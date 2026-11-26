import { useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import { useT } from '../i18n';
import { Icon } from './Icons';
import './ContextMenu.css';

function ContextMenu({ x, y, nodeId, nodeType, disabled, onDelete, onDuplicate, onToggleDisabled, onClose }) {
  const ref = useRef(null);
  const T   = useT();

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    window.addEventListener('mousedown', handler, true);
    return () => window.removeEventListener('mousedown', handler, true);
  }, [onClose]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const item = (icon, label, action, cls = '') => (
    <button
      className={`ctx-item${cls ? ` ${cls}` : ''}`}
      onMouseDown={(e) => { e.stopPropagation(); action(); onClose(); }}
    >
      <span className="ctx-icon"><Icon name={icon} size={15} /></span>
      <span>{label}</span>
    </button>
  );

  return (
    <div
      ref={ref}
      className="ctx-menu"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {item('copy', T('ctx.duplicate'), onDuplicate)}
      {nodeType !== 'comment' && item(disabled ? 'play' : 'pause', disabled ? T('ctx.enable') : T('ctx.disable'), onToggleDisabled)}
      <div className="ctx-sep" />
      {item('trash', T('ctx.delete'), onDelete, 'ctx-item--danger')}
    </div>
  );
}

export default ContextMenu;
