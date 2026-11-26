import useStore from '../store/useStore';
import { useT } from '../i18n';
import { BLOCK_DEFS, blockColor } from '../blockDefinitions';
import { BlockGlyph, Icon } from '../components/Icons';
import './BaseNode.css';

const MONO_TYPES = new Set([
  'command', 'deep_link', 'condition', 'variable', 'list_op', 'loop_for', 'rate_limit',
  'timer', 'db_create_table', 'db_write', 'db_read', 'db_delete', 'http_request', 'webhook',
  'code_block', 'get_user_info', 'save_user', 'dynamic_step', 'schedule',
]);

function BaseNode({ nodeId, icon, label, selected, preview, tag, mono, children }) {
  const onNodesChange      = useStore((s) => s.onNodesChange);
  const duplicateNodes     = useStore((s) => s.duplicateNodes);
  const toggleNodeDisabled = useStore((s) => s.toggleNodeDisabled);
  const isHovered          = useStore((s) => s.hoveredNodeId === nodeId);
  const isNeighbor         = useStore((s) => s.hoveredNodeId !== nodeId && s.neighborNodeIds.includes(nodeId));
  const type               = useStore((s) => s.nodes.find((n) => n.id === nodeId)?.type);
  const disabled           = useStore((s) => !!s.nodes.find((n) => n.id === nodeId)?.data?.disabled);
  const errs               = useStore((s) => s.nodeErrors[nodeId]);
  const step               = useStore((s) => s.traceSteps[nodeId] || 0);
  const lang               = useStore((s) => s.lang);
  const T                  = useT();

  const hasCritical = !!errs?.some((e) => e.level === 'error');
  const hasWarning  = !hasCritical && !!errs?.some((e) => e.level === 'warning');

  const blockDef     = type ? BLOCK_DEFS[type] : null;
  const displayLabel = blockDef && lang === 'en' ? (blockDef.label_en || label) : label;
  const isMono       = mono ?? MONO_TYPES.has(type);

  const cls = [
    'base-node',
    selected   ? 'base-node--selected' : '',
    isHovered  ? 'base-node--hovered'  : '',
    isNeighbor ? 'base-node--neighbor' : '',
    disabled   ? 'base-node--disabled' : '',
    step       ? 'base-node--traced'   : '',
  ].filter(Boolean).join(' ');

  const stop = (e) => e.stopPropagation();

  return (
    <div className={cls} style={{ '--g': blockDef ? blockColor(type) : 'var(--text-3)' }}>
      {step > 0 && <span className="base-node__step" title="Шаг выполнения в выбранном запросе">{step}</span>}

      <div className="base-node__actions" onMouseDown={stop}>
        <button onClick={(e) => { stop(e); duplicateNodes([nodeId]); }} title={T('node.duplicate')}>
          <Icon name="copy" size={14} />
        </button>
        <button onClick={(e) => { stop(e); toggleNodeDisabled?.(nodeId); }} title={disabled ? 'Включить' : 'Отключить'}>
          <Icon name={disabled ? 'play' : 'pause'} size={14} />
        </button>
        <button className="danger" onClick={(e) => { stop(e); onNodesChange([{ type: 'remove', id: nodeId }]); }} title={T('node.delete')}>
          <Icon name="trash" size={14} />
        </button>
      </div>

      <div className="base-node__header">
        <span className="base-node__glyph">
          {blockDef ? <BlockGlyph type={type} size={14} stroke={2} /> : <span className="base-node__emoji">{icon}</span>}
        </span>
        <span className="base-node__title">{displayLabel}</span>
        {disabled
          ? <span className="base-node__meta base-node__meta--off">{T('node.disabled')}</span>
          : tag && <span className="base-node__meta">{tag}</span>}
        {(hasCritical || hasWarning) && (
          <span
            className={`base-node__val base-node__val--${hasCritical ? 'error' : 'warn'}`}
            title={errs.map((e) => e.message).join('\n')}
          >
            <Icon name={hasCritical ? 'error' : 'warn'} size={13} stroke={2} />
          </span>
        )}
      </div>

      {preview
        ? <div className={`base-node__body${isMono ? ' base-node__body--mono' : ''}`}>{preview}</div>
        : <div className="base-node__pad" />}
      {children}
    </div>
  );
}

export default BaseNode;
