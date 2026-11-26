import { useState, useRef, useEffect } from 'react';
import { PANEL_META } from '../dockLayout';
import useStore from '../store/useStore';

export default function DockArea({
  slot, panelIds, activeId,
  onSetActive, onMovePanel,
  children,
}) {
  const [dropHint, setDropHint] = useState(null);
  const dragRef = useRef(null);
  const lang = useStore((s) => s.lang);

  if (panelIds.length === 0) return null;

  const titleOf = (id) => {
    const m = PANEL_META[id];
    if (!m) return id;
    return lang === 'en' ? (m.titleEn || m.title) : m.title;
  };

  const handleDragStart = (e, panelId) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-panel-id', panelId);
    e.dataTransfer.setData('text/plain', panelId);
    dragRef.current = panelId;
  };

  const handleDragOver = (e, idx) => {
    const id = dragRef.current
            || e.dataTransfer.types.includes('application/x-panel-id') ? 'unknown' : null;
    if (!id) return;
    const draggedId = dragRef.current;
    if (draggedId && PANEL_META[draggedId]) {
      const allowed = PANEL_META[draggedId].allowedSlots;
      if (!allowed.includes(slot)) return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropHint(idx);
  };

  const handleDragLeave = () => setDropHint(null);

  const handleDrop = (e, idx) => {
    e.preventDefault();
    const panelId = e.dataTransfer.getData('application/x-panel-id') || dragRef.current;
    if (!panelId || !PANEL_META[panelId]) { setDropHint(null); return; }
    const allowed = PANEL_META[panelId].allowedSlots;
    if (!allowed.includes(slot)) { setDropHint(null); return; }
    onMovePanel(panelId, slot, idx);
    setDropHint(null);
    dragRef.current = null;
  };

  const handleBodyDrop = (e) => {
    if (!dragRef.current && !e.dataTransfer.types.includes('application/x-panel-id')) return;
    e.preventDefault();
    const panelId = e.dataTransfer.getData('application/x-panel-id') || dragRef.current;
    if (!panelId) return;
    const allowed = PANEL_META[panelId]?.allowedSlots || [];
    if (!allowed.includes(slot)) return;
    onMovePanel(panelId, slot, panelIds.length);
    dragRef.current = null;
  };

  const handleBodyDragOver = (e) => {
    if (e.dataTransfer.types.includes('application/x-panel-id')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  };

  return (
    <div className={`dock-area dock-area--${slot}`}
         onDragOver={handleBodyDragOver}
         onDrop={handleBodyDrop}>
      <div className="dock-tabs">
        {panelIds.map((id, idx) => {
          const meta = PANEL_META[id];
          if (!meta) return null;
          const isActive = id === activeId;
          return (
            <div key={id}
                 className={`dock-tab${isActive ? ' active' : ''}${dropHint === idx ? ' drop-before' : ''}`}
                 draggable
                 onDragStart={(e) => handleDragStart(e, id)}
                 onDragEnd={() => { dragRef.current = null; setDropHint(null); }}
                 onDragOver={(e) => handleDragOver(e, idx)}
                 onDragLeave={handleDragLeave}
                 onDrop={(e) => handleDrop(e, idx)}
                 onClick={() => { onSetActive(id); }}
                 title={titleOf(id)}>
              <span className="dock-tab__label">{titleOf(id)}</span>
            </div>
          );
        })}
        <div className="dock-tabs-trail"
             onDragOver={(e) => handleDragOver(e, panelIds.length)}
             onDrop={(e) => handleDrop(e, panelIds.length)} />
      </div>

      {activeId && (
        <div className="dock-content">
          {children?.[activeId] || (
            <div style={{ padding: 16, color: 'var(--c-text-3)', fontSize: 12 }}>
              (panel "{activeId}" not registered)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
