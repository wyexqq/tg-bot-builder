import { useEffect, useRef, useState, useCallback } from 'react';
import SearchPanel from './SearchPanel';
import './SearchModal.css';

export default function SearchModal({ onClose }) {
  const boxRef = useRef(null);
  const [pos, setPos] = useState(null);
  const dragRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const clamp = useCallback((x, y) => {
    const el = boxRef.current;
    const w = el?.offsetWidth ?? 480;
    const h = el?.offsetHeight ?? 420;
    return {
      x: Math.max(0, Math.min(window.innerWidth - w, x)),
      y: Math.max(0, Math.min(window.innerHeight - h, y)),
    };
  }, []);

  const onHeaderDown = (e) => {
    if (e.button !== 0) return;
    const rect = boxRef.current.getBoundingClientRect();
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    document.body.style.userSelect = 'none';
    const onMove = (me) => {
      if (!dragRef.current) return;
      setPos(clamp(me.clientX - dragRef.current.dx, me.clientY - dragRef.current.dy));
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const style = pos
    ? { left: pos.x, top: pos.y, transform: 'none' }
    : undefined;

  return (
    <div className="search-modal-backdrop" onMouseDown={onClose}>
      <div
        ref={boxRef}
        className="search-modal"
        style={style}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="search-modal__head" onMouseDown={onHeaderDown}>
          <span className="search-modal__title">Поиск по проекту</span>
          <button className="search-modal__close" onMouseDown={(e) => e.stopPropagation()} onClick={onClose}>×</button>
        </div>
        <div className="search-modal__body">
          <SearchPanel onNavigate={onClose} />
        </div>
      </div>
    </div>
  );
}
