import { useState, useEffect, useRef, useCallback } from 'react';
import useStore from '../store/useStore';
import { getFlowInstance } from '../flowInstance';
import { BLOCK_DEFS } from '../blockDefinitions';
import './SearchPanel.css';

function getNodeSearchText(node) {
  const data = node.data ?? {};
  return [
    BLOCK_DEFS[node.type]?.label ?? node.type,
    data.label ?? '',
    data.text ?? '',
    data.command ?? '',
    data.variable ?? '',
    data.condition ?? '',
    data.url ?? '',
    data.message ?? '',
    data.query ?? '',
    data.sheet ?? '',
  ].join(' ');
}

function getNodePreview(node) {
  const data = node.data ?? {};
  if (data.command) return `/${data.command}`;
  if (data.text)    return data.text.slice(0, 80);
  if (data.variable) return data.variable;
  if (data.condition) return data.condition;
  if (data.url)     return data.url;
  if (data.message) return data.message.slice(0, 80);
  return BLOCK_DEFS[node.type]?.label ?? node.type;
}

function highlightMatch(text, query) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function SearchPanel({ onNavigate }) {
  const [query,      setQuery]      = useState('');
  const [results,    setResults]    = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex,   setUseRegex]   = useState(false);
  const inputRef = useRef(null);

  const nodes             = useStore((s) => s.nodes);
  const code              = useStore((s) => s.code);
  const explorerFolder    = useStore((s) => s.explorerFolder);
  const explorerOpenFiles = useStore((s) => s.explorerOpenFiles);
  const setSelectedNodeId = useStore((s) => s.setSelectedNodeId);
  const onNodesChange     = useStore((s) => s.onNodesChange);
  const openExplorerFile  = useStore((s) => s.openExplorerFile);
  const setLeftView       = useStore((s) => s.setLeftView);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const performSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults(null); return; }
    setIsSearching(true);

    let regex;
    try {
      regex = useRegex
        ? new RegExp(q, caseSensitive ? 'g' : 'gi')
        : new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi');
    } catch {
      setIsSearching(false);
      setResults({ error: 'Некорректное регулярное выражение', canvasResults: [], codeResults: [], fileResults: [] });
      return;
    }

    const testStr = (s) => { regex.lastIndex = 0; return regex.test(s); };

    const canvasResults = [];
    for (const node of nodes) {
      const searchable = getNodeSearchText(node);
      if (testStr(searchable)) {
        canvasResults.push({
          id:      node.id,
          type:    node.type,
          label:   BLOCK_DEFS[node.type]?.label ?? node.type,
          preview: getNodePreview(node),
          color:   BLOCK_DEFS[node.type]?.color ?? '#64748b',
        });
      }
    }

    const codeResults = [];
    const codeLines = code.split('\n');
    for (let i = 0; i < codeLines.length; i++) {
      regex.lastIndex = 0;
      if (regex.test(codeLines[i])) {
        codeResults.push({ line: i + 1, text: codeLines[i].trim(), filePath: null });
      }
    }

    const fileResults = [];
    for (const file of explorerOpenFiles) {
      const lines = (file.content ?? '').split('\n');
      for (let i = 0; i < lines.length; i++) {
        regex.lastIndex = 0;
        if (regex.test(lines[i])) {
          fileResults.push({
            filePath:  file.path,
            fileName:  file.name,
            line:      i + 1,
            text:      lines[i].trim().slice(0, 200),
            language:  file.language,
            fromDisk:  false,
          });
        }
      }
    }

    if (explorerFolder && window.electron) {
      try {
        const res = await window.electron.ipcRenderer.invoke('fs:search-files', {
          folderPath:   explorerFolder,
          query:        q,
          excludePaths: explorerOpenFiles.map((f) => f.path),
        });
        if (res?.ok && res.results) {
          for (const r of res.results) {
            fileResults.push({ ...r, fromDisk: true });
          }
        }
      } catch { }
    }

    setResults({ canvasResults, codeResults, fileResults });
    setIsSearching(false);
  }, [nodes, code, explorerFolder, explorerOpenFiles, caseSensitive, useRegex]);

  useEffect(() => {
    if (!query.trim()) { setResults(null); return; }
    const t = setTimeout(() => performSearch(query), 250);
    return () => clearTimeout(t);
  }, [query, performSearch]);

  const goToNode = (nodeId) => {
    setSelectedNodeId(nodeId);
    onNodesChange(useStore.getState().nodes.map((n) => ({
      type: 'select', id: n.id, selected: n.id === nodeId,
    })));
    const rf = getFlowInstance();
    if (rf) {
      const rfNode = rf.getNodes().find((n) => n.id === nodeId);
      if (rfNode) rf.fitView({ nodes: [rfNode], padding: 0.35, duration: 300 });
    }
    onNavigate?.();
  };

  const goToCodeLine = (line) => {
    window.dispatchEvent(new CustomEvent('monaco-goto-line', { detail: { line } }));
    onNavigate?.();
  };

  const goToFile = async (filePath, fileName, line, language) => {
    const existing = explorerOpenFiles.find((f) => f.path === filePath);
    if (!existing) {
      const res = await window.electron?.ipcRenderer.invoke('fs:read-file', filePath);
      if (res?.ok) {
        openExplorerFile({ path: filePath, name: fileName, content: res.content, modified: false, language });
      }
    } else {
      useStore.getState().setExplorerActiveFile(filePath);
    }
    setLeftView('explorer');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('monaco-goto-line', { detail: { line, filePath } }));
    }, 120);
    onNavigate?.();
  };

  const total = results
    ? results.canvasResults.length + results.codeResults.length + results.fileResults.length
    : 0;

  return (
    <div className="search-panel">
      <div className="search-panel-header">
        <span className="sidebar-section-title">Поиск</span>
        <span className="search-shortcut-hint">Ctrl+Shift+F</span>
      </div>

      <div className="search-input-wrap">
        <svg className="search-input-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          ref={inputRef}
          className="search-input"
          placeholder="Поиск по проекту..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setQuery(''); setResults(null); }
          }}
          spellCheck={false}
        />
        {query && (
          <button className="search-clear-btn" onClick={() => { setQuery(''); setResults(null); inputRef.current?.focus(); }}>×</button>
        )}
      </div>

      <div className="search-options">
        <button
          className={`search-opt-btn${caseSensitive ? ' active' : ''}`}
          onClick={() => setCaseSensitive((v) => !v)}
          title="С учётом регистра"
        >Aa</button>
        <button
          className={`search-opt-btn${useRegex ? ' active' : ''}`}
          onClick={() => setUseRegex((v) => !v)}
          title="Регулярное выражение"
        >.*</button>
        {query && results && !isSearching && (
          <span className="search-count">{total} совпад.</span>
        )}
      </div>

      {isSearching && (
        <div className="search-status">
          <span className="search-spinner" />
          Поиск...
        </div>
      )}

      {results?.error && (
        <div className="search-error">{results.error}</div>
      )}

      {results && !isSearching && !results.error && (
        <div className="search-results">
          {total === 0 && (
            <div className="search-no-results">
              Ничего не найдено для&nbsp;<strong>{query}</strong>
            </div>
          )}

          {results.canvasResults.length > 0 && (
            <SearchGroup title="Блок-схема" count={results.canvasResults.length}>
              {results.canvasResults.map((r) => (
                <div key={r.id} className="search-result-item" onClick={() => goToNode(r.id)}>
                  <span className="search-result-dot" style={{ background: r.color }} />
                  <div className="search-result-body">
                    <div className="search-result-name">{highlightMatch(r.label, query)}</div>
                    <div className="search-result-preview">{highlightMatch(r.preview, query)}</div>
                  </div>
                </div>
              ))}
            </SearchGroup>
          )}

          {results.codeResults.length > 0 && (
            <SearchGroup title="Код бота" count={results.codeResults.length} limit={50}>
              {results.codeResults.slice(0, 50).map((r, i) => (
                <div key={i} className="search-result-item" onClick={() => goToCodeLine(r.line)}>
                  <span className="search-result-line">:{r.line}</span>
                  <span className="search-result-code">{highlightMatch(r.text, query)}</span>
                </div>
              ))}
              {results.codeResults.length > 50 && (
                <div className="search-result-more">+{results.codeResults.length - 50} строк скрыто</div>
              )}
            </SearchGroup>
          )}

          {results.fileResults.length > 0 && (
            <SearchGroup title="Файлы проекта" count={results.fileResults.length} limit={100}>
              {results.fileResults.slice(0, 100).map((r, i) => (
                <div key={i} className="search-result-item" onClick={() => goToFile(r.filePath, r.fileName, r.line, r.language)}>
                  <div className="search-result-body">
                    <div className="search-result-name">
                      {r.fileName}
                      <span className="search-result-line-num">:{r.line}</span>
                    </div>
                    <div className="search-result-preview">{highlightMatch(r.text, query)}</div>
                  </div>
                </div>
              ))}
              {results.fileResults.length > 100 && (
                <div className="search-result-more">+{results.fileResults.length - 100} результатов скрыто</div>
              )}
            </SearchGroup>
          )}
        </div>
      )}

      {!query && !results && (
        <div className="search-empty-hint">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <p>Введите запрос для поиска по блокам, коду и файлам проекта</p>
        </div>
      )}
    </div>
  );
}

function SearchGroup({ title, count, children }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="search-group">
      <button className="search-group-header" onClick={() => setCollapsed((v) => !v)}>
        <svg className={`search-group-arrow${collapsed ? '' : ' open'}`} viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        <span className="search-group-title">{title}</span>
        <span className="search-group-count">{count}</span>
      </button>
      {!collapsed && <div className="search-group-items">{children}</div>}
    </div>
  );
}
