import { useRef, useEffect, useState } from 'react';
import useStore from '../store/useStore';
import './ConsolePanel.css';

let _lineId = 0;
const mkLine = (text, type) => ({ id: ++_lineId, text, type });

export default function ConsolePanel() {
  const storeConsoleLogs = useStore((s) => s.consoleLogs);
  const clearLogs        = useStore((s) => s.clearLogs);
  const consoleClearTick = useStore((s) => s.consoleClearTick);

  const [lines, setLines] = useState([mkLine('Console ready. Bot logs appear here.', 'system')]);
  const prevLogsRef = useRef([]);
  const outputRef   = useRef(null);

  useEffect(() => {
    const prev = prevLogsRef.current;
    const next = storeConsoleLogs;
    if (next.length === 0 && prev.length > 0) {
      setLines((ls) => ls.filter((l) => !l.type.startsWith('log-')));
      prevLogsRef.current = [];
      return;
    }
    if (next.length > prev.length) {
      const added = next.slice(prev.length);
      setLines((ls) => [
        ...ls,
        ...added.map((log) => mkLine(`[${log.time}] ${log.text}`, `log-${log.type}`)),
      ]);
      prevLogsRef.current = next;
    }
  }, [storeConsoleLogs]);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [lines.length]);

  const prevClearTick = useRef(consoleClearTick);
  useEffect(() => {
    if (consoleClearTick !== prevClearTick.current) {
      prevClearTick.current = consoleClearTick;
      setLines([mkLine('Cleared.', 'system')]);
      clearLogs();
      prevLogsRef.current = [];
    }
  }, [consoleClearTick, clearLogs]);

  return (
    <div className="console-panel">
      <div className="console-output" ref={outputRef}>
        {lines.map((l) => (
          <div key={l.id} className={`console-line console-line--${l.type}`}>
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}
