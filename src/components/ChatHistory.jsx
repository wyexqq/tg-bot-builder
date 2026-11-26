import { useState, useEffect, useRef, useCallback } from 'react';
import useStore from '../store/useStore';
import { useT } from '../i18n';
import './ChatHistory.css';

function ChatHistory() {
  const [messages, setMessages]   = useState([]);
  const [query,    setQuery]      = useState('');
  const isRunning                 = useStore((s) => s.isRunning);
  const panelConfig               = useStore((s) => s.panelConfig);
  const setPanelProp              = useStore((s) => s.setPanelProp);
  const startFloatDrag            = useStore((s) => s.startFloatDrag);
  const chatCfg                   = panelConfig.chat;
  const T                         = useT();
  const bottomRef                 = useRef(null);
  const intervalRef               = useRef(null);

  const load = useCallback(async () => {
    const res = await window.electron?.ipcRenderer.invoke('get-chat-history', { limit: 300 });
    if (res?.success) setMessages(res.messages || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    clearInterval(intervalRef.current);
    if (isRunning) {
      intervalRef.current = setInterval(load, 2500);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleClear = async () => {
    await window.electron?.ipcRenderer.invoke('clear-chat-history');
    setMessages([]);
  };

  const filtered = query.trim()
    ? messages.filter((m) =>
        (m.text || '').toLowerCase().includes(query.toLowerCase()) ||
        (m.username || '').toLowerCase().includes(query.toLowerCase()) ||
        (m.first_name || '').toLowerCase().includes(query.toLowerCase())
      )
    : messages;

  const onHeaderMouseDown = (e) => {
    if (e.button !== 0 || !chatCfg.floating) return;
    e.stopPropagation();
    startFloatDrag('chat', e.clientX, e.clientY);
  };

  const fmtTime = (ts) => {
    try {
      return new Date(ts).toLocaleString('ru-RU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return ts; }
  };

  return (
    <div className={`chat-history${chatCfg.fullscreen ? ' chat-history--fullscreen' : ''}`}>
      <div
        className="chat-history__header"
        onMouseDown={onHeaderMouseDown}
        style={chatCfg.floating ? { cursor: 'move' } : undefined}
      >
        <div className="chat-history__header-left">
          <span className="chat-history__title">{T('chat.title')}</span>
          {messages.length > 0 && (
            <span className="chat-history__count">{messages.length}</span>
          )}
          {isRunning && <span className="chat-history__live">● live</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="chat-history__clear-btn" onClick={handleClear}>{T('console.clear')}</button>
          <div className="panel-win-controls" style={{ marginLeft: 4 }}>
            <button
              className="panel-win-btn"
              onClick={() => setPanelProp('chat', 'floating', !chatCfg.floating)}
              title={chatCfg.floating ? T('panel.dock') : T('panel.undock')}
            >{chatCfg.floating ? '⊟' : '⊞'}</button>
            <button
              className="panel-win-btn panel-win-btn--close"
              onClick={() => setPanelProp('chat', 'visible', false)}
              title={T('panel.close')}
            >×</button>
          </div>
        </div>
      </div>

      <div className="chat-history__search-wrap">
        <input
          className="chat-history__search"
          placeholder={T('chat.searchFull')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
        />
        {query && (
          <button className="chat-history__search-clear" onClick={() => setQuery('')}>×</button>
        )}
      </div>

      <div className="chat-history__list">
        {filtered.length === 0 ? (
          <div className="chat-history__empty">
            {messages.length === 0
              ? T('chat.emptyRunning')
              : T('chat.noMatch')}
          </div>
        ) : (
          filtered.map((m, idx) => (
            <div key={idx} className="chat-history__item">
              <div className="chat-history__meta">
                <span className="chat-history__name">
                  {m.first_name || m.username || String(m.user_id)}
                </span>
                {m.username && (
                  <span className="chat-history__handle">@{m.username}</span>
                )}
                <span className="chat-history__id">{m.user_id}</span>
                <span className="chat-history__time">{fmtTime(m.ts)}</span>
              </div>
              <div className="chat-history__text">{m.text}</div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

export default ChatHistory;
