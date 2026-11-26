import { memo, useEffect, useMemo, useRef, useState } from 'react';
import useStore from '../store/useStore';
import { BLOCK_DEFS } from '../blockDefinitions';
import { getFlowInstance } from '../flowInstance';
import { BlockIcon, Icon } from './Icons';
import './RequestsPanel.css';

const pad = (n) => String(n).padStart(2, '0');
export const fmtTime = (ts) => {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const fmtMs = (ms) => (ms == null ? '' : ms < 1 ? '<1 мс' : ms < 1000 ? `${Math.round(ms)} мс` : `${(ms / 1000).toFixed(1)} с`);

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const userName = (u) => (u ? [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || String(u.id) : 'Бот');
const userHue = (u) => (u?.id ? Math.abs(Number(u.id) * 47) % 360 : 215);

const CONTENT_LABEL = {
  photo: 'фото', video: 'видео', document: 'файл', voice: 'голосовое', audio: 'аудио', sticker: 'стикер',
  contact: 'контакт', location: 'геопозиция', video_note: 'видеосообщение', animation: 'GIF', poll: 'опрос',
  dice: 'кубик', venue: 'место', web_app_data: 'данные Mini App',
};
const KIND_LABEL = {
  message: 'сообщение', edited_message: 'изменённое сообщение', callback_query: 'нажатие кнопки',
  channel_post: 'пост в канале', inline_query: 'inline-запрос', my_chat_member: 'статус бота в чате',
  chat_member: 'участник чата', chat_join_request: 'заявка на вступление', pre_checkout_query: 'оплата',
  outgoing: 'исходящие', unknown: 'апдейт',
};
const CHAT_LABEL = { private: 'личный чат', group: 'группа', supergroup: 'супергруппа', channel: 'канал' };
const SERVICE_METHODS = new Set(['answerCallbackQuery', 'sendChatAction', 'answerInlineQuery', 'answerPreCheckoutQuery']);

function payloadOf(r) {
  if (r.kind === 'callback_query') {
    return r.button ? <>кнопка «{r.button}»</> : <>callback <code>{r.data}</code></>;
  }
  if (r.kind === 'outgoing') {
    const names = [...new Set(r.calls.map((c) => c.method))];
    return <><code>{names.join(', ')}</code>{r.calls.length > 1 ? ` ×${r.calls.length}` : ''}</>;
  }
  if (r.text) {
    return /^\/\w/.test(r.text) ? <code>{r.text}</code> : <>«{r.text}»</>;
  }
  if (r.contentType && r.contentType !== 'text') return <>[{CONTENT_LABEL[r.contentType] || r.contentType}]</>;
  return <span className="rq-dim">{KIND_LABEL[r.kind] || r.kind}</span>;
}

function replyCount(r) {
  return r.calls.filter((c) => !SERVICE_METHODS.has(c.method)).length;
}

function metaOf(r) {
  if (r.status === 'pending') return { text: 'обработка…', cls: '' };
  if (r.status === 'error') {
    if (r.error) return { text: `${r.error.type}: ${r.error.msg}`, cls: 'err mono' };
    const bad = r.calls.find((c) => !c.ok);
    return { text: bad?.error || 'ошибка', cls: 'err mono' };
  }
  if (r.status === 'unhandled') return { text: 'нет обработчика', cls: 'warn' };
  if (r.kind === 'outgoing') return { text: 'без входящего запроса', cls: '' };
  const n = replyCount(r);
  if (!n) return { text: 'без ответа', cls: '' };
  return { text: `${n} ${plural(n, 'ответ', 'ответа', 'ответов')}`, cls: '' };
}

function callSummary(c) {
  const p = c.params || {};
  if (c.method === 'answerCallbackQuery') return p.text || '—';
  if (p.text) return p.text;
  if (p.caption) return p.caption;
  if (p.photo || p.video || p.document || p.audio || p.voice) return `[${c.method.replace(/^send/, '').toLowerCase()}]`;
  if (p.message_id) return `сообщение #${p.message_id}`;
  return '';
}

function nodeTitle(node) {
  if (!node) return 'блок';
  const def = BLOCK_DEFS[node.type];
  const base = def?.label || node.data?.label || node.type;
  const d = node.data || {};
  const extra = node.type === 'command' ? (d.command ? `/${String(d.command).replace(/^\//, '')}` : '')
    : node.type === 'buttons' ? ''
    : '';
  return extra ? `${base} ${extra}` : base;
}

const KIND_ICON = { callback_query: 'buttons', outgoing: 'bot' };
const RequestRow = memo(function RequestRow({ r, selected, onSelect }) {
  const meta = metaOf(r);
  const dot = r.status === 'error' ? 'err' : r.status === 'unhandled' ? 'warn' : r.status === 'pending' ? 'pending' : 'ok';
  const kindCls = r.kind === 'callback_query' ? 'cb' : r.kind === 'outgoing' ? 'out' : 'msg';
  return (
    <div className={`rq-row${selected ? ' on' : ''}`} onClick={() => onSelect(r.id)}>
      <span className="rq-tm">{fmtTime(r.ts)}</span>
      <span className={`rq-kind ${kindCls}`}><Icon name={KIND_ICON[r.kind] || 'msgin'} size={12} stroke={2} /></span>
      {r.kind === 'outgoing'
        ? <span className="rq-av rq-av--bot"><Icon name="bot" size={12} stroke={2} /></span>
        : <span className="rq-av" style={{ '--h': userHue(r.user) }}>{userName(r.user).slice(0, 1).toUpperCase()}</span>}
      <span className="rq-who">{r.kind === 'outgoing' ? 'Бот' : userName(r.user)}</span>
      <span className="rq-pl">{payloadOf(r)}</span>
      <span className={`rq-meta ${meta.cls}`} title={meta.text}>{meta.text}</span>
      <span className="rq-ms">{fmtMs(r.ms)}</span>
      <span className={`rq-dot ${dot}`} />
    </div>
  );
});

const LOG_ICON = { error: 'error', warn: 'warn', success: 'check' };
const LogRow = memo(function LogRow({ l, selected, onSelect }) {
  const first = l.text.split('\n')[0];
  return (
    <div className={`rq-row rq-row--log ${l.type}${selected ? ' on' : ''}`} onClick={() => onSelect(l.id)}>
      <span className="rq-tm">{fmtTime(l.ts)}</span>
      <span className={`rq-kind log ${l.type}`}><Icon name={LOG_ICON[l.type] || 'terminal'} size={12} stroke={2} /></span>
      <span className="rq-pl rq-log-text" title={l.text}>{first}</span>
      {l.text.includes('\n') && <span className="rq-meta">+{l.text.split('\n').length - 1} строк</span>}
    </div>
  );
});

function JsonView({ value }) {
  const text = useMemo(() => JSON.stringify(value, null, 2), [value]);
  return <pre className="rq-json">{text}</pre>;
}

function focusNodes(ids, zoomToOne = true) {
  const rf = getFlowInstance();
  if (!rf || !ids.length) return;
  const st = useStore.getState();
  if (ids.length === 1 && zoomToOne) {
    const n = rf.getNode(ids[0]);
    if (!n) return;
    const x = (n.positionAbsolute?.x ?? n.position.x) + (n.width || 200) / 2;
    const y = (n.positionAbsolute?.y ?? n.position.y) + (n.height || 80) / 2;
    rf.setCenter(x, y, { zoom: Math.max(rf.getZoom(), 1), duration: 350 });
    st.setSelectedNodeId?.(ids[0]);
    return;
  }
  rf.fitView({ nodes: ids.map((id) => ({ id })), padding: 0.35, duration: 400, maxZoom: 1.2 });
}

function revealCodeLine(line) {
  const st = useStore.getState();
  if (st.explorerActiveFile) st.setExplorerActiveFile?.(null);
  if (!st.panelConfig?.code?.visible) st.setPanelProp?.('code', 'visible', true);
  setTimeout(() => window.dispatchEvent(new CustomEvent('monaco-goto-line', { detail: { line } })), 60);
}

function CallRow({ c }) {
  const [open, setOpen] = useState(false);
  const sum = callSummary(c);
  return (
    <>
      <div className={`rq-out${c.ok ? '' : ' bad'}`} onClick={() => setOpen((v) => !v)}>
        <Icon name={open ? 'chev' : 'chevr'} size={12} stroke={2} />
        <code>{c.method}</code>
        <span className="rq-out-text">{c.ok ? sum || '—' : c.error}</span>
        <span className="rq-ms">{fmtMs(c.ms)}</span>
      </div>
      {open && <JsonView value={c.ok ? { params: c.params, result: c.result } : { params: c.params, error: c.error }} />}
    </>
  );
}

function RequestDetail({ r }) {
  const nodes      = useStore((s) => s.nodes);
  const edges      = useStore((s) => s.edges);
  const runInfo    = useStore((s) => s.runInfo);
  const [showJson, setShowJson] = useState(false);
  const [showTb, setShowTb] = useState(false);
  useEffect(() => { setShowJson(false); setShowTb(false); }, [r.id]);

  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const path = r.path.filter((id) => byId[id]);
  const branchLabel = (from, to) => {
    const e = edges.find((x) => x.source === from && x.target === to);
    if (!e?.sourceHandle) return null;
    const src = byId[from];
    if (src?.type === 'condition') {
      if (e.sourceHandle === 'true') return { text: src.data?.true_label || 'да', cls: 'yes' };
      if (e.sourceHandle === 'false') return { text: src.data?.false_label || 'нет', cls: 'no' };
    }
    if (src?.type === 'buttons' && /^btn_\d+$/.test(e.sourceHandle)) {
      const b = src.data?.buttons?.[Number(e.sourceHandle.slice(4))];
      return b?.text ? { text: b.text, cls: '' } : null;
    }
    return null;
  };

  const sub = [
    KIND_LABEL[r.kind] || r.kind,
    r.kind === 'callback_query' && r.data ? <code key="d">{r.data}</code> : null,
    r.chat ? (CHAT_LABEL[r.chat.type] || r.chat.type) + (r.chat.title ? ` «${r.chat.title}»` : '') : null,
    fmtTime(r.ts),
  ].filter(Boolean);

  const mappable = !!runInfo?.lineToNode && r.runId === runInfo?.id;

  return (
    <div className="rq-detail">
      <div className="rd-head">
        {r.kind === 'outgoing'
          ? <span className="rq-av lg rq-av--bot"><Icon name="bot" size={18} /></span>
          : <span className="rq-av lg" style={{ '--h': userHue(r.user) }}>{userName(r.user).slice(0, 1).toUpperCase()}</span>}
        <div className="rd-head-main">
          <div className="rd-title">
            {r.kind === 'outgoing' ? 'Сообщения от бота' : userName(r.user)}
            {r.user && <span className="muted"> {r.user.username ? `@${r.user.username} · ` : ''}{r.user.id}</span>}
          </div>
          <div className="rd-sub">{sub.map((x, i) => <span key={i}>{i > 0 && ' · '}{x}</span>)}</div>
        </div>
        {path.length > 0 && (
          <button className="rq-ghost" onClick={() => focusNodes(path, false)} title="Показать путь на схеме">
            <Icon name="target" size={13} /> На схеме
          </button>
        )}
        {r.raw && (
          <button className={`rq-ghost${showJson ? ' on' : ''}`} onClick={() => setShowJson((v) => !v)}>JSON</button>
        )}
      </div>

      {showJson && r.raw ? <JsonView value={r.raw} /> : (
        <>
          {r.kind !== 'outgoing' && r.text && r.kind !== 'callback_query' && (
            <div className="rd-quote">{r.text}</div>
          )}

          {r.kind !== 'outgoing' && (
            <>
              <div className="rd-sec">Путь по схеме</div>
              {r.status === 'pending' && <div className="rd-note">Обрабатывается…</div>}
              {r.status !== 'pending' && path.length > 0 && (
                <div className="rd-route">
                  {path.map((id, i) => {
                    const br = i < path.length - 1 ? branchLabel(id, path[i + 1]) : null;
                    const failed = r.status === 'error' && i === path.length - 1;
                    return (
                      <span key={id} className="rd-route-item">
                        <button className={`rd-chip${failed ? ' bad' : ''}`} onClick={() => focusNodes([id])} title="Показать блок">
                          <b>{i + 1}</b>
                          <BlockIcon type={byId[id].type} size={18} />
                          {nodeTitle(byId[id])}
                          {br && <i className={br.cls}>{br.text}</i>}
                        </button>
                        {i < path.length - 1 && <Icon name="chevr" size={12} stroke={2} />}
                      </span>
                    );
                  })}
                </div>
              )}
              {r.status !== 'pending' && path.length === 0 && (
                <div className="rd-note">
                  {r.status === 'unhandled'
                    ? 'Ни один обработчик не подошёл — добавьте триггер для такого сообщения.'
                    : !mappable
                      ? `Код изменён вручную или запущен не из схемы — выполнено строк кода: ${new Set(r.lines).size}.`
                      : 'Код блоков не выполнялся.'}
                </div>
              )}
              {r.fsm && (r.fsm[0] || r.fsm[1]) && r.fsm[0] !== r.fsm[1] && (
                <div className="rd-fsm">
                  Состояние: <code>{r.fsm[0] || 'нет'}</code> <Icon name="chevr" size={11} stroke={2} /> <code>{r.fsm[1] || 'нет'}</code>
                </div>
              )}
            </>
          )}

          {r.error && (
            <>
              <div className="rd-sec">Ошибка</div>
              <div className="rd-error">
                <div className="rd-error-head">
                  <Icon name="error" size={15} />
                  <code>{r.error.type}: {r.error.msg}</code>
                </div>
                <div className="rd-error-actions">
                  {r.error.line && (
                    <button className="rq-ghost" onClick={() => revealCodeLine(r.error.line)}>
                      Строка {r.error.line} в коде
                    </button>
                  )}
                  {r.error.tb && (
                    <button className={`rq-ghost${showTb ? ' on' : ''}`} onClick={() => setShowTb((v) => !v)}>Traceback</button>
                  )}
                </div>
                {showTb && <pre className="rq-json rq-tb">{r.error.tb}</pre>}
              </div>
            </>
          )}

          <div className="rd-sec">{r.kind === 'outgoing' ? 'Вызовы Bot API' : 'Ответ бота'}</div>
          {r.calls.length === 0
            ? <div className="rd-note">{r.status === 'pending' ? '…' : 'Бот ничего не отправил.'}</div>
            : <div className="rd-outs">{r.calls.map((c, i) => <CallRow key={i} c={c} />)}</div>}

          {r.prints.length > 0 && (
            <>
              <div className="rd-sec">Вывод (print)</div>
              <pre className="rq-json rq-prints">{r.prints.map((p) => p.text).join('\n')}</pre>
            </>
          )}
        </>
      )}
    </div>
  );
}

function LogDetail({ l }) {
  return (
    <div className="rq-detail">
      <div className="rd-head">
        <span className={`rq-kind lg log ${l.type}`}><Icon name={LOG_ICON[l.type] || 'terminal'} size={16} /></span>
        <div className="rd-head-main">
          <div className="rd-title">{l.type === 'error' ? 'Ошибка' : l.type === 'warn' ? 'Предупреждение' : 'Системное сообщение'}</div>
          <div className="rd-sub">{fmtTime(l.ts)}</div>
        </div>
      </div>
      <pre className={`rq-json${l.type === 'error' ? ' rq-tb' : ''}`}>{l.text}</pre>
    </div>
  );
}

export function useRequestsFeed(filter, query) {
  const requests = useStore((s) => s.requests);
  const logs     = useStore((s) => s.consoleLogs);
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchReq = (r) => {
      if (filter === 'msg' && !['message', 'edited_message', 'channel_post'].includes(r.kind)) return false;
      if (filter === 'cb' && r.kind !== 'callback_query') return false;
      if (filter === 'err' && r.status !== 'error' && r.status !== 'unhandled') return false;
      if (filter === 'sys' && r.kind !== 'outgoing') return false;
      if (!q) return true;
      const hay = [userName(r.user), r.user?.username, r.user?.id, r.text, r.data, r.button,
        ...r.calls.map((c) => `${c.method} ${callSummary(c)}`), r.error?.msg].join(' ').toLowerCase();
      return hay.includes(q);
    };
    const matchLog = (l) => {
      if (filter === 'msg' || filter === 'cb') return false;
      if (filter === 'err' && l.type !== 'error') return false;
      if (filter === 'all' && l.type === 'info') return false;
      return !q || l.text.toLowerCase().includes(q);
    };
    const items = [
      ...requests.filter(matchReq).map((r) => ({ k: 'r', id: r.id, ts: r.ts, r })),
      ...logs.filter(matchLog).map((l) => ({ k: 'l', id: l.id, ts: l.ts || 0, l })),
    ];
    items.sort((a, b) => a.ts - b.ts);
    return items;
  }, [requests, logs, filter, query]);
}

