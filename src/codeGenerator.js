import {
  genCustomBlockCall,
  genCustomBlockFunction,
  collectCustomImports,
  collectCustomInjects,
  applyInjects,
} from './customBlocks/customCodeGenerator';

const TAG_OPEN  = '\u0001';
const TAG_CLOSE = '\u0002';
const TAG_SEP   = '\u0003';
const STATE_PH  = '\u0004STATE\u0004';

function isTagged(l) { return typeof l === 'string' && l.charCodeAt(0) === 1; }
function tagLine(l, ids) {
  if (isTagged(l)) return l;
  const arr = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
  if (!arr.length) return l;
  return TAG_OPEN + arr.join(TAG_SEP) + TAG_CLOSE + l;
}
function untagLine(l) {
  if (!isTagged(l)) return { ids: [], text: l };
  const end = l.indexOf(TAG_CLOSE);
  return { ids: l.slice(1, end).split(TAG_SEP).filter(Boolean), text: l.slice(end + 1) };
}
function tagFrom(lines, id, from = 0) {
  for (let k = from; k < lines.length; k++) if (!isTagged(lines[k])) lines[k] = tagLine(lines[k], id);
  return lines;
}
const IND = (d) => '    '.repeat(d);

const ROOT_TYPES = ['command', 'message_handler', 'deep_link', 'schedule'];

