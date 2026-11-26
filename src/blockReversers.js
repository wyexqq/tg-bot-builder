export function joinCall(lines, startI) {
  let s = lines[startI];
  let depth = countDepth(s);
  let j = startI + 1;
  while (depth > 0 && j < lines.length) {
    s += '\n' + lines[j];
    depth += countDepth(lines[j]);
    j++;
  }
  return { call: s, newI: j };
}

function countDepth(s) {
  let d = 0, q = null;
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (q) { if (c === '\\') k++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === '(' || c === '[' || c === '{') d++;
    else if (c === ')' || c === ']' || c === '}') d--;
  }
  return d;
}

export function innerArgs(call, openChar = '(', closeChar = ')') {
  const start = call.indexOf(openChar);
  if (start === -1) return '';
  let depth = 0, q = null;
  for (let k = start; k < call.length; k++) {
    const c = call[k];
    if (q) { if (c === '\\') k++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === openChar) depth++;
    else if (c === closeChar) { depth--; if (depth === 0) return call.slice(start + 1, k); }
  }
  return call.slice(start + 1);
}

export function splitArgs(s) {
  const out = [];
  let depth = 0, q = null, cur = '';
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (q) { cur += c; if (c === '\\') { cur += s[++k] ?? ''; } else if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; }
    else if (c === '(' || c === '[' || c === '{') { depth++; cur += c; }
    else if (c === ')' || c === ']' || c === '}') { depth--; cur += c; }
    else if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; }
    else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function positional(args) {
  return args.filter((a) => !/^[a-zA-Z_]\w*\s*=/.test(a));
}

export function kwarg(args, name) {
  const a = args.find((x) => new RegExp(`^${name}\\s*=`).test(x));
  if (!a) return undefined;
  return a.slice(a.indexOf('=') + 1).trim();
}

