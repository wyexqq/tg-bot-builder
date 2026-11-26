import { useEffect } from 'react';
import { Handle, Position, useStore, useUpdateNodeInternals } from 'reactflow';
import BaseNode from './BaseNode';
import { BLOCK_DEFS } from '../blockDefinitions';

function groupByRowBreak(buttons) {
  const rows = [];
  let cur = [];
  for (let i = 0; i < buttons.length; i++) {
    cur.push({ btn: buttons[i], idx: i });
    if (buttons[i].row_break && i < buttons.length - 1) {
      rows.push(cur);
      cur = [];
    }
  }
  if (cur.length) rows.push(cur);
  return rows;
}

function EditMessageNode({ id, data, selected, isConnectable }) {
  const def = BLOCK_DEFS.edit_message;
  const buttons = data.edit_markup ? (data.buttons ?? []) : [];
  const preview = data.edit_text !== false ? (data.new_text || '').slice(0, 400) : '';
  const tag = data.edit_text === false ? (data.edit_markup ? 'только кнопки' : null) : null;

  const updateNodeInternals = useUpdateNodeInternals();
  const edges = useStore((s) => s.edges);
  const nodeInternals = useStore((s) => s.nodeInternals);
  const myNode = nodeInternals.get(id);
  const myX = myNode?.position?.x ?? 0;

  function getHandleSide(btnIdx) {
    const edge = edges.find((e) => e.source === id && e.sourceHandle === `btn_${btnIdx}`);
    if (!edge) return Position.Right;
    const target = nodeInternals.get(edge.target);
    if (!target) return Position.Right;
    return target.position.x < myX ? Position.Left : Position.Right;
  }

  const sidesKey = buttons.map((_, i) => getHandleSide(i)).join(',');
  useEffect(() => { updateNodeInternals(id); }, [sidesKey, id]); // eslint-disable-line

  const rows = groupByRowBreak(buttons);

  return (
    <BaseNode nodeId={id} icon={def.icon} label={def.label} selected={selected} preview={preview} tag={tag}>
      <Handle type="target" position={Position.Top} id="in" isConnectable={isConnectable} />

      {buttons.length > 0 && (
        <div className="btn-preview-list">
          {rows.map((row, ri) => (
            <div key={ri} className="btn-preview-row-group">
              {row.map(({ btn, idx }) => {
                const side = getHandleSide(idx);
                return (
                  <div key={idx} className="btn-preview-row">
                    <span className="btn-preview-text">{btn.text}</span>
                    <Handle
                      type="source"
                      position={side}
                      id={`btn_${idx}`}
                      isConnectable={isConnectable}
                      style={{
                        '--node-color': def.color,
                        position: 'absolute',
                        top: '50%',
                        [side === Position.Left ? 'left' : 'right']: '-7px',
                        transform: 'translateY(-50%)',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </BaseNode>
  );
}

export default EditMessageNode;
