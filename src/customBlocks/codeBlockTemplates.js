export function getNodeTemplate(blockName = 'MyBlock') {
  return `function Node({ data, selected, id, onDuplicate, onDelete, nodeColor, defaultIcon }) {
  const color = nodeColor || '#6366f1';
  const text  = data.text || '...';

  return (
    <div>
      <div className="base-node__header">
        <span className="base-node__glyph">{data.icon || defaultIcon || '🧩'}</span>
        <span className="base-node__title">{data.label || '${blockName}'}</span>
        <button className="base-node__duplicate" onMouseDown={(e) => e.stopPropagation()} onClick={onDuplicate} title="Дублировать">+</button>
        <button className="base-node__delete" onMouseDown={(e) => e.stopPropagation()} onClick={onDelete} title="Удалить">×</button>
      </div>
      <div className="base-node__body">{text}</div>
    </div>
  );
}

export default Node;
`;
}

export function getInspectorTemplate() {
  return `function Inspector({ nodeId, data, onChange }) {
  return (
    <div>
      <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Текст</label>
      <input
        value={data.text || ''}
        onChange={(e) => onChange({ text: e.target.value })}
        style={{ width: '100%', fontSize: 12, boxSizing: 'border-box' }}
      />
    </div>
  );
}

export default Inspector;
`;
}

export function getStylesTemplate(blockName = 'MyBlock') {
  const prefix = blockName.toLowerCase().replace(/\s+/g, '-');
  return `.cb-${prefix} {
  background: #1e2030;
  border-radius: 10px;
  padding: 10px 16px;
  min-width: 140px;
}
`;
}

export function getGeneratorTemplate() {
  return `export function generate(node, context) {
  const { id, data } = node;
  const text = data.text || '';
  return \`result_\${id} = my_function(\${JSON.stringify(text)})\`;
}
`;
}

export function getParserTemplate() {
  return `export function parse(line, context) {
  const m = line.match(/^result_(\w+)\s*=\s*my_function\((.+)\)$/);
  if (!m) return { matched: false };
  return { matched: true, nodeId: m[1], data: { text: JSON.parse(m[2]) } };
}
`;
}

export function getDefinitionTemplate(blockName = 'MyBlock', color = '#6366f1') {
  return `export const definition = {
  name: '${blockName}',
  icon: '🧩',
  color: '${color}',
  category: 'Мои блоки',
  description: 'Кастомный блок',
  handles: [
    { id: 'in',  type: 'target', position: 'left',  label: 'Вход' },
    { id: 'out', type: 'source', position: 'right', label: 'Выход' },
  ],
};
`;
}

export function createDefaultFiles(blockName = 'MyBlock', color = '#6366f1') {
  return [
    { id: 'node',       name: 'Node.jsx',      content: getNodeTemplate(blockName) },
    { id: 'inspector',  name: 'Inspector.jsx',  content: getInspectorTemplate() },
    { id: 'styles',     name: 'styles.css',     content: getStylesTemplate(blockName) },
    { id: 'generator',  name: 'generator.js',   content: getGeneratorTemplate() },
    { id: 'parser',     name: 'parser.js',      content: getParserTemplate() },
    { id: 'definition', name: 'definition.js',  content: getDefinitionTemplate(blockName, color) },
  ];
}
