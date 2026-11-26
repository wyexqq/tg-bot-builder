import { useState, useRef, useEffect } from 'react';
import useStore from '../store/useStore';
import { BlockIcon, Icon } from '../components/Icons';
import './CommentNode.css';

function CommentNode({ id, data, selected }) {
  const updateNodeData = useStore((s) => s.updateNodeData);
  const onNodesChange  = useStore((s) => s.onNodesChange);
  const duplicateNodes = useStore((s) => s.duplicateNodes);
  const [editing, setEditing] = useState(false);
  const taRef = useRef(null);

  useEffect(() => {
    if (editing && taRef.current) taRef.current.focus();
  }, [editing]);

  const bgColor   = data.color     || undefined;
  const textColor = data.textColor || undefined;

  return (
    <div
      className={`comment-node${selected ? ' comment-node--selected' : ''}${editing ? ' nodrag' : ''}`}
      style={bgColor ? { background: bgColor } : undefined}
      onDoubleClick={() => !editing && setEditing(true)}
    >
      <div className="comment-node__header">
        <BlockIcon type="comment" size={22} />
        <span className="comment-node__title">Заметка</span>
        <button
          className="comment-node__btn"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); duplicateNodes([id]); }}
          title="Дублировать"
        ><Icon name="copy" size={14} /></button>
        <button
          className="comment-node__btn comment-node__btn--danger"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onNodesChange([{ type: 'remove', id }]); }}
          title="Удалить"
        ><Icon name="trash" size={14} /></button>
      </div>

      {editing ? (
        <textarea
          ref={taRef}
          className="comment-node__textarea"
          value={data.text || ''}
          style={textColor ? { color: textColor } : undefined}
          onChange={(e) => updateNodeData(id, { text: e.target.value })}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); e.stopPropagation(); }}
          onClick={(e) => e.stopPropagation()}
          placeholder="Введите заметку..."
        />
      ) : (
        <div className="comment-node__text" style={textColor ? { color: textColor } : undefined}>
          {data.text
            ? data.text
            : <span className="comment-node__placeholder">Двойной клик для редактирования…</span>
          }
        </div>
      )}
    </div>
  );
}

export default CommentNode;
