import useCustomBlockStore from './customBlockStore';

function pyIdent(s) {
  return String(s).replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
}

export function genCustomBlockCall(node, depth) {
  const ind = '    '.repeat(depth);
  const def = useCustomBlockStore.getState().getBlockDef(node.data._customBlockId);
  if (!def) return [`${ind}pass  # unknown custom block`];

  const funcName = `_cb_${pyIdent(node.id)}`;

  const kwargs = [];
  for (const prop of def.properties) {
    const val = node.data[prop.key];
    if (val !== undefined && val !== '') {
      if (prop.type === 'number') {
        kwargs.push(`${prop.key}=${val}`);
      } else if (prop.type === 'toggle') {
        kwargs.push(`${prop.key}=${val ? 'True' : 'False'}`);
      } else {
        const escaped = String(val).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
        kwargs.push(`${prop.key}="${escaped}"`);
      }
    }
  }

  const vars = def.code.available_vars || [];
  const callArgs = [...vars, ...kwargs].join(', ');

  return [`${ind}await ${funcName}(${callArgs})`];
}

export function genCustomBlockFunction(node) {
  const def = useCustomBlockStore.getState().getBlockDef(node.data._customBlockId);
  if (!def) return [];

  const funcName = `_cb_${pyIdent(node.id)}`;
  let code = def.code.main || '';

  code = code.replace(/\{block_id\}/g, funcName);

  for (const prop of def.properties) {
    const val = node.data[prop.key] ?? prop.default ?? '';
    code = code.replace(new RegExp(`\\{${prop.key}\\}`, 'g'), String(val));
  }

  const lines = code.split('\n');

  return [
    `# --- CUSTOM_BLOCK: ${node.data._customBlockId} | ${node.id} ---`,
    ...lines,
    `# --- END_CUSTOM_BLOCK: ${node.id} ---`,
    '',
  ];
}

export function collectCustomImports(nodes) {
  const importSet = new Set();
  const store = useCustomBlockStore.getState();

  for (const node of nodes) {
    if (node.type !== 'custom_block') continue;
    const def = store.getBlockDef(node.data._customBlockId);
    if (!def || !def.code.imports) continue;
    for (const line of def.code.imports.split('\n')) {
      const trimmed = line.trim();
      if (trimmed) importSet.add(trimmed);
    }
  }

  return [...importSet];
}

export function collectCustomInjects(nodes) {
  const store = useCustomBlockStore.getState();
  const injectMap = new Map();

  for (const node of nodes) {
    if (node.type !== 'custom_block') continue;
    const def = store.getBlockDef(node.data._customBlockId);
    if (!def) continue;

    for (const inj of (def.code.injects || [])) {
      if (!inj.target || !inj.code) continue;
      if (!injectMap.has(inj.target)) {
        injectMap.set(inj.target, { start: [], end: [] });
      }
      const bucket = injectMap.get(inj.target);
      const lines = inj.code.split('\n').filter((l) => l.trim());

      const funcName = `_cb_${pyIdent(node.id)}`;
      const processed = lines.map((line) => {
        let l = line.replace(/\{block_id\}/g, funcName);
        for (const prop of def.properties) {
          const val = node.data[prop.key] ?? prop.default ?? '';
          l = l.replace(new RegExp(`\\{${prop.key}\\}`, 'g'), String(val));
        }
        return l;
      });

      if (inj.position === 'start') {
        bucket.start.push(...processed);
      } else {
        bucket.end.push(...processed);
      }
    }
  }

  return injectMap;
}

export function applyInjects(outLines, injectMap) {
  if (!injectMap || injectMap.size === 0) return outLines;

  const result = [...outLines];

  for (const [funcName, { start, end }] of injectMap) {
    const funcPattern = new RegExp(`^(async\\s+)?def\\s+${funcName}\\s*\\(`);
    let funcLineIdx = -1;

    for (let i = 0; i < result.length; i++) {
      if (funcPattern.test(result[i].trim())) {
        funcLineIdx = i;
        break;
      }
    }

    if (funcLineIdx === -1) {
      if (start.length || end.length) {
        result.push('');
        result.push(`async def ${funcName}():`);
        for (const line of start) result.push(`    ${line}`);
        for (const line of end)   result.push(`    ${line}`);
        if (!start.length && !end.length) result.push('    pass');
        result.push('');
      }
      continue;
    }

    const bodyIndent = '    ';
    let bodyStart = funcLineIdx + 1;
    while (bodyStart < result.length && result[bodyStart].trim() === '') bodyStart++;

    let bodyEnd = bodyStart;
    while (bodyEnd < result.length) {
      const line = result[bodyEnd];
      if (line.trim() === '') { bodyEnd++; continue; }
      if (line.startsWith(bodyIndent) || line.trim().startsWith('#')) {
        bodyEnd++;
      } else {
        break;
      }
    }

    if (end.length) {
      const endLines = end.map((l) => `    ${l}`);
      result.splice(bodyEnd, 0, ...endLines);
    }

    if (start.length) {
      const startLines = start.map((l) => `    ${l}`);
      result.splice(bodyStart, 0, ...startLines);
    }
  }

  return result;
}
