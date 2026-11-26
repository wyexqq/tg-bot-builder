import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import useStore from '../store/useStore';
import './FileExplorer.css';


const EXT_META = {
  py:   { label: 'py',  color: '#4ec9b0' },
  js:   { label: 'js',  color: '#e5c07b' },
  ts:   { label: 'ts',  color: '#519aba' },
  json: { label: '{}',  color: '#cbcb41' },
  md:   { label: '#',   color: '#7ec8e3' },
  txt:  { label: '≡',   color: '#abb2bf' },
  env:  { label: 'env', color: '#e06c75' },
  css:  { label: 'css', color: '#6196cc' },
  html: { label: 'html',color: '#e06c75' },
  sql:  { label: 'sql', color: '#55b4d4' },
  csv:  { label: 'csv', color: '#89d185' },
};

function getFileMeta(name) {
  const ext = name.split('.').pop().toLowerCase();
  return EXT_META[ext] ?? { label: '◉', color: '#abb2bf' };
}

function getLanguage(name) {
  const ext = name.split('.').pop().toLowerCase();
  const map = {
    py: 'python', js: 'javascript', ts: 'typescript',
    json: 'json', md: 'markdown', html: 'html',
    css: 'css', sql: 'sql',
  };
  return map[ext] ?? 'plaintext';
}

function getSep(p) { return p.includes('\\') ? '\\' : '/'; }

function joinPath(base, name) {
  const sep = getSep(base);
  return base.replace(new RegExp(`[${sep}]+$`), '') + sep + name;
}

function dirName(p) {
  const sep = getSep(p);
  const idx = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'));
  return idx >= 0 ? p.slice(0, idx) : p;
}


function IconNewFile() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
      <path d="M9.5 1.1l3.4 3.5.1.4v2h-1V6H8V2H3v11h4v1H2.5l-.5-.5v-12l.5-.5h6.7l.3.1zM9 2v3h2.9L9 2zM13 9h1v2h2v1h-2v2h-1v-2h-2v-1h2V9z"/>
    </svg>
  );
}

function IconNewFolder() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
      <path d="M14.5 3H7.71l-.85-.85L6.51 2h-5l-.5.5v11l.5.5h13l.5-.5v-10L14.5 3zm-.5 10H2V3h4.29l.86.85.35.15H14v9zM8 10h2v2h1v-2h2V9h-2V7h-1v2H8v1z"/>
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M13.451 5.609l-.956-.kjø M5 4.5A4.5 4.5 0 0 1 9.5 0C11.98 0 14.12 1.53 15 3.69V1h1v5h-5V5h3.22A4.5 4.5 0 1 0 9.5 13H9v1h.5A5.5 5.5 0 1 1 5 4.5z"/>
    </svg>
  );
}

function IconRefreshSimple() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M1 1v5h1.5L4 4.5A5.5 5.5 0 1 1 3.27 8H2.26A6.5 6.5 0 1 0 4.5 3.5L3 5H1z"/>
    </svg>
  );
}

function IconCollapseAll() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M9 9H4v1h5V9zM9 4H4v1h5V4zm3 3H4v1h8V7zm0 5H4v1h8v-1zm0-8H4v1h8V4z"/>
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M6 4l4 4-4 4V4z"/>
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 6l4 4 4-4H4z"/>
    </svg>
  );
}

function FolderIcon({ open }) {
  return open ? (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ color: '#dcb67a', flexShrink: 0 }}>
      <path d="M1.5 3h5l1 1H14l.5.5v8l-.5.5h-13l-.5-.5v-9l.5-.5zm12 5.5V5H7.5L6.5 4H2v4.5l.5.5h10.5l.5-.5z" opacity=".6"/>
      <path d="M1.5 8.5h13v4H1.5z" opacity=".8"/>
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ color: '#dcb67a', flexShrink: 0 }}>
      <path d="M1.5 3h5l1 1H14l.5.5v9l-.5.5h-13l-.5-.5v-9L1.5 3zm12 9V5H7.5L6.5 4H2v8h11.5z"/>
    </svg>
  );
}


function computeVisible(items, expanded, childMap, creatingIn, depth = 0) {
  const result = [];
  for (const item of items) {
    result.push({ ...item, depth });
    if (item.type === 'folder' && expanded.has(item.path)) {
      if (creatingIn?.parentPath === item.path) {
        result.push({ _creating: true, depth: depth + 1, type: creatingIn.type, parentPath: item.path });
      }
      const children = childMap[item.path] ?? [];
      result.push(...computeVisible(children, expanded, childMap, creatingIn, depth + 1));
    }
  }
  return result;
}