export default function RequestsPanel({ filter, query }) {
  const items          = useRequestsFeed(filter, query);
  const selectedId     = useStore((s) => s.selectedRequestId);
  const selectRequest  = useStore((s) => s.selectRequest);
  const requests       = useStore((s) => s.requests);
  const logs           = useStore((s) => s.consoleLogs);
  const botStatus      = useStore((s) => s.botStatus);
  const listRef        = useRef(null);
  const stickRef       = useRef(true);

  useEffect(() => {
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [items.length]);
  const onScroll = () => {
    const el = listRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const selReq = requests.find((r) => r.id === selectedId);
  const selLog = !selReq && selectedId ? logs.find((l) => l.id === selectedId) : null;

  if (items.length === 0) {
    return (
      <div className="rq-empty">
        <div className="rq-empty-ic"><Icon name="activity" size={22} /></div>
        <div className="rq-empty-title">
          {requests.length || logs.length ? 'Ничего не найдено' : botStatus === 'running' ? 'Бот запущен — ждём сообщений' : 'Здесь появятся запросы к боту'}
        </div>
        <div className="rq-empty-sub">
          {requests.length || logs.length
            ? 'Измените фильтр или строку поиска.'
            : 'Запустите бота и напишите ему в Telegram: команды, сообщения, нажатия кнопок и ответы бота будут видны здесь, а путь по схеме подсветится на холсте.'}
        </div>
      </div>
    );
  }

  return (
    <div className="rq">
      <div className="rq-list" ref={listRef} onScroll={onScroll}>
        {items.map((it) => (it.k === 'r'
          ? <RequestRow key={it.id} r={it.r} selected={it.id === selectedId} onSelect={selectRequest} />
          : <LogRow key={it.id} l={it.l} selected={it.id === selectedId} onSelect={selectRequest} />))}
      </div>
      {selReq ? <RequestDetail r={selReq} />
        : selLog ? <LogDetail l={selLog} />
        : (
          <div className="rq-detail rq-detail--empty">
            <Icon name="activity" size={20} />
            <span>Выберите запрос, чтобы увидеть путь по схеме и ответы бота</span>
          </div>
        )}
    </div>
  );
}
