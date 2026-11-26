export function matchCustomBlockCall(line) {
  const m = line.match(/^await\s+(_cb_\w+)\((.*)?\)$/);
  if (!m) return null;

  const funcName = m[1];
  const nodeId = funcName.replace(/^_cb_/, '');
  const argsStr = m[2] || '';

  const kwargs = {};
  const kwRe = /(\w+)\s*=\s*(?:"([^"\\]*(?:\\.[^"\\]*)*)"|(\d+(?:\.\d+)?)|(\w+))/g;
  let km;
  while ((km = kwRe.exec(argsStr))) {
    const key = km[1];
    if (['message', 'bot', 'state', 'db', 'config', 'dp'].includes(key)) continue;
    if (km[2] !== undefined) {
      kwargs[key] = km[2].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
    } else if (km[3] !== undefined) {
      kwargs[key] = Number(km[3]);
    } else if (km[4] !== undefined) {
      kwargs[key] = km[4] === 'True' ? true : km[4] === 'False' ? false : km[4];
    }
  }

  return { funcName, nodeId, kwargs };
}

export function matchCustomBlockStart(line) {
  const m = line.match(/^# --- CUSTOM_BLOCK:\s*([^\s|]+)\s*\|\s*([^\s]+)\s*---$/);
  if (!m) return null;
  return { defId: m[1].trim(), nodeId: m[2].trim() };
}

export function matchCustomBlockEnd(line) {
  const m = line.match(/^# --- END_CUSTOM_BLOCK:\s*([^\s]+)\s*---$/);
  return m ? m[1].trim() : null;
}

export function skipCustomBlockDef(lines, startI) {
  let i = startI + 1;
  while (i < lines.length) {
    if (matchCustomBlockEnd(lines[i].trim())) return i + 1;
    i++;
  }
  return i;
}
