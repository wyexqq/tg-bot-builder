import { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import './Breadcrumbs.css';

export default function Breadcrumbs() {
  const explorerFolder    = useStore((s) => s.explorerFolder);
  const explorerActiveFile = useStore((s) => s.explorerActiveFile);
  const explorerOpenFiles = useStore((s) => s.explorerOpenFiles);
  const cursor            = useStore((s) => s.editorCursor);

  const activeFile = explorerOpenFiles.find((f) => f.path === explorerActiveFile);
  const isFileMode = !!activeFile;

  const [symbol, setSymbol] = useState(null);
  useEffect(() => {
    if (!isFileMode || !cursor || !activeFile) { setSymbol(null); return; }
    const lines = activeFile.content.split('\n');
    const line = Math.min(cursor.line - 1, lines.length - 1);
    for (let i = line; i >= 0; i--) {
      const m = lines[i].match(/^(\s*)(?:async\s+)?(def|class)\s+(\w+)/);
      if (m) {
        const indent = m[1].length;
        if (i === line) { setSymbol({ name: m[3], kind: m[2] }); return; }
        const cursorLineText = lines[line];
        const cursorIndent = cursorLineText.match(/^(\s*)/)[1].length;
        if (cursorIndent > indent || cursorLineText.trim() === '') {
          setSymbol({ name: m[3], kind: m[2] });
          return;
        }
      }
    }
    setSymbol(null);
  }, [cursor, activeFile, isFileMode]);

  const items = [];
  if (isFileMode) {
    if (explorerFolder) {
      const folderName = explorerFolder.split(/[\\/]/).filter(Boolean).pop() || explorerFolder;
      items.push({ icon: '🗂', label: folderName, title: explorerFolder });
      const rel = activeFile.path.startsWith(explorerFolder)
        ? activeFile.path.slice(explorerFolder.length).replace(/^[\\/]/, '')
        : activeFile.path;
      const parts = rel.split(/[\\/]/);
      for (let i = 0; i < parts.length - 1; i++) {
        items.push({ icon: '📁', label: parts[i] });
      }
    }
    items.push({ icon: '📄', label: activeFile.name });
    if (symbol) {
      items.push({
        icon: symbol.kind === 'class' ? '◇' : 'ƒ',
        label: symbol.name,
        kind: 'symbol',
      });
    }
  } else {
    items.push({ icon: '⚡', label: 'bot.py (сгенерированный)', kind: 'generated' });
  }

  return (
    <div className="breadcrumbs">
      {items.map((it, idx) => (
        <span key={idx} className={`bc-item${it.kind ? ` bc-item--${it.kind}` : ''}`}
              title={it.title}>
          <span className="bc-icon">{it.icon}</span>
          <span className="bc-label">{it.label}</span>
          {idx < items.length - 1 && <span className="bc-sep">›</span>}
        </span>
      ))}
    </div>
  );
}
