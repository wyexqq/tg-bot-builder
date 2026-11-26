import { MarkerType } from 'reactflow';
import { matchCustomBlockCall, matchCustomBlockStart, skipCustomBlockDef } from './customBlocks/customCodeParser';
import useCustomBlockStore from './customBlocks/customBlockStore';
import {
  reverseLinearBlock, joinCall, unquote, splitArgs, innerArgs, positional, kwarg,
  isPyStr, dbQueryArgs, reverseAudienceQuery,
} from './blockReversers';

const EDGE_STYLE = {
  type: 'deletable',
  style: { strokeWidth: 2, stroke: '#64748b' },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
};

let _idSeq = 0;
const uid = (type) => `${type}_p${++_idSeq}_${Date.now() % 1e6}`;
let _usedIds = new Set();

const indentOf = (s) => (s || '').match(/^(\s*)/)?.[1].length ?? 0;

function blockEnd(lines, i) {
  const base = indentOf(lines[i]);
  let j = i + 1;
  while (j < lines.length && (!lines[j].trim() || indentOf(lines[j]) > base)) j++;
  while (j > i + 1 && !lines[j - 1].trim()) j--;
  return j;
}

function fnBodyEnd(lines, i) {
  let j = i;
  while (j < lines.length && (!lines[j].trim() || indentOf(lines[j]) > 0)) j++;
  return j;
}

export function parseFilesToGraph(files) {
  if (!files?.length) return null;
  const merged = files.map((f) => (typeof f === 'string' ? f : f.code ?? f.content ?? '')).join('\n');
  return parseCodeToGraph(merged);
}

