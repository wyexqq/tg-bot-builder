import { useMemo, useState, useEffect, useCallback } from 'react';
import useStore from '../store/useStore';
import './AnalyticsPanel.css';

export default function AnalyticsPanel() {
  const nodes          = useStore((s) => s.nodes);
  const edges          = useStore((s) => s.edges);
  const simStats       = useStore((s) => s.simStats);
  const resetSimStats  = useStore((s) => s.resetSimStats);
  const isRunning      = useStore((s) => s.isRunning);

  const stats = useMemo(() => {
    const active = nodes.filter((n) => !n.data?.disabled && n.type !== 'comment');
    const commands   = active.filter((n) => n.type === 'command');
    const handlers   = active.filter((n) => n.type === 'message_handler');
    const deepLinks  = active.filter((n) => n.type === 'deep_link');
    const conditions = active.filter((n) => n.type === 'condition');

    const connected = new Set([...edges.map((e) => e.source), ...edges.map((e) => e.target)]);
    const floating  = active.filter((n) => !connected.has(n.id) && !['command', 'message_handler', 'deep_link'].includes(n.type));

    let maxDepth = 0;
    const roots = active.filter((n) => ['command', 'message_handler', 'deep_link'].includes(n.type));
    const bfsVisited = new Set();
    const queue = roots.map((r) => ({ id: r.id, d: 0 }));
    while (queue.length) {
      const { id, d } = queue.shift();
      if (bfsVisited.has(id)) continue;
      bfsVisited.add(id);
      maxDepth = Math.max(maxDepth, d);
      for (const e of edges) {
        if (e.source === id) queue.push({ id: e.target, d: d + 1 });
      }
    }

    return { active: active.length, commands, handlers, deepLinks, conditions, floating, maxDepth };
  }, [nodes, edges]);

  const topCmds = Object.entries(simStats.commandsUsed)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);
  const maxCmdCount = topCmds[0]?.[1] ?? 1;

  const totalCond = (simStats.conditionResults.true || 0) + (simStats.conditionResults.false || 0);
  const trueRatio = totalCond > 0 ? Math.round((simStats.conditionResults.true || 0) / totalCond * 100) : 0;

  return (
    <div className="analytics">

      <div className="analytics__section">
        <div className="analytics__section-title">Флоу</div>
        <div className="analytics__grid4">
          <Stat val={stats.active} label="блоков" />
          <Stat val={edges.length} label="связей" />
          <Stat val={stats.commands.length + stats.handlers.length + stats.deepLinks.length} label="входов" />
          <Stat val={stats.maxDepth} label="глубина" />
        </div>
      </div>

      {stats.commands.length > 0 && (
        <div className="analytics__section">
          <div className="analytics__section-title">Команды ({stats.commands.length})</div>
          {stats.commands.map((n) => (
            <div key={n.id} className="analytics__tag analytics__tag--cmd">
              {n.data?.command_name || '/…'}
            </div>
          ))}
        </div>
      )}

      {stats.handlers.length > 0 && (
        <div className="analytics__section">
          <div className="analytics__section-title">Обработчики ({stats.handlers.length})</div>
          {stats.handlers.map((n) => (
            <div key={n.id} className="analytics__tag analytics__tag--handler">
              {n.data?.filter_type === 'any' ? 'любое сообщение'
                : `${n.data?.filter_type}: "${n.data?.filter_value || '…'}"`}
            </div>
          ))}
        </div>
      )}

      {stats.conditions.length > 0 && (
        <div className="analytics__section">
          <div className="analytics__section-title">Условия ({stats.conditions.length})</div>
          {stats.conditions.map((n) => (
            <div key={n.id} className="analytics__tag analytics__tag--condition">
              {n.data?.condition_expression || '?'}
            </div>
          ))}
        </div>
      )}

      {stats.floating.length > 0 && (
        <div className="analytics__section">
          <div className="analytics__section-title analytics__section-title--warn">
            ⚠ Не подключено ({stats.floating.length})
          </div>
          {stats.floating.map((n) => (
            <div key={n.id} className="analytics__tag analytics__tag--warn">
              {n.type} · #{n.id.slice(-6)}
            </div>
          ))}
        </div>
      )}

      <div className="analytics__section">
        <div className="analytics__section-title">
          Симулятор
          <button className="analytics__reset-btn" onClick={resetSimStats} title="Сбросить">↺</button>
        </div>
        <div className="analytics__grid4">
          <Stat val={simStats.messagesSent} label="сообщений" />
          <Stat val={Object.values(simStats.commandsUsed).reduce((a, b) => a + b, 0)} label="команд" />
          <Stat val={totalCond} label="условий" />
          <Stat val={totalCond > 0 ? `${trueRatio}%` : '—'} label="true" accent />
        </div>

        {topCmds.length > 0 && (
          <div className="analytics__cmd-list">
            {topCmds.map(([cmd, cnt]) => (
              <div key={cmd} className="analytics__cmd-row">
                <span className="analytics__cmd-name">/{cmd}</span>
                <div className="analytics__cmd-track">
                  <div className="analytics__cmd-fill" style={{ width: `${(cnt / maxCmdCount) * 100}%` }} />
                </div>
                <span className="analytics__cmd-cnt">{cnt}</span>
              </div>
            ))}
          </div>
        )}

        {totalCond > 0 && (
          <div className="analytics__cond-bar-wrap">
            <div className="analytics__cond-bar">
              <div className="analytics__cond-true" style={{ width: `${trueRatio}%` }} />
            </div>
            <div className="analytics__cond-labels">
              <span style={{ color: '#3fb950' }}>✓ true {simStats.conditionResults.true || 0}</span>
              <span style={{ color: '#f85149' }}>✗ false {simStats.conditionResults.false || 0}</span>
            </div>
          </div>
        )}
      </div>

      <ChatHistory isRunning={isRunning} />

    </div>
  );
}

