import { useMemo, useState } from 'react';
import useStore from '../store/useStore';
import './VariablesPanel.css';

function collectFlowVars(nodes) {
  const vars = new Map();
  const add = (name, source) => {
    if (!vars.has(name)) vars.set(name, { name, sources: [] });
    vars.get(name).sources.push(source);
  };

  for (const n of nodes) {
    if (n.type === 'variable' && n.data?.var_name?.trim()) {
      add(n.data.var_name, { kind: n.data.operation === 'set' ? 'set' : 'get', value: n.data.var_value });
    } else if (n.type === 'wait_input' && n.data?.var_name?.trim()) {
      add(n.data.var_name, { kind: 'input' });
    } else if (n.type === 'loop_for' && n.data?.loop_type === 'list' && n.data?.loop_var?.trim()) {
      add(n.data.loop_var, { kind: 'loop' });
    } else if (n.type === 'get_user_info') {
      for (const field of ['first_name', 'username', 'user_id', 'language_code']) {
        add(field, { kind: 'user_field' });
      }
    }
  }

  return [...vars.values()];
}

const KIND_LABEL = { set: 'set', get: 'get', input: 'input', loop: 'loop', user_field: 'user' };
const KIND_COLOR = { set: '#3fb950', get: '#60a5fa', input: '#e3b341', loop: '#a78bfa', user_field: '#94a3b8' };

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="8" height="8" rx="1.2"/>
      <path d="M3 9H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1"/>
    </svg>
  );
}

export default function VariablesPanel() {
  const nodes   = useStore((s) => s.nodes);
  const [copied, setCopied] = useState(null);

  const flowVars = useMemo(() => collectFlowVars(nodes), [nodes]);

  const copyVar = (name) => {
    navigator.clipboard.writeText(`{${name}}`);
    setCopied(name);
    setTimeout(() => setCopied(null), 1200);
  };

  return (
    <div className="vars-panel">
      <div className="vars-panel__section">
        <div className="vars-panel__section-title">
          Переменные
          <span className="vars-panel__count">{flowVars.length}</span>
        </div>
        {flowVars.length === 0 ? (
          <div className="vars-panel__empty">Нет переменных в флоу</div>
        ) : (
          flowVars.map((v) => (
            <div key={v.name} className="vars-panel__row">
              <span className="vars-panel__name">{v.name}</span>
              <div className="vars-panel__kinds">
                {[...new Set(v.sources.map((s) => s.kind))].map((k) => (
                  <span key={k} className="vars-panel__kind" style={{ color: KIND_COLOR[k] }}>
                    {KIND_LABEL[k]}
                  </span>
                ))}
              </div>
              <button
                className={`vars-panel__copy-btn${copied === v.name ? ' vars-panel__copy-btn--ok' : ''}`}
                onClick={() => copyVar(v.name)}
                title={`Копировать {${v.name}}`}
              >
                {copied === v.name ? '✓' : <CopyIcon />}
              </button>
            </div>
          ))
        )}
      </div>

      <div className="vars-panel__hint">
        <CopyIcon /> — скопировать <code>{'{имя}'}</code> для условий
      </div>
    </div>
  );
}