export function parseCodeToGraph(code) {
  if (!code?.trim()) return null;
  _idSeq = 0;
  _usedIds = new Set();

  const lines = stripCustomInjects(code.replace(/\r\n?/g, '\n').split('\n'));
  const nodes = [];
  const edges = [];
  const cbChains    = new Map();
  const dynChains   = new Map();
  const replyChains = new Map();
  const fsmChains   = new Map();
  const schedByIdx  = new Map();
  const ptbCallbackChains = [];

  let extractedToken = null;
  {
    const botCallLine = lines.find((l) => /\bBot\s*\(/.test(l));
    if (botCallLine) {
      const litM = botCallLine.match(/Bot\s*\([^)]*token\s*=\s*["']([^"']+)["']/);
      if (litM) {
        extractedToken = litM[1];
      } else {
        const varM = botCallLine.match(/Bot\s*\([^)]*token\s*=\s*(\w+)/);
        if (varM) {
          const tokenVar = varM[1];
          const assignLine = lines.find((l) => new RegExp(`^${tokenVar}\\s*=\\s*["']`).test(l.trim()));
          if (assignLine) {
            const valM = assignLine.match(/=\s*["']([^"']+)["']/);
            if (valM) extractedToken = valM[1];
          }
        }
      }
    }
  }

  let commandColX = 60;
  let i = 0;
  let globalUnknownBuf = [];

  const funcDefs = {};
  for (let k = 0; k < lines.length; k++) {
    const m = lines[k].trim().match(/^(?:async )?def (\w+)\s*\(/);
    if (m) funcDefs[m[1]] = k + 1;
  }

  const aiogramVars = new Set(['dp']);
  for (let k = 0; k < lines.length; k++) {
    const m = lines[k].trim().match(/^(\w+)\s*=\s*(?:Dispatcher|Router)\s*\(/);
    if (m) aiogramVars.add(m[1]);
  }
  const dpPat = [...aiogramVars].map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const reDeco = new RegExp(`^@(?:${dpPat})\\.(message|callback_query)\\((.*)\\)$`);
  const reAnyDpDeco = new RegExp(`^@(?:${dpPat})\\.`);

  const newChain = () => ({ chainNodes: [], chainEdges: [], heads: [] });
  const parseChainInto = (chain, from) => {
    const r = parseBlock(lines, from, 4, null, null, chain.chainNodes, chain.chainEdges, 0, 0);
    chain.heads = r.heads;
    return r.newI;
  };
  const pushRoot = (type, data) => {
    const id = uid(type);
    nodes.push({ id, type, position: { x: commandColX, y: 60 }, data });
    return id;
  };
  const parseRootBody = (rootId, from) => {
    const { newI } = parseBlock(lines, from, 4, rootId, 'out', nodes, edges, 245, commandColX);
    commandColX += 340;
    return newI;
  };
  const getSched = (k) => {
    if (!schedByIdx.has(k)) {
      const id = pushRoot('schedule', { schedule_type: 'daily', time_of_day: '09:00', interval_value: 30,
        interval_unit: 'minutes', audience: 'all', filter_sql: '', tag: '' });
      schedByIdx.set(k, nodes.find((n) => n.id === id));
    }
    return schedByIdx.get(k);
  };

  while (i < lines.length) {
    const line = lines[i].trim();

    const ptbCmdM = line.match(/(?:app|application)\.add_handler\(CommandHandler\(["']([^"']+)["'],\s*(\w+)\)/);
    if (ptbCmdM) {
      const cmdName = ptbCmdM[1];
      const funcName = ptbCmdM[2];
      if (funcDefs[funcName] !== undefined) {
        const cmdId = pushRoot('command', {
          command_name: '/' + cmdName, handler_name: funcName, description: '',
          parse_mode: 'HTML', only_private: false, only_admins: false, only_groups: false,
        });
        parsePTBBlock(lines, funcDefs[funcName], 4, cmdId, 'out', nodes, edges, 245, commandColX, funcDefs);
        commandColX += 340;
      }
      i++; continue;
    }
    const ptbCbHandlerM = line.match(/(?:app|application)\.add_handler\(CallbackQueryHandler\((\w+)\)/);
    if (ptbCbHandlerM) {
      const funcName = ptbCbHandlerM[1];
      if (funcDefs[funcName] !== undefined) {
        parsePTBCallbackChains(lines, funcDefs[funcName], 4, funcDefs).forEach((c) => ptbCallbackChains.push(c));
      }
      i++; continue;
    }

    const decoM = line.match(reDeco);
    if (decoM) {
      const observer = decoM[1];
      const dargs = splitArgs(decoM[2]);
      const a0 = dargs[0] || '';
      const fnLine = (lines[i + 1] || '').trim();
      const fnM = fnLine.match(/^async def (\w+)\(/);
      const fn = fnM?.[1] || '';
      const bodyStart = i + (fnM ? 2 : 1);
      const end = fnBodyEnd(lines, bodyStart);
      let m;
      let handled = true;

      if (observer === 'message') {
        if ((m = a0.match(/^Command\((["'].*["'])\)$/))) {
          const cmdName = unquote(m[1]);
          const bodyText = lines.slice(bodyStart, end).join('\n');
          if (cmdName === 'start' && /_dl_args/.test(bodyText)) {
            i = parseDeepLink(bodyStart);
          } else {
            const cmdId = pushRoot('command', {
              command_name: '/' + cmdName,
              handler_name: fn || 'cmd_' + cmdName,
              description: '',
              parse_mode: 'HTML',
              only_private: dargs.includes('F.chat.type == "private"'),
              only_admins: dargs.some((a) => /^F\.from_user\.id\.in_\(/.test(a)),
              only_groups: dargs.some((a) => /^F\.chat\.type\.in_\(/.test(a)),
            });
            i = parseRootBody(cmdId, bodyStart);
          }
        } else if (/^CommandStart\(/.test(a0)) {
          i = parseDeepLink(bodyStart);
        } else if ((m = a0.match(/^Command\(commands=\[(.+)\]\)$/))) {
          const mhId = pushRoot('message_handler', { filter_type: 'command', filter_value: unquote(splitArgs(m[1])[0]), handler_name: fn || 'on_message' });
          i = parseRootBody(mhId, bodyStart);
        } else if ((m = a0.match(/^BotStates\.wait_input_(\d+)$/))) {
          const st = +m[1];
          if (dargs.includes('F.contact')) i = parseContactHandler(st, bodyStart);
          else if (/^handle_dynamic_step_/.test(fn)) i = parseDynStepHandler(st, bodyStart, end);
          else i = parseWaitHandler(st, bodyStart);
        } else if (/^F\.text\b/.test(a0)) {
          const eqM = a0.match(/^F\.text\s*==\s*(.+)$/);
          if (eqM && /^on_reply_btn_\d+/.test(fn) && isPyStr(eqM[1])) {
            const chain = newChain();
            i = parseChainInto(chain, bodyStart);
            const key = unquote(eqM[1]);
            if (!replyChains.has(key)) replyChains.set(key, chain);
          } else {
            let filter_type = 'any', filter_value = '';
            if ((m = a0.match(/^F\.text\.contains\((.+)\)$/)))     { filter_type = 'contains'; filter_value = unquote(m[1]); }
            else if (eqM)                                          { filter_type = 'equals';   filter_value = unquote(eqM[1]); }
            else if ((m = a0.match(/^F\.text\.regexp\((.+)\)$/))) { filter_type = 'regex';    filter_value = unquote(m[1]); }
            const mhId = pushRoot('message_handler', { filter_type, filter_value, handler_name: fn || 'on_message' });
            i = parseRootBody(mhId, bodyStart);
          }
        } else handled = false;
      } else if ((m = a0.match(/^F\.data\s*==\s*(.+)$/)) && isPyStr(m[1])) {
        const chain = newChain();
        i = parseChainInto(chain, bodyStart);
        const key = unquote(m[1]);
        if (!cbChains.has(key)) cbChains.set(key, chain);
      } else if ((m = a0.match(/^F\.data\.startswith\((.+)\)$/))) {
        const prefix = unquote(m[1]);
        let j = bodyStart;
        let resultVar = 'dyn_arg';
        while (j < end) {
          const t = lines[j].trim();
          const rv = t.match(/^(\w+)\s*=\s*callback\.data\[len\(/);
          if (rv) { resultVar = rv[1]; j++; break; }
          if (!t || t.startsWith('message = callback') || t === 'await callback.answer()') { j++; continue; }
          break;
        }
        const chain = newChain();
        i = parseChainInto(chain, j);
        chain.resultVar = resultVar;
        if (!dynChains.has(prefix)) dynChains.set(prefix, chain);
      } else handled = false;

      if (handled) {
        if (i < bodyStart) i = bodyStart;
        i = Math.max(i, fnBodyEnd(lines, i));
        continue;
      }
    }

    let sm;
    if ((sm = line.match(/^async def _schedule_(\d+)_job\(/))) {
      const node = getSched(+sm[1]);
      commandColX = node.position.x;
      i = parseRootBody(node.id, i + 1);
      i = fnBodyEnd(lines, i);
      continue;
    }
    if ((sm = line.match(/^async def _run_schedule_(\d+)\(bot\):$/))) {
      const k = +sm[1];
      const end = fnBodyEnd(lines, i + 1);
      if (schedByIdx.has(k)) {
        readScheduleAudience(lines.slice(i + 1, end), schedByIdx.get(k).data);
        i = end;
        continue;
      }
      const node = getSched(k);
      const data = node.data;
      let j = i + 1;
      let chainStart = j, chainIndent = 4;
      const forLine = (lines[j] || '').trim();
      if (/^for _row in _db_query\(/.test(forLine)) {
        const q = dbQueryArgs(forLine);
        if (q) Object.assign(data, reverseAudienceQuery(q.sql, q.params));
        j++;
        while (j < end && !/^\s+try:/.test(lines[j])) j++;
        if (j < end) { chainStart = j + 1; chainIndent = 12; }
      } else {
        data.audience = 'once';
      }
      const { newI } = parseBlock(lines, chainStart, chainIndent, node.id, 'out', nodes, edges, 245, commandColX);
      commandColX += 340;
      i = Math.max(newI, end);
      i = fnBodyEnd(lines, i);
      continue;
    }
    if ((sm = line.match(/^async def _scheduler_loop_(\d+)\(bot\):$/))) {
      const k = +sm[1];
      i = schedByIdx.has(k) ? readScheduleTiming(lines, i + 1, schedByIdx.get(k).data) : fnBodyEnd(lines, i + 1);
      continue;
    }

    if (matchCustomBlockStart(line)) {
      i = skipCustomBlockDef(lines, i);
      continue;
    }

    if (line.startsWith('import ') || line.startsWith('from ')) {
      let depth = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
      i++;
      while (depth > 0 && i < lines.length) {
        const l = lines[i].trim();
        depth += (l.match(/\(/g) || []).length - (l.match(/\)/g) || []).length;
        i++;
      }
      continue;
    }
    if (line.startsWith('logging.')) { i++; continue; }
    if (/^BOT_TOKEN\s*=/.test(line)) { i++; continue; }
    if (/^\w+\s*=\s*(?:Dispatcher|Router)\(/.test(line)) { i++; continue; }
    if (/^\w+\s*=\s*Bot\(/.test(line)) { i++; continue; }
    if (/^(_user_data|_global_vars|_rl_store|_user_lists|_global_lists|_PH|_STORE_FILE|_store|_CHAT_LOG|_proxy_session|ADMIN_IDS)\b\s*[=:.]/.test(line)) { i++; continue; }
    if (line.startsWith('_db_exec("""CREATE TABLE IF NOT EXISTS bot_users')) {
      while (i < lines.length && !lines[i].includes(')"""')) i++;
      i++; continue;
    }
    {
      const isTopBlock =
        line.startsWith('def _') ||
        line.startsWith('async def main') ||
        line.startsWith('class BotStates') ||
        line.startsWith('class _') ||
        line.startsWith('if __name__') ||
        (line.startsWith('with sqlite3') && line.includes('_init_conn'));
      if (isTopBlock) { i = fnBodyEnd(lines, i + 1); continue; }
    }
    if (reAnyDpDeco.test(line) || line.startsWith('@app.') || line.startsWith('@application.')) {
      i++;
      if (/^(async )?def /.test((lines[i] || '').trim())) i++;
      i = fnBodyEnd(lines, i);
      continue;
    }
    if (line.startsWith('@')) {
      while (i < lines.length && lines[i].trim().startsWith('@')) globalUnknownBuf.push(lines[i++]);
      if (/^(?:async\s+)?(?:def|class)\s/.test((lines[i] || '').trim())) {
        globalUnknownBuf.push(lines[i++]);
        while (i < lines.length) {
          const bl = lines[i];
          if (bl.trim() && indentOf(bl) === 0) break;
          globalUnknownBuf.push(bl);
          i++;
        }
      }
      continue;
    }
    if (line.startsWith('async def ') || (line.startsWith('def ') && !line.startsWith('def _'))) {
      i = fnBodyEnd(lines, i + 1);
      continue;
    }
    if (line.startsWith('#')) { i++; continue; }

    if (line) globalUnknownBuf.push(lines[i]);
    i++;
  }

  const edgeTo = (src, handle, tgt) => edges.push({
    id: `e_${src}_${handle}_${tgt}_${edges.length}`, source: src, sourceHandle: handle, target: tgt, targetHandle: 'in', ...EDGE_STYLE,
  });
  const placeChain = (src, handle, chain, shift) => {
    const x0 = src.position.x + shift * 340;
    const y0 = src.position.y + 185;
    chain.chainNodes.forEach((n) => { n.position = { x: n.position.x + x0, y: n.position.y + y0 }; nodes.push(n); });
    chain.chainEdges.forEach((e) => edges.push(e));
    const heads = chain.heads.length ? chain.heads : [chain.chainNodes[0].id];
    heads.forEach((h) => edgeTo(src.id, handle, h));
    return heads;
  };

  const usedCb = new Set();
  const usedDyn = new Set();
  const usedReply = new Set();
  const sigToHeads = new Map();
  const fsmFirst = new Map();
  const fsmDupes = [];
  const fsmDone = new Set();

  let changed = true;
  while (changed) {
    changed = false;
    for (const node of [...nodes]) {
      const d = node.data || {};
      let shift = 0;
      if ((node.type === 'buttons' && d.button_type !== 'reply' && !d.dynamic_enabled) || (node.type === 'edit_message' && d.edit_markup)) {
        (d.buttons || []).forEach((btn, idx) => {
          const cd = btn.callback_data;
          if (!cd || usedCb.has(cd) || !cbChains.has(cd)) return;
          usedCb.add(cd);
          changed = true;
          const chain = cbChains.get(cd);
          if (!chain.chainNodes.length) return;
          const sig = chainSignature(chain);
          if (sigToHeads.has(sig)) sigToHeads.get(sig).forEach((h) => edgeTo(node.id, `btn_${idx}`, h));
          else sigToHeads.set(sig, placeChain(node, `btn_${idx}`, chain, shift++));
        });
      }
      if (node.type === 'buttons' && d.dynamic_enabled && d._dynPrefix && !usedDyn.has(d._dynPrefix)) {
        usedDyn.add(d._dynPrefix);
        const chain = dynChains.get(d._dynPrefix);
        if (chain) {
          changed = true;
          d.dynamic_result_var = chain.resultVar || 'dyn_arg';
          if (chain.chainNodes.length) placeChain(node, 'btn_dynamic', chain, shift++);
        }
      }
      if (node.type === 'buttons' && d.button_type === 'reply') {
        (d.buttons || []).forEach((btn, idx) => {
          const txt = btn.text;
          if (!txt || usedReply.has(txt) || !replyChains.has(txt)) return;
          usedReply.add(txt);
          changed = true;
          const chain = replyChains.get(txt);
          if (chain.chainNodes.length) placeChain(node, `btn_${idx}`, chain, shift++);
        });
      }
      if (d._fsmState !== undefined && !fsmDone.has(node.id)) {
        fsmDone.add(node.id);
        changed = true;
        const st = d._fsmState;
        if (fsmFirst.has(st)) { fsmDupes.push([node, fsmFirst.get(st)]); continue; }
        fsmFirst.set(st, node);
        const h = fsmChains.get(st);
        if (!h) continue;
        Object.assign(d, h.data);
        if (node.type === 'dynamic_step') {
          const extra = h.tail.length - (d._dsTailLen ?? 0);
          if (extra === 1 && /^await message\.answer\(/.test(h.tail[0])) {
            d.finish_message = unquote(positional(splitArgs(innerArgs(h.tail[0])))[0] || '""');
          } else d.finish_message = '';
        } else if (h.chain && h.chain.chainNodes.length) {
          placeChain(node, 'out', h.chain, 0);
        }
      }
    }
  }
  for (const [dup, kept] of fsmDupes) {
    for (const e of edges) if (e.target === dup.id) e.target = kept.id;
    const k = nodes.indexOf(dup);
    if (k !== -1) nodes.splice(k, 1);
  }
  {
    const seen = new Set();
    for (let k = edges.length - 1; k >= 0; k--) {
      const e = edges[k];
      const key = `${e.source}|${e.sourceHandle}|${e.target}`;
      if (seen.has(key)) edges.splice(k, 1); else seen.add(key);
    }
    edges.reverse(); edges.reverse();
  }

  if (ptbCallbackChains.length) {
    const used = new Set();
    for (const btnNode of nodes.filter((n) => n.type === 'buttons')) {
      let shift = 0;
      (btnNode.data.buttons || []).forEach((btn, idx) => {
        const chain = ptbCallbackChains.find((c) => c.callbackData === btn.callback_data && !used.has(c.callbackData));
        if (!chain || !chain.chainNodes.length) return;
        used.add(chain.callbackData);
        placeChain(btnNode, `btn_${idx}`, { ...chain, heads: [] }, shift++);
      });
    }
  }

  for (const n of nodes) {
    if (!n.data) continue;
    delete n.data._fsmState; delete n.data._dynPrefix; delete n.data._rlKey; delete n.data._dsTailLen;
  }

  if (globalUnknownBuf.length) {
    const gcode = globalUnknownBuf.join('\n').trimEnd();
    if (gcode.trim()) {
      nodes.push({
        id: uid('code_block'), type: 'code_block', position: { x: commandColX, y: 60 },
        data: { code: gcode, description: 'Глобальный код' },
      });
    }
  }

  return nodes.length > 0 ? { nodes, edges, botToken: extractedToken } : null;


  function parseDeepLink(from) {
    const data = { payload_var: 'start_payload', save_referrer: false, referrer_var: 'referrer_id' };
    let j = from;
    for (; j < lines.length; j++) {
      const t = lines[j].trim();
      if (!t) continue;
      if (indentOf(lines[j]) < 4) break;
      let m;
      if (/^_dl_args\s*=/.test(t)) continue;
      if ((m = t.match(/^(\w+)\s*=\s*_dl_args\[1\] if /))) { data.payload_var = m[1]; continue; }
      if ((m = t.match(/^(\w+)\s*=\s*int\(_dl_args\[1\]\)/))) { data.save_referrer = true; data.referrer_var = m[1]; continue; }
      break;
    }
    const dlId = pushRoot('deep_link', data);
    return parseRootBody(dlId, j);
  }

  function parseWaitHandler(st, from) {
    const data = { var_name: 'user_input', var_scope: 'user', validation: 'none' };
    let j = from;
    while (j < lines.length) {
      const t = lines[j].trim();
      if (!t) { j++; continue; }
      if (indentOf(lines[j]) < 4) break;
      let m;
      if (t === 'user_id = message.from_user.id' || t === 'import re as _re') { j++; continue; }
      if (/^if not message\.text or not message\.text\.lstrip\("-"\)\.isdigit\(\):$/.test(t)) { data.validation = 'number'; j = blockEnd(lines, j); continue; }
      if (/^if not message\.text or not _re\.match\(/.test(t)) { data.validation = 'phone'; j = blockEnd(lines, j); continue; }
      if (/^\w+\s*=\s*message\.text$/.test(t)) { j++; continue; }
      if ((m = t.match(/^_set_user_var\(user_id,\s*(["'].*?["'])\s*,\s*.+\)$/))) { data.var_name = unquote(m[1]); data.var_scope = 'user'; j++; continue; }
      if ((m = t.match(/^_set_global_var\((["'].*?["'])\s*,\s*.+\)$/))) { data.var_name = unquote(m[1]); data.var_scope = 'global'; j++; continue; }
      if (t === 'await state.clear()') { j++; break; }
      break;
    }
    const chain = newChain();
    const end = parseChainInto(chain, j);
    if (!fsmChains.has(st)) fsmChains.set(st, { kind: 'wait', data, chain });
    return end;
  }

  function parseContactHandler(st, from) {
    const data = {};
    let j = from;
    while (j < lines.length) {
      const t = lines[j].trim();
      if (!t) { j++; continue; }
      if (indentOf(lines[j]) < 4) break;
      let m;
      if ((m = t.match(/^(\w+)\s*=\s*message\.contact\.phone_number$/))) { data.phone_var = m[1]; j++; continue; }
      if ((m = t.match(/^(\w+)\s*=\s*message\.contact$/))) { data.contact_var = m[1]; j++; continue; }
      if (t.startsWith('from aiogram.types import ReplyKeyboardRemove') || t.includes('ReplyKeyboardRemove()')) { j++; continue; }
      if (t === 'await state.clear()') { j++; break; }
      break;
    }
    const chain = newChain();
    const end = parseChainInto(chain, j);
    if (!fsmChains.has(st)) fsmChains.set(st, { kind: 'contact', data, chain });
    return end;
  }

  function parseDynStepHandler(st, from, end) {
    const data = { answers_list_name: 'survey_answers', answers_scope: 'user' };
    let j = from;
    let m;
    for (; j < end; j++) {
      const t = lines[j].trim();
      if ((m = t.match(/^_list_op\(user_id,\s*(["'].*?["'])\s*,\s*'append'/))) { data.answers_list_name = unquote(m[1]); data.answers_scope = 'user'; }
      if ((m = t.match(/^_global_list_op\((["'].*?["'])\s*,\s*'append'/))) { data.answers_list_name = unquote(m[1]); data.answers_scope = 'global'; }
      if (t === 'await state.clear()' && indentOf(lines[j]) === 4) { j++; break; }
    }
    const tail = lines.slice(j, end).filter((l) => l.trim()).map((l) => l.trim());
    if (!fsmChains.has(st)) fsmChains.set(st, { kind: 'dynstep', data, chain: null, tail });
    return end;
  }
}

function parseBlock(lines, startI, baseIndent, parentId, parentHandle, nodes, edges, startY, startX) {
  let i = startI;
  let prevId = parentId;
  let prevHandle = parentHandle;
  let localY = startY;
  const heads = [];
  let forkId = parentId;
  let forkHandle = parentHandle;

  const addEdge = (src, sh, tgt, th) => {
    if (!src || !sh || !tgt) return;
    edges.push({ id: `e_${src}_${tgt}_${edges.length}`, source: src, sourceHandle: sh, target: tgt, targetHandle: th, ...EDGE_STYLE });
  };
  const pushNode = (n) => { nodes.push(n); localY += 185; };
  const link = (id) => {
    if (!prevId) heads.push(id);
    else addEdge(prevId, prevHandle, id, 'in');
    forkId = prevId; forkHandle = prevHandle;
    prevId = id; prevHandle = 'out';
  };
  const terminate = () => { prevId = forkId; prevHandle = forkHandle; };

  let unknownBuf = [];
  const flushUnknown = () => {
    if (!unknownBuf.length) return;
    const code = unknownBuf
      .map((l) => (l.slice(0, baseIndent).trim() === '' ? l.slice(baseIndent) : l.trimStart()))
      .join('\n').trimEnd();
    unknownBuf = [];
    if (!code.trim()) return;
    const id = uid('code_block');
    pushNode({ id, type: 'code_block', position: { x: startX, y: localY }, data: { code, description: '' } });
    link(id);
  };
  const add = (type, data, id = uid(type)) => {
    flushUnknown();
    pushNode({ id, type, position: { x: startX, y: localY }, data });
    link(id);
    return id;
  };
  const nextT = (k) => (lines[k] || '').trim();
  const pmOf = (args) => (kwarg(args, 'parse_mode') ? unquote(kwarg(args, 'parse_mode')) : 'None');
  const flagOf = (args, k) => kwarg(args, k) === 'True';
  const fsmSet = (t) => t.match(/^await state\.set_state\(BotStates\.wait_input_(\d+)\)$/);
  const pushUnknownStatement = (from) => {
    const t = lines[from].trim();
    let to;
    if (/:\s*(#.*)?$/.test(t) && /^(if|elif|else|for|while|try|except|finally|with|async\s+(with|for)|def|async\s+def|class|match|case)\b/.test(t)) {
      to = blockEnd(lines, from);
    } else {
      to = Math.max(joinCall(lines, from).newI, from + 1);
    }
    for (let k = from; k < to; k++) unknownBuf.push(lines[k]);
    return to;
  };

  while (i < lines.length) {
    const raw = lines[i];
    const indent = indentOf(raw);
    const line = raw.trim();

    if (line && indent < baseIndent) break;
    if (!line) { unknownBuf.push(''); i++; continue; }
    if (indent > baseIndent) { unknownBuf.push(raw); i++; continue; }
    if (unknownBuf.length && unknownBuf[unknownBuf.length - 1] === '' && unknownBuf.some((l) => l.trim())) {
      i = pushUnknownStatement(i);
      continue;
    }

    if (line.startsWith('message = callback') || line === 'await callback.answer()'
        || /^\w+\s*=\s*_get_(?:user|global)_var\(.*\)\s+# restore$/.test(line)) { i++; continue; }
    if (line === 'pass' && !unknownBuf.length) {
      const nx = lines.slice(i + 1).find((l) => l.trim());
      if (!nx || indentOf(nx) < baseIndent) { i++; continue; }
    }
    let m;

    if ((m = fsmSet(line))) {
      add('wait_input', { prompt_enabled: false, prompt: '', var_name: 'user_input', var_scope: 'user', validation: 'none', _fsmState: +m[1] });
      i++;
      if (nextT(i) === 'return') i++;
      terminate();
      continue;
    }
    if ((m = line.match(/^await message\.answer\((.*)\)$/)) && fsmSet(nextT(i + 1))
        && splitArgs(m[1]).every((a, k) => (k === 0 ? !/^\w+\s*=/.test(a) : /^parse_mode\s*=/.test(a)))) {
      const args = splitArgs(m[1]);
      const st = +fsmSet(nextT(i + 1))[1];
      add('wait_input', { prompt_enabled: true, prompt: unquote(positional(args)[0] || '""'), parse_mode: pmOf(args),
        var_name: 'user_input', var_scope: 'user', validation: 'none', _fsmState: st });
      i += 2;
      if (nextT(i) === 'return') i++;
      terminate();
      continue;
    }

    if (line === 'await message.answer(') {
      const { call, newI } = joinCall(lines, i);
      if (/request_contact=True/.test(call) && fsmSet(nextT(newI))) {
        const args = splitArgs(innerArgs(call.replace(/\n\s*/g, ' ')));
        const btnM = call.match(/KeyboardButton\(text=("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/);
        add('contact_request', {
          prompt: unquote(positional(args)[0] || '""'),
          button_text: btnM ? unquote(btnM[1]) : 'Поделиться номером',
          phone_var: 'user_phone', contact_var: 'user_contact',
          parse_mode: pmOf(args),
          _fsmState: +fsmSet(nextT(newI))[1],
        });
        i = newI + 1;
        if (nextT(i) === 'return') i++;
        terminate();
        continue;
      }
    }

    if ((m = line.match(/^_ds_steps\s*=\s*(.+)$/)) && nextT(i + 1) === 'if _ds_steps:') {
      const end = blockEnd(lines, i + 1);
      const stM = lines.slice(i + 1, end).join('\n').match(/BotStates\.wait_input_(\d+)/);
      let tailLen = 0;
      for (let k = end; k < lines.length; k++) {
        if (!lines[k].trim()) continue;
        if (indentOf(lines[k]) < baseIndent) break;
        tailLen++;
      }
      add('dynamic_step', { steps_source: m[1].trim(), answers_scope: 'user', answers_list_name: 'survey_answers',
        finish_message: '', _fsmState: stM ? +stM[1] : -1, _dsTailLen: tailLen });
      i = end;
      continue;
    }

    if ((m = line.match(/^_rl_key\s*=\s*(.+)$/))) {
      const data = { count_what: 'any', scope: m[1].startsWith('(') ? 'user' : 'global', max_calls: 3, window_seconds: 60,
        blocked_message: '', _rlKey: m[1] };
      let j = i + 1;
      const ap = nextT(j);
      if (/startswith\('\/'\)/.test(ap)) data.count_what = 'command';
      else if (/^_rl_apply = (callback is not None|False)$/.test(ap)) data.count_what = 'callback';
      j++;
      if (/^_rl_now\s*=/.test(nextT(j))) j++;
      const wm = nextT(j).match(/_rl_now - t < (\d+)\]$/);
      if (wm) { data.window_seconds = +wm[1]; j++; }
      const im = nextT(j).match(/^if \(not _rl_apply\) or len\(_rl_times\) < (\d+):$/);
      if (im) {
        data.max_calls = +im[1];
        const id = add('rate_limit', data);
        j++;
        if (nextT(j) === 'if _rl_apply:') j = blockEnd(lines, j);
        const allowed = parseBlock(lines, j, indent + 4, id, 'allowed', nodes, edges, localY, startX);
        j = allowed.newI;
        if (nextT(j) === 'else:' && indentOf(lines[j]) === indent) {
          j++;
          const bm = nextT(j).match(/^await message\.answer\((.*)\)$/);
          if (bm) { data.blocked_message = unquote(positional(splitArgs(bm[1]))[0] || '""'); j++; }
          const blocked = parseBlock(lines, j, indent + 4, id, 'blocked', nodes, edges, localY, startX + 340);
          j = blocked.newI;
        }
        i = j;
        terminate();
        continue;
      }
    }

    if (line === '_kb_rows, _kb_row = [], []') {
      const forM = nextT(i + 1).match(/^for item in (.+):$/);
      const appM = nextT(i + 2).match(/^_kb_row\.append\((.+)\)$/);
      const colM = nextT(i + 3).match(/^if len\(_kb_row\) >= (\d+):$/);
      const sendM = nextT(i + 7).match(/^await message\.answer\((.*)\)$/);
      if (forM && appM && colM && nextT(i + 6).startsWith('kb = InlineKeyboardMarkup(inline_keyboard=_kb_rows)')) {
        const bargs = splitArgs(innerArgs(appM[1]));
        const txt = kwarg(bargs, 'text') || 'str(str(item))';
        const cbv = kwarg(bargs, 'callback_data') || '"dyn_" + str(str(item))';
        const cbM = cbv.match(/^(["'].*?["'])\s*\+\s*str\((.*)\)$/s);
        const sargs = sendM ? splitArgs(sendM[1]) : [];
        add('buttons', {
          button_type: 'inline', buttons: [], attach_to_previous: false,
          message_text: sendM ? unquote(positional(sargs)[0] || '""') : 'Выберите:',
          parse_mode: pmOf(sargs),
          one_time_keyboard: false, resize_keyboard: true, selective: false,
          dynamic_enabled: true,
          dynamic_source: forM[1].trim(),
          dynamic_text_expr: /^str\(/.test(txt) ? innerArgs(txt) : txt,
          dynamic_callback_expr: cbM ? cbM[2] : 'str(item)',
          dynamic_columns: +colM[1],
          dynamic_result_var: 'dyn_arg',
          _dynPrefix: cbM ? unquote(cbM[1]) : '',
        });
        i += sendM ? 8 : 7;
        terminate();
        continue;
      }
    }

    if ((m = line.match(/^(_loop_guard_\w+)\s*=\s*0$/))) {
      const wm = nextT(i + 1).match(/^while \((.*)\) and (_loop_guard_\w+) < (.+):$/);
      if (wm && wm[2] === m[1]) {
        const id = add('loop_for', { loop_type: 'while', while_condition: wm[1], max_iterations: wm[3].trim(),
          count: '10', iter_var: 'i', list_var: '', item_var: 'item', range_start: '0', range_stop: '10', range_step: '1' });
        let j = i + 2;
        if (nextT(j) === `${m[1]} += 1`) j++;
        const body = parseBlock(lines, j, indent + 4, id, 'body', nodes, edges, localY, startX + 30);
        i = body.newI;
        prevId = id; prevHandle = 'out';
        continue;
      }
    }

    if ((m = line.match(/^(\w+)\s*=\s*(.+)$/))) {
      const sv = nextT(i + 1).match(/^_set_(user|global)_var\((.+)\)$/);
      if (sv) {
        const sargs = splitArgs(sv[2]);
        const nameArg = sv[1] === 'user' ? sargs[1] : sargs[0];
        const valArg = sv[1] === 'user' ? sargs[2] : sargs[1];
        if (valArg === m[1] && isPyStr(nameArg || '')) {
          const name = unquote(nameArg);
          add('variable', { operation: 'set', scope: sv[1], var_name: name, var_value: reverseValue(m[2]), result_variable: name });
          i += 2;
          continue;
        }
      }
    }

    if ((m = line.match(/^await message\.answer\((.+)\)$/)) && !/reply_markup\s*=/.test(m[1])) {
      add('text', textData(splitArgs(m[1])));
      i++; continue;
    }

    if ((m = line.match(/^await message\.answer_(photo|video|animation|sticker|audio|document)\((.+)\)$/)) && !/reply_markup\s*=/.test(m[2])) {
      add('media', mediaData(m[1], splitArgs(m[2])));
      i++; continue;
    }

    if ((m = line.match(/^await asyncio\.sleep\(([\d.]+)\)$/))) {
      const sec = parseFloat(m[1]);
      let delay = sec;
      let unit = 'seconds';
      if (sec >= 86400 && sec % 86400 === 0) { delay = sec / 86400; unit = 'days'; }
      else if (sec >= 3600 && sec % 3600 === 0) { delay = sec / 3600; unit = 'hours'; }
      else if (sec >= 60 && sec % 60 === 0) { delay = sec / 60; unit = 'minutes'; }
      add('timer', { delay, unit });
      i++; continue;
    }

    if ((m = line.match(/^_set_user_var\([^,]+,\s*(['"][^'"]+['"])\s*,\s*(.+)\)$/))) {
      const name = unquote(m[1]);
      add('variable', { operation: 'set', scope: 'user', var_name: name, var_value: reverseValue(m[2]), result_variable: name });
      i++; continue;
    }

    if ((m = line.match(/^(\w+)\s*=\s*_get_user_var\([^,]+,\s*(['"][^'"]+['"])\)$/))) {
      add('variable', { operation: 'get', scope: 'user', var_name: unquote(m[2]), var_value: '', result_variable: m[1] });
      i++; continue;
    }

    if ((m = line.match(/^await bot\.send_message\(([^,]+),\s*(.+)\)$/))) {
      const tmpl = unquote(m[2].trim());
      add('admin_notify', { admin_chat_id: m[1].trim(), message_template: tmpl });
      i++; continue;
    }

    if (/^kb = (InlineKeyboardMarkup|ReplyKeyboardMarkup)\(/.test(line) && line !== 'kb = InlineKeyboardMarkup(inline_keyboard=_kb_rows)') {
      const btnType = line.startsWith('kb = InlineKeyboardMarkup') ? 'inline' : 'reply';
      const { call, newI } = joinCall(lines, i);
      const buttons = [];
      const strRe = '("(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\')';
      for (const kl of call.split('\n')) {
        const before = buttons.length;
        if (btnType === 'inline') {
          const rx = new RegExp(`InlineKeyboardButton\\(text=${strRe}, callback_data=${strRe}(?:, style="(\\w+)")?\\)`, 'g');
          let bm;
          while ((bm = rx.exec(kl)) !== null) buttons.push({ text: unquote(bm[1]), callback_data: unquote(bm[2]), style: bm[3] || '', row_break: false });
        } else {
          const rx = new RegExp(`KeyboardButton\\(text=${strRe}(?:, style="(\\w+)")?\\)`, 'g');
          let bm;
          while ((bm = rx.exec(kl)) !== null) {
            const text = unquote(bm[1]);
            buttons.push({ text, callback_data: text.toLowerCase().replace(/\s+/g, '_'), style: bm[2] || '', row_break: false });
          }
        }
        if (buttons.length > before) buttons[buttons.length - 1].row_break = true;
      }
      const base = {
        button_type: btnType, buttons, attach_to_previous: false, message_text: 'Выберите:',
        one_time_keyboard: btnType === 'reply' && /one_time_keyboard=True/.test(call),
        resize_keyboard: btnType === 'reply' ? /resize_keyboard=True/.test(call) : true,
        selective: false,
      };
      const send = nextT(newI);
      let sm2;
      if ((sm2 = send.match(/^await message\.(answer|answer_photo|answer_video|answer_animation|answer_audio|answer_document|answer_sticker)\((.*)\)$/))
          && /,\s*reply_markup=kb\)$/.test(send)) {
        const args = splitArgs(sm2[2]).filter((a) => !/^reply_markup\s*=/.test(a));
        const kwNames = args.filter((a) => /^\w+\s*=/.test(a)).map((a) => a.match(/^(\w+)/)[1]);
        const first = positional(args)[0] || '""';
        const attach = btnType === 'inline' && (sm2[1] !== 'answer' || kwNames.some((k) => k !== 'parse_mode'));
        if (attach) {
          if (sm2[1] === 'answer') add('text', textData(args));
          else add('media', mediaData(sm2[1].replace(/^answer_/, ''), args));
          add('buttons', { ...base, attach_to_previous: true });
        } else {
          add('buttons', { ...base, message_text: unquote(first), parse_mode: pmOf(args) });
        }
        i = newI + 1;
        terminate();
        continue;
      }
      if (btnType === 'inline' && (sm2 = send.match(/^await message\.edit_text\((.*)\)$/)) && /reply_markup=kb\)$/.test(send)) {
        const args = splitArgs(sm2[1]).filter((a) => !/^reply_markup\s*=/.test(a));
        add('edit_message', { edit_text: true, new_text: unquote(positional(args)[0] || '""'), parse_mode: pmOf(args), edit_markup: true, buttons });
        i = newI + 1;
        terminate();
        continue;
      }
      if (btnType === 'inline' && send === 'await message.edit_reply_markup(reply_markup=kb)') {
        add('edit_message', { edit_text: false, new_text: '', parse_mode: 'HTML', edit_markup: true, buttons });
        i = newI + 1;
        terminate();
        continue;
      }
      if (buttons.length) {
        add('buttons', base);
        terminate();
      }
      i = newI; continue;
    }

    const forRangeM = line.match(/^for (\w+) in range\((.+)\):$/);
    if (forRangeM) {
      const rargs = splitArgs(forRangeM[2]);
      const data = rargs.length === 3
        ? { loop_type: 'range', iter_var: forRangeM[1], range_start: rargs[0], range_stop: rargs[1], range_step: rargs[2], count: '10', list_var: '', item_var: 'item' }
        : { loop_type: 'count', iter_var: forRangeM[1], count: forRangeM[2].trim(), list_var: '', item_var: 'item' };
      const id = add('loop_for', data);
      const body = parseBlock(lines, i + 1, indent + 4, id, 'body', nodes, edges, localY, startX + 30);
      i = body.newI;
      prevId = id; prevHandle = 'out';
      continue;
    }

    const forListM = line.match(/^for (\w+) in \((.+) or \[\]\):$/);
    if (forListM) {
      const id = add('loop_for', { loop_type: 'list', iter_var: 'i', count: '10', list_var: forListM[2].trim(), item_var: forListM[1] });
      const body = parseBlock(lines, i + 1, indent + 4, id, 'body', nodes, edges, localY, startX + 30);
      i = body.newI;
      prevId = id; prevHandle = 'out';
      continue;
    }

    if (line.startsWith('if ') && line.endsWith(':')) {
      const ifEnd = blockEnd(lines, i);
      if (nextT(ifEnd) === 'else:' && indentOf(lines[ifEnd]) === indent) {
        const expr = line.slice(3, -1).trim();
        const id = add('condition', { condition_mode: 'code', condition_expression: expr, true_label: 'Да', false_label: 'Нет' });
        const tR = parseBlock(lines, i + 1, indent + 4, id, 'true', nodes, edges, localY, startX);
        const fR = parseBlock(lines, ifEnd + 1, indent + 4, id, 'false', nodes, edges, localY, startX + 340);
        i = Math.max(fR.newI, blockEnd(lines, ifEnd));
        terminate();
        continue;
      }
    }

    const cbCall = matchCustomBlockCall(line);
    if (cbCall) {
      const data = { _customBlockId: null, ...cbCall.kwargs };
      let nodeId = null;
      for (let j = 0; j < lines.length; j++) {
        const marker = matchCustomBlockStart(lines[j].trim());
        if (marker && marker.nodeId.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1') === cbCall.nodeId) {
          data._customBlockId = marker.defId;
          nodeId = marker.nodeId;
          break;
        }
      }
      const id = nodeId && !_usedIds.has(nodeId) ? nodeId : uid('custom_block');
      _usedIds.add(id);
      add('custom_block', data, id);
      i++; continue;
    }

    if (matchCustomBlockStart(line)) {
      i = skipCustomBlockDef(lines, i);
      continue;
    }

    if (line.startsWith('message = _SchedMessage(')) {
      i = joinCall(lines, i).newI;
      continue;
    }

    const rev = reverseLinearBlock(lines, i, baseIndent);
    if (rev) {
      add(rev.type, rev.data);
      i = rev.newI; continue;
    }

    i = pushUnknownStatement(i);
  }

  flushUnknown();
  return { newI: i, heads };
}


function stripCustomInjects(lines) {
  let getDef;
  try { getDef = useCustomBlockStore.getState().getBlockDef; } catch { return lines; }
  if (typeof getDef !== 'function') return lines;
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const byTarget = new Map();
  for (const l of lines) {
    const mk = matchCustomBlockStart(l.trim());
    if (!mk) continue;
    const def = getDef(mk.defId);
    for (const inj of def?.code?.injects || []) {
      if (!inj?.target || !inj.code) continue;
      if (!byTarget.has(inj.target)) byTarget.set(inj.target, { start: [], end: [] });
      const bucket = byTarget.get(inj.target)[inj.position === 'start' ? 'start' : 'end'];
      for (const il of inj.code.split('\n')) {
        if (!il.trim()) continue;
        const src = esc(il.trim()).replace(/\\\{block_id\\\}/g, '_cb_\\w+').replace(/\\\{\w+\\\}/g, '.*?');
        bucket.push(new RegExp(`^${src}$`));
      }
    }
  }
  if (!byTarget.size) return lines;
  const out = [...lines];
  for (const [fn, { start, end }] of byTarget) {
    const defRe = new RegExp(`^(async\\s+)?def\\s+${esc(fn)}\\s*\\(`);
    const k = out.findIndex((l) => indentOf(l) === 0 && defRe.test(l.trim()));
    if (k === -1) continue;
    let s = k + 1;
    while (s < out.length && !out[s].trim()) s++;
    let n = 0;
    while (n < start.length && s < out.length && indentOf(out[s]) === 4 && start.some((re) => re.test(out[s].trim()))) { out.splice(s, 1); n++; }
    let e = fnBodyEnd(out, k + 1);
    while (e > k + 1 && !out[e - 1].trim()) e--;
    n = 0;
    while (n < end.length && e > s && indentOf(out[e - 1]) === 4 && end.some((re) => re.test(out[e - 1].trim()))) { out.splice(e - 1, 1); e--; n++; }
  }
  return out;
}

function textData(args) {
  return {
    message_text: unquote(positional(args)[0] || '""'),
    parse_mode: kwarg(args, 'parse_mode') ? unquote(kwarg(args, 'parse_mode')) : 'None',
    disable_web_page_preview: kwarg(args, 'disable_web_page_preview') === 'True',
    disable_notification: kwarg(args, 'disable_notification') === 'True',
  };
}

function mediaData(kind, args) {
  const caption = kwarg(args, 'caption') ? unquote(kwarg(args, 'caption')) : '';
  return {
    media_type: kind === 'animation' ? 'gif' : kind,
    file_id: unquote(positional(args)[0] || '""'),
    caption,
    parse_mode: kwarg(args, 'parse_mode') ? unquote(kwarg(args, 'parse_mode')) : (caption ? 'None' : 'HTML'),
    disable_notification: kwarg(args, 'disable_notification') === 'True',
  };
}

function reverseValue(raw) {
  const s = String(raw).trim();
  return isPyStr(s) ? unquote(s) : `{${s}}`;
}

function chainSignature(chain) {
  const idx = new Map(chain.chainNodes.map((n, k) => [n.id, k]));
  return JSON.stringify({
    n: chain.chainNodes.map((n) => ({ t: n.type, d: n.data })),
    e: chain.chainEdges.map((e) => [idx.get(e.source), e.sourceHandle, idx.get(e.target)]),
    h: chain.heads.map((h) => idx.get(h)),
  });
}

function extractFirstArg(raw) {
  if (!raw) return '';
  let i = 0;
  if (raw[i] === 'f') i++;
  const q = raw[i];
  if (q !== '"' && q !== "'") return raw.split(',')[0].trim();
  i++;
  while (i < raw.length) {
    if (raw[i] === '\\') { i += 2; continue; }
    if (raw[i] === q)    { i++; break; }
    i++;
  }
  return raw.slice(0, i);
}

function readScheduleAudience(body, data) {
  const forLine = body.map((l) => l.trim()).find((l) => /^for _row in _db_query\(/.test(l));
  if (!forLine) { data.audience = 'once'; return; }
  const q = dbQueryArgs(forLine);
  if (q) Object.assign(data, reverseAudienceQuery(q.sql, q.params));
}

function readScheduleTiming(lines, i, data) {
  const start = i;
  let endI = i;
  for (let j = i; j < lines.length; j++) {
    const bl = lines[j];
    if (bl.trim() && indentOf(bl) === 0) { endI = j; break; }
    endI = j + 1;
  }
  const body = lines.slice(start, endI).map((l) => l.trim());
  const daily = body.find((l) => /strftime\("%H:%M"\)\s*==\s*"(\d{1,2}:\d{2})"/.test(l));
  if (daily) {
    data.schedule_type = 'daily';
    data.time_of_day = daily.match(/==\s*"(\d{1,2}:\d{2})"/)[1];
  } else {
    const sleepL = body.find((l) => /^await asyncio\.sleep\([\d.]+\)$/.test(l));
    if (sleepL) {
      const sec = parseFloat(sleepL.match(/sleep\(([\d.]+)\)/)[1]);
      data.schedule_type = 'interval';
      if (sec % 3600 === 0)      { data.interval_value = sec / 3600; data.interval_unit = 'hours'; }
      else if (sec % 60 === 0)   { data.interval_value = sec / 60;   data.interval_unit = 'minutes'; }
      else                       { data.interval_value = sec;        data.interval_unit = 'seconds'; }
    }
  }
  return endI;
}


function collectMultiLinePTB(lines, startI) {
  let collected = lines[startI].trim();
  let j = startI + 1;
  let depth = (collected.match(/\(/g) || []).length - (collected.match(/\)/g) || []).length;
  while (depth > 0 && j < lines.length) {
    const l = lines[j].trim();
    collected += ' ' + l;
    depth += (l.match(/\(/g) || []).length - (l.match(/\)/g) || []).length;
    j++;
  }
  return { collected, newI: j };
}

function extractPTBButtons(argsStr) {
  const buttons = [];
  const rx = /InlineKeyboardButton\(["']([^'"]+)["'],\s*callback_data=["']([^'"]+)["']\)/g;
  let m;
  while ((m = rx.exec(argsStr)) !== null) buttons.push({ text: m[1], callback_data: m[2] });
  return buttons;
}

function extractReplyMarkupVal(argsStr) {
  const idx = argsStr.indexOf('reply_markup=');
  if (idx === -1) return '';
  const rest = argsStr.slice(idx + 'reply_markup='.length).trim();
  let depth = 0;
  let end = rest.length;
  for (let k = 0; k < rest.length; k++) {
    const c = rest[k];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') {
      if (depth === 0) { end = k; break; }
      depth--;
    } else if (c === ',' && depth === 0) { end = k; break; }
  }
  return rest.slice(0, end).trim();
}

function resolvePTBKeyboard(rmVal, lines, funcDefs) {
  if (!rmVal) return [];
  if (rmVal.startsWith('InlineKeyboardMarkup(')) {
    return extractPTBButtons(rmVal);
  }
  const fnCallM = rmVal.match(/^(\w+)\(\)$/);
  if (fnCallM && funcDefs[fnCallM[1]] !== undefined) {
    const bodyStart = funcDefs[fnCallM[1]];
    let k = bodyStart;
    const bodyParts = [];
    while (k < lines.length) {
      const l = lines[k];
      const indent = l.match(/^(\s*)/)?.[1].length ?? 0;
      if (l.trim() && indent < 4) break;
      bodyParts.push(l.trim());
      k++;
    }
    const bodyStr = bodyParts.join(' ');
    const mkM = bodyStr.match(/InlineKeyboardMarkup\((.+)\)/);
    if (mkM) return extractPTBButtons(mkM[1]);
  }
  return [];
}

function parsePTBBlock(lines, startI, baseIndent, parentId, parentHandle, nodes, edges, startY, startX, funcDefs) {
  let i = startI;
  let prevId = parentId;
  let prevHandle = parentHandle;
  let localY = startY;
  let unknownBuf = [];

  const addEdge = (src, sh, tgt, th) => {
    if (!src || !sh || !tgt) return;
    edges.push({ id: `e_${src}_${tgt}_${edges.length}`, source: src, sourceHandle: sh, target: tgt, targetHandle: th, ...EDGE_STYLE });
  };
  const pushNode = (n) => { nodes.push(n); localY += 185; };
  const flushUnknown = () => {
    if (!unknownBuf.length) return;
    const code = unknownBuf.join('\n').trimEnd();
    unknownBuf = [];
    if (!code.trim()) return;
    const id = uid('code_block');
    pushNode({ id, type: 'code_block', position: { x: startX, y: localY }, data: { code, description: '' } });
    addEdge(prevId, prevHandle, id, 'in');
    prevId = id; prevHandle = 'out';
  };

  while (i < lines.length) {
    const raw = lines[i];
    const indent = raw.match(/^(\s*)/)?.[1].length ?? 0;
    const line = raw.trim();

    if (line && indent < baseIndent) break;

    if (!line || line === 'pass' || line === 'return' ||
        line.startsWith('#') ||
        /^q\s*=\s*update\.callback_query/.test(line) ||
        /^await\s+q\.answer\(\)/.test(line) ||
        /^cid\s*=/.test(line) ||
        /^d\s*=\s*q\.data/.test(line)) {
      i++; continue;
    }

    const openP = (line.match(/\(/g) || []).length;
    const closeP = (line.match(/\)/g) || []).length;
    let fullLine = line;
    let nextI = i + 1;
    if (openP > closeP) {
      const { collected, newI } = collectMultiLinePTB(lines, i);
      fullLine = collected;
      nextI = newI;
    }

    const replyM = fullLine.match(/^await (?:update\.message|message)\.(?:reply_text|send_message)\((.+)\)$/);
    const editM  = fullLine.match(/^await (?:q|query|callback_query|update\.callback_query)\.edit_message_text\((.+)\)$/);
    const botSendM = fullLine.match(/^await (?:context\.bot|bot)\.send_message\([^,]+,\s*(.+)\)$/);
    const matchedSend = replyM || editM || botSendM;

    if (matchedSend) {
      flushUnknown();
      const argsStr = matchedSend[1];

      let msgText = '';
      const textKwM = argsStr.match(/\btext=f?["']([^"']*(?:\\.[^"']*)*)["']/);
      if (textKwM) {
        msgText = textKwM[1].replace(/\\n/g, '\n');
      } else {
        const firstArg = extractFirstArg(argsStr);
        if (/^f?["']/.test(firstArg)) {
          msgText = firstArg.replace(/^f?["']|["']$/g, '').replace(/\\n/g, '\n');
        }
      }

      const rmVal = extractReplyMarkupVal(argsStr);
      const buttons = resolvePTBKeyboard(rmVal, lines, funcDefs);

      if (buttons.length > 0) {
        const id = uid('buttons');
        pushNode({ id, type: 'buttons', position: { x: startX, y: localY }, data: {
          button_type: 'inline', buttons, message_text: msgText,
          row_width: 2, one_time_keyboard: false, resize_keyboard: true,
        }});
        addEdge(prevId, prevHandle, id, 'in'); prevId = id; prevHandle = 'out';
      } else if (msgText) {
        const id = uid('text');
        pushNode({ id, type: 'text', position: { x: startX, y: localY }, data: {
          message_text: msgText, parse_mode: 'HTML',
          disable_web_page_preview: false, disable_notification: false,
        }});
        addEdge(prevId, prevHandle, id, 'in'); prevId = id; prevHandle = 'out';
      }
      i = nextI; continue;
    }

    unknownBuf.push(raw);
    i++;
  }

  flushUnknown();
  return { newI: i };
}

function parsePTBCallbackChains(lines, startI, baseIndent, funcDefs) {
  const chains = [];
  let i = startI;

  while (i < lines.length) {
    const raw = lines[i];
    const indent = raw.match(/^(\s*)/)?.[1].length ?? 0;
    const line = raw.trim();

    if (line && indent < baseIndent) break;

    const eqM = line.match(/^(?:if|elif) d\s*==\s*["']([^"']+)["']\s*:/);
    const swM = !eqM && line.match(/^(?:if|elif) d\.startswith\(["']([^"']+)["']\)\s*:/);
    const cbData = eqM?.[1] || swM?.[1];

    if (cbData) {
      i++;
      const chainNodes = [];
      const chainEdges = [];
      const { newI } = parsePTBBlock(lines, i, indent + 4, null, null, chainNodes, chainEdges, 0, 0, funcDefs);
      if (chainNodes.length > 0) {
        chains.push({ callbackData: cbData, chainNodes, chainEdges });
      }
      i = newI;
      continue;
    }

    i++;
  }

  return chains;
}