function ChatHistory({ isRunning }) {
  const [messages, setMessages]   = useState([]);
  const [activeUid, setActiveUid] = useState(null);

  const load = useCallback(async () => {
    const result = await window.electron?.ipcRenderer.invoke('get-chat-history', { limit: 1000 });
    if (result?.success) setMessages(result.messages);
  }, []);

  useEffect(() => {
    load();
    if (!isRunning) return;
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [isRunning, load]);

  const users = useMemo(() => {
    const map = new Map();
    for (const m of messages) {
      if (!map.has(m.uid)) {
        map.set(m.uid, { uid: m.uid, fn: m.fn, ln: m.ln, un: m.un, msgs: [] });
      }
      map.get(m.uid).msgs.push(m);
    }
    return [...map.values()].sort((a, b) => {
      const lastA = a.msgs.at(-1)?.ts || '';
      const lastB = b.msgs.at(-1)?.ts || '';
      return lastB.localeCompare(lastA);
    });
  }, [messages]);

  const activeUser = users.find((u) => u.uid === activeUid);

  const clearHistory = async () => {
    await window.electron?.ipcRenderer.invoke('clear-chat-history');
    setMessages([]);
    setActiveUid(null);
  };

  return (
    <div className="analytics__section analytics__section--chats">
      <div className="analytics__section-title">
        Чаты Telegram
        {users.length > 0 && <span className="analytics__chat-count">{users.length}</span>}
        {isRunning && <span className="analytics__live-dot" title="Обновляется в реальном времени" />}
        {messages.length > 0 && (
          <button className="analytics__reset-btn" onClick={clearHistory} title="Очистить историю">↺</button>
        )}
      </div>

      {messages.length === 0 ? (
        <div className="analytics__chat-empty">
          {isRunning ? 'Ожидание сообщений…' : 'Запустите бота чтобы видеть чаты'}
        </div>
      ) : activeUser ? (
        <div className="analytics__chat-thread">
          <button className="analytics__chat-back" onClick={() => setActiveUid(null)}>
            ← {userName(activeUser)}
          </button>
          <div className="analytics__chat-msgs">
            {activeUser.msgs.map((m, i) => (
              <div key={i} className="analytics__chat-msg">
                <span className="analytics__chat-time">{fmtTime(m.ts)}</span>
                <span className="analytics__chat-txt">{m.txt}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="analytics__chat-users">
          {users.map((u) => (
            <button key={u.uid} className="analytics__chat-user" onClick={() => setActiveUid(u.uid)}>
              <div className="analytics__chat-avatar">{initials(u)}</div>
              <div className="analytics__chat-user-info">
                <div className="analytics__chat-user-name">{userName(u)}</div>
                <div className="analytics__chat-user-last">{u.msgs.at(-1)?.txt || ''}</div>
              </div>
              <span className="analytics__chat-user-cnt">{u.msgs.length}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function userName(u) {
  const name = [u.fn, u.ln].filter(Boolean).join(' ') || u.un || `#${u.uid}`;
  return name;
}

function initials(u) {
  if (u.fn) return u.fn[0].toUpperCase();
  if (u.un) return u.un[0].toUpperCase();
  return '?';
}

function fmtTime(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts + 'Z');
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function Stat({ val, label, accent }) {
  return (
    <div className="analytics__stat">
      <span className={`analytics__stat-val${accent ? ' analytics__stat-val--accent' : ''}`}>{val}</span>
      <span className="analytics__stat-label">{label}</span>
    </div>
  );
}
