import contextvars
import io
import json
import os
import sys
import threading
import time
import traceback

MARK = '\x1eTGB '
BOT_FILE = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'bot.py')
MAX_LINES = 5000
SKIP_METHODS = {'getUpdates', 'getMe', 'deleteWebhook'}

_out = sys.__stdout__
_lock = threading.Lock()
_cur = contextvars.ContextVar('tgb_update', default=None)
_lines = {}


def emit(ev):
    try:
        s = json.dumps(ev, ensure_ascii=False, default=str)
    except Exception:
        return
    with _lock:
        try:
            _out.write(MARK + s + '\n')
            _out.flush()
        except Exception:
            pass


def _is_unset(v):
    return v is None or type(v).__name__ == 'Default'


def _clean(obj, depth=0):
    if depth > 8:
        return '…'
    if isinstance(obj, dict):
        return {str(k): _clean(v, depth + 1) for k, v in obj.items() if not _is_unset(v)}
    if isinstance(obj, (list, tuple)):
        out = [_clean(v, depth + 1) for v in obj[:60]]
        if len(obj) > 60:
            out.append(f'… +{len(obj) - 60}')
        return out
    if isinstance(obj, str):
        return obj if len(obj) <= 1500 else obj[:1500] + '…'
    if obj is None or isinstance(obj, (bool, int, float)):
        return obj
    if hasattr(obj, 'model_dump'):
        try:
            return _clean(obj.model_dump(exclude_none=True), depth + 1)
        except Exception:
            pass
    s = str(obj)
    return s if len(s) <= 300 else s[:300] + '…'


def _exc(e):
    line = None
    for fr in reversed(traceback.extract_tb(e.__traceback__)):
        if os.path.abspath(fr.filename) == BOT_FILE:
            line = fr.lineno
            break
    tb = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    return {'type': type(e).__name__, 'msg': str(e)[:1000], 'line': line, 'tb': tb[-6000:]}


def _record(lineno):
    uid = _cur.get()
    if uid is None:
        return
    lst = _lines.get(uid)
    if lst is not None and len(lst) < MAX_LINES and (not lst or lst[-1] != lineno):
        lst.append(lineno)


def _iter_codes(code):
    yield code
    for c in code.co_consts:
        if hasattr(c, 'co_code'):
            yield from _iter_codes(c)


def _install_tracing(code):
    mon = getattr(sys, 'monitoring', None)
    if mon is not None:
        try:
            tool = 4
            mon.use_tool_id(tool, 'tgb-runner')
            mon.register_callback(tool, mon.events.LINE, lambda c, ln: _record(ln))
            for c in _iter_codes(code):
                mon.set_local_events(tool, c, mon.events.LINE)
            return
        except Exception:
            pass

    def local(frame, event, arg):
        if event == 'line':
            _record(frame.f_lineno)
        return local

    def glob(frame, event, arg):
        return local if frame.f_code.co_filename == BOT_FILE else None

    sys.settrace(glob)
    threading.settrace(glob)


_pbuf = {}
NL = chr(10)


def _flush_prints(uid):
    for key in [k for k in _pbuf if k[0] == uid]:
        rest = _pbuf.pop(key)
        if rest.strip():
            emit({'t': 'print', 'uid': uid, 'stream': key[1], 'text': rest[:4000]})


class _Tee(io.TextIOBase):
    def __init__(self, base, stream):
        self._base, self._stream = base, stream

    def write(self, s):
        uid = _cur.get()
        if uid is None or not s:
            return self._base.write(s)
        key = (uid, self._stream)
        buf = _pbuf.get(key, '') + s
        if NL in buf:
            done, buf = buf.rsplit(NL, 1)
            if done.strip():
                emit({'t': 'print', 'uid': uid, 'stream': self._stream, 'text': done[:4000]})
        _pbuf[key] = buf
        return len(s)

    def flush(self):
        try:
            self._base.flush()
        except Exception:
            pass

    def isatty(self):
        return False

    @property
    def encoding(self):
        return getattr(self._base, 'encoding', 'utf-8')


def _describe(update):
    d = {'t': 'update', 'uid': update.update_id, 'ts': time.time() * 1000}
    try:
        kind = update.event_type
        ev = update.event
    except Exception:
        kind, ev = 'unknown', None
    d['kind'] = kind
    user = getattr(ev, 'from_user', None)
    chat = getattr(ev, 'chat', None)
    if chat is None and getattr(ev, 'message', None) is not None:
        chat = getattr(ev.message, 'chat', None)
    if user is not None:
        d['user'] = {'id': user.id, 'first_name': user.first_name, 'last_name': user.last_name,
                     'username': user.username, 'lang': user.language_code, 'is_bot': user.is_bot}
    if chat is not None:
        d['chat'] = {'id': chat.id, 'type': chat.type, 'title': getattr(chat, 'title', None)}
    try:
        if kind in ('message', 'edited_message', 'channel_post', 'edited_channel_post', 'business_message'):
            d['text'] = ev.text or ev.caption
            ct = getattr(ev, 'content_type', '') or ''
            d['content_type'] = str(getattr(ct, 'value', ct))
            if getattr(ev, 'contact', None) is not None:
                d['text'] = d['text'] or f'контакт {ev.contact.phone_number}'
        elif kind == 'callback_query':
            d['data'] = ev.data
            kb = getattr(getattr(ev, 'message', None), 'reply_markup', None)
            for row in (getattr(kb, 'inline_keyboard', None) or []):
                for b in row:
                    if getattr(b, 'callback_data', None) == ev.data:
                        d['button'] = b.text
        elif kind == 'inline_query':
            d['text'] = ev.query
        elif kind in ('my_chat_member', 'chat_member'):
            d['text'] = f'{ev.old_chat_member.status} → {ev.new_chat_member.status}'
    except Exception:
        pass
    try:
        d['raw'] = _clean(update.model_dump(exclude_none=True))
    except Exception:
        pass
    return d