export default function FileExplorer() {
  const folderPath          = useStore((s) => s.explorerFolder);
  const setExplorerFolder   = useStore((s) => s.setExplorerFolder);
  const openExplorerFile    = useStore((s) => s.openExplorerFile);
  const renameExplorerFile  = useStore((s) => s.renameExplorerFile);
  const closeExplorerFile   = useStore((s) => s.closeExplorerFile);
  const closeFilesUnder     = useStore((s) => s.closeExplorerFilesUnder);
  const explorerOpenFiles      = useStore((s) => s.explorerOpenFiles);
  const setExplorerActive      = useStore((s) => s.setExplorerActiveFile);
  const explorerCreateTrigger  = useStore((s) => s.explorerCreateTrigger);

  const api = window.electron?.ipcRenderer;

  const [rootItems,    setRootItems]    = useState([]);
  const [expanded,     setExpanded]     = useState(new Set());
  const [childMap,     setChildMap]     = useState({});
  const [selectedItem, setSelectedItem] = useState(null);

  const [renamingPath, setRenamingPath] = useState(null);
  const [renameVal,    setRenameVal]    = useState('');
  const [renameOrig,   setRenameOrig]   = useState(null);
  const [creatingIn,   setCreatingIn]   = useState(null);
  const [createVal,    setCreateVal]    = useState('');

  const [ctxMenu, setCtxMenu] = useState(null);

  const refreshRef     = useRef(null);
  const startCreateRef = useRef(null);

  useEffect(() => {
    if (!explorerCreateTrigger || !folderPath) return;
    startCreateRef.current?.(explorerCreateTrigger.type);
  }, [explorerCreateTrigger, folderPath]); // eslint-disable-line

  const loadDir = useCallback(async (dirPath, isRoot) => {
    const items = await api?.invoke('fs:read-dir', dirPath);
    if (!items) return;
    if (isRoot) {
      setRootItems(items);
    } else {
      setChildMap((prev) => ({ ...prev, [dirPath]: items }));
    }
  }, [api]);

  const refresh = useCallback(() => {
    if (!folderPath) return;
    loadDir(folderPath, true);
    setExpanded((prev) => {
      prev.forEach((p) => { if (p !== folderPath) loadDir(p, false); });
      return prev;
    });
  }, [folderPath, loadDir]);

  refreshRef.current = refresh;

  useEffect(() => {
    if (!folderPath) { setRootItems([]); setExpanded(new Set()); setChildMap({}); return; }
    loadDir(folderPath, true);
    api?.invoke('fs:watch', folderPath);
  }, [folderPath]); // eslint-disable-line

  useEffect(() => {
    const handler = () => { refreshRef.current?.(); };
    const off = api?.on('fs:changed', handler);
    return () => { if (typeof off === 'function') off(); };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('click', close, { once: true });
  }, [ctxMenu]);

  const visibleItems = useMemo(
    () => computeVisible(rootItems, expanded, childMap, creatingIn),
    [rootItems, expanded, childMap, creatingIn]
  );

  const handleSelect = useCallback(async (item) => {
    setSelectedItem(item);
    setCtxMenu(null);
    if (item.type === 'folder') {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(item.path)) {
          next.delete(item.path);
        } else {
          next.add(item.path);
          loadDir(item.path, false);
        }
        return next;
      });
    } else {
      const already = explorerOpenFiles.find((f) => f.path === item.path);
      if (already) { setExplorerActive(item.path); return; }
      const res = await api?.invoke('fs:read-file', item.path);
      if (res?.ok) {
        openExplorerFile({
          path: item.path,
          name: item.name,
          content: res.content,
          modified: false,
          language: getLanguage(item.name),
        });
      }
    }
  }, [api, explorerOpenFiles, loadDir, openExplorerFile, setExplorerActive]);

  const handleContextMenu = useCallback((e, item) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedItem(item);
    setCtxMenu({ x: e.clientX, y: e.clientY, item });
  }, []);

  const startRename = useCallback((item) => {
    setCtxMenu(null);
    setRenameOrig(item);
    setRenamingPath(item.path);
    setRenameVal(item.name);
  }, []);

  const commitRename = useCallback(async () => {
    if (!renameOrig) { setRenamingPath(null); return; }
    const newName = renameVal.trim();
    if (!newName || newName === renameOrig.name) { setRenamingPath(null); setRenameOrig(null); return; }
    const newPath = joinPath(dirName(renameOrig.path), newName);
    const res = await api?.invoke('fs:rename', { oldPath: renameOrig.path, newPath });
    if (res?.ok) {
      renameExplorerFile(renameOrig.path, newPath, newName);
      refresh();
    }
    setRenamingPath(null);
    setRenameOrig(null);
  }, [api, renameOrig, renameVal, renameExplorerFile, refresh]);

  const onRenameKey = (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); commitRename(); }
    if (e.key === 'Escape') { setRenamingPath(null); setRenameOrig(null); }
  };

  const getCreateParent = useCallback(() => {
    if (!selectedItem) return folderPath;
    if (selectedItem.type === 'folder') return selectedItem.path;
    return dirName(selectedItem.path);
  }, [selectedItem, folderPath]);

  useEffect(() => {
    startCreateRef.current = (type) => {
      const parent = selectedItem?.type === 'folder'
        ? selectedItem.path
        : selectedItem
          ? dirName(selectedItem.path)
          : folderPath;
      startCreate(parent ?? folderPath, type);
    };
  });

  const startCreate = useCallback((parentPath, type) => {
    setCtxMenu(null);
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(parentPath);
      return next;
    });
    if (parentPath !== folderPath && !childMap[parentPath]) {
      loadDir(parentPath, false);
    }
    setCreatingIn({ parentPath, type });
    setCreateVal('');
  }, [childMap, folderPath, loadDir]);

  const commitCreate = useCallback(async () => {
    if (!creatingIn) return;
    const name = createVal.trim();
    if (!name) { setCreatingIn(null); return; }
    const newPath = joinPath(creatingIn.parentPath, name);
    const channel = creatingIn.type === 'file' ? 'fs:create-file' : 'fs:create-folder';
    const res = await api?.invoke(channel, newPath);
    if (res?.ok) {
      refresh();
      if (creatingIn.type === 'file') {
        openExplorerFile({ path: newPath, name, content: '', modified: false, language: getLanguage(name) });
      }
    }
    setCreatingIn(null);
  }, [api, creatingIn, createVal, openExplorerFile, refresh]);

  const onCreateKey = (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); commitCreate(); }
    if (e.key === 'Escape') { setCreatingIn(null); }
  };

  const handleDelete = useCallback(async (item) => {
    setCtxMenu(null);
    if (!window.confirm(`Удалить "${item.name}"?\nЭто действие нельзя отменить.`)) return;
    const res = await api?.invoke('fs:delete', item.path);
    if (res?.ok) {
      const sep = getSep(item.path);
      if (item.type === 'folder') {
        closeFilesUnder(item.path + sep);
      } else {
        closeExplorerFile(item.path);
      }
      if (selectedItem?.path === item.path) setSelectedItem(null);
      refresh();
    }
  }, [api, closeExplorerFile, closeFilesUnder, refresh, selectedItem]);

  const openFolder = async () => {
    const p = await api?.invoke('fs:open-folder');
    if (p) {
      setExplorerFolder(p);
      setExpanded(new Set());
      setChildMap({});
      setSelectedItem(null);
    }
  };

  const onTreeKeyDown = (e) => {
    if (!selectedItem) return;
    if (e.key === 'F2')     { e.preventDefault(); startRename(selectedItem); }
    if (e.key === 'Delete') { e.preventDefault(); handleDelete(selectedItem); }
    if (e.key === 'Enter' && selectedItem.type === 'file') handleSelect(selectedItem);
  };

  const CreatingRow = ({ depth }) => (
    <div className="tree-item tree-item--creating" style={{ paddingLeft: 8 + depth * 16 }}>
      <span className="tree-chevron" />
      <span className="tree-file-icon" style={{ color: '#abb2bf', fontSize: 11, width: 18 }}>
        {creatingIn?.type === 'folder' ? '📁' : '◉'}
      </span>
      <input
        className="tree-rename-input"
        value={createVal}
        autoFocus
        placeholder={creatingIn?.type === 'folder' ? 'folder_name' : 'file.py'}
        onChange={(e) => setCreateVal(e.target.value)}
        onKeyDown={onCreateKey}
        onBlur={commitCreate}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );

  const folderName = folderPath ? folderPath.split(/[/\\]/).pop() : '';

  const creatingInRoot = creatingIn?.parentPath === folderPath;

  return (
    <div className="file-explorer">
      <div className="explorer-header">
        <span className="explorer-title" title={folderPath ?? ''}>
          {folderPath ? folderName.toUpperCase() : 'ПРОВОДНИК'}
        </span>
        {folderPath && (
          <div className="explorer-actions">
            <button
              className="explorer-action-btn"
              title="Новый файл (в выбранной папке)"
              onClick={() => startCreate(getCreateParent(), 'file')}
            >
              <IconNewFile />
            </button>
            <button
              className="explorer-action-btn"
              title="Новая папка"
              onClick={() => startCreate(getCreateParent(), 'folder')}
            >
              <IconNewFolder />
            </button>
            <button
              className="explorer-action-btn"
              title="Обновить"
              onClick={refresh}
            >
              <IconRefreshSimple />
            </button>
            <button
              className="explorer-action-btn"
              title="Свернуть все папки"
              onClick={() => setExpanded(new Set())}
            >
              <IconCollapseAll />
            </button>
          </div>
        )}
      </div>

      {!folderPath ? (
        <div className="explorer-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="explorer-empty-icon">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <p className="explorer-empty-text">Папка не открыта</p>
          <button className="explorer-open-btn" onClick={openFolder}>
            Открыть папку
          </button>
          <p className="explorer-empty-hint">Откройте папку для просмотра файлов проекта</p>
        </div>
      ) : (
        <div
          className="explorer-tree"
          tabIndex={0}
          onKeyDown={onTreeKeyDown}
          onClick={() => setCtxMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, item: null }); }}
        >
          {creatingInRoot && <CreatingRow depth={0} />}

          {visibleItems.map((item, i) => {
            if (item._creating) {
              return <CreatingRow key={`creating-${i}`} depth={item.depth} />;
            }

            const isSelected = selectedItem?.path === item.path;
            const isExpand   = expanded.has(item.path);
            const isRenaming = renamingPath === item.path;
            const isOpen     = explorerOpenFiles.some((f) => f.path === item.path);
            const meta       = item.type === 'file' ? getFileMeta(item.name) : null;

            return (
              <div
                key={item.path}
                className={`tree-item${isSelected ? ' tree-item--selected' : ''}${isOpen ? ' tree-item--open' : ''}`}
                style={{ paddingLeft: 6 + item.depth * 16 }}
                onClick={(e) => { e.stopPropagation(); handleSelect(item); }}
                onContextMenu={(e) => handleContextMenu(e, item)}
                title={item.path}
              >
                <span className="tree-chevron">
                  {item.type === 'folder'
                    ? (isExpand ? <ChevronDown /> : <ChevronRight />)
                    : null}
                </span>

                {item.type === 'folder' ? (
                  <FolderIcon open={isExpand} />
                ) : (
                  <span className="tree-file-icon" style={{ color: meta.color }}>
                    {meta.label}
                  </span>
                )}

                {isRenaming ? (
                  <input
                    className="tree-rename-input"
                    value={renameVal}
                    autoFocus
                    onChange={(e) => setRenameVal(e.target.value)}
                    onKeyDown={onRenameKey}
                    onBlur={commitRename}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className={`tree-name${item.type === 'folder' ? ' tree-name--folder' : ''}`}>
                    {item.name}
                  </span>
                )}
              </div>
            );
          })}

          {folderPath && rootItems.length === 0 && !creatingInRoot && (
            <div className="explorer-tree-empty">Папка пуста</div>
          )}
        </div>
      )}

      {ctxMenu && (
        <div
          className="explorer-ctx-menu"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {(!ctxMenu.item || ctxMenu.item.type === 'folder') && (
            <>
              <button
                className="ctx-item"
                onClick={() => startCreate(ctxMenu.item ? ctxMenu.item.path : folderPath, 'file')}
              >
                <IconNewFile /> Новый файл
              </button>
              <button
                className="ctx-item"
                onClick={() => startCreate(ctxMenu.item ? ctxMenu.item.path : folderPath, 'folder')}
              >
                <IconNewFolder /> Новая папка
              </button>
            </>
          )}
          {ctxMenu.item && (
            <>
              {ctxMenu.item.type === 'folder' && <div className="ctx-sep" />}
              <button className="ctx-item" onClick={() => startRename(ctxMenu.item)}>
                Переименовать
              </button>
              <div className="ctx-sep" />
              <button className="ctx-item ctx-item--danger" onClick={() => handleDelete(ctxMenu.item)}>
                Удалить
              </button>
            </>
          )}
          {!ctxMenu.item && (
            <>
              <div className="ctx-sep" />
              <button className="ctx-item" onClick={refresh}>Обновить</button>
              <button className="ctx-item" onClick={openFolder}>Открыть другую папку...</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
