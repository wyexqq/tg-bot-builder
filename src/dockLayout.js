const STORAGE_KEY = 'dockLayout_v4';

export const DEFAULT_LAYOUT = {
  slots: {
    left:   [],
    right:  ['properties', 'simulator', 'variables', 'analytics'],
    bottom: ['requests', 'terminal'],
    hidden: [],
  },
  activeTab: {
    right:  'properties',
    bottom: 'requests',
  },
  collapsed: {
    left:   false,
    right:  false,
    bottom: false,
  },
  sizes: {
    left:   248,
    right:  312,
    bottom: 250,
  },
};

export const PANEL_META = {
  palette:    { title: 'Блоки',        titleEn: 'Blocks',     allowedSlots: ['left'] },
  explorer:   { title: 'Проводник',    titleEn: 'Files',      allowedSlots: ['left'] },
  search:     { title: 'Поиск',        titleEn: 'Search',     allowedSlots: ['left'] },
  git:        { title: 'Git',          titleEn: 'Git',        allowedSlots: ['left'] },
  workspace:  { title: 'Воркспейс',    titleEn: 'Workspace',  allowedSlots: ['left'] },
  properties: { title: 'Свойства',     titleEn: 'Properties', allowedSlots: ['right'] },
  simulator:  { title: 'Симулятор',    titleEn: 'Simulator',  allowedSlots: ['right'] },
  variables:  { title: 'Переменные',   titleEn: 'Variables',  allowedSlots: ['right', 'bottom'] },
  analytics:  { title: 'Аналитика',    titleEn: 'Analytics',  allowedSlots: ['right', 'bottom'] },
  requests:   { title: 'Запросы',      titleEn: 'Requests',   allowedSlots: ['bottom'] },
  terminal:   { title: 'Терминал',     titleEn: 'Terminal',   allowedSlots: ['bottom', 'right'] },
};

export function loadLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
    const stored = JSON.parse(raw);
    const merged = JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
    if (stored.slots) {
      const knownIds = new Set();
      for (const slot of ['left', 'right', 'bottom', 'hidden']) {
        if (Array.isArray(stored.slots[slot])) {
          merged.slots[slot] = stored.slots[slot].filter((id) => PANEL_META[id]);
          merged.slots[slot].forEach((id) => knownIds.add(id));
        }
      }
      for (const [id, _] of Object.entries(PANEL_META)) {
        if (!knownIds.has(id)) {
          for (const slot of ['left', 'right', 'bottom', 'hidden']) {
            if (DEFAULT_LAYOUT.slots[slot].includes(id)) {
              merged.slots[slot].push(id);
              break;
            }
          }
        }
      }
    }
    if (stored.activeTab) Object.assign(merged.activeTab, stored.activeTab);
    if (stored.collapsed) Object.assign(merged.collapsed, stored.collapsed);
    if (stored.sizes)     Object.assign(merged.sizes,     stored.sizes);
    return merged;
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
  }
}

export function saveLayout(layout) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); }
  catch { }
}

export function findSlot(layout, panelId) {
  for (const slot of ['left', 'right', 'bottom', 'hidden']) {
    if (layout.slots[slot]?.includes(panelId)) return slot;
  }
  return null;
}

export function movePanel(layout, panelId, targetSlot, targetIndex = -1) {
  const next = JSON.parse(JSON.stringify(layout));
  for (const slot of ['left', 'right', 'bottom', 'hidden']) {
    next.slots[slot] = next.slots[slot].filter((id) => id !== panelId);
  }
  const arr = next.slots[targetSlot] || [];
  if (targetIndex < 0 || targetIndex > arr.length) arr.push(panelId);
  else arr.splice(targetIndex, 0, panelId);
  next.slots[targetSlot] = arr;
  if (targetSlot !== 'hidden') next.activeTab[targetSlot] = panelId;
  return next;
}

export function setActive(layout, slot, panelId) {
  if (!layout.slots[slot]?.includes(panelId)) return layout;
  return { ...layout, activeTab: { ...layout.activeTab, [slot]: panelId } };
}

export function setCollapsed(layout, slot, value) {
  return { ...layout, collapsed: { ...layout.collapsed, [slot]: value } };
}

export function setSize(layout, slot, value) {
  return { ...layout, sizes: { ...layout.sizes, [slot]: value } };
}

export function resetLayout() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { }
  return JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
}
