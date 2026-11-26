import * as Babel from '@babel/standalone';
import React from 'react';
import * as ReactFlowLib from 'reactflow';
import { Handle, Position } from 'reactflow';
import useStore from '../store/useStore';


function convertESMtoCommonJS(code) {
  let transformed = code;
  const namedExports = [];

  const origExportRe = /^\s*export\s+(?:const|let|var|function|async\s+function)\s+(\w+)/mg;
  let m;
  while ((m = origExportRe.exec(code)) !== null) {
    namedExports.push(m[1]);
  }

  transformed = transformed.replace(/^\s*export\s+default\s+/mg, 'module.exports.default = ');

  transformed = transformed.replace(/^\s*export\s+(const|let|var)\s+/mg, '$1 ');

  transformed = transformed.replace(/^\s*export\s+(async\s+)?function\s+/mg, '$1function ');

  if (namedExports.length > 0) {
    transformed += '\n' + namedExports.map((n) => `module.exports.${n} = ${n};`).join('\n');
  }

  transformed = transformed.replace(/^\s*export\s*\{[^}]*\}\s*;?/mg, '');

  return transformed;
}


function transformJSX(code, filename = 'file.jsx') {
  const result = Babel.transform(code, {
    presets: ['react'],
    filename,
  });
  return convertESMtoCommonJS(result.code);
}

function transformESM(code, filename = 'file.js') {
  return convertESMtoCommonJS(code);
}


function execModule(code, globals = {}) {
  const module = { exports: {} };
  const exports = module.exports;
  // eslint-disable-next-line no-new-func
  const fn = new Function(
    'React', 'Handle', 'Position', 'ReactFlow',
    'module', 'exports',
    ...Object.keys(globals),
    code
  );
  fn(
    React, Handle, Position, ReactFlowLib,
    module, exports,
    ...Object.values(globals)
  );
  return module.exports;
}


function compileFile(file) {
  const { name, content } = file;
  const isJSX = name.endsWith('.jsx');
  const isJS  = name.endsWith('.js') && !isJSX;
  const isCSS = name.endsWith('.css');

  if (isCSS) return { ok: true, result: content };

  try {
    let code = isJSX ? transformJSX(content, name) : transformESM(content, name);
    code = code.replace(/^"use strict";\s*/m, '');
    const mod = execModule(code);
    return { ok: true, result: mod };
  } catch (err) {
    return { ok: false, error: `${name}: ${err.message}` };
  }
}


export function compileCodeBlock(files) {
  const errors = [];
  const components = {};

  const fileMap = Object.fromEntries(files.map((f) => [f.id, f]));

  const defFile = fileMap['definition'];
  if (!defFile) {
    errors.push('definition.js: файл не найден');
  } else {
    const r = compileFile(defFile);
    if (!r.ok) errors.push(r.error);
    else if (!r.result?.definition) errors.push('definition.js: не экспортирован `definition`');
    else components.definition = r.result.definition;
  }

  const nodeFile = fileMap['node'];
  if (!nodeFile) {
    errors.push('Node.jsx: файл не найден');
  } else {
    const r = compileFile(nodeFile);
    if (!r.ok) errors.push(r.error);
    else {
      const NodeComponent = r.result?.default || r.result;
      if (typeof NodeComponent !== 'function') errors.push('Node.jsx: нет default-экспорта (React-компонент)');
      else components.NodeComponent = NodeComponent;
    }
  }

  const inspFile = fileMap['inspector'];
  if (inspFile) {
    const r = compileFile(inspFile);
    if (!r.ok) errors.push(r.error);
    else {
      const InspComponent = r.result?.default || r.result;
      if (typeof InspComponent === 'function') components.InspectorComponent = InspComponent;
    }
  }

  const genFile = fileMap['generator'];
  if (genFile) {
    const r = compileFile(genFile);
    if (!r.ok) errors.push(r.error);
    else if (typeof r.result?.generate === 'function') components.generatorFn = r.result.generate;
  }

  const parseFile = fileMap['parser'];
  if (parseFile) {
    const r = compileFile(parseFile);
    if (!r.ok) errors.push(r.error);
    else if (typeof r.result?.parse === 'function') components.parserFn = r.result.parse;
  }

  const cssFile = fileMap['styles'];
  if (cssFile) {
    components.css = cssFile.content;
  }

  return {
    valid: errors.length === 0,
    errors,
    components,
  };
}


const injectedStyles = new Map();

export function injectBlockCSS(defId, css) {
  const old = injectedStyles.get(defId);
  if (old) old.remove();
  if (!css) return;

  const el = document.createElement('style');
  el.setAttribute('data-codeblock', defId);
  el.textContent = css;
  document.head.appendChild(el);
  injectedStyles.set(defId, el);
}

export function removeBlockCSS(defId) {
  const el = injectedStyles.get(defId);
  if (el) { el.remove(); injectedStyles.delete(defId); }
}


export function wrapNodeComponent(NodeComponent, definition) {
  const handles = definition?.handles || [];
  const color   = definition?.color   || '#6366f1';
  const icon    = definition?.icon    || '🧩';
  const name    = definition?.name    || 'Блок';

  function WrappedNode(props) {
    const { data, selected, id } = props;

    const onNodesChange  = useStore((s) => s.onNodesChange);
    const duplicateNodes = useStore((s) => s.duplicateNodes);

    const onDuplicate = React.useCallback(
      (e) => { e?.stopPropagation(); duplicateNodes([id]); },
      [id, duplicateNodes]
    );
    const onDelete = React.useCallback(
      (e) => { e?.stopPropagation(); onNodesChange([{ type: 'remove', id }]); },
      [id, onNodesChange]
    );

    const nodeColor = data.color || color;

    return React.createElement(
      'div',
      {
        className: `base-node${selected ? ' base-node--selected' : ''}`,
        style: { '--node-color': nodeColor, '--g': nodeColor },
      },
      ...handles.map((h) =>
        React.createElement(Handle, {
          key: h.id,
          type: h.type,
          position: Position[capitalize(h.position)] ?? Position.Left,
          id: h.id,
          style: { '--node-color': nodeColor, ...(h.style || {}) },
          title: h.label,
        })
      ),
      React.createElement(NodeComponent, {
        data, selected, id,
        onDuplicate, onDelete,
        icon, nodeColor,
        defaultIcon: icon,
        defaultColor: nodeColor,
      })
    );
  }

  WrappedNode.displayName = `CodeBlock_${name}`;
  return WrappedNode;
}

function capitalize(str) {
  return str ? str[0].toUpperCase() + str.slice(1) : str;
}
