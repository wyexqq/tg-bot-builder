import { useEffect, useState, useCallback } from 'react';
import useStore from '../store/useStore';

export default function WorkspacePanel() {
  const explorerFolder    = useStore((s) => s.explorerFolder);
  const setExplorerFolder = useStore((s) => s.setExplorerFolder);
  const setLeftView       = useStore((s) => s.setLeftView);

  const [folders, setFolders] = useState([]);
  const [recent,  setRecent]  = useState([]);

  const ipc = window.electron?.ipcRenderer;

  const refresh = useCallback(async () => {
    if (!ipc) return;
    const cfg = await ipc.invoke('workspace:list');
    setFolders(cfg?.folders || []);
    setRecent(cfg?.recent || []);
  }, [ipc]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!explorerFolder || !ipc) return;
    if (recent[0] === explorerFolder) return;
    refresh();
  }, [explorerFolder]); // eslint-disable-line

  const addFolder = async () => {
    const res = await ipc.invoke('workspace:add-folder');
    if (res?.ok) {
      setFolders(res.folders || []);
      setRecent(res.recent || []);
      switchTo(res.folder);
    }
  };

  const removeFolder = async (folder) => {
    if (!confirm(`Убрать ${folder} из workspace?`)) return;
    const res = await ipc.invoke('workspace:remove', folder);
    setFolders(res.folders || []);
    setRecent(res.recent || []);
  };

  const switchTo = async (folder) => {
    setExplorerFolder(folder);
    setLeftView('explorer');
  };

  const baseName = (p) => p.split(/[\\/]/).filter(Boolean).pop() || p;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="sidebar-section-title">WORKSPACE FOLDERS</div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 4 }}>
        {folders.length === 0 && (
          <div style={{ padding: 12, color: 'var(--c-text-3)', fontSize: 12 }}>
            Нет папок. Добавьте, чтобы переключаться между проектами.
          </div>
        )}

        {folders.map((f) => {
          const active = f === explorerFolder;
          return (
            <div key={f}
                 style={{
                   padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 6,
                   borderRadius: 3, cursor: 'pointer',
                   background: active ? 'var(--c-surface-3)' : 'transparent',
                   borderLeft: active ? '2px solid var(--c-accent)' : '2px solid transparent',
                 }}
                 onClick={() => switchTo(f)}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
                             whiteSpace: 'nowrap', fontSize: 12, color: 'var(--c-text)' }}>
                <strong>{baseName(f)}</strong>
                <span style={{ color: 'var(--c-text-3)', fontSize: 10, display: 'block' }}>
                  {f}
                </span>
              </span>
              <button onClick={(e) => { e.stopPropagation(); removeFolder(f); }}
                      title="Убрать"
                      style={{
                        width: 18, height: 18, padding: 0, border: 'none',
                        background: 'transparent', color: 'var(--c-text-3)',
                        cursor: 'pointer', fontSize: 12, borderRadius: 2,
                      }}>×</button>
            </div>
          );
        })}
      </div>

      <div style={{ padding: 8, borderTop: '1px solid var(--c-border)' }}>
        <button className="settings-btn" onClick={addFolder}>+ Добавить папку</button>
      </div>

      {recent.length > 0 && (
        <>
          <div className="sidebar-section-title" style={{ borderTop: '1px solid var(--c-border)' }}>
            RECENT
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 200, padding: 4 }}>
            {recent.slice(0, 10).map((f) => (
              <div key={f}
                   onClick={() => switchTo(f)}
                   style={{
                     padding: '4px 8px', cursor: 'pointer', fontSize: 11,
                     color: 'var(--c-text-2)',
                     overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                   }}
                   title={f}>
                {baseName(f)} <span style={{ color: 'var(--c-text-3)' }}>· {f}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
