import { useMemo, useState } from 'react';
import useStore from '../store/useStore';
import RequestsPanel from './RequestsPanel';
import TerminalPanel from './TerminalPanel';
import { Icon } from './Icons';

const FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'msg', label: 'Сообщения' },
  { id: 'cb',  label: 'Кнопки' },
  { id: 'err', label: 'Ошибки' },
  { id: 'sys', label: 'Система' },
];

export default function BottomPanel({ active, onActive, collapsed, onToggleCollapsed }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery]   = useState('');
  const requests      = useStore((s) => s.requests);
  const logs          = useStore((s) => s.consoleLogs);
  const botStatus     = useStore((s) => s.botStatus);
  const followLive    = useStore((s) => s.followLive);
  const setFollowLive = useStore((s) => s.setFollowLive);
  const clearRequests = useStore((s) => s.clearRequests);

  const errCount = useMemo(
    () => requests.filter((r) => r.status === 'error' || r.status === 'unhandled').length
        + logs.filter((l) => l.type === 'error').length,
    [requests, logs],
  );
  const reqCount = requests.filter((r) => r.kind !== 'outgoing').length;

  const open = (id) => {
    if (collapsed) onToggleCollapsed();
    onActive(id);
  };

  return (
    <div className="bp">
      <div className="bp-head">
        <button className={`bp-tab${active === 'requests' ? ' on' : ''}`} onClick={() => open('requests')}>
          {botStatus === 'running' ? <span className="bp-live" title="Бот запущен" /> : <Icon name="activity" size={14} />}
          Запросы
          {reqCount > 0 && <span className="bp-cnt">{reqCount}</span>}
        </button>
        <button className={`bp-tab${active === 'terminal' ? ' on' : ''}`} onClick={() => open('terminal')}>
          <Icon name="terminal" size={14} />
          Терминал
        </button>

        {active === 'requests' && !collapsed && (
          <div className="bp-filters">
            {FILTERS.map((f) => (
              <button key={f.id} className={filter === f.id ? 'on' : ''} onClick={() => setFilter(f.id)}>
                {f.label}
                {f.id === 'err' && errCount > 0 && <span className="bp-cnt err">{errCount}</span>}
              </button>
            ))}
          </div>
        )}

        <span className="island-grow" />

        {active === 'requests' && !collapsed && (
          <>
            <label className="bp-search">
              <Icon name="search" size={13} stroke={2} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Пользователь, текст, метод…"
                spellCheck={false}
              />
              {query && (
                <button onClick={() => setQuery('')} title="Сбросить"><Icon name="x" size={12} stroke={2} /></button>
              )}
            </label>
            <button
              className={`ib2${followLive ? ' on' : ''}`}
              onClick={() => setFollowLive(!followLive)}
              title={followLive ? 'Следить за новыми запросами: вкл' : 'Следить за новыми запросами: выкл'}
            >
              <Icon name="arrowDown" size={15} />
            </button>
            <button className="ib2" onClick={clearRequests} title="Очистить">
              <Icon name="clear" size={15} />
            </button>
          </>
        )}
        <button className="ib2" onClick={onToggleCollapsed} title={collapsed ? 'Развернуть панель' : 'Свернуть панель'}>
          <Icon name={collapsed ? 'collapse' : 'expand'} size={15} />
        </button>
      </div>

      <div className="bp-body" style={collapsed ? { display: 'none' } : undefined}>
        <div className="bp-pane" style={active === 'requests' ? undefined : { display: 'none' }}>
          <RequestsPanel filter={filter} query={query} />
        </div>
        <div className="bp-pane bp-pane--term" style={active === 'terminal' ? undefined : { display: 'none' }}>
          <TerminalPanel />
        </div>
      </div>
    </div>
  );
}
