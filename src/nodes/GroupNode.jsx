import { useRef, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import useStore from '../store/useStore';
import { Icon } from '../components/Icons';
import './GroupNode.css';

function GroupNode({ id, data, selected }) {
  const updateNodeData       = useStore((s) => s.updateNodeData);
  const onNodesChange        = useStore((s) => s.onNodesChange);
  const toggleGroupCollapsed = useStore((s) => s.toggleGroupCollapsed);
  const duplicateNodes       = useStore((s) => s.duplicateNodes);
  const nodes                = useStore((s) => s.nodes);

  const collapsed = data.collapsed || false;
  const w         = data._width  || 320;
  const h         = data._height || 220;
  const label     = data.label   || 'Группа';
  const childIds  = data._childIds || [];
  const count = nodes.filter((n) => childIds.includes(n.id) && n.type !== 'group_frame').length;

  const startRef = useRef(null);
  const onResizeMouseDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    startRef.current = { mx: e.clientX, my: e.clientY, w, h };
    const onMove = (me) => {
      const dw = me.clientX - startRef.current.mx;
      const dh = me.clientY - startRef.current.my;
      updateNodeData(id, {
        _width:  Math.max(160, startRef.current.w + dw),
        _height: Math.max(80,  startRef.current.h + dh),
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [id, w, h, updateNodeData]);

  return (
    <div
      className={`group-node${selected ? ' group-node--selected' : ''}${collapsed ? ' group-node--collapsed' : ''}`}
      style={collapsed ? {} : { width: w, height: h }}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="in"
        isConnectable={false}
        className={`group-node__handle${collapsed ? '' : ' group-node__handle--hidden'}`}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="out"
        isConnectable={false}
        className={`group-node__handle${collapsed ? '' : ' group-node__handle--hidden'}`}
      />

      <div className="group-node__header">
        <span className="group-node__icon"><Icon name="frame" size={14} /></span>
        <span className="group-node__label">{label}</span>
        <button
          className="group-node__toggle-btn"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); toggleGroupCollapsed(id); }}
          title={collapsed ? 'Развернуть группу — показать блоки внутри' : 'Свернуть группу — скрыть блоки внутри'}
        >
          {collapsed ? 'Показать' : 'Скрыть'}
        </button>
        <button
          className="group-node__btn group-node__btn--dup"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); duplicateNodes([id]); }}
          title="Дублировать группу"
        ><Icon name="copy" size={13} /></button>
        <button
          className="group-node__btn group-node__btn--delete"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onNodesChange([{ type: 'remove', id }]); }}
          title="Удалить группу (блоки останутся на холсте)"
        ><Icon name="x" size={13} /></button>
      </div>

      {collapsed && (
        <div className="group-node__count">
          {count} блок{count === 1 ? '' : count < 5 ? 'а' : 'ов'}
        </div>
      )}

      {!collapsed && (
        <div
          className="group-node__resize"
          onMouseDown={onResizeMouseDown}
          title="Изменить размер группы"
        />
      )}
    </div>
  );
}

export default GroupNode;
