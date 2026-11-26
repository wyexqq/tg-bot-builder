import { Handle, Position } from 'reactflow';
import BaseNode from '../nodes/BaseNode';
import useCustomBlockStore from './customBlockStore';

const POS_MAP = {
  top:    Position.Top,
  bottom: Position.Bottom,
  left:   Position.Left,
  right:  Position.Right,
};

function CustomBlockNode({ id, data, selected, isConnectable }) {
  const getBlockDef = useCustomBlockStore((s) => s.getBlockDef);
  const def = getBlockDef(data._customBlockId);

  if (!def) {
    return (
      <BaseNode nodeId={id} icon="?" label="Unknown Block" selected={selected} preview="Block definition missing">
        <Handle type="target" position={Position.Top} id="in" isConnectable={isConnectable} />
      </BaseNode>
    );
  }

  let preview = def.preview_template || '';
  if (preview) {
    for (const prop of def.properties) {
      const val = data[prop.key] ?? prop.default ?? '';
      preview = preview.replace(new RegExp(`\\{${prop.key}\\}`, 'g'), String(val));
    }
    if (preview.length > 50) preview = preview.slice(0, 50) + '...';
  }

  const sources = def.handles.filter((h) => h.type === 'source');
  const targets = def.handles.filter((h) => h.type === 'target');

  const computeOffset = (arr, idx) => {
    const count = arr.length;
    if (count <= 1) return '50%';
    const step = 80 / (count - 1);
    return `${10 + step * idx}%`;
  };

  const hasOutputLabels = sources.some((h) => h.label);

  return (
    <BaseNode
      nodeId={id}
      icon={def.icon}
      label={def.name}
      selected={selected}
      preview={preview || undefined}
    >
      {targets.map((h, i) => {
        const isVertical = h.position === 'top' || h.position === 'bottom';
        const offset = isVertical
          ? { left: computeOffset(targets.filter((t) => t.position === h.position), targets.filter((t) => t.position === h.position).indexOf(h)) }
          : { top: computeOffset(targets.filter((t) => t.position === h.position), targets.filter((t) => t.position === h.position).indexOf(h)) };

        return (
          <Handle
            key={h.id}
            type="target"
            position={POS_MAP[h.position] || Position.Top}
            id={h.id}
            isConnectable={isConnectable}
            style={{ '--node-color': def.color, ...offset }}
          />
        );
      })}

      {hasOutputLabels && (
        <div className="condition-footer" style={{ display: 'flex', justifyContent: 'space-around', fontSize: 10, opacity: 0.7 }}>
          {sources.map((h) => (
            <span key={h.id} style={{ flex: 1, textAlign: 'center' }}>{h.label}</span>
          ))}
        </div>
      )}

      {sources.map((h, i) => {
        const samePos = sources.filter((s) => s.position === h.position);
        const idxInPos = samePos.indexOf(h);
        const isVertical = h.position === 'top' || h.position === 'bottom';
        const offset = isVertical
          ? { left: computeOffset(samePos, idxInPos) }
          : { top: computeOffset(samePos, idxInPos) };

        return (
          <Handle
            key={h.id}
            type="source"
            position={POS_MAP[h.position] || Position.Bottom}
            id={h.id}
            isConnectable={isConnectable}
            style={{ '--node-color': def.color, ...offset }}
          />
        );
      })}
    </BaseNode>
  );
}

export default CustomBlockNode;
