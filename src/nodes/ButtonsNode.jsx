import { useEffect } from 'react';
import { Handle, Position, useStore, useUpdateNodeInternals } from 'reactflow';
import BaseNode from './BaseNode';
import { BLOCK_DEFS } from '../blockDefinitions';
import './ButtonsNode.css';

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

function ButtonsNode({ id, data, selected, isConnectable }) {
  const def = BLOCK_DEFS.buttons;
  const buttons = data.buttons ?? [];
  const count = buttons.length;
  const attach = data.button_type !== 'reply' && data.attach_to_previous;
  const dynamic = data.button_type !== 'reply' && !!data.dynamic_enabled;
  const preview = dynamic
    ? `Из списка ${data.dynamic_source || '…'}`
    : (data.message_text || `${count} ${pluralBtn(count)}`) + (attach ? ' · к предыдущему' : '');

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
  useEffect(() => {
    updateNodeInternals(id);
  }, [sidesKey, id]); // eslint-disable-line

  const rows = groupByRowBreak(buttons);

  return (
    <BaseNode nodeId={id} color={def.color} icon={def.icon} label={def.label} selected={selected} preview={preview}
              tag={data.button_type === 'reply' ? 'Reply' : 'Inline'}>
      <Handle type="target" position={Position.Top} id="in" isConnectable={isConnectable} style={{ '--node-color': def.color }} />

      {dynamic && (
        <div className="btn-preview-list">
          <div className="btn-preview-row">
            <span className="btn-preview-text btn-preview-text--dynamic">{data.dynamic_text_expr || 'str(item)'} …</span>
            <Handle
              type="source"
              position={Position.Right}
              id="btn_dynamic"
              isConnectable={isConnectable}
              style={{ position: 'absolute', top: '50%', right: '-15px', transform: 'translateY(-50%)' }}
            />
          </div>
        </div>
      )}

      {!dynamic && count > 0 && (
        <div className="btn-preview-list">
          {rows.map((row, ri) => (
            <div key={ri} className="btn-preview-row-group">
              {row.map(({ btn, idx }) => {
                const side = getHandleSide(idx);
                return (
                  <div key={idx} className="btn-preview-row">
                    <span className={`btn-preview-text${btn.style ? ` btn-preview-text--${btn.style}` : ''}`}>{btn.text || '—'}</span>
                    <Handle
                      type="source"
                      position={side}
                      id={`btn_${idx}`}
                      isConnectable={isConnectable}
                      style={{
                        '--node-color': def.color,
                        position: 'absolute',
                        top: '50%',
                        [side === Position.Left ? 'left' : 'right']: '-15px',
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

function pluralBtn(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'кнопка';
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'кнопки';
  return 'кнопок';
}

export default ButtonsNode;