async def _fsm_state(data):
    st = data.get('state') if isinstance(data, dict) else None
    if st is None:
        return None
    try:
        return await st.get_state()
    except Exception:
        return None


async def _update_mw(handler, event, data):
    uid = getattr(event, 'update_id', None)
    if uid is None:
        return await handler(event, data)
    emit(_describe(event))
    _lines[uid] = []
    token = _cur.set(uid)
    fsm_before = await _fsm_state(data)
    t0 = time.perf_counter()
    handled, err = False, None
    try:
        result = await handler(event, data)
        handled = result is not _UNHANDLED
        return result
    except Exception as e:
        handled, err = True, _exc(e)
        raise
    finally:
        ms = round((time.perf_counter() - t0) * 1000, 1)
        _cur.reset(token)
        _flush_prints(uid)
        fsm_after = await _fsm_state(data)
        emit({'t': 'done', 'uid': uid, 'ms': ms, 'handled': handled, 'error': err,
              'lines': _lines.pop(uid, []),
              'fsm': [fsm_before, fsm_after] if (fsm_before or fsm_after) else None})


def _install_aiogram_hooks():
    global _UNHANDLED
    try:
        from aiogram import Bot, Dispatcher
        from aiogram.client.session.middlewares.base import BaseRequestMiddleware
        from aiogram.dispatcher.event.bases import UNHANDLED
    except Exception:
        return
    _UNHANDLED = UNHANDLED

    class _RequestMW(BaseRequestMiddleware):
        async def __call__(self, make_request, bot, method):
            name = getattr(method, '__api_method__', type(method).__name__)
            if name == 'getUpdates':
                return await make_request(bot, method)
            uid = _cur.get()
            t0 = time.perf_counter()
            try:
                res = await make_request(bot, method)
            except Exception as e:
                if name not in SKIP_METHODS:
                    emit({'t': 'call', 'uid': uid, 'method': name, 'params': _params(method),
                          'ms': round((time.perf_counter() - t0) * 1000, 1), 'ok': False,
                          'error': f'{type(e).__name__}: {e}'[:800]})
                raise
            ms = round((time.perf_counter() - t0) * 1000, 1)
            val = res.result if type(res).__name__ == 'Response' else res
            if name == 'getMe':
                me = val
                if me is not None:
                    emit({'t': 'ready', 'bot': {'id': me.id, 'username': me.username, 'name': me.first_name}})
            elif name not in SKIP_METHODS:
                emit({'t': 'call', 'uid': uid, 'method': name, 'params': _params(method), 'ms': ms,
                      'ok': True, 'result': _clean(val)})
            return res

    def _params(method):
        try:
            return _clean(method.model_dump(exclude_none=True))
        except Exception:
            return None

    orig_bot_init = Bot.__init__

    def bot_init(self, *a, **k):
        orig_bot_init(self, *a, **k)
        try:
            self.session.middleware(_RequestMW())
        except Exception:
            pass

    Bot.__init__ = bot_init

    orig_dp_init = Dispatcher.__init__

    def dp_init(self, *a, **k):
        orig_dp_init(self, *a, **k)
        try:
            self.update.outer_middleware(_update_mw)
        except Exception:
            pass

    Dispatcher.__init__ = dp_init

    import logging

    class _DupFilter(logging.Filter):
        def filter(self, record):
            try:
                return not str(record.msg).startswith('Cause exception while process update')
            except Exception:
                return True

    logging.getLogger('aiogram.event').addFilter(_DupFilter())


_UNHANDLED = object()


def main():
    try:
        with open(BOT_FILE, encoding='utf-8') as f:
            src = f.read()
        code = compile(src, BOT_FILE, 'exec')
    except SyntaxError:
        traceback.print_exc()
        sys.exit(1)

    _install_aiogram_hooks()
    sys.stdout = _Tee(sys.stdout, 'stdout')
    sys.stderr = _Tee(sys.stderr, 'stderr')
    sys.argv = [BOT_FILE]
    sys.path.insert(0, os.path.dirname(BOT_FILE))
    g = {'__name__': '__main__', '__file__': BOT_FILE, '__builtins__': __builtins__}
    _install_tracing(code)
    exec(code, g)


if __name__ == '__main__':
    main()
