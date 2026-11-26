import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import useStore from '../store/useStore';
import { useT } from '../i18n';
import './TelegramSimulator.css';

function evalCondition(expr, profile) {
  try {
    const vars = { ...profile.vars };
    let e = expr;
    e = e.replace(/\{(\w+)\}/g, (_, name) => JSON.stringify(vars[name] ?? null));
    const sorted = Object.keys(vars).sort((a, b) => b.length - a.length);
    for (const k of sorted) {
      e = e.replace(new RegExp(`\\b${k}\\b`, 'g'), JSON.stringify(vars[k]));
    }
    e = e
      .replace(/\bnot in\b/gi, '___notin___')
      .replace(/\band\b/gi, '&&')
      .replace(/\bor\b/gi, '||')
      .replace(/\bnot\b/gi, '!')
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/\bNone\b/g, 'null')
      .replace(/___notin___/g, 'notin___placeholder');
    // eslint-disable-next-line no-new-func
    return Boolean(new Function(`"use strict"; return (${e})`)());
  } catch {
    return true;
  }
}

function evalPresetCondition(data, ctx, profile) {
  const field = String(data.field || 'message.text').trim();
  const vars  = profile?.vars || {};
  let lhs;
  if (/^(message\.)?text$/.test(field) || field === 'message.caption') lhs = ctx.text ?? '';
  else if (/^(callback(_query)?\.)?data$/.test(field)) lhs = ctx.data ?? '';
  else {
    const key = field.replace(/^data\[['"](.+)['"]\]$/, '$1').replace(/^\{(\w+)\}$/, '$1');
    lhs = vars[key] ?? vars[field] ?? '';
  }
  const raw = String(data.value ?? '').trim();
  const rhs = raw === 'True' ? true : raw === 'False' ? false : raw === 'None' ? null
    : (raw !== '' && !Number.isNaN(Number(raw))) ? Number(raw) : String(data.value ?? '');
  const num = (v) => (typeof v === 'number' ? v : Number(v));
  switch (data.operator || '==') {
    case '==': return typeof rhs === 'number' ? num(lhs) === rhs : String(lhs) === String(rhs ?? 'None');
    case '!=': return typeof rhs === 'number' ? num(lhs) !== rhs : String(lhs) !== String(rhs ?? 'None');
    case '>':  return num(lhs) >  num(rhs);
    case '<':  return num(lhs) <  num(rhs);
    case '>=': return num(lhs) >= num(rhs);
    case '<=': return num(lhs) <= num(rhs);
    case 'contains':   return String(lhs).includes(String(rhs));
    case 'startswith': return String(lhs).startsWith(String(rhs));
    case 'endswith':   return String(lhs).endsWith(String(rhs));
    default: return true;
  }
}

function presetLabel(data) {
  const op = data.operator || '==';
  return `${data.field || 'message.text'} ${op} ${JSON.stringify(String(data.value ?? ''))}`;
}


let _msgId = 0;
const mkMsg = (fields) => ({ id: ++_msgId, ts: fmtTime(), ...fields });

function fmtTime() {
  return new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function buildRows(buttons) {
  const rows = [];
  let cur = [];
  for (let i = 0; i < buttons.length; i++) {
    cur.push(buttons[i]);
    if (buttons[i].row_break && i < buttons.length - 1) {
      rows.push(cur);
      cur = [];
    }
  }
  if (cur.length) rows.push(cur);
  return rows;
}

const MEDIA_INFO = {
  photo:    { icon: '🖼️',  label: 'Фото',     bg: '#1a3a5c' },
  video:    { icon: '🎬',  label: 'Видео',    bg: '#1a1a40' },
  gif:      { icon: '🎞️', label: 'GIF',      bg: '#1a2a40' },
  animation:{ icon: '🎞️', label: 'GIF',      bg: '#1a2a40' },
  sticker:  { icon: '🎭',  label: 'Стикер',   bg: '#2a1a40' },
  audio:    { icon: '🎵',  label: 'Аудио',    bg: '#1a3a30' },
  document: { icon: '📄',  label: 'Документ', bg: '#1a2a30' },
};

function TgHTML({ text, plain }) {
  if (!text) return null;
  if (plain) return <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>;

  const safe = text
    .replace(/&/g, '&amp;')
    .replace(/<(\/?)( *)(b|strong|i|em|u|s|del|code|pre|br)([ >])/gi,
      (_, sl, sp, tag, rest) => `\x00${sl}${tag.toLowerCase()}${rest}`)
    .replace(/<[^>]*>/g, '')
    .replace(/\x00/g, '<')
    .replace(/\n/g, '<br>');

  return <span dangerouslySetInnerHTML={{ __html: safe }} />;
}

function MediaCard({ mediaType, caption, parseMode }) {
  const info = MEDIA_INFO[mediaType] || MEDIA_INFO.photo;
  return (
    <div className="tg-sim__media-card" style={{ background: info.bg }}>
      <span className="tg-sim__media-icon">{info.icon}</span>
      <span className="tg-sim__media-label">{info.label}</span>
      {caption && (
        <div className="tg-sim__media-caption">
          <TgHTML text={caption} plain={parseMode !== 'HTML'} />
        </div>
      )}
    </div>
  );
}

function InlineKeyboard({ buttons, onBtn }) {
  const rows = buildRows(buttons);
  return (
    <div className="tg-sim__inline-kbd">
      {rows.map((row, ri) => (
        <div key={ri} className="tg-sim__inline-row">
          {row.map((btn, bi) => (
            <button key={bi} className="tg-sim__inline-btn" onClick={() => onBtn(btn)}>
              {btn.text}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function Bubble({ msg, onInlineBtn }) {
  const isUser = msg.from === 'user';
  return (
    <div className={`tg-sim__bubble tg-sim__bubble--${msg.from}`}>
      {msg.mediaType && (
        <MediaCard mediaType={msg.mediaType} caption={msg.caption} parseMode={msg.parseMode} />
      )}
      {msg.text && (
        <div className="tg-sim__msg-text">
          <TgHTML text={msg.text} plain={isUser || msg.parseMode !== 'HTML'} />
        </div>
      )}
      {msg.inlineBtns && msg.inlineBtns.length > 0 && (
        <InlineKeyboard buttons={msg.inlineBtns} onBtn={onInlineBtn} />
      )}
      <div className="tg-sim__ts">{msg.ts}</div>
    </div>
  );
}


function TelegramSimulator() {
  const T              = useT();
  const nodes          = useStore((s) => s.nodes);
  const edges          = useStore((s) => s.edges);
  const panelConfig    = useStore((s) => s.panelConfig);
  const setPanelProp   = useStore((s) => s.setPanelProp);
  const startFloatDrag = useStore((s) => s.startFloatDrag);
  const simCfg         = panelConfig.simulator;

  const simProfile       = useStore((s) => s.simProfile);
  const trackSimCommand  = useStore((s) => s.trackSimCommand);
  const trackSimMessage  = useStore((s) => s.trackSimMessage);
  const trackSimCondition = useStore((s) => s.trackSimCondition);

  const messages     = useStore((s) => s.simMessages);
  const waitNodeId   = useStore((s) => s.simWaitNodeId);
  const replyKbd     = useStore((s) => s.simReplyKbd);
  const setSimState  = useStore((s) => s.setSimState);
  const clearSim     = useStore((s) => s.clearSim);

  const inputRef  = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (messages.length === 0) {
      setSimState({ messages: [mkMsg({ from: 'system', text: T('sim.ready') })] });
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const simulate = useCallback((startIds, ctx = {}) => {
    const profile = useStore.getState().simProfile;
    const out = [];
    let pendingWait = null;
    let newReplyKbd = null;
    const targetsOf = (src, handle) =>
      edges.filter((e) => e.source === src && e.sourceHandle === handle).map((e) => e.target);

    const walk = (nid, visited = new Set()) => {
      if (!nid || visited.has(nid)) return;
      visited.add(nid);

      const node = nodes.find((n) => n.id === nid);
      if (!node || node.data?.disabled) return;

      switch (node.type) {
        case 'text':
          out.push({ from: 'bot', text: node.data.message_text || '', parseMode: node.data.parse_mode || 'HTML' });
          break;

        case 'media':
          out.push({ from: 'bot', mediaType: node.data.media_type, caption: node.data.caption || '', parseMode: node.data.parse_mode || 'HTML', text: '' });
          break;

        case 'buttons': {
          if (node.data.button_type === 'inline') {
            const btns = (node.data.buttons || []).map((b, i) => ({ ...b, _nodeId: nid, _btnIdx: i }));
            const last = out[out.length - 1];
            if (last && last.from === 'bot' && !last.inlineBtns) {
              last.inlineBtns = btns;
            } else {
              out.push({ from: 'bot', text: '', inlineBtns: btns });
            }
          } else {
            newReplyKbd = {
              rows: buildRows(node.data.buttons || []),
              one_time: !!node.data.one_time_keyboard,
            };
            out.push({ from: 'system', text: T('sim.keyboardShow') });
          }
          break;
        }

        case 'wait_input':
          out.push({ from: 'bot', text: node.data.prompt || 'Введите значение:', parseMode: 'HTML' });
          pendingWait = nid;
          return;

        case 'contact_request':
          out.push({ from: 'bot', text: node.data.prompt || 'Поделитесь номером телефона:', parseMode: 'HTML' });
          newReplyKbd = { rows: [[{ text: node.data.button_text || 'Поделиться номером' }]], one_time: true };
          pendingWait = nid;
          return;

        case 'condition': {
          const isCode = node.data.condition_mode === 'code';
          const expr   = isCode ? (node.data.condition_expression || '?') : presetLabel(node.data);
          const result = isCode ? evalCondition(expr, profile) : evalPresetCondition(node.data, ctx, profile);
          useStore.getState().trackSimCondition(result);
          const branch = result ? '✓ да' : '✗ нет';
          out.push({ from: 'system', text: `${T('sim.condition').replace('{expr}', expr)} → ${branch}` });
          for (const t of targetsOf(nid, result ? 'true' : 'false')) walk(t, visited);
          return;
        }

        case 'timer': break;

        case 'variable':
          if (node.data.operation === 'set') {
            out.push({ from: 'system', text: T('sim.varSet').replace('{name}', node.data.var_name).replace('{val}', node.data.var_value || '…') });
          }
          break;

        case 'list_op':
          out.push({ from: 'system', text: `📋 Список «${node.data.list_name}»: ${node.data.operation}` });
          break;

        case 'admin_notify':
          out.push({ from: 'system', text: '📣 Уведомление отправлено администратору' });
          break;

        case 'loop_for':
          out.push({ from: 'system', text: `🔁 Цикл: ${node.data.loop_type === 'count' ? `${node.data.count || '?'} раз` : `по «${node.data.list_var || 'list'}»`}` });
          break;

        case 'http_request':
          out.push({ from: 'system', text: `🌐 HTTP ${node.data.method || 'GET'} → ${node.data.url || '?'}` });
          break;

        case 'webhook':
          out.push({ from: 'system', text: `🔗 Webhook POST → ${node.data.url || '?'}` });
          break;

        case 'code_block':
          out.push({ from: 'system', text: '🐍 Выполнение Python-кода' });
          break;

        case 'db_write':
          out.push({ from: 'system', text: `🗄️ БД: запись в «${node.data.table_name || '?'}»` });
          break;

        case 'db_read':
          out.push({ from: 'system', text: `🗄️ БД: чтение из «${node.data.table_name || '?'}»` });
          break;

        case 'broadcast':
          out.push({ from: 'system', text: '📢 Рассылка всем пользователям' });
          break;

        case 'google_sheets':
          out.push({ from: 'system', text: `📊 Google Sheets: ${node.data.action || '?'}` });
          break;

        case 'rate_limit':
          out.push({ from: 'system', text: '⏱️ Лимит частоты: разрешено (симулятор не ограничивает)' });
          for (const t of targetsOf(nid, 'allowed')) walk(t, visited);
          return;

        case 'save_user':
          out.push({ from: 'system', text: '💾 Пользователь сохранён в БД' });
          break;

        case 'get_user_info':
          out.push({ from: 'system', text: '👤 Данные пользователя получены' });
          break;

        default: break;
      }

      for (const t of targetsOf(nid, 'out')) walk(t, visited);
    };

    for (const id of [].concat(startIds || [])) walk(id);
    return { out, pendingWait, newReplyKbd };
  }, [nodes, edges, T]);

  const sendText = useCallback((rawText) => {
    const text = rawText.trim();
    if (!text) return;

    trackSimMessage();
    const newMsgs = [mkMsg({ from: 'user', text })];
    let simResult = null;
    let nextWait = null;
    let nextKbd = replyKbd;

    if (waitNodeId) {
      const outs = edges.filter((e) => e.source === waitNodeId && e.sourceHandle === 'out').map((e) => e.target);
      nextWait = null;
      if (outs.length) simResult = simulate(outs, { text });
    } else if (text.startsWith('/')) {
      const cmdName = text.slice(1).split(' ')[0].toLowerCase();
      const cmdNode = nodes.find(
        (n) => n.type === 'command' && (n.data?.command_name || '').replace('/', '').toLowerCase() === cmdName
      );
      if (cmdNode) {
        trackSimCommand(cmdName);
        const outs = edges.filter((e) => e.source === cmdNode.id && e.sourceHandle === 'out').map((e) => e.target);
        if (outs.length) simResult = simulate(outs, { text });
        else newMsgs.push(mkMsg({ from: 'system', text: `⚡ ${T('sim.cmdEmpty')}` }));
      } else {
        newMsgs.push(mkMsg({ from: 'system', text: `⚡ ${T('sim.cmdNotFound').replace('{cmd}', cmdName)}` }));
      }
    } else {
      const handlers = nodes.filter((n) => n.type === 'message_handler');
      let matched = null;
      for (const h of handlers) {
        const { filter_type = 'any', filter_value = '' } = h.data || {};
        if (filter_type === 'any')                                           { matched = h; break; }
        if (filter_type === 'contains' && text.includes(filter_value))      { matched = h; break; }
        if (filter_type === 'equals'   && text === filter_value)            { matched = h; break; }
        if (filter_type === 'regex') {
          try { if (new RegExp(filter_value).test(text)) { matched = h; break; } } catch {}
        }
      }
      if (matched) {
        const outs = edges.filter((e) => e.source === matched.id && e.sourceHandle === 'out').map((e) => e.target);
        if (outs.length) simResult = simulate(outs, { text });
        else newMsgs.push(mkMsg({ from: 'system', text: `⚡ ${T('sim.handlerEmpty')}` }));
      } else {
        newMsgs.push(mkMsg({ from: 'system', text: `⚡ ${T('sim.noHandler')}` }));
      }
    }

    if (simResult) {
      simResult.out.forEach((r) => newMsgs.push(mkMsg(r)));
      if (simResult.pendingWait !== undefined) nextWait = simResult.pendingWait;
      if (simResult.newReplyKbd) nextKbd = simResult.newReplyKbd;
    }

    setSimState({
      messages: [...messages, ...newMsgs],
      waitNodeId: nextWait,
      replyKbd: nextKbd,
    });
  }, [nodes, edges, simulate, waitNodeId, replyKbd, messages, setSimState, T, trackSimMessage, trackSimCommand]);


  const handleInlineBtn = useCallback((btn) => {
    const newMsgs = [mkMsg({ from: 'user', text: btn.text, isBtnTap: true })];
    const outs = edges.filter((e) => e.source === btn._nodeId && e.sourceHandle === `btn_${btn._btnIdx}`).map((e) => e.target);
    let nextWait = waitNodeId;
    let nextKbd = replyKbd;
    if (outs.length) {
      const result = simulate(outs, { text: btn.text, data: btn.callback_data || `btn_${btn._btnIdx}` });
      result.out.forEach((r) => newMsgs.push(mkMsg(r)));
      if (result.pendingWait !== undefined) nextWait = result.pendingWait;
      if (result.newReplyKbd) nextKbd = result.newReplyKbd;
    }
    setSimState({ messages: [...messages, ...newMsgs], waitNodeId: nextWait, replyKbd: nextKbd });
  }, [edges, simulate, waitNodeId, replyKbd, messages, setSimState]);

  const handleReplyBtn = useCallback((btnText) => {
    if (replyKbd?.one_time) setSimState({ replyKbd: null });
    sendText(btnText);
  }, [replyKbd, sendText, setSimState]);

  const onHeaderMouseDown = (e) => {
    if (e.button !== 0 || !simCfg.floating) return;
    e.stopPropagation();
    startFloatDrag('simulator', e.clientX, e.clientY);
  };

  const [input, setInput] = useState('');
  const inputElRef = useRef(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [newVarName, setNewVarName]   = useState('');
  const [newVarValue, setNewVarValue] = useState('');

  const updateSimVar = useStore((s) => s.updateSimVar);
  const removeSimVar = useStore((s) => s.removeSimVar);

  const flowVarNames = useMemo(() => {
    const names = new Set();
    for (const n of nodes) {
      if (n.type === 'variable'  && n.data?.var_name?.trim())  names.add(n.data.var_name.trim());
      if (n.type === 'wait_input' && n.data?.var_name?.trim()) names.add(n.data.var_name.trim());
      if (n.type === 'loop_for'  && n.data?.loop_var?.trim())  names.add(n.data.loop_var.trim());
      if (n.type === 'get_user_info') {
        ['first_name', 'username', 'user_id', 'language_code'].forEach((f) => names.add(f));
      }
    }
    return [...names];
  }, [nodes]);

  const addProfileVar = () => {
    const n = newVarName.trim();
    if (!n) return;
    updateSimVar(n, newVarValue);
    setNewVarName('');
    setNewVarValue('');
  };

  const doSend = useCallback(() => {
    if (!input.trim()) return;
    sendText(input);
    setInput('');
  }, [input, sendText]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
  };

  const handleClear = () => {
    clearSim();
    setSimState({ messages: [mkMsg({ from: 'system', text: T('sim.ready') })] });
    setInput('');
    inputElRef.current?.focus();
  };

  return (
    <div className="tg-sim">
      <div
        className="tg-sim__header"
        onMouseDown={onHeaderMouseDown}
        style={simCfg.floating ? { cursor: 'move' } : undefined}
      >
        <div className="tg-sim__header-left">
          <div className="tg-sim__header-info">
            <div className="tg-sim__bot-name">{T('sim.title')}</div>
            <div className="tg-sim__bot-status">{T('sim.status')}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            className={`tg-sim__icon-btn${profileOpen ? ' tg-sim__icon-btn--profile-on' : ''}`}
            onClick={() => setProfileOpen((v) => !v)}
            title="Профиль тест-юзера"
          >👤</button>
          <button className="tg-sim__icon-btn" onClick={handleClear} title={T('sim.clear')}>🗑</button>
        </div>
      </div>

      <div className={`tg-sim__profile-drawer${profileOpen ? ' tg-sim__profile-drawer--open' : ''}`}>
        <div className="tg-sim__profile-inner">
          {flowVarNames.length === 0 && Object.keys(simProfile.vars).length === 0 && (
            <div className="tg-sim__profile-empty">
              Нет переменных в флоу. Добавь блок «Переменная» или «Ждать ввода».
            </div>
          )}
          {flowVarNames.filter((n) => !(n in simProfile.vars)).map((name) => (
            <div key={name} className="tg-sim__profile-row">
              <span className="tg-sim__profile-label tg-sim__profile-label--flow">{name}</span>
              <input
                className="tg-sim__profile-input tg-sim__profile-input--placeholder"
                placeholder="не задано"
                onFocus={() => updateSimVar(name, '')}
                readOnly
              />
            </div>
          ))}
          {Object.entries(simProfile.vars).map(([name, val]) => (
            <div key={name} className="tg-sim__profile-row">
              <span className="tg-sim__profile-label">{name}</span>
              <input
                className="tg-sim__profile-input"
                value={val}
                onChange={(e) => updateSimVar(name, e.target.value)}
                spellCheck={false}
              />
              <button className="tg-sim__profile-del" onClick={() => removeSimVar(name)} title="Сбросить">×</button>
            </div>
          ))}
          <div className="tg-sim__profile-add">
            <input
              className="tg-sim__profile-input tg-sim__profile-input--name"
              placeholder="имя"
              value={newVarName}
              onChange={(e) => setNewVarName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addProfileVar()}
              spellCheck={false}
            />
            <span className="tg-sim__profile-eq">=</span>
            <input
              className="tg-sim__profile-input"
              placeholder="значение"
              value={newVarValue}
              onChange={(e) => setNewVarValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addProfileVar()}
              spellCheck={false}
            />
            <button className="tg-sim__profile-add-btn" onClick={addProfileVar} title="Добавить переменную">+</button>
          </div>
        </div>
      </div>

      <div className="tg-sim__chat">
        {messages.map((msg) => (
          <div key={msg.id} className={`tg-sim__row tg-sim__row--${msg.from}`}>
            {msg.from === 'system'
              ? <div className="tg-sim__system">{msg.text}</div>
              : <Bubble msg={msg} onInlineBtn={handleInlineBtn} />
            }
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {replyKbd && (
        <div className="tg-sim__reply-kbd">
          {replyKbd.rows.map((row, ri) => (
            <div key={ri} className="tg-sim__reply-row">
              {row.map((btn, bi) => (
                <button
                  key={bi}
                  className="tg-sim__reply-btn"
                  onClick={() => handleReplyBtn(btn.text || btn)}
                >
                  {btn.text || btn}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="tg-sim__input-bar">
        {waitNodeId && <div className="tg-sim__wait-hint">{T('sim.waitHint')}</div>}
        <div className="tg-sim__input-row">
          <input
            ref={inputElRef}
            className="tg-sim__input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={waitNodeId ? T('sim.placeholderWait') : T('sim.placeholder')}
            spellCheck={false}
          />
          <button
            className="tg-sim__send"
            onClick={doSend}
            disabled={!input.trim()}
            title={T('sim.send')}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default TelegramSimulator;