export function unquote(s) {
  if (s == null) return '';
  let t = String(s).trim();
  let raw = false;
  const pm = t.match(/^([rRfFbBuU]{1,2})(["'])/);
  if (pm) { raw = /r/i.test(pm[1]); t = t.slice(pm[1].length); }
  const q = t[0];
  if (q !== '"' && q !== "'") return t;
  const end = t.lastIndexOf(q);
  t = end > 0 ? t.slice(1, end) : t.slice(1);
  if (raw) return t;
  const map = { n: '\n', r: '\r', t: '\t', '"': '"', "'": "'", '\\': '\\', 0: '\0' };
  return t.replace(/\\(.)/g, (m0, c) => (c in map ? map[c] : m0));
}

export const isPyStr = (s) => /^(?:[rRfFbBuU]{1,2})?["']/.test(String(s ?? '').trim());

export function unquoteTemplate(s) {
  const t = String(s ?? '').trim();
  const u = unquote(t);
  return /^[rR]?[fF]/.test(t) ? u.replace(/\{\{/g, '{').replace(/\}\}/g, '}') : u;
}

export function dbQueryArgs(callText) {
  const idx = callText.indexOf('_db_query(');
  if (idx === -1) return null;
  const args = splitArgs(innerArgs(callText.slice(idx)));
  const pos = positional(args);
  const sql = unquote(pos[0] || '""');
  const params = pos[1] ? splitArgs(innerArgs(pos[1])) : [];
  return { sql, params };
}

export function reverseAudienceQuery(sql, params = []) {
  const res = { audience: 'all', filter_sql: '', tag: '' };
  let m = sql.match(/WHERE tags LIKE (?:\?|%s)\s*$/);
  if (m) {
    res.audience = 'tag';
    res.tag = unquote(params[0] || '""').replace(/^%/, '').replace(/%$/, '');
    return res;
  }
  m = sql.match(/WHERE tags LIKE '%(.+)%'$/);
  if (m) { res.audience = 'tag'; res.tag = m[1].replace(/''/g, "'"); return res; }
  m = sql.match(/ WHERE (.+)$/s);
  if (m) { res.audience = 'condition'; res.filter_sql = m[1]; return res; }
  return res;
}

const isStr = (s) => /^f?["']/.test(String(s).trim());

export function reverseLinearBlock(lines, i, baseIndent) {
  const raw = lines[i];
  const line = raw.trim();
  const indentOf = (s) => s.match(/^(\s*)/)?.[1].length ?? 0;

  const joined = () => {
    const { call, newI } = joinCall(lines, i);
    return { flat: call.replace(/\n\s*/g, ' ').trim(), newI };
  };

  const guiMap = {
    'message.from_user.id': 'id',
    'message.from_user.first_name or ""': 'first_name',
    'message.from_user.last_name or ""': 'last_name',
    'message.from_user.username or ""': 'username',
    'message.from_user.language_code or ""': 'language_code',
    'bool(getattr(message.from_user, "is_premium", False))': 'is_premium',
  };
  const guiM = line.match(/^(\w+)\s*=\s*(message\.from_user\..+|bool\(getattr\(message\.from_user.+)$/);
  if (guiM && guiMap[guiM[2].trim()]) {
    const fields = [];
    let j = i;
    while (j < lines.length) {
      const m = lines[j].trim().match(/^(\w+)\s*=\s*(.+)$/);
      if (!m || !guiMap[m[2].trim()]) break;
      fields.push({ field: guiMap[m[2].trim()], var_name: m[1] });
      j++;
    }
    return { type: 'get_user_info', data: { fields }, newI: j };
  }

  let m;
  if ((m = line.match(/^_set_global_var\(([^,]+),\s*(.+)\)$/))) {
    return { type: 'variable', newI: i + 1, data: {
      operation: 'set', scope: 'global',
      var_name: unquote(m[1]), var_value: reverseValue(m[2]),
      result_variable: unquote(m[1]),
    } };
  }
  if ((m = line.match(/^(\w+)\s*=\s*_get_global_var\(([^)]+)\)$/))) {
    return { type: 'variable', newI: i + 1, data: {
      operation: 'get', scope: 'global',
      var_name: unquote(m[2]), var_value: '', result_variable: m[1],
    } };
  }

  const loM = line.match(/^(?:(\w+)\s*=\s*)?_(global_)?list_op\((.+)\)$/);
  if (loM) {
    const args = splitArgs(loM[3]);
    const isGlobal = !!loM[2];
    const base = isGlobal ? 0 : 1;
    const name = unquote(args[base]);
    const op = unquote(args[base + 1]);
    const data = {
      operation: op, scope: isGlobal ? 'global' : 'user',
      list_name: name, value: '', result_variable: loM[1] || 'result', index: 0,
    };
    const idxKw = kwarg(args, 'index');
    if (idxKw !== undefined) data.index = idxKw;
    else if (args[base + 2] && !/=/.test(args[base + 2])) data.value = reverseValue(args[base + 2]);
    return { type: 'list_op', data, newI: i + 1 };
  }

  if ((m = line.match(/^await message\.edit_text\((.+)\)$/)) && !/reply_markup\s*=/.test(m[1])) {
    const args = splitArgs(m[1]);
    const data = { edit_text: true, edit_markup: false, buttons: [],
      new_text: unquote(positional(args)[0]),
      parse_mode: kwarg(args, 'parse_mode') ? unquote(kwarg(args, 'parse_mode')) : 'None' };
    return { type: 'edit_message', data, newI: i + 1 };
  }
  if (line === 'await message.edit_reply_markup(reply_markup=kb)') {
    return { type: 'edit_message', data: { edit_text: false, edit_markup: true, buttons: [] }, newI: i + 1 };
  }

  if (line.startsWith('_db_exec(') || /^_db_exec\("CREATE TABLE/.test(line)) {
    const { flat, newI } = joined();
    const inner = innerArgs(flat);
    const eargs = splitArgs(inner);
    const sql = unquote(positional(eargs)[0]);
    const res = reverseDbExec(sql, positional(eargs)[1]);
    if (res) return { ...res, newI };
  }
  if ((m = line.match(/^(\w+)\s*=\s*_db_query\((.+)\)$/))) {
    const { flat, newI } = joined();
    const qm = flat.match(/^(\w+)\s*=\s*_db_query\((.+)\)$/s);
    if (qm) {
      const qargs = splitArgs(qm[2]);
      const sql = unquote(positional(qargs)[0]);
      const one = kwarg(qargs, 'one');
      const paramsTuple = positional(qargs)[1];
      const params = paramsTuple ? splitArgs(innerArgs(paramsTuple)) : [];
      const data = reverseSelect(sql, params);
      if (data) {
        data.result_variable = qm[1];
        data.fetch_mode = one === 'False' ? 'all' : 'one';
        return { type: 'db_read', data, newI };
      }
    }
  }

  if (line.startsWith('_bcast_uids =')) {
    const q = dbQueryArgs(line) || { sql: 'SELECT user_id FROM bot_users', params: [] };
    const data = { message_text: '', parse_mode: 'None', delay_between: 0.05,
      audience: 'all', filter_sql: '', tag: '' };
    Object.assign(data, reverseAudienceQuery(q.sql, q.params));
    let j = i + 1;
    if ((lines[j] || '').trim().startsWith('for _bcast_uid')) {
      const forIndent = indentOf(lines[j]);
      j++;
      for (; j < lines.length; j++) {
        if (lines[j].trim() && indentOf(lines[j]) <= forIndent) break;
        const bl = lines[j].trim();
        const sm = bl.match(/^await bot\.send_message\(_bcast_uid,\s*(.+)\)$/);
        if (sm) {
          const sargs = splitArgs(sm[1]);
          data.message_text = unquote(positional(sargs)[0]);
          if (kwarg(sargs, 'parse_mode')) data.parse_mode = unquote(kwarg(sargs, 'parse_mode'));
        }
        const dm = bl.match(/^await asyncio\.sleep\(([\d.]+)\)$/);
        if (dm) data.delay_between = parseFloat(dm[1]);
      }
    }
    return { type: 'broadcast', data, newI: j };
  }

  if (line.startsWith('_admin_ids =')) {
    const data = { message_template: '', admins: [], admin_mode: 'id', admin_chat_id: '' };
    const listM = line.match(/^_admin_ids\s*=\s*\[([^\]]*)\]/);
    if (listM) {
      data.admins = /#\s*TODO/.test(listM[1]) ? []
        : splitArgs(listM[1]).map((s) => s.replace(/\s*#.*$/, '').trim()).filter(Boolean);
    }
    const q = dbQueryArgs(line);
    if (q) {
      data.admins = [];
      if (/username IN/i.test(q.sql)) {
        data.admin_mode = 'username';
        data.admins = q.params.map((p) => unquote(p)).filter(Boolean);
      } else if (/tags LIKE/i.test(q.sql)) {
        data.admin_mode = 'tag';
        data.admin_tag = unquote(q.params[0] || '""').replace(/^%/, '').replace(/%$/, '');
      }
    }
    let j = i + 1;
    if ((lines[j] || '').trim().startsWith('for _aid')) {
      const forIndent = indentOf(lines[j]);
      j++;
      for (; j < lines.length; j++) {
        if (lines[j].trim() && indentOf(lines[j]) <= forIndent) break;
        const sm = lines[j].trim().match(/^await bot\.send_message\(_aid,\s*(.+)\)$/);
        if (sm) data.message_template = reverseTemplate(unquote(positional(splitArgs(sm[1]))[0]));
      }
    }
    if (data.admin_mode === 'id' && data.admins.length === 1) data.admin_chat_id = data.admins[0];
    return { type: 'admin_notify', data, newI: j };
  }

  if (line.startsWith('async with aiohttp.ClientSession()')) {
    return reverseAiohttp(lines, i, baseIndent, indentOf);
  }

  if (line.startsWith('_gc = _gspread.service_account_from_dict')) {
    return reverseSheets(lines, i);
  }

  return null;
}

function reverseValue(raw) {
  const s = String(raw).trim();
  if (isStr(s)) {
    const u = unquote(s);
    return u;
  }
  return `{${s}}`;
}

function reverseTemplate(text) {
  return String(text)
    .replace(/\{message\.from_user\.id\}/g, '{user_id}')
    .replace(/\{message\.from_user\.username\}/g, '{username}')
    .replace(/\{message\.from_user\.first_name\}/g, '{first_name}')
    .replace(/\{message\.from_user\.last_name\}/g, '{last_name}')
    .replace(/\{message\.text\}/g, '{text}')
    .replace(/\{message\.chat\.id\}/g, '{chat_id}');
}

function reverseDbExec(sql, paramsArg) {
  let m = sql.match(/^CREATE TABLE (IF NOT EXISTS )?(\w+)\s*\((.+)\)$/s);
  if (m) {
    const columns = splitArgs(m[3]).map((def) => {
      const parts = def.trim().split(/\s+/);
      const name = parts[0];
      const type = parts[1] || 'TEXT';
      const up = def.toUpperCase();
      return {
        name, type: type.replace(/,$/, ''),
        primary_key: up.includes('PRIMARY KEY'),
        not_null: up.includes('NOT NULL'),
        unique: up.includes('UNIQUE'),
        autoincrement: /AUTOINCREMENT|AUTO_INCREMENT|SERIAL/i.test(def),
      };
    });
    return { type: 'db_create_table', data: { table_name: m[2], if_not_exists: !!m[1], columns } };
  }
  m = sql.match(/^(?:INSERT OR REPLACE|INSERT IGNORE|INSERT|REPLACE)\s+(?:OR REPLACE )?INTO bot_users\s*\(([^)]+)\)/i);
  if (m) {
    const cols = m[1].split(',').map((c) => c.trim());
    const params = paramsArg ? splitArgs(innerArgs(paramsArg)) : [];
    const fields = cols.map((c, k) => ({ column: c, value: (params[k] || '""').trim() }));
    return { type: 'save_user', data: { fields } };
  }
  m = sql.match(/^(INSERT(?:\s+OR\s+\w+)?|REPLACE|INSERT IGNORE)\s+INTO\s+(\w+)\s*\(([^)]+)\)\s+VALUES/i);
  if (m) {
    const cols = m[3].split(',').map((c) => c.trim());
    const params = paramsArg ? splitArgs(innerArgs(paramsArg)) : [];
    const values = cols.map((c, k) => ({ column: c, value: (params[k] || '').trim() }));
    const mode = /REPLACE/i.test(m[1]) ? 'INSERT OR REPLACE'
      : (/IGNORE/i.test(m[1]) || /ON CONFLICT DO NOTHING\s*$/i.test(sql)) ? 'INSERT OR IGNORE' : 'INSERT';
    return { type: 'db_write', data: { table_name: m[2], mode, values, where_clause: '' } };
  }
  m = sql.match(/^UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/is);
  if (m) {
    const params = paramsArg ? splitArgs(innerArgs(paramsArg)) : [];
    const sets = splitArgs(m[2]).map((s) => s.split('=')[0].trim());
    const values = sets.map((col, k) => ({ column: col, value: (params[k] || '').trim() }));
    return { type: 'db_write', data: { table_name: m[1], mode: 'UPDATE', values,
      where_clause: reverseWhere(m[3] || '', params.slice(sets.length)) } };
  }
  m = sql.match(/^DELETE FROM (\w+)(?:\s+WHERE\s+(.+))?$/is);
  if (m) {
    const params = paramsArg ? splitArgs(innerArgs(paramsArg)) : [];
    return { type: 'db_delete', data: { table_name: m[1], where_clause: reverseWhere(m[2] || '', params), confirm: false } };
  }
  return null;
}

function reverseSelect(sql, params = []) {
  const m = sql.match(/^SELECT (.+?) FROM (\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER BY\s+(.+?))?(?:\s+LIMIT\s+(\d+))?$/is);
  if (!m) return null;
  return {
    table_name: m[2], columns_to_select: m[1].trim(),
    where_clause: m[3] ? reverseWhere(m[3], params) : '',
    order_by: m[4] || '', limit: m[5] || '',
  };
}

function reverseWhere(clause, params) {
  if (!clause) return '';
  let k = 0;
  return clause.replace(/\?|%s/g, () => {
    const p = params[k++];
    if (p === undefined) return '?';
    return `{${p.trim()}}`;
  }).trim();
}

function reverseAiohttp(lines, i, baseIndent, indentOf) {
  let j = i + 1;
  const body = [];
  for (; j < lines.length; j++) {
    if (lines[j].trim() && indentOf(lines[j]) <= baseIndent) break;
    body.push(lines[j].trim());
  }
  const inner = body.find((l) => l.startsWith('async with _sess.')) || '';
  const im = inner.match(/^async with _sess\.(\w+)\((.+)\) as _resp:$/);
  if (!im) return null;
  const method = im[1].toUpperCase();
  const cargs = splitArgs(im[2]);
  const url = unquote(positional(cargs)[0]);
  const tmatch = (kwarg(cargs, 'timeout') || '').match(/total=(\d+)/);
  const timeout = tmatch ? parseInt(tmatch[1]) : 10;
  const headers = reverseHeaders(kwarg(cargs, 'headers'));
  const jsonKw = kwarg(cargs, 'json');
  const resultLine = body.find((l) => l.includes('= _resp.') || l.includes('= await _resp.')) || '';
  const rm = resultLine.match(/^(\w+)\s*=/);
  const resultVar = rm ? rm[1] : 'response';

  if (resultLine.includes('_resp.status')) {
    const data = { url, method, timeout, result_variable: resultVar, headers, payload: '{}' };
    if (jsonKw) {
      const jm = jsonKw.match(/_json\.loads\((.+)\)$/);
      if (jm) data.payload = isPyStr(jm[1]) ? unquoteTemplate(jm[1]) : jm[1];
    }
    return { type: 'webhook', data, newI: j };
  }
  const data = { url, method, timeout, result_variable: resultVar, headers, body: '' };
  if (jsonKw) {
    const jm = jsonKw.match(/_json\.loads\((.+)\)$/);
    if (jm) data.body = unquote(jm[1]);
  }
  return { type: 'http_request', data, newI: j };
}

function reverseHeaders(dictStr) {
  if (!dictStr) return '';
  const inner = innerArgs(dictStr, '{', '}');
  if (!inner) return '';
  return splitArgs(inner).map((pair) => {
    const idx = pair.indexOf(':');
    if (idx === -1) return '';
    return `${unquote(pair.slice(0, idx))}: ${unquote(pair.slice(idx + 1))}`;
  }).filter(Boolean).join('\n');
}

function reverseSheets(lines, i) {
  const credM = lines[i].match(/_json\.loads\(([^)]+)\)/);
  const wsM = (lines[i + 1] || '').match(/open_by_key\(([^)]+)\)\.worksheet\(([^)]+)\)/);
  const data = {
    credentials_var: credM ? unquote(credM[1]) : 'GOOGLE_CREDS_JSON',
    spreadsheet_id: wsM ? unquote(wsM[1]) : '',
    sheet_name: wsM ? unquote(wsM[2]) : 'Sheet1',
    action: 'append', row_data: '', range: 'A1', result_variable: 'sheets_result',
  };
  const third = (lines[i + 2] || '').trim();
  const readM = third.match(/^(\w+)\s*=\s*_gs_ws\.get_all_values\(\)$/);
  if (readM) { data.action = 'read'; data.result_variable = readM[1]; return { type: 'google_sheets', data, newI: i + 3 }; }
  const appM = third.match(/^_gs_ws\.append_row\(\[(.*)\]\)$/);
  if (appM) {
    data.action = 'append';
    data.row_data = splitArgs(appM[1]).map((v) => isStr(v) ? unquote(v) : `{${v}}`).join(', ');
    return { type: 'google_sheets', data, newI: i + 3 };
  }
  return { type: 'google_sheets', data, newI: i + 2 };
}
