import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import useStore from '../store/useStore';
import './EditorTabs.css';

const EXT_COLOR = {
  py: '#4ec9b0', js: '#e5c07b', ts: '#519aba', json: '#cbcb41',
  md: '#7ec8e3', txt: '#abb2bf', env: '#e06c75', css: '#6196cc',
  html: '#e06c75', sql: '#55b4d4', csv: '#89d185',
};

function fileColor(name) {
  const ext = name.split('.').pop().toLowerCase();
  return EXT_COLOR[ext] ?? '#abb2bf';
}

function relativePath(filePath, folderPath) {
  if (!folderPath) return filePath.split(/[/\\]/).pop();
  const norm = (p) => p.replace(/\\/g, '/');
  const base = norm(folderPath).replace(/\/$/, '');
  const fp   = norm(filePath);
  if (fp.startsWith(base + '/')) return fp.slice(base.length + 1);
  return filePath.split(/[/\\]/).pop();
}

function TabGhost({ x, y, w, h, tab }) {
  return ReactDOM.createPortal(
    <div className="etab-ghost" style={{ left: x, top: y, width: w, height: h }}>
      {tab.isGenerated
        ? <span className="etab-icon etab-icon--py" />
        : <span className="etab-icon" style={{ background: fileColor(tab.name) }} />
      }
      <span className="etab-name">{tab.name}</span>
    </div>,
    document.body
  );
}