export function generateCode(nodes, edges, botToken, opts = {}) {
  const EMPTY = { code: '', nodeLineMap: {}, nodeLines: {} };
  const { loggingEnabled = false, proxyEnabled = false, proxyUrl = '',
          sqlDialect = 'sqlite', dbConfig = {} } = opts;

  const DB = (() => {
    const cfg = dbConfig || {};
    const s = (v, d) => (v != null && String(v).trim() !== '' ? String(v) : d);
    if (sqlDialect === 'postgres') {
      return {
        ph: '%s', importLine: 'import psycopg2',
        connect: `psycopg2.connect(host=${escapePy(s(cfg.host, 'localhost'))}, port=${s(cfg.port, '5432')}, user=${escapePy(s(cfg.user, 'postgres'))}, password=${escapePy(s(cfg.password, ''))}, dbname=${escapePy(s(cfg.database, 'postgres'))})`,
      };
    }
    if (sqlDialect === 'mysql') {
      return {
        ph: '%s', importLine: 'import pymysql',
        connect: `pymysql.connect(host=${escapePy(s(cfg.host, 'localhost'))}, port=${parseInt(s(cfg.port, '3306')) || 3306}, user=${escapePy(s(cfg.user, 'root'))}, password=${escapePy(s(cfg.password, ''))}, database=${escapePy(s(cfg.database, 'bot'))})`,
      };
    }
    return { ph: '?', importLine: 'import sqlite3', connect: 'sqlite3.connect("bot.db")' };
  })();
  if (!nodes || nodes.length === 0) return EMPTY;

  const activeNodes = nodes.filter((n) => !n.data?.disabled && n.type !== 'group_frame' && n.type !== 'comment');
  const activeIds   = new Set(activeNodes.map((n) => n.id));

  const expandedEdges = [];
  const seenEdgeIds = new Set();
  for (const e of edges || []) {
    if (e.id && e.id.startsWith('proxy_')) {
      const originalId = e.id.slice('proxy_'.length);
      const group = nodes.find((n) => n.type === 'group_frame' && (n.data?._proxyIds || []).includes(e.id));
      if (group) {
        const original = (group.data._savedEdges || []).find((oe) => oe.id === originalId);
        if (original && !seenEdgeIds.has(original.id)) {
          expandedEdges.push(original);
          seenEdgeIds.add(original.id);
        }
      }
    } else if (!seenEdgeIds.has(e.id)) {
      expandedEdges.push(e);
      seenEdgeIds.add(e.id);
    }
  }
  const activeEdges = expandedEdges.filter((e) => activeIds.has(e.source) && activeIds.has(e.target));

  if (!activeNodes.some((n) => ROOT_TYPES.includes(n.type))) return EMPTY;

  nodes = activeNodes;
  edges = activeEdges;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const nextMap = new Map();
  for (const edge of edges) {
    const h = edge.sourceHandle || 'out';
    if (!nextMap.has(edge.source)) nextMap.set(edge.source, new Map());
    const m = nextMap.get(edge.source);
    if (!m.has(h)) m.set(h, []);
    if (!m.get(h).includes(edge.target)) m.get(h).push(edge.target);
  }
  const getNexts = (nodeId, handle = 'out') => nextMap.get(nodeId)?.get(handle) ?? [];

  const isStaticInline = (n) =>
    (n.type === 'buttons' && n.data?.button_type !== 'reply' && !n.data?.dynamic_enabled) ||
    (n.type === 'edit_message' && !!n.data?.edit_markup);
  const cbEff = new Map();
  {
    const taken = new Set();
    for (const n of nodes) if (isStaticInline(n)) for (const b of n.data.buttons || []) if (b.callback_data) taken.add(b.callback_data);
    const owner = new Map();
    for (const n of nodes) {
      if (!isStaticInline(n)) continue;
      const arr = [];
      (n.data.buttons || []).forEach((b, i) => {
        let eff = b.callback_data || `btn_${i}`;
        const sig = getNexts(n.id, `btn_${i}`).join('|');
        if (!owner.has(eff)) { owner.set(eff, sig); taken.add(eff); }
        else {
          const o = owner.get(eff);
          if (sig && o && o !== sig) {
            let k = 2;
            while (taken.has(`${eff}_${k}`)) k++;
            eff = `${eff}_${k}`;
            taken.add(eff);
            owner.set(eff, sig);
          } else if (sig && !o) owner.set(eff, sig);
        }
        arr.push(eff);
      });
      cbEff.set(n.id, arr);
    }
  }

  let needsDb = false, needsUserVars = false, needsListVars = false, needsAiohttp = false;
  let needsFSM = false, needsBotUsers = false, needsGoogleSheets = false, needsRateLimit = false;
  let needsSchedule = false, needsDatetime = false, needsJson = false;
  const emitted = new Set();
  const storedVars = new Map();
  const regStored = (name, scope) => {
    const loc = pyIdent(name);
    if (!storedVars.has(loc)) storedVars.set(loc, { name, scope: scope === 'global' ? 'global' : 'user' });
  };

  function markEmitted(node) {
    emitted.add(node.id);
    const d = node.data || {};
    switch (node.type) {
      case 'db_create_table': case 'db_write': case 'db_read': case 'db_delete': needsDb = true; break;
      case 'variable': needsUserVars = true; if (d.operation === 'set') regStored(d.var_name, d.scope); break;
      case 'list_op': needsListVars = true; break;
      case 'admin_notify':
        if (d.admin_mode === 'username' || d.admin_mode === 'tag') { needsDb = true; needsBotUsers = true; }
        break;
      case 'http_request':
        needsAiohttp = true;
        if (['POST', 'PUT'].includes(d.method) && d.body) needsJson = true;
        break;
      case 'webhook': needsAiohttp = true; needsJson = true; break;
      case 'save_user': case 'broadcast': needsBotUsers = true; break;
      case 'google_sheets': needsGoogleSheets = true; needsJson = true; break;
      case 'rate_limit': needsRateLimit = true; needsDatetime = true; break;
      case 'wait_input': needsFSM = true; needsUserVars = true; regStored(d.var_name || 'user_input', d.var_scope); break;
      case 'contact_request': needsFSM = true; break;
      case 'dynamic_step': needsFSM = true; needsUserVars = true; needsListVars = true; break;
      case 'schedule': needsSchedule = true; needsBotUsers = true; break;
      default: break;
    }
  }

  const handlers = [];
  const queue = [];
  const enqueue = (h) => { handlers.push(h); queue.push(h); };
  const cbByData   = new Map();
  const replyByTxt = new Map();
  const dynByNode  = new Map();
  const fsmByNode  = new Map();
  const usedFn     = new Set();
  const fnName = (base) => {
    let n = base, k = 2;
    while (usedFn.has(n)) n = `${base}_${k++}`;
    usedFn.add(n);
    return n;
  };
  const stateIdx = new Map(); let stateCounter = 0;
  const fsmState = (node) => { if (!stateIdx.has(node.id)) stateIdx.set(node.id, stateCounter++); return stateIdx.get(node.id); };
  const dynIdx = new Map(); let dynCounter = 0;
  const dynIndex = (node) => { if (!dynIdx.has(node.id)) dynIdx.set(node.id, dynCounter++); return dynIdx.get(node.id); };
  const rlIdx = new Map(); let rlCounter = 0;
  const rlIndex = (node) => { if (!rlIdx.has(node.id)) rlIdx.set(node.id, rlCounter++); return rlIdx.get(node.id); };
  let replyCounter = 0;

  function effPM(node, ctx) {
    const own = node.data?.parse_mode;
    const pm = own !== undefined && own !== null && own !== '' ? own : ctx?.parseMode;
    return pm && pm !== 'None' ? `, parse_mode="${pm}"` : '';
  }
  const subCtx = (ctx, kind) => ({ kind, parseMode: ctx?.parseMode ?? null });

  function genChainRaw(startId, depth, visited, ctx) {
    const lines = [];
    let current = startId;
    const ind = IND(depth);

    while (current && !visited.has(current)) {
      visited.add(current);
      const node = nodeMap.get(current);
      if (!node) break;
      markEmitted(node);
      const from = lines.length;
      let stop = false;

      switch (node.type) {
        case 'text': {
          const text = escapePyFStr(node.data.message_text || '');
          const pm   = node.data.parse_mode && node.data.parse_mode !== 'None' ? `, parse_mode="${node.data.parse_mode}"` : '';
          const extra = node.data.disable_web_page_preview ? ', disable_web_page_preview=True' : '';
          const notif = node.data.disable_notification ? ', disable_notification=True' : '';
          lines.push(`${ind}await message.answer(${text}${pm}${extra}${notif})`);
          break;
        }
        case 'media':         lines.push(...genMedia(node, depth)); break;
        case 'buttons':       lines.push(...genButtons(node, depth, visited, lines, ctx)); stop = true; break;
        case 'edit_message':
          lines.push(...genEditMessage(node, depth, ctx));
          stop = !!node.data.edit_markup;
          break;
        case 'dynamic_step':  lines.push(...genDynamicStepEntry(node, depth, visited, ctx)); stop = true; break;
        case 'condition':     lines.push(...genCondition(node, depth, visited, ctx)); stop = true; break;
        case 'variable':      lines.push(...genVariable(node, depth)); break;
        case 'list_op':       lines.push(...genListOp(node, depth)); break;
        case 'timer':         lines.push(...genTimer(node, depth)); break;
        case 'admin_notify':  lines.push(...genAdminNotify(node, depth)); break;
        case 'db_create_table': lines.push(...genDbCreate(node, depth)); break;
        case 'db_write':      lines.push(...genDbWrite(node, depth)); break;
        case 'db_read':       lines.push(...genDbRead(node, depth)); break;
        case 'db_delete':     lines.push(...genDbDelete(node, depth)); break;
        case 'http_request':  lines.push(...genHttpRequest(node, depth)); break;
        case 'code_block':    lines.push(...genCodeBlock(node, depth)); break;
        case 'custom_block': {
          const cl = genCustomBlockCall(node, depth);
          if (cl.some((l) => /\bstate\b/.test(l))) needsFSM = true;
          lines.push(...cl);
          break;
        }
        case 'loop_for':      lines.push(...genLoop(node, depth, new Set(visited), ctx)); break;
        case 'webhook':       lines.push(...genWebhook(node, depth)); break;
        case 'get_user_info': lines.push(...genGetUserInfo(node, depth)); break;
        case 'broadcast':     lines.push(...genBroadcast(node, depth)); break;
        case 'save_user':     lines.push(...genSaveUser(node, depth)); break;
        case 'google_sheets': lines.push(...genGoogleSheets(node, depth)); break;
        case 'rate_limit':    lines.push(...genRateLimit(node, depth, visited, ctx)); stop = true; break;
        case 'wait_input': {
          if (node.data.prompt_enabled !== false && node.data.prompt) {
            lines.push(`${ind}await message.answer(${escapePyFStr(node.data.prompt)}${effPM(node, ctx)})`);
          }
          const s = fsmState(node);
          lines.push(`${ind}await state.set_state(BotStates.wait_input_${s})`);
          lines.push(`${ind}return`);
          if (!fsmByNode.has(node.id)) {
            const h = { kind: 'wait', owner: node.id, node, stateIdx: s, targets: getNexts(node.id), ctx: subCtx(ctx, 'message') };
            fsmByNode.set(node.id, h); enqueue(h);
          }
          stop = true;
          break;
        }
        case 'contact_request': {
          const { data } = node;
          const pm = effPM(node, ctx);
          lines.push(`${ind}await message.answer(`);
          lines.push(`${ind}    ${escapePyFStr(data.prompt || 'Поделитесь номером телефона:')},`);
          if (pm) lines.push(`${ind}    ${pm.slice(2)},`);
          lines.push(`${ind}    reply_markup=ReplyKeyboardMarkup(`);
          lines.push(`${ind}        keyboard=[[KeyboardButton(text=${escapePy(data.button_text || 'Поделиться номером')}, request_contact=True)]],`);
          lines.push(`${ind}        resize_keyboard=True, one_time_keyboard=True`);
          lines.push(`${ind}    )`);
          lines.push(`${ind})`);
          const s = fsmState(node);
          lines.push(`${ind}await state.set_state(BotStates.wait_input_${s})`);
          lines.push(`${ind}return`);
          if (!fsmByNode.has(node.id)) {
            const h = { kind: 'contact', owner: node.id, node, stateIdx: s, targets: getNexts(node.id), ctx: subCtx(ctx, 'message') };
            fsmByNode.set(node.id, h); enqueue(h);
          }
          stop = true;
          break;
        }
        default: break;
      }

      tagFrom(lines, node.id, from);
      if (stop) break;

      const nexts = getNexts(node.id, 'out');
      if (nexts.length <= 1) { current = nexts[0] || null; continue; }
      for (const n of nexts) lines.push(...genChainRaw(n, depth, new Set(visited), ctx));
      break;
    }
    return lines;
  }

  function genSeq(ids, depth, visited, ctx) {
    const out = [];
    for (const id of ids || []) out.push(...genChainRaw(id, depth, new Set(visited), ctx));
    return out;
  }
  function genTargets(ids, depth, visited, ctx) {
    const out = genSeq(ids, depth, visited, ctx);
    if (!out.length) out.push(`${IND(depth)}pass`);
    return out;
  }


  function genMedia(node, depth) {
    const ind = IND(depth);
    const { data } = node;
    const fileId = escapePyFStr(data.file_id || '');
    const notif  = data.disable_notification ? ', disable_notification=True' : '';

    if (data.media_type === 'sticker') {
      return [`${ind}await message.answer_sticker(${fileId}${notif})`];
    }

    const caption = data.caption ? `, caption=${escapePyFStr(data.caption)}` : '';
    const pm      = data.parse_mode && data.parse_mode !== 'None' && data.caption ? `, parse_mode="${data.parse_mode}"` : '';
    const methodMap = { photo: 'answer_photo', video: 'answer_video', gif: 'answer_animation', audio: 'answer_audio', document: 'answer_document' };
    const method = methodMap[data.media_type] || 'answer_photo';

    return [`${ind}await message.${method}(${fileId}${caption}${pm}${notif})`];
  }

  function genVariable(node, depth) {
    const ind = IND(depth);
    const { data } = node;
    const uid = 'message.from_user.id';

    if (data.operation === 'set') {
      const val = /^\{[^}]+\}$/.test((data.var_value || '').trim())
        ? data.var_value.trim().slice(1, -1)
        : escapePyFStr(data.var_value || '');
      const loc = pyIdent(data.var_name);
      const store = data.scope === 'global'
        ? `${ind}_set_global_var(${escapePy(data.var_name)}, ${loc})`
        : `${ind}_set_user_var(${uid}, ${escapePy(data.var_name)}, ${loc})`;
      return [`${ind}${loc} = ${val}`, store];
    }
    const res = data.result_variable || data.var_name;
    if (data.scope === 'global') {
      return [`${ind}${res} = _get_global_var(${escapePy(data.var_name)})`];
    }
    return [`${ind}${res} = _get_user_var(${uid}, ${escapePy(data.var_name)})`];
  }

  function genListOp(node, depth) {
    const ind = IND(depth);
    const { data } = node;
    const uid  = 'message.from_user.id';
    const name = escapePy(data.list_name);
    const val  = escapePyFStr(data.value || '');
    const res  = data.result_variable || 'result';

    if (data.scope === 'global') {
      switch (data.operation) {
        case 'create': return [`${ind}_global_list_op(${name}, 'create')`];
        case 'append': return [`${ind}_global_list_op(${name}, 'append', ${val})`];
        case 'remove': return [`${ind}_global_list_op(${name}, 'remove', ${val})`];
        case 'clear':  return [`${ind}_global_list_op(${name}, 'clear')`];
        case 'get':    return [`${ind}${res} = _global_list_op(${name}, 'get', index=${data.index || 0})`];
        case 'length': return [`${ind}${res} = _global_list_op(${name}, 'length')`];
        default: return [`${ind}pass`];
      }
    }
    switch (data.operation) {
      case 'create': return [`${ind}_list_op(${uid}, ${name}, 'create')`];
      case 'append': return [`${ind}_list_op(${uid}, ${name}, 'append', ${val})`];
      case 'remove': return [`${ind}_list_op(${uid}, ${name}, 'remove', ${val})`];
      case 'clear':  return [`${ind}_list_op(${uid}, ${name}, 'clear')`];
      case 'get':    return [`${ind}${res} = _list_op(${uid}, ${name}, 'get', index=${data.index || 0})`];
      case 'length': return [`${ind}${res} = _list_op(${uid}, ${name}, 'length')`];
      default: return [`${ind}pass`];
    }
  }

  function genTimer(node, depth) {
    const { data } = node;
    const multipliers = { seconds: 1, minutes: 60, hours: 3600, days: 86400 };
    const seconds = (parseFloat(data.delay) || 1) * (multipliers[data.unit] || 1);
    return [`${IND(depth)}await asyncio.sleep(${seconds})`];
  }

  function genAdminNotify(node, depth) {
    const ind = IND(depth);
    const { data } = node;
    const tmpl = (data.message_template || '')
      .replace(/\{user_id\}/g, '{message.from_user.id}')
      .replace(/\{username\}/g, '{message.from_user.username}')
      .replace(/\{first_name\}/g, '{message.from_user.first_name}')
      .replace(/\{last_name\}/g, '{message.from_user.last_name}')
      .replace(/\{text\}/g, '{message.text}')
      .replace(/\{chat_id\}/g, '{message.chat.id}');
    const msg = escapePyFStr(tmpl);

    const lines = [];
    const mode = data.admin_mode || 'id';
    const list = (data.admins && data.admins.length ? data.admins : [data.admin_chat_id])
      .map((x) => String(x ?? '').trim()).filter(Boolean);

    if (mode === 'username') {
      const unames = list.map((u) => u.replace(/^@/, ''));
      const ph = unames.map(() => DB.ph).join(',');
      lines.push(`${ind}_admin_ids = [r[0] for r in _db_query("SELECT user_id FROM bot_users WHERE username IN (${ph})", (${unames.map(escapePy).join(', ')}${unames.length === 1 ? ',' : ''}))]`);
    } else if (mode === 'tag') {
      const tag = escapePy(`%${(data.admin_tag || '').trim()}%`);
      lines.push(`${ind}_admin_ids = [r[0] for r in _db_query("SELECT user_id FROM bot_users WHERE tags LIKE ${DB.ph}", (${tag},))]`);
    } else {
      lines.push(`${ind}_admin_ids = [${list.join(', ') || '0  # TODO: укажите Chat ID администратора'}]`);
    }
    lines.push(`${ind}for _aid in _admin_ids:`);
    lines.push(`${ind}    try:`);
    lines.push(`${ind}        await bot.send_message(_aid, ${msg})`);
    lines.push(`${ind}    except Exception:`);
    lines.push(`${ind}        pass`);
    return lines;
  }

  function tryAttachKeyboard(chainLines, kbLines, kbVar, ind, btnId) {
    if (!chainLines || !chainLines.length) return false;
    const lastIdx = chainLines.length - 1;
    const { ids, text } = untagLine(chainLines[lastIdx]);
    const trimmed = text.trimEnd();
    if (!trimmed.startsWith(ind) || trimmed[ind.length] === ' ') return false;
    const body = trimmed.slice(ind.length);
    if (!/^await message\.(answer|answer_photo|answer_video|answer_animation|answer_audio|answer_document|answer_sticker)\(/.test(body)) return false;
    if (!body.endsWith(')') || /reply_markup\s*=/.test(body)) return false;
    const attached = tagLine(`${trimmed.slice(0, -1)}, reply_markup=${kbVar})`, [...ids, btnId]);
    chainLines.splice(lastIdx, 1, ...kbLines.map((l) => tagLine(l, btnId)), attached);
    return true;
  }

  function buildButtonRows(buttons) {
    const rows = [];
    let cur = [];
    for (let i = 0; i < buttons.length; i++) {
      cur.push({ b: buttons[i], i });
      if (buttons[i].row_break && i < buttons.length - 1) { rows.push(cur); cur = []; }
    }
    if (cur.length) rows.push(cur);
    return rows;
  }

  function inlineKbLines(node, ind) {
    const effs = cbEff.get(node.id) || [];
    const out = [`${ind}kb = InlineKeyboardMarkup(inline_keyboard=[`];
    for (const row of buildButtonRows(node.data.buttons ?? [])) {
      const cells = row
        .map(({ b, i }) => `InlineKeyboardButton(text=${escapePy(b.text ?? '')}, callback_data=${escapePy(effs[i] ?? (b.callback_data || `btn_${i}`))}${b.style ? `, style="${b.style}"` : ''})`)
        .join(', ');
      out.push(`${ind}    [${cells}],`);
    }
    out.push(`${ind}])`);
    return out;
  }

  function registerCallbacks(node, ctx) {
    const effs = cbEff.get(node.id) || [];
    (node.data.buttons ?? []).forEach((b, i) => {
      const targets = getNexts(node.id, `btn_${i}`);
      if (!targets.length) return;
      const data = effs[i] ?? (b.callback_data || `btn_${i}`);
      if (cbByData.has(data)) return;
      const h = { kind: 'cb', owner: node.id, data, name: fnName(`cb_${pyIdent(data)}`), targets, ctx: subCtx(ctx, 'callback') };
      cbByData.set(data, h);
      enqueue(h);
    });
  }

  function genButtons(node, depth, visited, chainLines, ctx) {
    const lines = [];
    const ind = IND(depth);
    const { data, id } = node;
    const buttons = data.buttons ?? [];
    const msgText = data.message_text || 'Выберите:';
    const pm = effPM(node, ctx);

    if (data.button_type === 'reply') {
      lines.push(`${ind}kb = ReplyKeyboardMarkup(`);
      lines.push(`${ind}    keyboard=[`);
      for (const row of buildButtonRows(buttons)) {
        const cells = row.map(({ b }) => `KeyboardButton(text=${escapePy(b.text ?? '')}${b.style ? `, style="${b.style}"` : ''})`).join(', ');
        lines.push(`${ind}        [${cells}],`);
      }
      const opts = [];
      if (data.resize_keyboard)   opts.push('resize_keyboard=True');
      if (data.one_time_keyboard) opts.push('one_time_keyboard=True');
      lines.push(`${ind}    ],`);
      if (opts.length) lines.push(`${ind}    ${opts.join(', ')},`);
      lines.push(`${ind})`);
      lines.push(`${ind}await message.answer(${escapePyFStr(msgText)}${pm}, reply_markup=kb)`);
      buttons.forEach((b, i) => {
        const targets = getNexts(id, `btn_${i}`);
        const txt = b.text ?? '';
        if (!targets.length || !txt || replyByTxt.has(txt)) return;
        const h = { kind: 'reply', owner: id, text: txt, name: fnName(`on_reply_btn_${replyCounter++}`), targets, ctx: subCtx(ctx, 'message') };
        replyByTxt.set(txt, h);
        enqueue(h);
      });
    } else if (data.dynamic_enabled) {
      const k = dynIndex(node);
      const prefix    = `dyn_${k}_`;
      const source    = data.dynamic_source || 'items';
      const textExpr  = data.dynamic_text_expr || 'str(item)';
      const cbExpr    = data.dynamic_callback_expr || 'str(item)';
      const cols      = Math.max(1, parseInt(data.dynamic_columns, 10) || 1);
      lines.push(`${ind}_kb_rows, _kb_row = [], []`);
      lines.push(`${ind}for item in ${source}:`);
      lines.push(`${ind}    _kb_row.append(InlineKeyboardButton(text=str(${textExpr}), callback_data="${prefix}" + str(${cbExpr})))`);
      lines.push(`${ind}    if len(_kb_row) >= ${cols}:`);
      lines.push(`${ind}        _kb_rows.append(_kb_row); _kb_row = []`);
      lines.push(`${ind}if _kb_row: _kb_rows.append(_kb_row)`);
      lines.push(`${ind}kb = InlineKeyboardMarkup(inline_keyboard=_kb_rows)`);
      lines.push(`${ind}await message.answer(${escapePyFStr(msgText)}${pm}, reply_markup=kb)`);

      const targets = getNexts(id, 'btn_dynamic');
      if (targets.length && !dynByNode.has(id)) {
        const h = { kind: 'dyn', owner: id, prefix, name: fnName(`cb_dyn_${k}`), targets,
          resultVar: pyIdent(data.dynamic_result_var || 'dyn_arg'), ctx: subCtx(ctx, 'callback') };
        dynByNode.set(id, h);
        enqueue(h);
      }
    } else {
      const kbLines = inlineKbLines(node, ind);
      const attached = data.attach_to_previous && tryAttachKeyboard(chainLines, kbLines, 'kb', ind, id);
      if (!attached) {
        lines.push(...kbLines);
        lines.push(`${ind}await message.answer(${escapePyFStr(msgText)}${pm}, reply_markup=kb)`);
      }
      registerCallbacks(node, ctx);
    }
    return lines;
  }

  function genEditMessage(node, depth, ctx) {
    const lines = [];
    const ind = IND(depth);
    const { data } = node;
    const wantText   = data.edit_text !== false;
    const wantMarkup = !!data.edit_markup;

    let kbArg = '';
    if (wantMarkup) {
      lines.push(...inlineKbLines(node, ind));
      kbArg = ', reply_markup=kb';
      registerCallbacks(node, ctx);
    }

    if (wantText) {
      const text = escapePyFStr(data.new_text || '');
      const pm = data.parse_mode && data.parse_mode !== 'None' ? `, parse_mode="${data.parse_mode}"` : '';
      lines.push(`${ind}await message.edit_text(${text}${pm}${kbArg})`);
    } else if (wantMarkup) {
      lines.push(`${ind}await message.edit_reply_markup(reply_markup=kb)`);
    }
    return lines;
  }

  function genDynamicStepEntry(node, depth, visited, ctx) {
    const ind = IND(depth);
    const { data, id } = node;
    const s = fsmState(node);
    const stepsExpr = data.steps_source || 'question_list';

    const lines = [
      `${ind}_ds_steps = ${stepsExpr}`,
      `${ind}if _ds_steps:`,
      `${ind}    _set_user_var(message.from_user.id, "_ds_idx_${s}", 0)`,
      `${ind}    await state.update_data(_ds_steps_${s}=list(_ds_steps))`,
      `${ind}    await message.answer(str(_ds_steps[0]))`,
      `${ind}    await state.set_state(BotStates.wait_input_${s})`,
      `${ind}    return`,
    ];
    const targets = getNexts(id, 'out');
    if (!fsmByNode.has(id)) {
      const h = { kind: 'dynstep', owner: id, node, stateIdx: s, targets, ctx: subCtx(ctx, 'message') };
      fsmByNode.set(id, h); enqueue(h);
    }
    lines.push(...genSeq(targets, depth, visited, ctx));
    return lines;
  }

  function genCondition(node, depth, visited, ctx) {
    const lines = [];
    const ind = IND(depth);
    const { data, id } = node;

    let expr;
    if (data.condition_mode === 'code') {
      expr = data.condition_expression || 'True';
    } else {
      const field = data.field || 'message.text';
      const op    = data.operator || '==';
      const val   = String(data.value ?? '');
      const isLiteral = isNumericStr(val) || /^(True|False|None)$/.test(val.trim());
      const rhs = isLiteral ? val.trim() : escapePy(val);
      if (op === 'contains')        expr = `${rhs} in ${field}`;
      else if (op === 'startswith') expr = `${field}.startswith(${rhs})`;
      else if (op === 'endswith')   expr = `${field}.endswith(${rhs})`;
      else                          expr = `${field} ${op} ${rhs}`;
    }

    lines.push(`${ind}if ${expr}:`);
    lines.push(...genTargets(getNexts(id, 'true'), depth + 1, visited, ctx));
    lines.push(`${ind}else:`);
    lines.push(...genTargets(getNexts(id, 'false'), depth + 1, visited, ctx));
    return lines;
  }

  function pyHeadersDict(text) {
    const rows = (text || '').split('\n').map((l) => l.trim()).filter(Boolean);
    const entries = [];
    for (const l of rows) {
      const idx = l.indexOf(':');
      if (idx === -1) continue;
      entries.push(`${escapePy(l.slice(0, idx).trim())}: ${escapePyFStr(l.slice(idx + 1).trim())}`);
    }
    return entries.length ? `{${entries.join(', ')}}` : null;
  }

  function genHttpRequest(node, depth) {
    const ind = IND(depth);
    const { data } = node;
    const url     = escapePy(data.url || '');
    const timeout = parseInt(data.timeout) || 10;
    const resVar  = data.result_variable || 'response';
    const hdrs    = pyHeadersDict(data.headers);
    const hdrArg  = hdrs ? `, headers=${hdrs}` : '';
    const lines   = [];

    lines.push(`${ind}async with aiohttp.ClientSession() as _sess:`);
    if (['POST', 'PUT'].includes(data.method) && data.body) {
      lines.push(`${ind}    async with _sess.${(data.method || 'GET').toLowerCase()}(${url}, json=_json.loads(${escapePy(data.body)}), timeout=aiohttp.ClientTimeout(total=${timeout})${hdrArg}) as _resp:`);
    } else {
      lines.push(`${ind}    async with _sess.${(data.method || 'get').toLowerCase()}(${url}, timeout=aiohttp.ClientTimeout(total=${timeout})${hdrArg}) as _resp:`);
    }
    lines.push(`${ind}        ${resVar} = await _resp.text()`);
    return lines;
  }

  function genCodeBlock(node, depth) {
    const ind = IND(depth);
    const code = (node.data.code || '').replace(/\r\n?/g, '\n').trimEnd();
    if (!code) return [`${ind}pass`];
    return code.split('\n').map((l) => (l.trim() ? `${ind}${l}` : ''));
  }

  function genLoop(node, depth, visited, ctx) {
    const lines = [];
    const ind = IND(depth);
    const { data, id } = node;

    const type = data.loop_type || 'count';
    let header;
    let guardVar = null;

    if (type === 'list' && data.list_var) {
      const itemVar = data.item_var || 'item';
      const listVar = data.list_var.trim();
      header = `for ${itemVar} in (${listVar} or []):`;
    } else if (type === 'range') {
      const iterVar = data.iter_var || 'i';
      const start = String(data.range_start ?? '0').trim() || '0';
      const stop  = String(data.range_stop  ?? '10').trim() || '10';
      const step  = String(data.range_step  ?? '1').trim()  || '1';
      header = `for ${iterVar} in range(${start}, ${stop}, ${step}):`;
    } else if (type === 'while') {
      const cond = (data.while_condition || 'True').trim();
      const maxIter = String(data.max_iterations || '1000').trim() || '1000';
      guardVar = `_loop_guard_${depth}`;
      lines.push(`${ind}${guardVar} = 0`);
      header = `while (${cond}) and ${guardVar} < ${maxIter}:`;
    } else {
      const count = String(data.count || '10').trim();
      const iterVar = data.iter_var || 'i';
      header = `for ${iterVar} in range(${count}):`;
    }

    lines.push(`${ind}${header}`);
    if (guardVar) lines.push(`${ind}    ${guardVar} += 1`);
    const bodyIds = getNexts(id, 'body').filter((b) => !visited.has(b));
    const bodyVisited = new Set(visited);
    bodyVisited.add(id);
    const body = genSeq(bodyIds, depth + 1, bodyVisited, ctx);
    if (body.length) lines.push(...body);
    else if (!guardVar) lines.push(`${ind}    pass`);
    return lines;
  }

  function genWebhook(node, depth) {
    const ind = IND(depth);
    const { data } = node;
    const url     = escapePy(data.url || '');
    const timeout = parseInt(data.timeout) || 10;
    const resVar  = data.result_variable || 'wh_status';
    const payloadStr = (data.payload || '{}').trim();
    const hasTemplates = /\{[a-zA-Z_][a-zA-Z0-9_.]*\}/.test(payloadStr);
    let payloadExpr;
    if (hasTemplates) {
      const slots = [];
      const replaced = payloadStr.replace(/\{[a-zA-Z_][a-zA-Z0-9_.]*\}/g, (m) => {
        slots.push(m);
        return `\x00${slots.length - 1}\x00`;
      });
      let fBody = replaced.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
        .replace(/\{/g, '{{').replace(/\}/g, '}}');
      slots.forEach((t, i) => { fBody = fBody.replace(`\x00${i}\x00`, t); });
      payloadExpr = `_json.loads(f"${fBody}")`;
    } else {
      const safe = payloadStr.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
      payloadExpr = `_json.loads('${safe}')`;
    }
    const method = (data.method || 'POST').toLowerCase();
    const hdrs   = pyHeadersDict(data.headers);
    const hdrArg = hdrs ? `, headers=${hdrs}` : '';
    return [
      `${ind}async with aiohttp.ClientSession() as _sess:`,
      `${ind}    async with _sess.${method}(${url}, json=${payloadExpr}, timeout=aiohttp.ClientTimeout(total=${timeout})${hdrArg}) as _resp:`,
      `${ind}        ${resVar} = _resp.status`,
    ];
  }

  function genDbCreate(node, depth) {
    const { data } = node;
    const cols = (data.columns ?? []).map((c) => {
      let type = c.type || 'TEXT';
      if (c.autoincrement && sqlDialect === 'postgres' && /INT/i.test(type)) type = 'SERIAL';
      else if (sqlDialect !== 'sqlite' && /^INT(EGER)?$/i.test(type) && !c.autoincrement && /(^|_)(user|chat)_id$/i.test(c.name || '')) type = 'BIGINT';
      let def = `${c.name} ${type}`;
      if (c.primary_key)   def += ' PRIMARY KEY';
      if (c.autoincrement && sqlDialect === 'sqlite') def += ' AUTOINCREMENT';
      if (c.autoincrement && sqlDialect === 'mysql')  def += ' AUTO_INCREMENT';
      if (c.not_null)      def += ' NOT NULL';
      if (c.unique)        def += ' UNIQUE';
      return def;
    });
    const ifne = data.if_not_exists !== false ? 'IF NOT EXISTS ' : '';
    return [`${IND(depth)}_db_exec("CREATE TABLE ${ifne}${data.table_name} (${cols.join(', ')})")`];
  }

  function mapWriteMode(mode) {
    const m = (mode || 'INSERT').toUpperCase();
    if (sqlDialect === 'sqlite') return m;
    if (sqlDialect === 'mysql') {
      if (m === 'INSERT OR REPLACE') return 'REPLACE';
      if (m === 'INSERT OR IGNORE')  return 'INSERT IGNORE';
      return m === 'UPDATE' ? 'UPDATE' : 'INSERT';
    }
    return m === 'UPDATE' ? 'UPDATE' : 'INSERT';
  }

  const pyTuple = (items) => (items.length === 1 ? `(${items[0]},)` : `(${items.join(', ')})`);
  const fixFrom = (expr) => String(expr ?? '').replace(/\bmessage\.from\./g,'message.from_user.');

  function genDbWrite(node, depth) {
    const ind = IND(depth);
    const { data } = node;
    const values = (data.values ?? []).map((v) => ({ ...v, value: fixFrom(v.value) }));
    const mode   = mapWriteMode(data.mode || 'INSERT');
    const isUpd  = mode.toUpperCase().startsWith('UPDATE');
    const PH = DB.ph;

    if (isUpd) {
      const sets = values.map((v) => `${v.column} = ${PH}`).join(', ');
      const { sql: ws, params: wp } = parseWhere(fixFrom(data.where_clause));
      const wsd = ws.split('?').join(PH);
      const allP = [...values.map((v) => v.value), ...wp].join(', ');
      return [
        `${ind}_db_exec(`,
        `${ind}    "UPDATE ${data.table_name} SET ${sets}${wsd ? ` WHERE ${wsd}` : ''}",`,
        `${ind}    (${allP},)`,
        `${ind})`,
      ];
    }
    const cols  = values.map((v) => v.column).join(', ');
    const ph    = values.map(() => PH).join(', ');
    const params = values.map((v) => v.value).join(', ');
    const pgIgnore = sqlDialect === 'postgres' && /OR IGNORE/i.test(data.mode || '') ? ' ON CONFLICT DO NOTHING' : '';
    return [
      `${ind}_db_exec(`,
      `${ind}    "${mode} INTO ${data.table_name} (${cols}) VALUES (${ph})${pgIgnore}",`,
      `${ind}    (${params},)`,
      `${ind})`,
    ];
  }

  function genDbRead(node, depth) {
    const { data } = node;
    const { sql: ws, params: wp } = parseWhere(fixFrom(data.where_clause));
    const wsd = ws.split('?').join(DB.ph);
    let sql = `SELECT ${data.columns_to_select || '*'} FROM ${data.table_name}`;
    if (wsd) sql += ` WHERE ${wsd}`;
    if (data.order_by) sql += ` ORDER BY ${data.order_by}`;
    if (data.limit)    sql += ` LIMIT ${data.limit}`;
    const varName  = data.result_variable || 'result';
    const one      = data.fetch_mode !== 'all';
    const paramsStr = wp.length ? `, (${wp.join(', ')},)` : '';
    return [`${IND(depth)}${varName} = _db_query("${sql}"${paramsStr}, one=${one ? 'True' : 'False'})`];
  }

  function genDbDelete(node, depth) {
    const { data } = node;
    const { sql: ws, params: wp } = parseWhere(fixFrom(data.where_clause));
    const wsd = ws.split('?').join(DB.ph);
    let sql = `DELETE FROM ${data.table_name}`;
    if (wsd) sql += ` WHERE ${wsd}`;
    const paramsStr = wp.length ? `, (${wp.join(', ')},)` : '';
    return [`${IND(depth)}_db_exec("${sql}"${paramsStr})`];
  }

  function genGetUserInfo(node, depth) {
    const ind = IND(depth);
    const fields = node.data.fields || [];
    const lines = [];
    const mapping = {
      id:            'message.from_user.id',
      first_name:    'message.from_user.first_name or ""',
      last_name:     'message.from_user.last_name or ""',
      username:      'message.from_user.username or ""',
      language_code: 'message.from_user.language_code or ""',
      is_premium:    'bool(getattr(message.from_user, "is_premium", False))',
    };
    for (const { field, var_name } of fields) {
      const src = mapping[field] || `getattr(message.from_user, ${escapePy(field)}, None)`;
      lines.push(`${ind}${pyIdent(var_name)} = ${src}`);
    }
    return lines.length ? lines : [`${ind}pass`];
  }

  function audienceQuery(data, cols) {
    const base = `SELECT ${cols} FROM bot_users`;
    if (data.audience === 'condition' && (data.filter_sql || '').trim()) {
      return [escapePy(`${base} WHERE ${(data.filter_sql || '').trim()}`), ''];
    }
    if (data.audience === 'tag' && (data.tag || '').trim()) {
      return [escapePy(`${base} WHERE tags LIKE ${DB.ph}`), `(${escapePy(`%${(data.tag || '').trim()}%`)},)`];
    }
    return [escapePy(base), ''];
  }

  function genBroadcast(node, depth) {
    const ind  = IND(depth);
    const { data } = node;
    const text = escapePyFStr(data.message_text || '');
    const pm   = data.parse_mode && data.parse_mode !== 'None' ? `, parse_mode="${data.parse_mode}"` : '';
    const delay = parseFloat(data.delay_between) || 0.05;
    const [q, p] = audienceQuery(data, 'user_id');
    return [
      `${ind}_bcast_uids = [r[0] for r in _db_query(${q}${p ? `, ${p}` : ''})]`,
      `${ind}for _bcast_uid in _bcast_uids:`,
      `${ind}    try:`,
      `${ind}        await bot.send_message(_bcast_uid, ${text}${pm})`,
      `${ind}    except Exception:`,
      `${ind}        pass`,
      `${ind}    await asyncio.sleep(${delay})`,
    ];
  }

  function genSaveUser(node, depth) {
    const ind  = IND(depth);
    const { data } = node;
    const rows = (data.fields && data.fields.length)
      ? data.fields
      : [
          { column: 'user_id',    value: 'message.from_user.id' },
          { column: 'username',   value: 'message.from_user.username or ""' },
          { column: 'first_name', value: 'message.from_user.first_name or ""' },
          { column: 'last_name',  value: 'message.from_user.last_name or ""' },
        ];
    const cols = [];
    const vals = [];
    for (const f of rows) {
      if (!f.column) continue;
      cols.push(f.column);
      vals.push(f.value || '""');
    }
    if (!cols.length) return [`${ind}pass`];
    const ph = cols.map(() => DB.ph).join(',');
    const upd = cols.filter((c) => c !== 'user_id');
    let sql;
    if (sqlDialect === 'postgres') {
      const conflict = cols.includes('user_id')
        ? (upd.length ? ` ON CONFLICT (user_id) DO UPDATE SET ${upd.map((c) => `${c} = EXCLUDED.${c}`).join(', ')}` : ' ON CONFLICT (user_id) DO NOTHING')
        : ' ON CONFLICT DO NOTHING';
      sql = `INSERT INTO bot_users(${cols.join(', ')}) VALUES(${ph})${conflict}`;
    } else if (sqlDialect === 'mysql') {
      sql = upd.length
        ? `INSERT INTO bot_users(${cols.join(', ')}) VALUES(${ph}) ON DUPLICATE KEY UPDATE ${upd.map((c) => `${c} = VALUES(${c})`).join(', ')}`
        : `INSERT IGNORE INTO bot_users(${cols.join(', ')}) VALUES(${ph})`;
    } else {
      sql = `INSERT OR REPLACE INTO bot_users(${cols.join(', ')}) VALUES(${ph})`;
    }
    return [
      `${ind}_db_exec(`,
      `${ind}    "${sql}",`,
      `${ind}    ${pyTuple(vals)}`,
      `${ind})`,
    ];
  }

  function genGoogleSheets(node, depth) {
    const ind  = IND(depth);
    const { data } = node;
    const credsVar = data.credentials_var || 'GOOGLE_CREDS_JSON';
    const sheetId  = data.spreadsheet_id  || '';
    const sheetName = data.sheet_name     || 'Sheet1';

    if (data.action === 'read') {
      const resVar = data.result_variable || 'sheets_result';
      return [
        `${ind}_gc = _gspread.service_account_from_dict(_json.loads(${escapePy(credsVar)}))`,
        `${ind}_gs_ws = _gc.open_by_key(${escapePy(sheetId)}).worksheet(${escapePy(sheetName)})`,
        `${ind}${resVar} = _gs_ws.get_all_values()`,
      ];
    }
    const rowItems = (data.row_data || '').split(',').map((s) => s.trim());
    const rowStr   = rowItems.map((v) => {
      if (/^\{[a-zA-Z_][a-zA-Z0-9_.]*\}$/.test(v)) return v.slice(1, -1);
      return escapePy(v);
    }).join(', ');
    return [
      `${ind}_gc = _gspread.service_account_from_dict(_json.loads(${escapePy(credsVar)}))`,
      `${ind}_gs_ws = _gc.open_by_key(${escapePy(sheetId)}).worksheet(${escapePy(sheetName)})`,
      `${ind}_gs_ws.append_row([${rowStr}])`,
    ];
  }

  function genRateLimit(node, depth, visited, ctx) {
    const ind  = IND(depth);
    const { data, id } = node;
    const maxCalls   = parseInt(data.max_calls)     || 3;
    const windowSec  = parseInt(data.window_seconds) || 60;
    const blockedMsg = escapePy(data.blocked_message || 'Подождите немного');
    const scope      = data.scope || 'user';
    const countWhat  = data.count_what || 'any';
    const key = `rl_${rlIndex(node)}`;
    const lines = [];
    if (scope === 'global') lines.push(`${ind}_rl_key = ${escapePy(key)}`);
    else                    lines.push(`${ind}_rl_key = (message.from_user.id, ${escapePy(key)})`);
    if (countWhat === 'command')       lines.push(`${ind}_rl_apply = (message.text or '').startswith('/')`);
    else if (countWhat === 'callback') lines.push(`${ind}_rl_apply = ${ctx?.kind === 'callback' ? 'callback is not None' : 'False'}`);
    else                               lines.push(`${ind}_rl_apply = True`);
    lines.push(`${ind}_rl_now = _dt.datetime.now().timestamp()`);
    lines.push(`${ind}_rl_times = [t for t in _rl_store.get(_rl_key, []) if _rl_now - t < ${windowSec}]`);
    lines.push(`${ind}if (not _rl_apply) or len(_rl_times) < ${maxCalls}:`);
    lines.push(`${ind}    if _rl_apply:`);
    lines.push(`${ind}        _rl_times.append(_rl_now)`);
    lines.push(`${ind}        _rl_store[_rl_key] = _rl_times`);
    lines.push(...genSeq(getNexts(id, 'allowed'), depth + 1, visited, ctx));
    lines.push(`${ind}else:`);
    lines.push(`${ind}    await message.answer(${blockedMsg})`);
    lines.push(...genSeq(getNexts(id, 'blocked'), depth + 1, visited, ctx));
    return lines;
  }

  function computeLoads(textLines) {
    if (!storedVars.size) return [];
    const code = pyCodeOnly(textLines.join('\n')).split('\n');
    const assigned = new Set();
    const needed = [];
    for (const ln of code) {
      const am = ln.match(/^\s*([A-Za-z_]\w*)\s*=(?!=)/);
      const fm = ln.match(/^\s*(?:async\s+)?for\s+([A-Za-z_]\w*)\s+in\b/);
      for (const idn of readIdents(ln)) {
        if (fm && idn === fm[1]) continue;
        if (storedVars.has(idn) && !assigned.has(idn) && !needed.includes(idn)) needed.push(idn);
      }
      if (am) assigned.add(am[1]);
      if (fm) assigned.add(fm[1]);
    }
    return needed;
  }
  function loadLines(head, body, ownerId, depth = 1) {
    const scan = [...head, ...body].map((l) => untagLine(l).text)
      .filter((t) => !/^\s*(@|async def |def )/.test(t));
    return computeLoads(scan).map((loc) => {
      const v = storedVars.get(loc);
      const src = v.scope === 'global'
        ? `_get_global_var(${escapePy(v.name)})`
        : `_get_user_var(message.from_user.id, ${escapePy(v.name)})`;
      return tagLine(`${IND(depth)}${loc} = ${src}  # restore`, ownerId);
    });
  }

  const scheduleNodes = nodes.filter((n) => n.type === 'schedule');
  const deepLinkNodes = nodes.filter((n) => n.type === 'deep_link');
  const commandNodes  = nodes.filter((n) => n.type === 'command');
  const msgHandlerNodes = nodes.filter((n) => n.type === 'message_handler');
  const hasStartCmd = commandNodes.some((n) => (n.data.command_name ?? '/start').replace(/^\//, '').trim() === 'start');

  const rootBlocks = { schedule: [], deep_link: [], command: [], message_handler: [] };
  const T = (ownerId) => (s) => tagLine(s, ownerId);

  scheduleNodes.forEach((sch, k) => {
    markEmitted(sch);
    const t = T(sch.id);
    const ctx = { kind: 'schedule', parseMode: null };
    const head = [t(`async def _schedule_${k}_job(message, state):`)];
    const body = tagFrom(genTargets(getNexts(sch.id), 1, new Set(), ctx), sch.id);
    rootBlocks.schedule.push({ node: sch, k, head, body });
  });

  deepLinkNodes.forEach((dl, k) => {
    markEmitted(dl);
    const { data } = dl;
    const t = T(dl.id);
    const name = fnName(k === 0 ? 'cmd_start_deep_link' : `cmd_start_deep_link_${k + 1}`);
    const payloadVar  = pyIdent(data.payload_var || 'start_payload');
    const referrerVar = pyIdent(data.referrer_var || 'referrer_id');
    const head = [
      t(`@dp.message(${hasStartCmd ? 'CommandStart(deep_link=True)' : 'CommandStart()'})`),
      t(`async def ${name}(message: Message${STATE_PH}):`),
      t('    _dl_args = message.text.split() if message.text else []'),
      t(`    ${payloadVar} = _dl_args[1] if len(_dl_args) > 1 else ""`),
    ];
    if (data.save_referrer) head.push(t(`    ${referrerVar} = int(_dl_args[1]) if len(_dl_args) > 1 and _dl_args[1].isdigit() else None`));
    const body = tagFrom(genTargets(getNexts(dl.id), 1, new Set(), { kind: 'message', parseMode: null }), dl.id);
    rootBlocks.deep_link.push({ node: dl, head, body });
  });

  const adminCmd = commandNodes.some((n) => n.data?.only_admins);
  commandNodes.forEach((cmd) => {
    markEmitted(cmd);
    const { data } = cmd;
    const t = T(cmd.id);
    const cmdName     = (data.command_name ?? '/start').replace(/^\//, '');
    const handlerName = data.handler_name || `cmd_${pyIdent(cmdName)}`;
    usedFn.add(handlerName);
    const filters = [];
    if (data.only_private) filters.push('F.chat.type == "private"');
    if (data.only_groups)  filters.push('F.chat.type.in_({"group", "supergroup"})');
    if (data.only_admins)  filters.push('F.from_user.id.in_(ADMIN_IDS)');
    const filterStr = filters.length ? `, ${filters.join(', ')}` : '';
    const head = [
      t(`@dp.message(Command("${cmdName}")${filterStr})`),
      t(`async def ${handlerName}(message: Message${STATE_PH}):`),
    ];
    const pm = data.parse_mode && data.parse_mode !== 'None' ? data.parse_mode : null;
    const body = tagFrom(genTargets(getNexts(cmd.id), 1, new Set(), { kind: 'message', parseMode: pm }), cmd.id);
    rootBlocks.command.push({ node: cmd, head, body });
  });

  msgHandlerNodes.forEach((mh) => {
    markEmitted(mh);
    const { data } = mh;
    const t = T(mh.id);
    const handlerName = pyIdent(data.handler_name || 'on_message');
    usedFn.add(handlerName);
    const filterType  = data.filter_type  || 'any';
    const filterValue = data.filter_value || '';
    let filterStr;
    if (filterType === 'contains')      filterStr = `F.text.contains(${escapePy(filterValue)})`;
    else if (filterType === 'equals')   filterStr = `F.text == ${escapePy(filterValue)}`;
    else if (filterType === 'regex')    filterStr = `F.text.regexp(${escapePy(filterValue)})`;
    else if (filterType === 'command')  filterStr = `Command(commands=[${escapePy(filterValue.replace(/^\//, ''))}])`;
    else filterStr = 'F.text';
    const head = [
      t(`@dp.message(${filterStr})`),
      t(`async def ${handlerName}(message: Message${STATE_PH}):`),
    ];
    const body = tagFrom(genTargets(getNexts(mh.id), 1, new Set(), { kind: 'message', parseMode: null }), mh.id);
    rootBlocks.message_handler.push({ node: mh, head, body });
  });

  while (queue.length) {
    const h = queue.shift();
    const t = T(h.owner);
    const head = [];
    let body = [];
    switch (h.kind) {
      case 'cb':
        head.push(t(`@dp.callback_query(F.data == ${escapePy(h.data)})`));
        head.push(t(`async def ${h.name}(callback: types.CallbackQuery${STATE_PH}):`));
        head.push(t('    message = callback.message.model_copy(update={"from_user": callback.from_user})'));
        head.push(t('    await callback.answer()'));
        body = genTargets(h.targets, 1, new Set(), h.ctx);
        break;
      case 'dyn':
        head.push(t(`@dp.callback_query(F.data.startswith(${escapePy(h.prefix)}))`));
        head.push(t(`async def ${h.name}(callback: types.CallbackQuery${STATE_PH}):`));
        head.push(t('    message = callback.message.model_copy(update={"from_user": callback.from_user})'));
        head.push(t('    await callback.answer()'));
        head.push(t(`    ${h.resultVar} = callback.data[len(${escapePy(h.prefix)}):]`));
        body = genSeq(h.targets, 1, new Set(), h.ctx);
        break;
      case 'reply':
        head.push(t(`@dp.message(F.text == ${escapePy(h.text)})`));
        head.push(t(`async def ${h.name}(message: Message${STATE_PH}):`));
        body = genTargets(h.targets, 1, new Set(), h.ctx);
        break;
      case 'wait': {
        const { data } = h.node;
        const varName  = data.var_name  || 'user_input';
        const loc      = pyIdent(varName);
        const validation = data.validation || 'none';
        head.push(t(`@dp.message(BotStates.wait_input_${h.stateIdx})`));
        head.push(t(`async def handle_wait_input_${h.stateIdx}(message: Message, state: FSMContext):`));
        head.push(t('    user_id = message.from_user.id'));
        if (validation === 'number') {
          head.push(t('    if not message.text or not message.text.lstrip("-").isdigit():'));
          head.push(t(`        await message.answer(${escapePy('Пожалуйста, введите число.')})`));
          head.push(t('        return'));
        } else if (validation === 'phone') {
          head.push(t('    import re as _re'));
          head.push(t('    if not message.text or not _re.match(r"^\\+?[0-9]{7,15}$", message.text.strip()):'));
          head.push(t(`        await message.answer(${escapePy('Пожалуйста, введите корректный номер телефона.')})`));
          head.push(t('        return'));
        }
        head.push(t(`    ${loc} = message.text`));
        head.push(t(data.var_scope === 'global'
          ? `    _set_global_var(${escapePy(varName)}, ${loc})`
          : `    _set_user_var(user_id, ${escapePy(varName)}, ${loc})`));
        head.push(t('    await state.clear()'));
        body = genSeq(h.targets, 1, new Set(), h.ctx);
        break;
      }
      case 'contact': {
        const { data } = h.node;
        const phoneVar   = pyIdent(data.phone_var   || 'user_phone');
        const contactVar = pyIdent(data.contact_var || 'user_contact');
        head.push(t(`@dp.message(BotStates.wait_input_${h.stateIdx}, F.contact)`));
        head.push(t(`async def handle_contact_${h.stateIdx}(message: Message, state: FSMContext):`));
        head.push(t(`    ${contactVar} = message.contact`));
        head.push(t(`    ${phoneVar} = message.contact.phone_number`));
        head.push(t('    from aiogram.types import ReplyKeyboardRemove'));
        head.push(t('    await message.answer("✅", reply_markup=ReplyKeyboardRemove())'));
        head.push(t('    await state.clear()'));
        body = genSeq(h.targets, 1, new Set(), h.ctx);
        break;
      }
      case 'dynstep': {
        const { data } = h.node;
        const s = h.stateIdx;
        const listName = escapePy(data.answers_list_name || 'survey_answers');
        head.push(t(`@dp.message(BotStates.wait_input_${s})`));
        head.push(t(`async def handle_dynamic_step_${s}(message: Message, state: FSMContext):`));
        head.push(t('    user_id = message.from_user.id'));
        head.push(t(`    _ds_steps = (await state.get_data()).get("_ds_steps_${s}", [])`));
        head.push(t(`    _ds_idx = _get_user_var(user_id, "_ds_idx_${s}", 0)`));
        head.push(t(data.answers_scope === 'global'
          ? `    _global_list_op(${listName}, 'append', message.text)`
          : `    _list_op(user_id, ${listName}, 'append', message.text)`));
        head.push(t('    _ds_idx += 1'));
        head.push(t(`    _set_user_var(user_id, "_ds_idx_${s}", _ds_idx)`));
        head.push(t('    if _ds_idx < len(_ds_steps):'));
        head.push(t('        await message.answer(str(_ds_steps[_ds_idx]))'));
        head.push(t('        return'));
        head.push(t('    await state.clear()'));
        if (data.finish_message) head.push(t(`    await message.answer(${escapePy(data.finish_message)})`));
        body = genSeq(h.targets, 1, new Set(), h.ctx);
        break;
      }
      default: break;
    }
    h.head = head;
    h.body = tagFrom(body, h.owner);
  }

  if (needsSchedule) needsBotUsers = true;
  const emittedNodes = nodes.filter((n) => emitted.has(n.id));
  const customNodes = nodes.filter((n) => n.type === 'custom_block');
  const stateParam = needsFSM ? ', state: FSMContext' : '';

  const out = [];

  const reqs = computeRequirements(emittedNodes, { sqlDialect });
  if (reqs.length) {
    out.push(`# Зависимости: pip install ${reqs.join(' ')}`);
    out.push('');
  }

  out.push('import asyncio');
  if (loggingEnabled) out.push('import logging');
  if (loggingEnabled || needsJson) out.push('import json as _json');
  if (loggingEnabled) out.push('import os as _os');
  if (loggingEnabled || needsDatetime) out.push('import datetime as _dt');
  if (needsDb || needsBotUsers) out.push(DB.importLine);
  if (needsUserVars || needsListVars) out.push('import json as _json_store, os as _os_store');
  if (needsSchedule)            out.push('import datetime as _dt_sched');
  if (needsAiohttp)             out.push('import aiohttp');
  if (needsGoogleSheets)        out.push('import gspread as _gspread');
  if (proxyEnabled && proxyUrl) out.push('from aiogram.client.session.aiohttp import AiohttpSession');

  for (const imp of collectCustomImports(customNodes)) out.push(imp);

  out.push('from aiogram import Bot, Dispatcher, types, F');
  out.push(`from aiogram.filters import Command${deepLinkNodes.length ? ', CommandStart' : ''}`);
  const _tgTypes = [
    'Message',
    'InlineKeyboardButton', 'InlineKeyboardMarkup',
    'ReplyKeyboardMarkup', 'KeyboardButton',
  ];
  out.push('from aiogram.types import (');
  for (const chunk of chunkArray([...new Set(_tgTypes)], 3)) {
    out.push(`    ${chunk.join(', ')},`);
  }
  out.push(')');
  if (needsFSM) {
    out.push('from aiogram.fsm.context import FSMContext');
    out.push('from aiogram.fsm.state import State, StatesGroup');
  }
  out.push('');
  if (loggingEnabled) {
    out.push('logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")');
  }
  out.push(`BOT_TOKEN = "${botToken || 'YOUR_BOT_TOKEN_HERE'}"`);
  out.push('dp = Dispatcher()');
  if (proxyEnabled && proxyUrl) {
    out.push(`_proxy_session = AiohttpSession(proxy="${proxyUrl}")`);
    out.push('bot = Bot(token=BOT_TOKEN, session=_proxy_session)');
  } else {
    out.push('bot = Bot(token=BOT_TOKEN)');
  }
  out.push('');

  if (adminCmd) {
    const ids = [];
    for (const n of emittedNodes) {
      if (n.type !== 'admin_notify' || (n.data.admin_mode || 'id') !== 'id') continue;
      const list = (n.data.admins && n.data.admins.length ? n.data.admins : [n.data.admin_chat_id]);
      for (const x of list) { const v = String(x ?? '').trim(); if (/^-?\d+$/.test(v) && !ids.includes(v)) ids.push(v); }
    }
    out.push(ids.length ? `ADMIN_IDS = [${ids.join(', ')}]` : 'ADMIN_IDS = []  # TODO: впишите Telegram ID администраторов');
    out.push('');
  }

  if (loggingEnabled) {
    out.push('_CHAT_LOG = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), \'chat_log.ndjson\')');
    out.push('');
    out.push('def _log_chat(uid, fn, ln, un, txt):');
    out.push('    try:');
    out.push('        with open(_CHAT_LOG, \'a\', encoding=\'utf-8\') as _f:');
    out.push('            _f.write(_json.dumps({\'ts\': _dt.datetime.utcnow().isoformat(),');
    out.push('                \'uid\': uid, \'fn\': fn, \'ln\': ln, \'un\': un, \'txt\': txt},');
    out.push('                ensure_ascii=False) + \'\\n\')');
    out.push('    except Exception:');
    out.push('        pass');
    out.push('');
    out.push('@dp.message.outer_middleware()');
    out.push('async def _chat_log_mw(handler, message: Message, data: dict):');
    out.push('    if message.from_user:');
    out.push('        u = message.from_user');
    out.push('        _log_chat(u.id, u.first_name or \'\', u.last_name or \'\',');
    out.push('                  u.username or \'\', message.text or f\'[{message.content_type}]\')');
    out.push('    return await handler(message, data)');
    out.push('');
  }

  if (needsUserVars || needsListVars) {
    out.push('_STORE_FILE = _os_store.path.join(_os_store.path.dirname(_os_store.path.abspath(__file__)), \'bot_data.json\')');
    out.push('');
    out.push('def _load_store():');
    out.push('    if _os_store.path.exists(_STORE_FILE):');
    out.push('        try:');
    out.push('            with open(_STORE_FILE, \'r\', encoding=\'utf-8\') as f:');
    out.push('                return _json_store.load(f)');
    out.push('        except Exception:');
    out.push('            pass');
    out.push('    return {}');
    out.push('');
    out.push('_store = _load_store()');
    out.push('_store.setdefault(\'user_vars\', {})');
    out.push('_store.setdefault(\'global_vars\', {})');
    out.push('_store.setdefault(\'user_lists\', {})');
    out.push('_store.setdefault(\'global_lists\', {})');
    out.push('');
    out.push('def _save_store():');
    out.push('    _tmp = _STORE_FILE + \'.tmp\'');
    out.push('    try:');
    out.push('        with open(_tmp, \'w\', encoding=\'utf-8\') as f:');
    out.push('            _json_store.dump(_store, f, ensure_ascii=False, indent=2)');
    out.push('        _os_store.replace(_tmp, _STORE_FILE)');
    out.push('    except Exception:');
    out.push('        pass');
    out.push('');
  }
  if (needsUserVars) {
    out.push('def _set_user_var(uid, key, value):');
    out.push('    _store[\'user_vars\'].setdefault(str(uid), {})[key] = value');
    out.push('    _save_store()');
    out.push('');
    out.push('def _get_user_var(uid, key, default=None):');
    out.push('    return _store[\'user_vars\'].get(str(uid), {}).get(key, default)');
    out.push('');
    out.push('def _set_global_var(key, value):');
    out.push('    _store[\'global_vars\'][key] = value');
    out.push('    _save_store()');
    out.push('');
    out.push('def _get_global_var(key, default=None):');
    out.push('    return _store[\'global_vars\'].get(key, default)');
    out.push('');
  }
  if (needsListVars) {
    out.push('def _list_op(uid, name, op, value=None, index=0):');
    out.push('    lst = _store[\'user_lists\'].setdefault(str(uid), {}).setdefault(name, [])');
    out.push('    result = None');
    out.push('    mutated = True');
    out.push('    if op == "create":   _store[\'user_lists\'].setdefault(str(uid), {})[name] = []');
    out.push('    elif op == "append": lst.append(value)');
    out.push('    elif op == "remove":');
    out.push('        if value in lst: lst.remove(value)');
    out.push('    elif op == "clear":  lst.clear()');
    out.push('    elif op == "get":    result = lst[index] if index < len(lst) else None; mutated = False');
    out.push('    elif op == "length": result = len(lst); mutated = False');
    out.push('    else:                mutated = False');
    out.push('    if mutated: _save_store()');
    out.push('    return result');
    out.push('');
    out.push('def _global_list_op(name, op, value=None, index=0):');
    out.push('    lst = _store[\'global_lists\'].setdefault(name, [])');
    out.push('    result = None');
    out.push('    mutated = True');
    out.push('    if op == "create":   _store[\'global_lists\'][name] = []');
    out.push('    elif op == "append": lst.append(value)');
    out.push('    elif op == "remove":');
    out.push('        if value in lst: lst.remove(value)');
    out.push('    elif op == "clear":  lst.clear()');
    out.push('    elif op == "get":    result = lst[index] if index < len(lst) else None; mutated = False');
    out.push('    elif op == "length": result = len(lst); mutated = False');
    out.push('    else:                mutated = False');
    out.push('    if mutated: _save_store()');
    out.push('    return result');
    out.push('');
  }

  if (needsDb || needsBotUsers) {
    out.push(`_PH = ${JSON.stringify(DB.ph)}  # SQL parameter placeholder for this dialect`);
    out.push('def _db_connect():');
    out.push(`    return ${DB.connect}`);
    out.push('');
    out.push('def _db_exec(sql, params=()):');
    out.push('    _conn = _db_connect()');
    out.push('    try:');
    out.push('        _cur = _conn.cursor()');
    out.push('        if params:');
    out.push('            _cur.execute(sql, params)');
    out.push('        else:');
    out.push('            _cur.execute(sql)');
    out.push('        _conn.commit()');
    out.push('    finally:');
    out.push('        _conn.close()');
    out.push('');
    out.push('def _db_query(sql, params=(), one=False):');
    out.push('    _conn = _db_connect()');
    out.push('    try:');
    out.push('        _cur = _conn.cursor()');
    out.push('        if params:');
    out.push('            _cur.execute(sql, params)');
    out.push('        else:');
    out.push('            _cur.execute(sql)');
    out.push('        return _cur.fetchone() if one else _cur.fetchall()');
    out.push('    finally:');
    out.push('        _conn.close()');
    out.push('');
  }

  if (needsBotUsers) {
    const pkType = sqlDialect === 'sqlite' ? 'INTEGER' : 'BIGINT';
    out.push('_db_exec("""CREATE TABLE IF NOT EXISTS bot_users(');
    out.push(`    user_id ${pkType} PRIMARY KEY,`);
    out.push('    username TEXT,');
    out.push('    first_name TEXT,');
    out.push('    last_name TEXT,');
    out.push('    tags TEXT,');
    out.push('    registered_at TEXT');
    out.push(')""")');
    out.push('');
  }

  if (needsRateLimit) {
    out.push('_rl_store: dict = {}');
    out.push('');
  }

  if (needsFSM && stateCounter > 0) {
    out.push('class BotStates(StatesGroup):');
    for (let i = 0; i < stateCounter; i++) out.push(`    wait_input_${i} = State()`);
    out.push('');
  }

  if (needsSchedule) {
    out.push('class _SchedUser:');
    out.push('    def __init__(self, uid, username=None, first_name="", last_name=""):');
    out.push('        self.id = uid');
    out.push('        self.username = username');
    out.push('        self.first_name = first_name');
    out.push('        self.last_name = last_name');
    out.push('');
    out.push('class _SchedChat:');
    out.push('    def __init__(self, uid):');
    out.push('        self.id = uid');
    out.push('');
    out.push('class _SchedMessage:');
    out.push('    def __init__(self, bot, uid, username=None, first_name="", last_name="", chat_id=None):');
    out.push('        self.from_user = _SchedUser(uid, username, first_name, last_name)');
    out.push('        self.chat = _SchedChat(uid if chat_id is None else chat_id)');
    out.push('        self.message_id = None');
    out.push('        self.text = ""');
    out.push('        self.content_type = "text"');
    out.push('        self._bot = bot');
    out.push('    async def _send(self, method, *args, **kwargs):');
    out.push('        if self.chat.id is None:');
    out.push('            return None');
    out.push('        return await getattr(self._bot, method)(self.chat.id, *args, **kwargs)');
    out.push('    async def answer(self, text, **kwargs):');
    out.push('        return await self._send("send_message", text, **kwargs)');
    out.push('    async def answer_photo(self, photo, **kwargs):');
    out.push('        return await self._send("send_photo", photo, **kwargs)');
    out.push('    async def answer_video(self, video, **kwargs):');
    out.push('        return await self._send("send_video", video, **kwargs)');
    out.push('    async def answer_animation(self, animation, **kwargs):');
    out.push('        return await self._send("send_animation", animation, **kwargs)');
    out.push('    async def answer_audio(self, audio, **kwargs):');
    out.push('        return await self._send("send_audio", audio, **kwargs)');
    out.push('    async def answer_document(self, document, **kwargs):');
    out.push('        return await self._send("send_document", document, **kwargs)');
    out.push('    async def answer_sticker(self, sticker, **kwargs):');
    out.push('        return await self._send("send_sticker", sticker, **kwargs)');
    out.push('');

    for (const { node, k, head, body } of rootBlocks.schedule) {
      const { data } = node;
      const t = T(node.id);
      out.push(...head, ...loadLines(head, body, node.id), ...body);
      out.push('');
      out.push('');
      out.push(t(`async def _run_schedule_${k}(bot):`));
      if ((data.audience || 'all') === 'once') {
        out.push(t(`    await _schedule_${k}_job(_SchedMessage(bot, None), dp.fsm.get_context(bot, chat_id=0, user_id=0))`));
      } else {
        const [q, p] = audienceQuery(data, 'user_id, username, first_name, last_name');
        out.push(t(`    for _row in _db_query(${q}${p ? `, ${p}` : ''}):`));
        out.push(t('        message = _SchedMessage(bot, _row[0], _row[1], _row[2], _row[3])'));
        out.push(t('        try:'));
        out.push(t(`            await _schedule_${k}_job(message, dp.fsm.get_context(bot, chat_id=_row[0], user_id=_row[0]))`));
        out.push(t('        except Exception:'));
        out.push(t('            pass'));
      }
      out.push('');
      out.push('');
      out.push(`async def _scheduler_loop_${k}(bot):`);
      if (data.schedule_type === 'interval') {
        const mult = { seconds: 1, minutes: 60, hours: 3600 }[data.interval_unit] || 60;
        const seconds = Math.max(1, (parseFloat(data.interval_value) || 30) * mult);
        out.push('    while True:');
        out.push(`        await asyncio.sleep(${seconds})`);
        out.push('        try:');
        out.push(`            await _run_schedule_${k}(bot)`);
        out.push('        except Exception:');
        out.push('            pass');
      } else {
        const time = /^\d{1,2}:\d{2}$/.test(data.time_of_day || '') ? data.time_of_day : '09:00';
        out.push('    _last_fired = None');
        out.push('    while True:');
        out.push('        _now = _dt_sched.datetime.now()');
        out.push(`        if _now.strftime("%H:%M") == ${escapePy(time)} and _last_fired != _now.date():`);
        out.push('            _last_fired = _now.date()');
        out.push('            try:');
        out.push(`                await _run_schedule_${k}(bot)`);
        out.push('            except Exception:');
        out.push('                pass');
        out.push('        await asyncio.sleep(20)');
      }
      out.push('');
      out.push('');
    }
  }

  out.push('');

  const emitBlock = (head, body, ownerId) => {
    out.push(...head, ...loadLines(head, body, ownerId), ...body);
    out.push('');
    out.push('');
  };
  for (const b of rootBlocks.deep_link) emitBlock(b.head, b.body, b.node.id);
  for (const b of rootBlocks.command)   emitBlock(b.head, b.body, b.node.id);
  for (const h of handlers) if (h.kind === 'wait' || h.kind === 'contact' || h.kind === 'dynstep') emitBlock(h.head, h.body, h.owner);
  for (const h of handlers) if (h.kind === 'reply') emitBlock(h.head, h.body, h.owner);
  for (const b of rootBlocks.message_handler) emitBlock(b.head, b.body, b.node.id);
  for (const h of handlers) if (h.kind === 'cb' || h.kind === 'dyn') emitBlock(h.head, h.body, h.owner);

  if (customNodes.length > 0) {
    for (const cn of customNodes) out.push(...genCustomBlockFunction(cn).map((l) => tagLine(l, cn.id)));
    out.push('');
  }

  out.push('async def main():');
  for (const { k } of rootBlocks.schedule) out.push(`    asyncio.create_task(_scheduler_loop_${k}(bot))`);
  out.push('    await dp.start_polling(bot)');
  out.push('');
  out.push('');
  out.push('if __name__ == "__main__":');
  out.push('    asyncio.run(main())');
  out.push('');

  const owned = out.map((l) => {
    const { ids, text } = untagLine(l);
    const s = new String(text.split(STATE_PH).join(stateParam)); // eslint-disable-line no-new-wrappers
    s.__owners = ids;
    return s;
  });
  const injected = applyInjects(owned, collectCustomInjects(customNodes));

  const nodeLines = {};
  const codeLines = [];
  for (const l of injected) {
    const owners = (l && typeof l === 'object' && l.__owners) || [];
    // eslint-disable-next-line no-control-regex
    const text = String(l).replace(/\u0001[^\u0002]*\u0002/g, '');
    for (const part of text.split('\n')) {
      codeLines.push(part);
      if (!part.trim()) continue;
      for (const o of owners) (nodeLines[o] || (nodeLines[o] = [])).push(codeLines.length);
    }
  }
  const nodeLineMap = {};
  for (const [id, ls] of Object.entries(nodeLines)) nodeLineMap[id] = ls[0];

  return { code: codeLines.join('\n'), nodeLineMap, nodeLines };
}

export function computeRequirements(nodes, flags = {}) {
  const set = new Set(['aiogram']);
  if (nodes.some((n) => n.type === 'google_sheets')) set.add('gspread');
  const usesDb = nodes.some((n) => n.type?.startsWith('db_') || ['save_user', 'broadcast', 'schedule'].includes(n.type)
    || (n.type === 'admin_notify' && ['username', 'tag'].includes(n.data?.admin_mode)));
  if (usesDb && flags.sqlDialect === 'postgres') set.add('psycopg2-binary');
  if (usesDb && flags.sqlDialect === 'mysql') set.add('pymysql');
  return [...set].sort();
}


function escapePy(s) {
  return `"${String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`;
}

function escapePyFStr(s) {
  const text = String(s ?? '');
  if (!/\{[^{}]+\}/.test(text)) return escapePy(text);
  const inner = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  return `f"${inner}"`;
}

function pyIdent(s) {
  return String(s ?? '').replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1') || '_';
}

function isNumericStr(s) { return s !== '' && !isNaN(Number(s)); }

function parseWhere(clause) {
  if (!clause) return { sql: '', params: [] };
  const params = [];
  const sql = clause.replace(/\{([^}]+)\}/g, (_, expr) => { params.push(expr.trim()); return '?'; });
  return { sql, params };
}

function chunkArray(arr, n) {
  const r = [];
  for (let i = 0; i < arr.length; i += n) r.push(arr.slice(i, i + n));
  return r;
}

function pyCodeOnly(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '#') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '"' || c === "'") {
      let j = out.length;
      let prefix = '';
      while (j > 0 && /[rRbBfFuU]/.test(out[j - 1]) && prefix.length < 2) { prefix = out[j - 1] + prefix; j--; }
      if (j > 0 && /\w/.test(out[j - 1])) prefix = '';
      if (prefix) out = out.slice(0, out.length - prefix.length);
      const isF = /f/i.test(prefix);
      const isRaw = /r/i.test(prefix);
      const triple = src.substr(i, 3) === c.repeat(3);
      const q = triple ? c.repeat(3) : c;
      i += q.length;
      out += ' ';
      while (i < n) {
        if (!isRaw && src[i] === '\\') { if (src[i + 1] === '\n') out += '\n'; i += 2; continue; }
        if (src.startsWith(q, i)) { i += q.length; break; }
        if (!triple && src[i] === '\n') break;
        if (isF && src[i] === '{') {
          if (src[i + 1] === '{') { i += 2; continue; }
          let depth = 1;
          let e = '';
          i++;
          while (i < n && depth > 0) {
            const ch = src[i];
            if (ch === '{') depth++;
            else if (ch === '}') { depth--; if (depth === 0) break; }
            e += ch;
            i++;
          }
          i++;
          out += ` ${pyCodeOnly(e.replace(/![rsa]$/, '').split(':')[0])} `;
          continue;
        }
        if (src[i] === '\n') out += '\n';
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function readIdents(codeLine) {
  const res = [];
  const re = /[A-Za-z_]\w*/g;
  let m;
  while ((m = re.exec(codeLine))) {
    const before = codeLine[m.index - 1];
    if (before && /[\w.]/.test(before)) continue;
    const after = codeLine.slice(m.index + m[0].length);
    if (/^\s*=(?!=)/.test(after)) continue;
    res.push(m[0]);
  }
  return res;
}
