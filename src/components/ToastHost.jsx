import { useEffect, useState } from 'react';
import './ToastHost.css';

let _id = 0;
const _listeners = new Set();

function emit(level, text, opts = {}) {
  const item = {
    id: ++_id, level, text,
    duration: opts.duration ?? 4000,
  };
  _listeners.forEach((fn) => fn(item));
  return item.id;
}

export const toast = {
  success: (text, opts) => emit('success', text, opts),
  error:   (text, opts) => emit('error',   text, { duration: 8000, ...opts }),
  info:    (text, opts) => emit('info',    text, opts),
  warn:    (text, opts) => emit('warn',    text, opts),
};

export default function ToastHost() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const onItem = (item) => {
      setItems((prev) => [...prev, item]);
      if (item.duration > 0) {
        setTimeout(() => {
          setItems((prev) => prev.filter((x) => x.id !== item.id));
        }, item.duration);
      }
    };
    _listeners.add(onItem);
    return () => { _listeners.delete(onItem); };
  }, []);

  const dismiss = (id) => setItems((prev) => prev.filter((x) => x.id !== id));

  return (
    <div className="toast-host">
      {items.map((it) => (
        <div key={it.id} className={`toast toast--${it.level}`}>
          <span className="toast-icon">
            {it.level === 'success' ? '✓' : it.level === 'error' ? '×' :
             it.level === 'warn' ? '!' : 'ⓘ'}
          </span>
          <span className="toast-text">{it.text}</span>
          <button className="toast-close" onClick={() => dismiss(it.id)}>×</button>
        </div>
      ))}
    </div>
  );
}