export default function EditorTabs() {
  const openFiles      = useStore((s) => s.explorerOpenFiles);
  const activeFile     = useStore((s) => s.explorerActiveFile);
  const setActive      = useStore((s) => s.setExplorerActiveFile);
  const closeFile      = useStore((s) => s.closeExplorerFile);
  const reorderFiles   = useStore((s) => s.reorderExplorerFiles);
  const explorerFolder = useStore((s) => s.explorerFolder);

  const tabsBarRef = useRef(null);
  const activeRef  = useRef(null);

  const [botTabIdx, setBotTabIdx] = useState(0);

  const clampedBotIdx = Math.min(botTabIdx, openFiles.length);

  const BOT_TAB = useMemo(() => ({ path: null, name: 'bot.py', isGenerated: true }), []);

  const allTabs = useMemo(() => {
    const result = [...openFiles];
    result.splice(clampedBotIdx, 0, BOT_TAB);
    return result;
  }, [openFiles, clampedBotIdx, BOT_TAB]);

  const allTabsRef = useRef(allTabs);
  allTabsRef.current = allTabs;

  const hasBotPyCollision = openFiles.some((f) => f.name === 'bot.py');

  const [tabDrag,     setTabDrag]  = useState(null);
  const pendingRef    = useRef(null);
  const isDraggingRef = useRef(false);
  const tabDragToRef  = useRef(null);

  useEffect(() => {
    if (activeRef.current && tabsBarRef.current) {
      activeRef.current.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    }
  }, [activeFile, clampedBotIdx]);

  const commitReorder = useCallback((fromDisplay, toDisplay) => {
    const tabs = allTabsRef.current;

    const newOrder = [...tabs];
    const [moved]  = newOrder.splice(fromDisplay, 1);
    newOrder.splice(toDisplay, 0, moved);

    const newBotIdx = newOrder.findIndex((t) => t.isGenerated);
    setBotTabIdx(newBotIdx);

    if (!moved.isGenerated) {
      const oldFileOrder = tabs.filter((t) => !t.isGenerated);
      const newFileOrder = newOrder.filter((t) => !t.isGenerated);
      const oldIdx = oldFileOrder.findIndex((t) => t.path === moved.path);
      const newIdx = newFileOrder.findIndex((t) => t.path === moved.path);
      if (oldIdx !== newIdx) reorderFiles(oldIdx, newIdx);
    }
  }, [reorderFiles]);

  const onTabMouseDown = useCallback((e, displayIdx) => {
    if (e.button === 1) {
      const tab = allTabsRef.current[displayIdx];
      if (tab && !tab.isGenerated) { e.preventDefault(); closeFile(tab.path); }
      return;
    }
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    if (!tabsBarRef.current) return;
    const tabEls       = [...tabsBarRef.current.querySelectorAll('[data-tab-didx]')];
    const rects        = tabEls.map((el) => el.getBoundingClientRect());
    const containerRect = tabsBarRef.current.getBoundingClientRect();

    pendingRef.current    = { displayIdx, startX: e.clientX, rects, containerRect };
    isDraggingRef.current = false;
    tabDragToRef.current  = displayIdx;

    document.body.style.userSelect = 'none';

    const onMove = (me) => {
      const pd = pendingRef.current;
      if (!pd) return;

      if (!isDraggingRef.current) {
        if (Math.abs(me.clientX - pd.startX) < 5) return;
        isDraggingRef.current = true;
        document.body.style.cursor = 'grabbing';
        const rect = pd.rects[pd.displayIdx];
        const tab  = allTabsRef.current[pd.displayIdx];

        let initGhostX = rect.left + (me.clientX - pd.startX);
        if (pd.containerRect) {
          initGhostX = Math.max(
            pd.containerRect.left,
            Math.min(pd.containerRect.right - rect.width, initGhostX)
          );
        }

        setTabDrag({
          fromIndex: pd.displayIdx,
          toIndex:   pd.displayIdx,
          ghostX:    initGhostX,
          ghostY:    rect.top,
          ghostW:    rect.width,
          ghostH:    rect.height,
          rects:     pd.rects,
          tab:       tab ?? { name: '', isGenerated: false },
        });
        return;
      }

      setTabDrag((d) => {
        if (!d) return null;
        const rect = pd.rects[pd.displayIdx];

        let ghostX = rect.left + (me.clientX - pd.startX);
        if (pd.containerRect) {
          ghostX = Math.max(
            pd.containerRect.left,
            Math.min(pd.containerRect.right - rect.width, ghostX)
          );
        }

        let newTo = pd.displayIdx;
        for (let i = 0; i < pd.rects.length; i++) {
          if (i === pd.displayIdx) continue;
          const mid = (pd.rects[i].left + pd.rects[i].right) / 2;
          if (i > pd.displayIdx && me.clientX > mid) newTo = i;
          else if (i < pd.displayIdx && me.clientX < mid) newTo = i;
        }
        newTo = Math.max(0, Math.min(pd.rects.length - 1, newTo));
        tabDragToRef.current = newTo;
        return { ...d, toIndex: newTo, ghostX };
      });
    };

    const onUp = () => {
      const pd         = pendingRef.current;
      const wasDragging = isDraggingRef.current;

      pendingRef.current    = null;
      isDraggingRef.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor     = '';

      if (!wasDragging) {
        const tab = allTabsRef.current[pd?.displayIdx];
        if (tab) {
          if (tab.isGenerated) setActive(null);
          else setActive(tab.path);
        }
      } else {
        const from = pd?.displayIdx ?? 0;
        const to   = tabDragToRef.current ?? from;
        setTabDrag(null);
        if (to !== from) commitReorder(from, to);
      }

      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [closeFile, setActive, commitReorder]);

  const getTabStyle = useCallback((displayIdx) => {
    if (!tabDrag) return {};
    const { fromIndex, toIndex, rects } = tabDrag;

    if (displayIdx === fromIndex) return { opacity: 0, pointerEvents: 'none' };

    const itemW = rects[fromIndex]?.width ?? 120;
    const gap   = rects.length > 1
      ? Math.max(0, rects[Math.min(1, rects.length - 1)].left - rects[0].right)
      : 0;
    const step = itemW + gap;

    let shift = 0;
    if (fromIndex < toIndex && displayIdx > fromIndex && displayIdx <= toIndex) shift = -step;
    if (fromIndex > toIndex && displayIdx < fromIndex && displayIdx >= toIndex) shift = +step;

    return {
      transform:  shift ? `translateX(${shift}px)` : 'none',
      transition: 'transform 0.13s cubic-bezier(.25,.46,.45,.94)',
    };
  }, [tabDrag]);

  return (
    <div className="editor-tabs" ref={tabsBarRef}>
      {allTabs.map((tab, displayIdx) => {
        const isActive = tab.isGenerated ? !activeFile : activeFile === tab.path;
        const style    = getTabStyle(displayIdx);

        if (tab.isGenerated) {
          return (
            <div
              key="__generated__"
              data-tab-didx={displayIdx}
              ref={isActive ? activeRef : null}
              className={`etab${isActive ? ' etab--active' : ''}`}
              style={style}
              onMouseDown={(e) => onTabMouseDown(e, displayIdx)}
              title="Код бота — генерируется из схемы (нельзя закрыть)"
            >
              <span className="etab-icon etab-icon--py" />
              <span className="etab-name">
                {hasBotPyCollision ? 'bot.py (generated)' : 'bot.py'}
              </span>
              <span className="etab-badge">⚡</span>
            </div>
          );
        }

        const displayName = tab.name === 'bot.py' && hasBotPyCollision
          ? relativePath(tab.path, explorerFolder)
          : tab.name;

        return (
          <div
            key={tab.path}
            data-tab-didx={displayIdx}
            ref={isActive ? activeRef : null}
            className={`etab${isActive ? ' etab--active' : ''}`}
            style={style}
            onMouseDown={(e) => onTabMouseDown(e, displayIdx)}
            title={tab.path}
          >
            <span className="etab-icon" style={{ background: fileColor(tab.name) }} />
            <span className="etab-name">{displayName}</span>
            {tab.modified && <span className="etab-modified" title="Несохранённые изменения">●</span>}
            <button
              className="etab-close"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); closeFile(tab.path); }}
              tabIndex={-1}
              title="Закрыть (Ctrl+W)"
              aria-label="Закрыть вкладку"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <path d="M6.4 5l3.3-3.3L8.3.3 5 3.6 1.7.3.3 1.7 3.6 5 .3 8.3l1.4 1.4L5 6.4l3.3 3.3 1.4-1.4z"/>
              </svg>
            </button>
          </div>
        );
      })}

      {tabDrag && (
        <TabGhost
          x={tabDrag.ghostX}
          y={tabDrag.ghostY}
          w={tabDrag.ghostW}
          h={tabDrag.ghostH}
          tab={tabDrag.tab}
        />
      )}
    </div>
  );
}
