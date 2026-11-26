import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import useStore from '../store/useStore';

const SENT = '\x1e';
const MARK_HEAD = `${SENT}TGTERM${SENT}`;
const MARK_CMD =
  `[Console]::Out.WriteLine("$([char]30)TGTERM$([char]30)$((Get-Location).Path)$([char]30)")`;

const THEME_DARK = {
  background: 'rgba(0,0,0,0)', foreground: '#e9ecf2', cursor: '#3b8cff',
  selectionBackground: 'rgba(59,140,255,0.35)',
  black: '#1a1d26', red: '#f14c4c', green: '#23d18b', yellow: '#e5c07b',
  blue: '#4ea0f0', magenta: '#d670d6', cyan: '#29b8db', white: '#d4d4d4',
  brightBlack: '#808080', brightRed: '#ff6b68', brightGreen: '#a8e6a0',
  brightYellow: '#f5d76e', brightBlue: '#6cb6ff', brightMagenta: '#e59be5',
  brightCyan: '#56d4e8', brightWhite: '#ffffff',
};
const THEME_LIGHT = {
  background: 'rgba(0,0,0,0)', foreground: '#0f172a', cursor: '#0a6cff',
  selectionBackground: 'rgba(10,108,255,0.22)',
  black: '#0f172a', red: '#dc2626', green: '#16a34a', yellow: '#b45309',
  blue: '#0a6cff', magenta: '#7c3aed', cyan: '#0891b2', white: '#475569',
  brightBlack: '#94a3b8', brightRed: '#ef4444', brightGreen: '#22c55e',
  brightYellow: '#d97706', brightBlue: '#3b8cff', brightMagenta: '#a855f7',
  brightCyan: '#06b6d4', brightWhite: '#0f172a',
};

function promptFor(cwd) {
  const p = cwd || '~';
  return `\x1b[32mPS\x1b[0m \x1b[33m${p}\x1b[0m> `;
}
function plainPromptLen(cwd) {
  return `PS ${cwd || '~'}> `.length;
}

export default function TerminalPanel() {
  const cwd = useStore((s) => s.explorerFolder);
  const isDark = useStore((s) => s.isDark);
  const containerRef = useRef(null);
  const termRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ipc = window.electron?.ipcRenderer;
    if (!ipc) return;

    const sessionId = `term_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace",
      fontSize: 12.5,
      allowTransparency: true,
      lineHeight: 1.2,
      scrollback: 8000,
      theme: isDark ? THEME_DARK : THEME_LIGHT,
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    try { fit.fit(); } catch { }
    termRef.current = term;

    const ed = {
      line: '', cur: 0, running: true,
      hist: [], hi: 0,
      buf: '', first: true, cwd: cwd || '',
    };

    const render = () => {
      term.write('\r' + promptFor(ed.cwd) + ed.line + '\x1b[K');
      const back = ed.line.length - ed.cur;
      if (back > 0) term.write(`\x1b[${back}D`);
    };

    const newPrompt = () => {
      ed.running = false; ed.line = ''; ed.cur = 0;
      term.write(promptFor(ed.cwd));
    };

    const submit = () => {
      const cmd = ed.line;
      term.write('\r\n');
      if (cmd.trim()) {
        if (ed.hist[ed.hist.length - 1] !== cmd) ed.hist.push(cmd);
      }
      ed.hi = ed.hist.length;
      ed.running = true; ed.line = ''; ed.cur = 0;
      ipc.invoke('term:write', { sessionId, data: cmd + '\r\n' });
      ipc.invoke('term:write', { sessionId, data: MARK_CMD + '\r\n' });
    };

    const insert = (str) => {
      ed.line = ed.line.slice(0, ed.cur) + str + ed.line.slice(ed.cur);
      ed.cur += str.length;
      render();
    };

    const onData = (data) => {
      if (ed.running) {
        if (data === '\x03') ipc.invoke('term:write', { sessionId, data: '\x03' });
        return;
      }
      switch (data) {
        case '\r': submit(); return;
        case '\x7f': if (ed.cur > 0) { ed.line = ed.line.slice(0, ed.cur - 1) + ed.line.slice(ed.cur); ed.cur--; render(); } return;
        case '\x1b[3~': if (ed.cur < ed.line.length) { ed.line = ed.line.slice(0, ed.cur) + ed.line.slice(ed.cur + 1); render(); } return;
        case '\x1b[D': if (ed.cur > 0) { ed.cur--; render(); } return;
        case '\x1b[C': if (ed.cur < ed.line.length) { ed.cur++; render(); } return;
        case '\x1b[H': case '\x01': ed.cur = 0; render(); return;
        case '\x1b[F': case '\x05': ed.cur = ed.line.length; render(); return;
        case '\x1b[A':
          if (ed.hist.length && ed.hi > 0) { ed.hi--; ed.line = ed.hist[ed.hi]; ed.cur = ed.line.length; render(); }
          return;
        case '\x1b[B':
          if (ed.hi < ed.hist.length) { ed.hi++; ed.line = ed.hist[ed.hi] ?? ''; ed.cur = ed.line.length; render(); }
          return;
        case '\x03': term.write('^C\r\n'); newPrompt(); return;
        case '\x0c': term.write('\x1b[2J\x1b[H'); render(); return;
        case '\x17': {
          const left = ed.line.slice(0, ed.cur).replace(/\s*\S+\s*$/, '');
          ed.line = left + ed.line.slice(ed.cur); ed.cur = left.length; render(); return;
        }
        default: break;
      }
      const printable = [...data].filter((c) => c === '\t' || c >= ' ').join('');
      if (printable) insert(printable);
    };

    const onDataDisp = term.onData(onData);

    const onPtyData = (payload) => {
      if (payload?.sessionId !== sessionId) return;
      ed.buf += payload.data;

      let start;
      while ((start = ed.buf.indexOf(MARK_HEAD)) !== -1) {
        const from = start + MARK_HEAD.length;
        const close = ed.buf.indexOf(SENT, from);
        if (close === -1) break;
        const before = ed.buf.slice(0, start);
        if (before) term.write(before);
        ed.cwd = ed.buf.slice(from, close) || ed.cwd;
        ed.buf = ed.buf.slice(close + 1).replace(/^\r?\n/, '');
        if (ed.first) { ed.first = false; term.write('\x1b[2J\x1b[H'); }
        newPrompt();
      }
      if (ed.buf.indexOf(SENT) === -1) {
        if (ed.buf) { term.write(ed.buf); ed.buf = ''; }
      }
    };
    const onPtyExit = (payload) => {
      if (payload?.sessionId === sessionId) {
        term.write(`\r\n\x1b[33m[процесс завершён, код ${payload.code}]\x1b[0m\r\n`);
      }
    };
    const offData = ipc.on('pty:data', onPtyData);
    const offExit = ipc.on('pty:exit', onPtyExit);

    ipc.invoke('term:create', { sessionId, cwd });

    const ro = new ResizeObserver(() => { try { fit.fit(); } catch { } });
    ro.observe(containerRef.current);

    return () => {
      onDataDisp.dispose();
      ro.disconnect();
      if (typeof offData === 'function') offData();
      if (typeof offExit === 'function') offExit();
      ipc.invoke('term:kill', { sessionId });
      term.dispose();
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (termRef.current) termRef.current.options.theme = isDark ? THEME_DARK : THEME_LIGHT;
  }, [isDark]);

  return (
    <div className="term-host" style={{ height: '100%', width: '100%', overflow: 'hidden', padding: '6px 4px 4px 12px' }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}
