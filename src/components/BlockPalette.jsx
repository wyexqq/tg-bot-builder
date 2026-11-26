import { useEffect, useRef, useState } from 'react';
import { PALETTE_ITEMS, PALETTE_GROUPS, BLOCK_DEFS } from '../blockDefinitions';
import { getFlowInstance } from '../flowInstance';
import useStore from '../store/useStore';
import useCustomBlockStore from '../customBlocks/customBlockStore';
import { useT } from '../i18n';
import PaletteSettingsModal from './PaletteSettingsModal';
import { BlockIcon, Icon } from './Icons';
import { blockColor } from '../blockDefinitions';
import './BlockPalette.css';

const ITEM_MAP = Object.fromEntries(PALETTE_ITEMS.map((b) => [b.type, b]));

function resolveLabel(type, blocksCfg, lang) {
  const custom = blocksCfg[type]?.customLabel;
  if (custom) return custom;
  const item = ITEM_MAP[type];
  if (!item) return type;
  return lang === 'en' ? (item.label_en || item.label) : item.label;
}

const GROUP_NAMES = {
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

function resolveGroupName(key, groupsCfg, lang) {
  const custom = groupsCfg[key]?.customName;
  if (custom) return custom;
  return GROUP_NAMES[key]?.[lang] ?? key;
}

function PaletteItem({ type, label, desc, customIcon, onDragStart, onClick }) {
  return (
    <div
      className="palette-item"
      draggable
      onClick={() => onClick(type)}
      onDragStart={(e) => onDragStart(e, type)}
      title={desc ? `${label} — ${desc}` : label}
    >
      {customIcon
        ? <span className="blk-ic palette-emoji" style={{ '--g': blockColor(type) }}>{customIcon}</span>
        : <BlockIcon type={type} size={24} />}
      <span className="palette-label">{label}</span>
    </div>
  );
}

function PaletteGroup({ name, children }) {
  const [open, setOpen] = useState(true);
  if (!children?.length) return null;
  return (
    <div className={`palette-group${open ? '' : ' closed'}`}>
      <button className="palette-group__head" onClick={() => setOpen((o) => !o)}>
        <Icon name="chev" size={13} stroke={2} className="palette-group__arrow" />
        <span className="palette-group__name">{name}</span>
        <span className="palette-group__count">{children.length}</span>
      </button>
      {open && (
        <div className="palette-group__body">
          {children}
        </div>
      )}
    </div>
  );
}

function BlockPalette() {
  const addNode         = useStore((s) => s.addNode);
  const nodes           = useStore((s) => s.nodes);
  const lang            = useStore((s) => s.lang);
  const paletteConfig   = useStore((s) => s.paletteConfig);
  const allCustomBlocks = useCustomBlockStore((s) => s.blocks);
  const allPackages     = useCustomBlockStore((s) => s.packages);

  const customBlocks = allCustomBlocks.filter((b) => {
    if (b.codeMode && !b.valid) return false;
    if (b.paletteHidden) return false;
    if (b.package_id) {
      const pkg = allPackages.find((p) => p.id === b.package_id);
      if (pkg?.paletteHidden) return false;
    }
    return true;
  });

  const [query,       setQuery]       = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const searchRef = useRef(null);
  const T = useT();

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.code === 'KeyK') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const { groupOrder, groups, blockOrder, blocks: blocksCfg } = paletteConfig;

  const calcPosition = () => {
    const inst = getFlowInstance();
    if (inst) {
      const wrapEl = document.querySelector('.flow-wrap');
      if (wrapEl) {
        const { width, height } = wrapEl.getBoundingClientRect();
        const n = nodes.length;
        const offsetX = (n % 3) * 30 - 30;
        const offsetY = Math.floor(n / 3) * 30 - 30;
        const wrapRect = wrapEl.getBoundingClientRect();
        return inst.screenToFlowPosition({
          x: wrapRect.left + width  / 2 + offsetX,
          y: wrapRect.top  + height / 2 + offsetY,
        });
      }
    }
    const n = nodes.length;
    return { x: 60 + (n % 4) * 270, y: 60 + Math.floor(n / 4) * 220 };
  };

  const handleClick = (type) => {
    const def = BLOCK_DEFS[type];
    if (!def) return;
    const customDefaultData = blocksCfg[type]?.customDefaultData;
    const data = customDefaultData
      ? JSON.parse(JSON.stringify(customDefaultData))
      : JSON.parse(JSON.stringify(def.defaultData));
    addNode({ id: `${type}_${Date.now()}`, type, position: calcPosition(), data });
  };

  const handleCustomClick = (blockDef) => {
    const position = calcPosition();
    if (blockDef.codeMode) {
      addNode({
        id: `codeblock_${blockDef.id}_${Date.now()}`,
        type: `codeblock_${blockDef.id}`,
        position,
        data: { _codeBlockId: blockDef.id, label: blockDef.name, icon: blockDef.icon, color: blockDef.color },
      });
    } else {
      const defaultData = { _customBlockId: blockDef.id };
      for (const prop of blockDef.properties) {
        defaultData[prop.key] = prop.default ?? '';
      }
      addNode({ id: `custom_block_${Date.now()}`, type: 'custom_block', position, data: defaultData });
    }
  };

  const onDragStart = (e, type) => {
    e.dataTransfer.setData('application/reactflow', type);
    e.dataTransfer.setData('application/nodeoffset', JSON.stringify({ x: 125, y: 17 }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const q = query.trim().toLowerCase();
  const isSearching = q.length > 0;

  const filteredFlat = isSearching
    ? PALETTE_ITEMS.filter((b) => {
        if (blocksCfg[b.type]?.hidden) return false;
        const label = resolveLabel(b.type, blocksCfg, lang);
        const desc  = lang === 'en' ? (b.desc_en || b.desc) : b.desc;
        return label.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
      })
    : [];

  const renderGroups = () =>
    groupOrder
      .filter((key) => !groups[key]?.hidden)
      .map((key) => {
        const types = blockOrder[key] ?? [];
        const visibleTypes = types.filter((t) => !blocksCfg[t]?.hidden && ITEM_MAP[t]);
        if (!visibleTypes.length) return null;

        return (
          <PaletteGroup key={key} name={resolveGroupName(key, groups, lang)}>
            {visibleTypes.map((type) => {
              const item  = ITEM_MAP[type];
              const cfg   = blocksCfg[type] ?? {};
              const label = resolveLabel(type, blocksCfg, lang);
              const desc  = cfg.customDesc ?? (lang === 'en' ? (item.desc_en || item.desc) : item.desc);
              return (
                <PaletteItem
                  key={type}
                  type={type}
                  label={label}
                  desc={desc}
                  customIcon={cfg.customIcon}
                  onDragStart={onDragStart}
                  onClick={handleClick}
                />
              );
            })}
          </PaletteGroup>
        );
      });

  const renderCustomBlocks = () => {
    if (!customBlocks.length) return null;
    const visibleCustom = customBlocks.filter((cb) => {
      const cfgKey = `__custom__${cb.id}`;
      return !blocksCfg[cfgKey]?.hidden;
    });
    if (!visibleCustom.length) return null;

    const groupCfg = groups['group.custom'] ?? {};
    if (groupCfg.hidden) return null;

    return (
      <div className="palette-group">
        <div className="palette-group__head" style={{ cursor: 'default' }}>
          <Icon name="puzzle" size={13} stroke={2} className="palette-group__arrow" />
          <span className="palette-group__name">
            {resolveGroupName('group.custom', groups, lang)}
          </span>
          <span className="palette-group__count">{visibleCustom.length}</span>
        </div>
        <div className="palette-group__body">
          {visibleCustom.map((cb) => (
            <div
              key={cb.id}
              className="palette-item"
              onClick={() => handleCustomClick(cb)}
              draggable
              onDragStart={(e) => {
                const dragType = cb.codeMode ? 'code_block' : 'custom_block';
                e.dataTransfer.setData('application/reactflow', dragType);
                e.dataTransfer.setData('application/customblockid', cb.id);
                e.dataTransfer.setData('application/nodeoffset', JSON.stringify({ x: 125, y: 17 }));
                e.dataTransfer.effectAllowed = 'move';
              }}
              title={lang === 'en' ? (cb.description_en || cb.description) : cb.description}
            >
              <span className="blk-ic palette-emoji" style={{ '--g': cb.color || blockColor('custom_block') }}>{cb.icon || '🧩'}</span>
              <span className="palette-label">{lang === 'en' ? (cb.label_en || cb.name) : cb.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      {settingsOpen && (
        <PaletteSettingsModal onClose={() => setSettingsOpen(false)} />
      )}

      <div className="block-palette">
        <div className="island-head">
          <span className="island-title">{T('palette.header')}</span>
          <span className="island-grow" />
          <button className="ib2" title="Настроить палитру" onClick={() => setSettingsOpen(true)}>
            <Icon name="sliders" size={15} />
          </button>
        </div>

        <label className="palette-search-wrap">
          <Icon name="search" size={13} stroke={2} />
          <input
            ref={searchRef}
            className="palette-search"
            placeholder={T('palette.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setQuery(''); e.currentTarget.blur(); } }}
            spellCheck={false}
          />
          {query
            ? <button className="palette-search-clear" onClick={() => setQuery('')}><Icon name="x" size={12} stroke={2} /></button>
            : <kbd>Ctrl K</kbd>}
        </label>

        <div className="palette-list">
          {isSearching ? (
            filteredFlat.length === 0
              ? <div className="palette-empty">{T('palette.empty')}</div>
              : filteredFlat.map((block) => {
                  const cfg   = blocksCfg[block.type] ?? {};
                  const label = resolveLabel(block.type, blocksCfg, lang);
                  const desc  = cfg.customDesc ?? (lang === 'en' ? (block.desc_en || block.desc) : block.desc);
                  return (
                    <PaletteItem
                      key={block.type}
                      type={block.type}
                      label={label}
                      desc={desc}
                      customIcon={cfg.customIcon}
                      onDragStart={onDragStart}
                      onClick={handleClick}
                    />
                  );
                })
          ) : (
            <>
              {renderGroups()}
              {renderCustomBlocks()}
            </>
          )}

          <button className="palette-ide-link" onClick={() => window.__setAppPage?.('ide')}>
            <Icon name="plus" size={14} stroke={2} />
            {lang === 'en' ? 'Create your own block' : 'Создать свой блок'}
            <span>Block IDE</span>
          </button>
        </div>
      </div>
    </>
  );
}

export default BlockPalette;
