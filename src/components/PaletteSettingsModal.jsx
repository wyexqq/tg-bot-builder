import { useState, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import useStore from '../store/useStore';
import useCustomBlockStore from '../customBlocks/customBlockStore';
import { PALETTE_GROUPS, PALETTE_ITEMS, BLOCK_DEFS } from '../blockDefinitions';
import './PaletteSettingsModal.css';

const BUILTIN_KEYS = PALETTE_GROUPS.map((g) => g.key);
const ITEM_MAP     = Object.fromEntries(PALETTE_ITEMS.map((b) => [b.type, b]));

function groupLabel(key, groups, lang) {
  const cfg = groups[key];
  if (cfg?.customName) return cfg.customName;
  const i18n = {
    'group.triggers':     { ru: 'Триггеры',      en: 'Triggers' },
    'group.messages':     { ru: 'Сообщения',     en: 'Messages' },
    'group.logic':        { ru: 'Логика',        en: 'Logic' },
    'group.users':        { ru: 'Пользователи',  en: 'Users' },
    'group.data':         { ru: 'Данные',        en: 'Data' },
    'group.database':     { ru: 'База данных',   en: 'Database' },
    'group.integrations': { ru: 'Интеграции',    en: 'Integrations' },
    'group.extra':        { ru: 'Прочее',        en: 'Other' },
    'group.custom':       { ru: 'Кастомные',     en: 'Custom' },
  };
  return i18n[key]?.[lang] ?? key;
}

function useSortable({ listRef, onReorder }) {
  const [drag, setDrag] = useState(null);
  const toIndexRef = useRef(null);

  const startDrag = useCallback((e, index, ghostContent, opts = {}) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (!listRef.current) return;

    const itemEls = [...listRef.current.querySelectorAll('[data-si]')];
    if (!itemEls[index]) return;
    const rects = itemEls.map((el) => el.getBoundingClientRect());
    const rect   = rects[index];

    const groupMin = opts.groupMin ?? 0;
    const groupMax = opts.groupMax ?? (rects.length - 1);

    toIndexRef.current = index;

    const containerRect = listRef.current?.getBoundingClientRect() ?? null;

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    setDrag({
      fromIndex: index,
      toIndex:   index,
      ghostX:    rect.left,
      ghostY:    rect.top,
      ghostW:    rect.width,
      ghostH:    rect.height,
      rects,
      ghostContent,
      groupMin,
      groupMax,
    });

    const startMouseY = e.clientY;

    const onMove = (me) => {
      setDrag((d) => {
        if (!d) return null;
        const mouseY  = me.clientY;
        const deltaY  = mouseY - startMouseY;

        let ghostY = rect.top + deltaY;
        if (containerRect) {
          ghostY = Math.max(
            containerRect.top,
            Math.min(containerRect.bottom - rect.height, ghostY)
          );
        }

        let newTo = d.fromIndex;

        for (let i = d.fromIndex - 1; i >= d.groupMin; i--) {
          const mid = (d.rects[i].top + d.rects[i].bottom) / 2;
          if (mouseY < mid) newTo = i;
          else break;
        }

        for (let i = d.fromIndex + 1; i <= d.groupMax; i++) {
          const mid = (d.rects[i].top + d.rects[i].bottom) / 2;
          if (mouseY > mid) newTo = i;
          else break;
        }

        newTo = Math.max(d.groupMin, Math.min(d.groupMax, newTo));

        toIndexRef.current = newTo;
        return { ...d, toIndex: newTo, ghostY };
      });
    };

    const onUp = () => {
      const from = index;
      const to   = toIndexRef.current;

      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      setDrag(null);
      toIndexRef.current = null;

      if (to !== null && to !== from) onReorder(from, to);

      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [listRef, onReorder]);

  const getItemStyle = useCallback((index) => {
    if (!drag) return {};
    const { fromIndex, toIndex, rects, groupMin, groupMax } = drag;

    if (index === fromIndex) return { opacity: 0, pointerEvents: 'none' };

    if (index < groupMin || index > groupMax) return {};

    const itemH = rects[fromIndex]?.height ?? 36;
    const gap   = rects.length > 1
      ? Math.max(0, rects[Math.min(1, rects.length - 1)].top - rects[0].bottom)
      : 2;
    const step  = itemH + gap;

    let shift = 0;
    if (fromIndex < toIndex && index > fromIndex && index <= toIndex) shift = -step;
    if (fromIndex > toIndex && index < fromIndex && index >= toIndex) shift = +step;

    return {
      transform:  shift ? `translateY(${shift}px)` : 'none',
      transition: 'transform 0.13s cubic-bezier(.25,.46,.45,.94)',
    };
  }, [drag]);

  const ghostPortal = drag
    ? ReactDOM.createPortal(
        <div
          className="psm-sort-ghost"
          style={{
            top:    drag.ghostY,
            left:   drag.ghostX,
            width:  drag.ghostW,
            height: drag.ghostH,
          }}
        >
          {drag.ghostContent}
        </div>,
        document.body
      )
    : null;

  return { drag, startDrag, getItemStyle, ghostPortal };
}

function BlockEditor({ type, cfg, onSave, onClose }) {
  const item        = ITEM_MAP[type];
  const originalDef = BLOCK_DEFS[type];
  if (!item || !originalDef) return null;

  const [icon,  setIcon]  = useState(cfg.customIcon  ?? item.icon  ?? '');
  const [label, setLabel] = useState(cfg.customLabel ?? (item.label ?? type));
  const [desc,  setDesc]  = useState(cfg.customDesc  ?? item.desc  ?? '');

  const baseData = cfg.customDefaultData ?? originalDef.defaultData;
  const [data, setData] = useState(() => JSON.parse(JSON.stringify(baseData)));
  const setValue = (key, value) => setData((prev) => ({ ...prev, [key]: value }));

  const handleApply = () => {
    onSave({
      customIcon:        icon  !== item.icon  ? (icon  || null) : null,
      customLabel:       label !== item.label ? (label || null) : null,
      customDesc:        desc  !== item.desc  ? (desc  || null) : null,
      customDefaultData: data,
    });
    onClose();
  };

  const handleReset = () => {
    setIcon(item.icon ?? '');
    setLabel(item.label ?? type);
    setDesc(item.desc ?? '');
    setData(JSON.parse(JSON.stringify(originalDef.defaultData)));
  };

  const renderField = (key, value) => {
    if (typeof value === 'boolean') {
      return (
        <label key={key} className="psm-dd-row">
          <span className="psm-dd-key">{key}</span>
          <input type="checkbox" className="psm-dd-check" checked={value}
            onChange={(e) => setValue(key, e.target.checked)} />
        </label>
      );
    }
    if (typeof value === 'number') {
      return (
        <label key={key} className="psm-dd-row">
          <span className="psm-dd-key">{key}</span>
          <input type="number" className="psm-dd-input" value={value}
            onChange={(e) => setValue(key, parseFloat(e.target.value) || 0)} />
        </label>
      );
    }
    if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
      return (
        <label key={key} className="psm-dd-row psm-dd-row--json">
          <span className="psm-dd-key">{key}</span>
          <textarea className="psm-dd-textarea" defaultValue={JSON.stringify(value, null, 2)}
            onBlur={(e) => { try { setValue(key, JSON.parse(e.target.value)); } catch { } }} />
        </label>
      );
    }
    return (
      <label key={key} className="psm-dd-row">
        <span className="psm-dd-key">{key}</span>
        <input className="psm-dd-input" value={value ?? ''}
          onChange={(e) => setValue(key, e.target.value)} />
      </label>
    );
  };

  return (
    <div className="psm-dd-overlay" onClick={onClose}>
      <div className="psm-dd-box psm-dd-box--wide" onClick={(e) => e.stopPropagation()}>
        <div className="psm-dd-head">
          <span className="psm-meta-preview-head">
            <span className="psm-meta-preview-icon">{icon || item.icon}</span>
            {label || item.label}
          </span>
          <button className="psm-dd-close" onClick={onClose}>×</button>
        </div>

        <div className="psm-dd-body">
          <div className="psm-be-section">Вид</div>
          <label className="psm-dd-row">
            <span className="psm-dd-key">Иконка</span>
            <input className="psm-dd-input psm-dd-input--icon" value={icon}
              placeholder={item.icon} maxLength={8}
              onChange={(e) => setIcon(e.target.value)} />
            <span className="psm-meta-preview">{icon || item.icon}</span>
          </label>
          <label className="psm-dd-row">
            <span className="psm-dd-key">Название</span>
            <input className="psm-dd-input" value={label}
              placeholder={item.label}
              onChange={(e) => setLabel(e.target.value)} />
          </label>
          <label className="psm-dd-row">
            <span className="psm-dd-key">Описание</span>
            <input className="psm-dd-input" value={desc}
              placeholder={item.desc}
              onChange={(e) => setDesc(e.target.value)} />
          </label>

          {Object.keys(originalDef.defaultData).length > 0 && (
            <>
              <div className="psm-be-section">Значения по умолчанию</div>
              {Object.entries(data).map(([k, v]) => renderField(k, v))}
            </>
          )}
        </div>

        <div className="psm-dd-foot">
          <button className="psm-btn psm-btn--ghost" onClick={handleReset}>Сбросить</button>
          <button className="psm-btn psm-btn--primary" onClick={handleApply}>Применить</button>
        </div>
      </div>
    </div>
  );
}

function GroupsTab({ paletteConfig, lang }) {
  const updatePaletteGroup = useStore((s) => s.updatePaletteGroup);
  const movePaletteGroup   = useStore((s) => s.movePaletteGroup);
  const addPaletteGroup    = useStore((s) => s.addPaletteGroup);
  const removePaletteGroup = useStore((s) => s.removePaletteGroup);

  const { groupOrder, groups } = paletteConfig;

  const [editingKey,   setEditingKey]   = useState(null);
  const [editVal,      setEditVal]      = useState('');
  const [newGroupName, setNewGroupName] = useState('');

  const listRef = useRef(null);

  const { drag, startDrag, getItemStyle, ghostPortal } = useSortable({
    listRef,
    onReorder: (from, to) => movePaletteGroup(groupOrder[from], to),
  });

  const startEdit = (key) => {
    setEditingKey(key);
    setEditVal(groups[key]?.customName ?? groupLabel(key, groups, lang));
  };
  const commitEdit = (key) => {
    const val = editVal.trim();
    updatePaletteGroup(key, { customName: val || null });
    setEditingKey(null);
  };

  const createGroup = () => {
    const name = newGroupName.trim();
    if (!name) return;
    addPaletteGroup(`group.user_${Date.now()}`, name);
    setNewGroupName('');
  };

  return (
    <div className="psm-tab-body">
      {ghostPortal}
      <div className="psm-section-label">Перетаскивайте для изменения порядка</div>

      <div ref={listRef} className="psm-group-list">
        {groupOrder.map((key, idx) => {
          const cfg      = groups[key] ?? {};
          const isBuiltin = BUILTIN_KEYS.includes(key);
          const name     = groupLabel(key, groups, lang);

          return (
            <div
              key={key}
              data-si={idx}
              className={`psm-group-row${cfg.hidden ? ' psm-group-row--hidden' : ''}`}
              style={getItemStyle(idx)}
            >
              <span
                className="psm-drag-handle"
                onMouseDown={(e) =>
                  startDrag(e, idx, (
                    <div className="psm-ghost-group-row">
                      <span className="psm-drag-handle psm-drag-handle--ghost">⠿</span>
                      <span className="psm-group-name">{name}</span>
                    </div>
                  ))
                }
              >⠿</span>

              {editingKey === key ? (
                <input
                  className="psm-inline-input"
                  value={editVal}
                  autoFocus
                  onChange={(e) => setEditVal(e.target.value)}
                  onBlur={() => commitEdit(key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')  commitEdit(key);
                    if (e.key === 'Escape') setEditingKey(null);
                  }}
                />
              ) : (
                <span className="psm-group-name" onDoubleClick={() => startEdit(key)}>
                  {name}
                  {cfg.customName && <span className="psm-edited-dot" title="Переименовано" />}
                </span>
              )}

              <div className="psm-row-actions">
                <button className="psm-icon-btn" title="Переименовать" onClick={() => startEdit(key)}>✎</button>
                <button
                  className={`psm-icon-btn${cfg.hidden ? ' psm-icon-btn--active' : ''}`}
                  title={cfg.hidden ? 'Показать' : 'Скрыть'}
                  onClick={() => updatePaletteGroup(key, { hidden: !cfg.hidden })}
                >
                  {cfg.hidden ? '◉' : '○'}
                </button>
                {!isBuiltin && (
                  <button
                    className="psm-icon-btn psm-icon-btn--danger"
                    title="Удалить группу"
                    onClick={() => removePaletteGroup(key)}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="psm-new-group-row">
        <input
          className="psm-inline-input"
          placeholder="Название новой группы..."
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') createGroup(); }}
        />
        <button className="psm-btn psm-btn--ghost" onClick={createGroup}>+ Создать</button>
      </div>
    </div>
  );
}

function BlocksTab({ paletteConfig, lang }) {
  const updatePaletteBlock      = useStore((s) => s.updatePaletteBlock);
  const movePaletteBlockToGroup = useStore((s) => s.movePaletteBlockToGroup);
  const movePaletteBlockInGroup = useStore((s) => s.movePaletteBlockInGroup);
  const allCustomBlocks         = useCustomBlockStore((s) => s.blocks);

  const { groupOrder, groups, blockOrder, blocks: blocksCfg } = paletteConfig;

  const [search,      setSearch]      = useState('');
  const [blockEditing, setBlockEditing] = useState(null);

  const listRef = useRef(null);

  const q = search.trim().toLowerCase();

  const allRows = [];
  for (const gKey of groupOrder) {
    const order = blockOrder[gKey] ?? [];
    for (const type of order) {
      const item = ITEM_MAP[type];
      if (!item) continue;
      const label = lang === 'en' ? (item.label_en || item.label) : item.label;
      const cfg   = blocksCfg[type] ?? {};
      if (q && !(cfg.customLabel ?? label).toLowerCase().includes(q) && !type.includes(q)) continue;
      allRows.push({ type, gKey, label: cfg.customLabel ?? label, rawLabel: label, cfg, icon: item.icon });
    }
  }

  const customRows = allCustomBlocks
    .filter((cb) => !q || cb.name.toLowerCase().includes(q))
    .map((cb) => ({
      type: `__custom__${cb.id}`,
      gKey: 'group.custom',
      label: cb.name,
      cfg: blocksCfg[`__custom__${cb.id}`] ?? {},
      icon: cb.icon,
      isCustom: true,
      cb,
    }));

  const { drag, startDrag, getItemStyle, ghostPortal } = useSortable({
    listRef,
    onReorder: (from, to) => {
      const fromRow = allRows[from];
      const toRow   = allRows[to];
      if (!fromRow || !toRow || fromRow.gKey !== toRow.gKey) return;
      const groupTypes = blockOrder[fromRow.gKey] ?? [];
      const toIndex    = groupTypes.indexOf(toRow.type);
      if (toIndex !== -1) movePaletteBlockInGroup(fromRow.gKey, fromRow.type, toIndex);
    },
  });

  const groupBounds = {};
  allRows.forEach((r, i) => {
    if (!groupBounds[r.gKey]) groupBounds[r.gKey] = { min: i, max: i };
    else groupBounds[r.gKey].max = i;
  });

  const groupSelectOptions = groupOrder.map((k) => ({
    value: k,
    label: groupLabel(k, groups, lang),
  }));

  const renderRow = (row, flatIndex) => {
    const { type, gKey, label, cfg, icon, isCustom } = row;
    const bounds = groupBounds[gKey] ?? { min: 0, max: allRows.length - 1 };

    return (
      <div
        key={type}
        data-si={isCustom ? undefined : flatIndex}
        className={`psm-block-row${cfg.hidden ? ' psm-block-row--hidden' : ''}`}
        style={isCustom ? {} : getItemStyle(flatIndex)}
      >
        {!isCustom ? (
          <span
            className="psm-drag-handle"
            onMouseDown={(e) =>
              startDrag(e, flatIndex, (
                <div className="psm-ghost-block-row">
                  <span className="psm-drag-handle psm-drag-handle--ghost">⠿</span>
                  <span className="psm-block-icon">{icon}</span>
                  <span className="psm-block-name">{label}</span>
                </div>
              ), { groupMin: bounds.min, groupMax: bounds.max })
            }
          >⠿</span>
        ) : (
          <span className="psm-drag-handle psm-drag-handle--disabled" />
        )}

        <span className="psm-block-icon">{cfg.customIcon ?? icon}</span>

        <span className="psm-block-name">
          {label}
          {(cfg.customLabel || cfg.customIcon || cfg.customDesc || cfg.customDefaultData) && (
            <span className="psm-edited-dot" title="Изменено" />
          )}
        </span>

        {!isCustom ? (
          <select
            className="psm-group-select"
            value={gKey}
            onChange={(e) => movePaletteBlockToGroup(type, e.target.value)}
          >
            {groupSelectOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : (
          <span className="psm-group-select psm-group-select--static">Кастомные</span>
        )}

        <div className="psm-row-actions">
          {!isCustom && (
            <button className="psm-icon-btn" title="Редактировать блок"
              onClick={() => setBlockEditing(type)}>✎</button>
          )}
          <button
            className={`psm-icon-btn${cfg.hidden ? ' psm-icon-btn--active' : ''}`}
            title={cfg.hidden ? 'Показать' : 'Скрыть'}
            onClick={() => updatePaletteBlock(type, { hidden: !cfg.hidden })}
          >
            {cfg.hidden ? '◉' : '○'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="psm-tab-body">
      {ghostPortal}
      {blockEditing && (
        <BlockEditor
          type={blockEditing}
          cfg={blocksCfg[blockEditing] ?? {}}
          onSave={(patch) => updatePaletteBlock(blockEditing, patch)}
          onClose={() => setBlockEditing(null)}
        />
      )}

      <input
        className="psm-search"
        placeholder="Поиск блоков..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="psm-blocks-head">
        <span style={{ width: 14, flexShrink: 0 }} />
        <span className="psm-bh-icon" />
        <span className="psm-bh-name">Название</span>
        <span className="psm-bh-group">Группа</span>
        <span className="psm-bh-actions">Действия</span>
      </div>

      <div ref={listRef} className="psm-blocks-list">
        {allRows.map((row, idx) => renderRow(row, idx))}
        {customRows.map((row) => renderRow(row, -1))}

        {allRows.length === 0 && customRows.length === 0 && (
          <div className="psm-empty">Ничего не найдено</div>
        )}
      </div>
    </div>
  );
}

export default function PaletteSettingsModal({ onClose }) {
  const paletteConfig      = useStore((s) => s.paletteConfig);
  const resetPaletteConfig = useStore((s) => s.resetPaletteConfig);
  const lang               = useStore((s) => s.lang);

  const [tab, setTab] = useState('groups');

  const modalRef = useRef(null);
  const [pos, setPos] = useState(null);
  const dragRef = useRef(null);

  const onHeadDown = (e) => {
    if (e.button !== 0 || e.target.closest('.psm-close')) return;
    const rect = modalRef.current.getBoundingClientRect();
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    document.body.style.userSelect = 'none';
    const onMove = (me) => {
      if (!dragRef.current) return;
      const el = modalRef.current;
      const w = el?.offsetWidth ?? 520;
      const h = el?.offsetHeight ?? 480;
      const x = Math.max(0, Math.min(window.innerWidth  - w, me.clientX - dragRef.current.dx));
      const y = Math.max(0, Math.min(window.innerHeight - h, me.clientY - dragRef.current.dy));
      setPos({ x, y });
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleReset = () => {
    if (window.confirm('Сбросить все настройки палитры?')) resetPaletteConfig();
  };

  const modalStyle = pos ? { position: 'fixed', left: pos.x, top: pos.y, margin: 0, transform: 'none' } : undefined;

  return (
    <div className="psm-overlay" onClick={onClose}>
      <div className="psm-modal" ref={modalRef} style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div className="psm-modal-head psm-modal-head--drag" onMouseDown={onHeadDown}>
          <span className="psm-modal-title">НАСТРОЙКИ ПАЛИТРЫ</span>
          <button className="psm-close" onClick={onClose}>×</button>
        </div>

        <div className="psm-tabs">
          <button className={`psm-tab${tab === 'groups' ? ' psm-tab--active' : ''}`}
            onClick={() => setTab('groups')}>Группы</button>
          <button className={`psm-tab${tab === 'blocks' ? ' psm-tab--active' : ''}`}
            onClick={() => setTab('blocks')}>Все блоки</button>
          <div className="psm-tabs-spacer" />
          <button className="psm-tab psm-tab--reset" onClick={handleReset}>Сбросить</button>
        </div>

        {tab === 'groups' && <GroupsTab paletteConfig={paletteConfig} lang={lang} />}
        {tab === 'blocks' && <BlocksTab paletteConfig={paletteConfig} lang={lang} />}
      </div>
    </div>
  );
}
