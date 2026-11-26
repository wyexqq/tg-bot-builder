import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, addEdge, MarkerType } from 'reactflow';
import useCustomBlockStore from '../customBlocks/customBlockStore';
import { PALETTE_GROUPS, PALETTE_ITEMS, BLOCK_DEFS } from '../blockDefinitions';
import {
  loadLayout, saveLayout, movePanel as dockMovePanel,
  setActive as dockSetActive, setCollapsed as dockSetCollapsed,
  setSize as dockSetSize, resetLayout as dockResetLayout,
} from '../dockLayout';

let _snapTimer = null;

const buildInitialPaletteConfig = () => {
  const groupOrder = PALETTE_GROUPS.map((g) => g.key);
  const groups = {};
  const blockOrder = {};
  const blocks = {};

  for (const g of PALETTE_GROUPS) {
    groups[g.key] = { customName: null, hidden: false };
    blockOrder[g.key] = [...g.types];
    for (const type of g.types) {
      blocks[type] = { customLabel: null, hidden: false, customDefaultData: null, group: g.key };
    }
  }

  groups['group.custom'] = { customName: null, hidden: false };
  blockOrder['group.custom'] = [];

  return { groupOrder, groups, blockOrder, blocks };
};

const KNOWN_NODE_TYPES = new Set([...Object.keys(BLOCK_DEFS), 'custom_block', 'group_frame']);

const isUserGroupKey = (k) => k === 'group.custom' || k.startsWith('group.user_');

function mergePaletteConfig(base, saved) {
  const builtin = new Set(base.groupOrder);
  const validGroup = (k) => builtin.has(k) || isUserGroupKey(k);
  const known = new Set(Object.keys(base.blocks));

  const savedOrder = (saved.groupOrder ?? []).filter(validGroup);
  const groupOrder = [...savedOrder, ...base.groupOrder.filter((k) => !savedOrder.includes(k))];

  const placed = new Set();
  const blockOrder = {};
  for (const key of new Set([...groupOrder, 'group.custom'])) {
    const savedTypes = (saved.blockOrder?.[key] ?? []).filter((t) => known.has(t) && !placed.has(t));
    savedTypes.forEach((t) => placed.add(t));
    blockOrder[key] = savedTypes;
  }
  for (const g of PALETTE_GROUPS) {
    for (const t of g.types) {
      if (!placed.has(t)) { blockOrder[g.key].push(t); placed.add(t); }
    }
  }

  const groups = { ...base.groups };
  for (const [k, v] of Object.entries(saved.groups ?? {})) if (validGroup(k)) groups[k] = { ...groups[k], ...v };

  const blocks = { ...base.blocks };
  for (const [t, v] of Object.entries(saved.blocks ?? {})) {
    if (!known.has(t)) continue;
    const group = Object.keys(blockOrder).find((k) => blockOrder[k].includes(t)) ?? base.blocks[t].group;
    blocks[t] = { ...base.blocks[t], ...v, group };
  }
  return { groupOrder, groups, blockOrder, blocks };
}

function computeLayout(nodes, edges) {
  if (!nodes.length) return nodes;

  const W = 290, H = 185, MARGIN = 60;

  const hasIncoming = new Set(edges.map((e) => e.target));
  const roots = nodes.filter((n) => !hasIncoming.has(n.id));
  const startNodes = roots.length ? roots : nodes.slice(0, 1);

  const depth = new Map();
  const queue = startNodes.map((n) => ({ id: n.id, d: 0 }));
  while (queue.length) {
    const { id, d } = queue.shift();
    if (depth.has(id) && depth.get(id) >= d) continue;
    depth.set(id, d);
    edges
      .filter((e) => e.source === id)
      .forEach((e) => queue.push({ id: e.target, d: d + 1 }));
  }
  const maxD = depth.size ? Math.max(...depth.values()) : 0;
  nodes.forEach((n) => { if (!depth.has(n.id)) depth.set(n.id, maxD + 1); });

  const groups = new Map();
  depth.forEach((d, id) => {
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d).push(id);
  });

  const positions = new Map();
  groups.forEach((ids, d) => {
    ids.forEach((id, i) => {
      positions.set(id, { x: MARGIN + i * W, y: MARGIN + d * H });
    });
  });

  return nodes.map((n) => ({ ...n, position: positions.get(n.id) ?? n.position }));
}

let _logSeq = 0;
let _outSeq = 0;

const useStore = create((set, get) => ({
  botToken: '',
  setBotToken: (token) => set({ botToken: token }),

  botInfo: { status: 'idle', username: '' },
  setBotInfo: (info) => set({ botInfo: info }),

  isRunning: false,
  setIsRunning: (running) => set({ isRunning: running }),

  botStatus: 'stopped',
  setBotStatus: (s) => set({ botStatus: s, isRunning: s === 'running' }),

  code: '',
  setCode: (code) => {
    if (get().isUserEditingCode) get()._scheduleSnapshot();
    set({ code });
  },

  isUserEditingCode: false,
  setIsUserEditingCode: (v) => set({ isUserEditingCode: v }),

  syncEnabled: true,
  setSyncEnabled: (v) => set({ syncEnabled: v }),

  codeManuallyEdited: false,
  setCodeManuallyEdited: (v) => set({ codeManuallyEdited: v }),

  termRunning: false,
  setTermRunning: (v) => set({ termRunning: v }),
  consoleClearTick: 0,
  triggerConsoleClear: () => set((s) => ({ consoleClearTick: s.consoleClearTick + 1 })),

  loggingEnabled: false,
  setLoggingEnabled: (v) => set({ loggingEnabled: v }),

  proxyEnabled: false,
  proxyUrl: '',
  setProxyEnabled: (v) => set({ proxyEnabled: v }),
  setProxyUrl: (v) => set({ proxyUrl: v }),

  sqlDialect: 'sqlite',
  setSqlDialect: (v) => set({ sqlDialect: v }),
  dbConfig: { host: 'localhost', port: '', user: '', password: '', database: '' },
  setDbConfig: (patch) => set((s) => ({ dbConfig: { ...s.dbConfig, ...patch } })),

  currentFilePath: null,
  setCurrentFilePath: (p) => set({ currentFilePath: p }),

  hasUnsavedChanges: false,
  setHasUnsavedChanges: (v) => set({ hasUnsavedChanges: v }),

  loadProject: (data) => {
    const rawNodes = data.nodes ?? [];
    const nodesIn  = rawNodes.filter((n) => KNOWN_NODE_TYPES.has(n.type));
    const keptIds  = new Set(nodesIn.map((n) => n.id));
    const edgesIn  = (data.edges ?? []).filter((e) => keptIds.has(e.source) && keptIds.has(e.target));
    const dropped  = rawNodes.length - nodesIn.length;
    if (dropped > 0) {
      setTimeout(() => get().addLog?.(`Пропущено блоков удалённых типов: ${dropped}`, 'warn'), 0);
    }
    set({
      nodes: nodesIn,
      edges: edgesIn,
      code: data.code ?? '',
      botToken: data.botToken ?? '',
      hasUnsavedChanges: false,
      isUserEditingCode: false,
      nodeErrors: {},
      _past: [],
      _future: [],
    });
    if (data.customBlocks || data.customPackages) {
      try {
        useCustomBlockStore.getState().hydrate(data);
      } catch (_) { }
    }
    if (data.paletteConfig) {
      set({ paletteConfig: mergePaletteConfig(buildInitialPaletteConfig(), data.paletteConfig) });
    }
  },

  paletteConfig: buildInitialPaletteConfig(),

  updatePaletteGroup: (key, patch) =>
    set((s) => ({
      paletteConfig: {
        ...s.paletteConfig,
        groups: {
          ...s.paletteConfig.groups,
          [key]: { ...s.paletteConfig.groups[key], ...patch },
        },
      },
    })),

  updatePaletteBlock: (type, patch) =>
    set((s) => ({
      paletteConfig: {
        ...s.paletteConfig,
        blocks: {
          ...s.paletteConfig.blocks,
          [type]: { ...s.paletteConfig.blocks[type], ...patch },
        },
      },
    })),

  reorderPaletteGroups: (fromKey, toKey) =>
    set((s) => {
      const order = [...s.paletteConfig.groupOrder];
      const fi = order.indexOf(fromKey);
      const ti = order.indexOf(toKey);
      if (fi === -1 || ti === -1 || fi === ti) return s;
      [order[fi], order[ti]] = [order[ti], order[fi]];
      return { paletteConfig: { ...s.paletteConfig, groupOrder: order } };
    }),

  movePaletteGroup: (fromKey, toIndex) =>
    set((s) => {
      const order = [...s.paletteConfig.groupOrder];
      const fi = order.indexOf(fromKey);
      if (fi === -1) return s;
      order.splice(fi, 1);
      order.splice(toIndex, 0, fromKey);
      return { paletteConfig: { ...s.paletteConfig, groupOrder: order } };
    }),

  movePaletteBlockInGroup: (groupKey, fromType, toIndex) =>
    set((s) => {
      const order = [...(s.paletteConfig.blockOrder[groupKey] ?? [])];
      const fi = order.indexOf(fromType);
      if (fi === -1) return s;
      order.splice(fi, 1);
      order.splice(toIndex, 0, fromType);
      return {
        paletteConfig: {
          ...s.paletteConfig,
          blockOrder: { ...s.paletteConfig.blockOrder, [groupKey]: order },
        },
      };
    }),

  movePaletteBlockToGroup: (type, toGroupKey) =>
    set((s) => {
      const blocks = { ...s.paletteConfig.blocks };
      const fromGroupKey = blocks[type]?.group;
      if (!fromGroupKey || fromGroupKey === toGroupKey) return s;

      const oldOrder = (s.paletteConfig.blockOrder[fromGroupKey] ?? []).filter((t) => t !== type);
      const newOrder = [...(s.paletteConfig.blockOrder[toGroupKey] ?? []), type];

      blocks[type] = { ...blocks[type], group: toGroupKey };

      return {
        paletteConfig: {
          ...s.paletteConfig,
          blocks,
          blockOrder: {
            ...s.paletteConfig.blockOrder,
            [fromGroupKey]: oldOrder,
            [toGroupKey]: newOrder,
          },
        },
      };
    }),

  addPaletteGroup: (key, name) =>
    set((s) => {
      if (s.paletteConfig.groups[key]) return s;
      return {
        paletteConfig: {
          ...s.paletteConfig,
          groupOrder: [...s.paletteConfig.groupOrder, key],
          groups: { ...s.paletteConfig.groups, [key]: { customName: name, hidden: false } },
          blockOrder: { ...s.paletteConfig.blockOrder, [key]: [] },
        },
      };
    }),

  removePaletteGroup: (key) =>
    set((s) => {
      const builtinKeys = PALETTE_GROUPS.map((g) => g.key);
      if (builtinKeys.includes(key)) return s;

      const displaced = s.paletteConfig.blockOrder[key] ?? [];
      const coreOrder = [...(s.paletteConfig.blockOrder['group.core'] ?? []), ...displaced];
      const updBlocks = { ...s.paletteConfig.blocks };
      displaced.forEach((t) => { if (updBlocks[t]) updBlocks[t] = { ...updBlocks[t], group: 'group.core' }; });

      const newGroups = { ...s.paletteConfig.groups };
      delete newGroups[key];
      const newBlockOrder = { ...s.paletteConfig.blockOrder, 'group.core': coreOrder };
      delete newBlockOrder[key];

      return {
        paletteConfig: {
          ...s.paletteConfig,
          groupOrder: s.paletteConfig.groupOrder.filter((k) => k !== key),
          groups: newGroups,
          blockOrder: newBlockOrder,
          blocks: updBlocks,
        },
      };
    }),

  resetPaletteConfig: () => set({ paletteConfig: buildInitialPaletteConfig() }),

  serialisePaletteConfig: () => {
    const { paletteConfig } = get();
    return JSON.parse(JSON.stringify(paletteConfig));
  },

  isDark: true,
  toggleTheme: () =>
    set((state) => {
      const next = !state.isDark;
      document.documentElement.classList.toggle('dark', next);
      return { isDark: next };
    }),

  lang: 'ru',
  setLang: (lang) => set({ lang }),
  toggleLang: () => set((s) => ({ lang: s.lang === 'ru' ? 'en' : 'ru' })),

  nodeErrors: {},
  setNodeErrors: (errs) => set({ nodeErrors: errs }),
  clearNodeErrors: () => set({ nodeErrors: {} }),

  _past: [],
  _future: [],

  _snapshot: () => {
    const { nodes, edges, code, _past } = get();
    const snap = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      code,
    };
    set({ _past: [..._past.slice(-49), snap], _future: [] });
  },

  _scheduleSnapshot: () => {
    if (_snapTimer) clearTimeout(_snapTimer);
    _snapTimer = setTimeout(() => {
      _snapTimer = null;
      get()._snapshot();
    }, 600);
  },

  undo: () => {
    const { _past, _future, nodes, edges, code } = get();
    if (!_past.length) return;
    const prev = _past[_past.length - 1];
    set({
      _past: _past.slice(0, -1),
      _future: [
        { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)), code },
        ..._future.slice(0, 49),
      ],
      nodes: prev.nodes,
      edges: prev.edges,
      code: prev.code !== undefined ? prev.code : code,
    });
  },

  redo: () => {
    const { _past, _future, nodes, edges, code } = get();
    if (!_future.length) return;
    const next = _future[0];
    set({
      _past: [..._past.slice(-49), { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)), code }],
      _future: _future.slice(1),
      nodes: next.nodes,
      edges: next.edges,
      code: next.code !== undefined ? next.code : code,
    });
  },

  nodes: [],
  edges: [],

  onNodesChange: (changes) =>
    set((state) => {
      const extra = [];
      for (const ch of changes) {
        if (ch.type === 'position' && ch.position) {
          const node = state.nodes.find((n) => n.id === ch.id);
          if (node?.type === 'group_frame') {
            const dx = ch.position.x - node.position.x;
            const dy = ch.position.y - node.position.y;
            if (dx !== 0 || dy !== 0) {
              for (const childId of (node.data._childIds || [])) {
                const child = state.nodes.find((n) => n.id === childId);
                if (child) {
                  extra.push({ type: 'position', id: childId,
                    position: { x: child.position.x + dx, y: child.position.y + dy },
                    dragging: ch.dragging });
                }
              }
            }
          }
        }
      }
      return { nodes: applyNodeChanges([...changes, ...extra], state.nodes) };
    }),

  onEdgesChange: (changes) => {
    const hasRemove = changes.some((c) => c.type === 'remove');
    if (hasRemove) get()._snapshot();
    set((state) => {
      const removedProxyIds = changes
        .filter((c) => c.type === 'remove' && c.id.startsWith('proxy_'))
        .map((c) => c.id.slice('proxy_'.length));

      let nodes = state.nodes;
      if (removedProxyIds.length > 0) {
        const removedSet = new Set(removedProxyIds);
        nodes = nodes.map((n) => {
          if (n.type !== 'group_frame' || !n.data._savedEdges) return n;
          const filtered = n.data._savedEdges.filter((e) => !removedSet.has(e.id));
          if (filtered.length === n.data._savedEdges.length) return n;
          return { ...n, data: { ...n.data, _savedEdges: filtered } };
        });
      }

      return { nodes, edges: applyEdgeChanges(changes, state.edges) };
    });
  },

  onConnect: (connection) => {
    get()._snapshot();
    set((state) => ({
      edges: addEdge(
        {
          ...connection,
          type: 'deletable',
          selected: false,
          style: { strokeWidth: 2, stroke: '#64748b' },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
        },
        state.edges
      ),
    }));
  },

  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  selectionIds: [],
  setSelectionIds: (ids) =>
    set((state) => {
      if (
        state.selectionIds.length === ids.length &&
        ids.every((id, i) => id === state.selectionIds[i])
      ) return {};
      return { selectionIds: ids };
    }),

  hoveredEdgeId: null,
  setHoveredEdgeId: (id) => set({ hoveredEdgeId: id }),

  hoveredNodeId: null,
  neighborNodeIds: [],
  setHoveredNodeId: (id) =>
    set((state) => {
      if (!id) return { hoveredNodeId: null, neighborNodeIds: [] };
      const neighbors = [];
      state.edges.forEach((e) => {
        if (e.source === id) neighbors.push(e.target);
        if (e.target === id) neighbors.push(e.source);
      });
      return { hoveredNodeId: id, neighborNodeIds: neighbors };
    }),

  addNode: (node) => {
    get()._snapshot();
    set((state) => ({ nodes: [...state.nodes, node] }));
  },

  updateNodeData: (nodeId, patch) => {
    get()._scheduleSnapshot();
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n
      ),
    }));
  },

  deleteNodes: (nodeIds) => {
    get()._snapshot();
    set((state) => {
      const del = new Set(nodeIds);
      let nodes = state.nodes;
      let edges = state.edges;
      for (const g of state.nodes) {
        if (!del.has(g.id) || g.type !== 'group_frame' || !g.data?.collapsed) continue;
        const kids  = new Set(g.data._childIds || []);
        const proxy = new Set(g.data._proxyIds || []);
        nodes = nodes.map((n) => (kids.has(n.id) && !del.has(n.id) ? { ...n, hidden: false } : n));
        edges = [...edges.filter((e) => !proxy.has(e.id)), ...(g.data._savedEdges || [])];
      }
      return {
        nodes: nodes.filter((n) => !del.has(n.id)),
        edges: edges.filter((e) => !del.has(e.source) && !del.has(e.target)),
        selectionIds: [],
        selectedNodeId: null,
      };
    });
  },

  duplicateNodes: (nodeIds) => {
    get()._snapshot();
    set((state) => {
      const src = state.nodes.filter((n) => nodeIds.includes(n.id));
      if (!src.length) return {};
      const copies = src.map((n) => ({
        ...n,
        id: `${n.type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        position: { x: n.position.x + 160, y: n.position.y + 40 },
        selected: false,
        data: JSON.parse(JSON.stringify(n.data)),
      }));
      return { nodes: [...state.nodes, ...copies] };
    });
  },

  toggleNodeDisabled: (nodeId) =>
    set((state) => {
      const target = state.nodes.find((n) => n.id === nodeId);
      if (!target) return {};
      const newDisabled = !target.data.disabled;
      const childIds = target.type === 'group_frame'
        ? new Set(target.data._childIds || [])
        : null;
      return {
        nodes: state.nodes.map((n) => {
          if (n.id === nodeId) return { ...n, data: { ...n.data, disabled: newDisabled } };
          if (childIds?.has(n.id)) return { ...n, data: { ...n.data, disabled: newDisabled } };
          return n;
        }),
      };
    }),

  groupNodes: (nodeIds) => {
    get()._snapshot();
    set((state) => {
      const validIds = nodeIds.filter((id) => {
        const n = state.nodes.find((nd) => nd.id === id);
        return n && n.type !== 'group_frame' && !n.hidden;
      });
      if (validIds.length < 2) return {};
      const targets = state.nodes.filter((n) => validIds.includes(n.id));
      const PADDING = 48;
      const minX = Math.min(...targets.map((n) => n.position.x)) - PADDING;
      const minY = Math.min(...targets.map((n) => n.position.y)) - PADDING - 28;
      const maxX = Math.max(...targets.map((n) => n.position.x + (n.width  || 200)));
      const maxY = Math.max(...targets.map((n) => n.position.y + (n.height || 80)));
      const groupNode = {
        id: `group_${Date.now()}`,
        type: 'group_frame',
        position: { x: minX, y: minY },
        zIndex: -1,
        data: {
          label: 'Группа',
          _childIds: validIds,
          _width:  maxX - minX + PADDING,
          _height: maxY - minY + PADDING + 28,
          collapsed: false,
        },
        selectable: true,
        draggable: true,
      };
      return { nodes: [...state.nodes, groupNode], selectionIds: [] };
    });
  },

  removeFromGroup: (groupId, nodeId) =>
    set((state) => {
      const group = state.nodes.find((n) => n.id === groupId);
      if (!group) return {};
      const newChildIds = (group.data._childIds || []).filter((id) => id !== nodeId);
      return {
        nodes: state.nodes.map((n) =>
          n.id === groupId ? { ...n, data: { ...n.data, _childIds: newChildIds } } : n
        ),
      };
    }),

  addToGroup: (groupId, nodeIds) => {
    get()._scheduleSnapshot();
    set((state) => {
      const group = state.nodes.find((n) => n.id === groupId);
      if (!group) return {};
      const currentChildIds = group.data._childIds || [];
      const newIds = nodeIds.filter(
        (id) => id !== groupId && !currentChildIds.includes(id) &&
        state.nodes.find((n) => n.id === id && n.type !== 'group_frame')
      );
      if (!newIds.length) return {};
      const allChildIds = [...currentChildIds, ...newIds];
      const allChildren = state.nodes.filter((n) => allChildIds.includes(n.id));
      const PADDING = 48;
      const minX = Math.min(...allChildren.map((n) => n.position.x)) - PADDING;
      const minY = Math.min(...allChildren.map((n) => n.position.y)) - PADDING - 28;
      const maxX = Math.max(...allChildren.map((n) => n.position.x + (n.width || 200)));
      const maxY = Math.max(...allChildren.map((n) => n.position.y + (n.height || 80)));
      const newWidth  = maxX - minX + PADDING;
      const newHeight = maxY - minY + PADDING + 28;
      return {
        nodes: state.nodes.map((n) => {
          if (n.id !== groupId) return n;
          return {
            ...n,
            position: { x: minX, y: minY },
            data: {
              ...n.data,
              _childIds: allChildIds,
              _width:  Math.max(n.data._width  || 320, newWidth),
              _height: Math.max(n.data._height || 220, newHeight),
            },
          };
        }),
      };
    });
  },

  toggleGroupCollapsed: (groupId) => {
    set((state) => {
      const group = state.nodes.find((n) => n.id === groupId);
      if (!group) return {};
      const newCollapsed = !group.data.collapsed;
      const childSet = new Set(group.data._childIds || []);

      if (newCollapsed) {
        const externalEdges = state.edges.filter((e) => {
          const srcIn = childSet.has(e.source);
          const dstIn = childSet.has(e.target);
          return srcIn !== dstIn;
        });
        const proxyEdges = externalEdges.map((e) => ({
          ...e,
          id: `proxy_${e.id}`,
          source:       childSet.has(e.source) ? groupId : e.source,
          target:       childSet.has(e.target) ? groupId : e.target,
          sourceHandle: childSet.has(e.source) ? 'out'   : e.sourceHandle,
          targetHandle: childSet.has(e.target) ? 'in'    : e.targetHandle,
        }));
        const externalIds = new Set(externalEdges.map((e) => e.id));
        return {
          nodes: state.nodes.map((n) => {
            if (n.id === groupId) return { ...n, data: { ...n.data, collapsed: true, _savedEdges: externalEdges, _proxyIds: proxyEdges.map((e) => e.id) } };
            if (childSet.has(n.id)) return { ...n, hidden: true };
            return n;
          }),
          edges: [...state.edges.filter((e) => !externalIds.has(e.id)), ...proxyEdges],
        };
      } else {
        const proxyIds = new Set(group.data._proxyIds || []);
        const savedEdges = group.data._savedEdges || [];
        return {
          nodes: state.nodes.map((n) => {
            if (n.id === groupId) return { ...n, data: { ...n.data, collapsed: false, _savedEdges: undefined, _proxyIds: undefined } };
            if (childSet.has(n.id)) return { ...n, hidden: false };
            return n;
          }),
          edges: [...state.edges.filter((e) => !proxyIds.has(e.id)), ...savedEdges],
        };
      }
    });
  },

  autoLayout: () => {
    get()._snapshot();
    set((state) => ({
      nodes: computeLayout(state.nodes, state.edges),
    }));
  },

  panelConfig: {
    code:    { visible: true,  fullscreen: false, floating: false, floatX: 60,  floatY: 80,  floatW: 620, floatH: 500 },
    canvas:  { visible: true,  fullscreen: false, floating: false, floatX: 220, floatY: 80,  floatW: 800, floatH: 580 },
    console: { visible: true,  fullscreen: false, floating: false, floatX: 80,  floatY: 420, floatW: 720, floatH: 240 },
    chat:      { visible: false, fullscreen: false, floating: false, floatX: 100, floatY: 100, floatW: 360, floatH: 520 },
    simulator: { visible: false, fullscreen: false, floating: false, floatX: 140, floatY: 100, floatW: 360, floatH: 520 },
    terminal:  { visible: false },
    variables: { visible: false },
    analytics: { visible: false },
  },
  setPanelProp: (panel, key, value) =>
    set((s) => ({
      panelConfig: {
        ...s.panelConfig,
        [panel]: { ...s.panelConfig[panel], [key]: value },
      },
    })),

  _floatDrag: null,
  startFloatDrag: (panel, mx, my) => {
    const c = get().panelConfig[panel];
    set({ _floatDrag: { panel, startMX: mx, startMY: my, startFX: c.floatX, startFY: c.floatY } });
  },
  moveFloatDrag: (mx, my) => {
    const { _floatDrag, panelConfig } = get();
    if (!_floatDrag) return;
    const { panel, startMX, startMY, startFX, startFY } = _floatDrag;
    set({
      panelConfig: {
        ...panelConfig,
        [panel]: {
          ...panelConfig[panel],
          floatX: startFX + (mx - startMX),
          floatY: startFY + (my - startMY),
        },
      },
    });
  },
  endFloatDrag: () => set({ _floatDrag: null }),

  editorCursor: { line: 1, column: 1, filePath: null, language: 'python' },
  setEditorCursor: (cursor) => set({ editorCursor: cursor }),

  dockLayout: loadLayout(),

  dockMovePanel: (panelId, targetSlot, targetIndex = -1) => set((s) => {
    const next = dockMovePanel(s.dockLayout, panelId, targetSlot, targetIndex);
    saveLayout(next);
    return { dockLayout: next };
  }),

  dockSetActive: (slot, panelId) => set((s) => {
    const next = dockSetActive(s.dockLayout, slot, panelId);
    saveLayout(next);
    return { dockLayout: next };
  }),

  dockToggleCollapsed: (slot) => set((s) => {
    const next = dockSetCollapsed(s.dockLayout, slot, !s.dockLayout.collapsed[slot]);
    saveLayout(next);
    return { dockLayout: next };
  }),

  dockSetSize: (slot, value) => set((s) => {
    const next = dockSetSize(s.dockLayout, slot, value);
    saveLayout(next);
    return { dockLayout: next };
  }),

  dockHidePanel: (panelId) => set((s) => {
    const next = dockMovePanel(s.dockLayout, panelId, 'hidden', -1);
    saveLayout(next);
    return { dockLayout: next };
  }),

  dockShowPanel: (panelId, preferredSlot = 'left') => set((s) => {
    const inSlot = ['left', 'right', 'bottom'].find((sl) =>
      s.dockLayout.slots[sl].includes(panelId));
    if (inSlot) {
      let next = dockSetActive(s.dockLayout, inSlot, panelId);
      if (next.collapsed?.[inSlot]) next = dockSetCollapsed(next, inSlot, false);
      saveLayout(next);
      return { dockLayout: next };
    }
    const next = dockMovePanel(s.dockLayout, panelId, preferredSlot, -1);
    saveLayout(next);
    return { dockLayout: next };
  }),

  dockReset: () => set({ dockLayout: dockResetLayout() }),

  simMessages:   [],
  simWaitNodeId: null,
  simReplyKbd:   null,
  setSimState: (patch) => set((s) => ({
    simMessages:   patch.messages   !== undefined ? patch.messages   : s.simMessages,
    simWaitNodeId: patch.waitNodeId !== undefined ? patch.waitNodeId : s.simWaitNodeId,
    simReplyKbd:   patch.replyKbd   !== undefined ? patch.replyKbd   : s.simReplyKbd,
  })),
  clearSim: () => set({ simMessages: [], simWaitNodeId: null, simReplyKbd: null }),

  simProfile: { vars: {} },
  updateSimVar: (name, value) => set((s) => ({
    simProfile: { vars: { ...s.simProfile.vars, [name]: value } },
  })),
  removeSimVar: (name) => set((s) => {
    const vars = { ...s.simProfile.vars };
    delete vars[name];
    return { simProfile: { vars } };
  }),
  resetSimProfile: () => set({ simProfile: { vars: {} } }),

  simStats: { commandsUsed: {}, messagesSent: 0, conditionResults: { true: 0, false: 0 } },
  trackSimCommand: (cmd) => set((s) => ({
    simStats: {
      ...s.simStats,
      commandsUsed: { ...s.simStats.commandsUsed, [cmd]: (s.simStats.commandsUsed[cmd] || 0) + 1 },
    },
  })),
  trackSimMessage: () => set((s) => ({
    simStats: { ...s.simStats, messagesSent: s.simStats.messagesSent + 1 },
  })),
  trackSimCondition: (result) => set((s) => {
    const key = result ? 'true' : 'false';
    return {
      simStats: {
        ...s.simStats,
        conditionResults: { ...s.simStats.conditionResults, [key]: (s.simStats.conditionResults[key] || 0) + 1 },
      },
    };
  }),
  resetSimStats: () => set({ simStats: { commandsUsed: {}, messagesSent: 0, conditionResults: { true: 0, false: 0 } } }),

  leftView: 'palette',
  setLeftView: (v) => set({ leftView: v }),

  rightView: 'properties',
  setRightView: (v) => set({ rightView: v }),

  recentProjects: (() => {
    try { return JSON.parse(localStorage.getItem('recentProjects') || '[]'); }
    catch { return []; }
  })(),
  projectModalOpen: false,
  setProjectModalOpen: (v) => set({ projectModalOpen: v }),

  openProjectFolder: (folderPath) => {
    if (!folderPath) return;
    set((s) => {
      const recent = [folderPath, ...s.recentProjects.filter((p) => p !== folderPath)].slice(0, 12);
      try {
        localStorage.setItem('recentProjects', JSON.stringify(recent));
        localStorage.setItem('lastProject', folderPath);
      } catch { }
      return { recentProjects: recent, explorerFolder: folderPath, projectModalOpen: false };
    });
  },

  removeRecentProject: (folderPath) =>
    set((s) => {
      const recent = s.recentProjects.filter((p) => p !== folderPath);
      try { localStorage.setItem('recentProjects', JSON.stringify(recent)); } catch { }
      return { recentProjects: recent };
    }),

  explorerFolder: null,
  setExplorerFolder: (p) => set({ explorerFolder: p }),

  explorerOpenFiles: [],
  explorerActiveFile: null,

  setExplorerActiveFile: (filePath) => set({ explorerActiveFile: filePath }),

  openExplorerFile: (file) =>
    set((s) => {
      if (s.explorerOpenFiles.find((f) => f.path === file.path)) {
        return { explorerActiveFile: file.path };
      }
      return {
        explorerOpenFiles: [...s.explorerOpenFiles, file],
        explorerActiveFile: file.path,
      };
    }),

  closeExplorerFile: (filePath) =>
    set((s) => {
      const files = s.explorerOpenFiles.filter((f) => f.path !== filePath);
      let active = s.explorerActiveFile;
      if (active === filePath) {
        const idx = s.explorerOpenFiles.findIndex((f) => f.path === filePath);
        active = files.length > 0 ? files[Math.max(0, idx - 1)].path : null;
      }
      return { explorerOpenFiles: files, explorerActiveFile: active };
    }),

  updateExplorerFileContent: (filePath, content) =>
    set((s) => ({
      explorerOpenFiles: s.explorerOpenFiles.map((f) =>
        f.path === filePath ? { ...f, content, modified: true } : f
      ),
    })),

  markExplorerFileSaved: (filePath) =>
    set((s) => ({
      explorerOpenFiles: s.explorerOpenFiles.map((f) =>
        f.path === filePath ? { ...f, modified: false } : f
      ),
    })),

  renameExplorerFile: (oldPath, newPath, newName) =>
    set((s) => ({
      explorerOpenFiles: s.explorerOpenFiles.map((f) =>
        f.path === oldPath ? { ...f, path: newPath, name: newName } : f
      ),
      explorerActiveFile: s.explorerActiveFile === oldPath ? newPath : s.explorerActiveFile,
    })),

  closeExplorerFilesUnder: (prefix) =>
    set((s) => {
      const files = s.explorerOpenFiles.filter((f) => !f.path.startsWith(prefix));
      const active = files.find((f) => f.path === s.explorerActiveFile)
        ? s.explorerActiveFile
        : (files[0]?.path ?? null);
      return { explorerOpenFiles: files, explorerActiveFile: active };
    }),

  reorderExplorerFiles: (fromIndex, toIndex) =>
    set((s) => {
      if (fromIndex === toIndex) return {};
      const files = [...s.explorerOpenFiles];
      const [moved] = files.splice(fromIndex, 1);
      files.splice(toIndex, 0, moved);
      return { explorerOpenFiles: files };
    }),

  explorerCreateTrigger: null,
  triggerExplorerCreate: (type) => set({ explorerCreateTrigger: { type, ts: Date.now() } }),

  nodeLineMap: {},
  setNodeLineMap: (map) => set({ nodeLineMap: map }),

  consoleLogs: [],
  addLog: (text, type = 'info') =>
    set((state) => {
      const entry = {
        id: `l${++_logSeq}`,
        ts: Date.now(),
        text: String(text ?? ''),
        type,
        time: new Date().toLocaleTimeString('ru-RU'),
      };
      const logs = [...state.consoleLogs, entry];
      return { consoleLogs: logs.length > 1000 ? logs.slice(logs.length - 1000) : logs };
    }),
  clearLogs: () => set({ consoleLogs: [] }),

  generated: { code: '', nodeLines: null },
  setGenerated: (code, nodeLines) => set({ generated: { code, nodeLines: nodeLines || null } }),

  runInfo: null,
  requests: [],
  selectedRequestId: null,
  followLive: true,
  traceSteps: {},
  tracePath: [],

  startRun: (code) => set((s) => {
    const g = s.generated;
    let lineToNode = null;
    if (g?.nodeLines && g.code === code) {
      lineToNode = {};
      const size = {};
      for (const [nodeId, lines] of Object.entries(g.nodeLines)) {
        for (const ln of lines || []) {
          if (!(ln in lineToNode) || (lines.length < size[ln])) {
            lineToNode[ln] = nodeId;
            size[ln] = lines.length;
          }
        }
      }
    }
    const codeLines = lineToNode ? code.split('\n') : null;
    return { runInfo: { id: Date.now(), startedAt: Date.now(), lineToNode, codeLines, bot: null } };
  }),

  botEvent: (ev) => set((s) => reduceBotEvent(s, ev)),

  selectRequest: (id) => set((s) => {
    const last = [...s.requests].reverse().find((r) => r.kind !== 'outgoing' && r.status !== 'pending');
    return {
      selectedRequestId: id,
      followLive: !id || id === last?.id,
      ...traceFor(s.requests.find((r) => r.id === id)),
    };
  }),
  setFollowLive: (v) => set((s) => {
    if (!v) return { followLive: false };
    const last = [...s.requests].reverse().find((r) => r.kind !== 'outgoing' && r.status !== 'pending');
    return { followLive: true, selectedRequestId: last?.id ?? null, ...traceFor(last) };
  }),
  clearRequests: () => set({
    requests: [], selectedRequestId: null, followLive: true, traceSteps: {}, tracePath: [], consoleLogs: [],
  }),
}));

const MAX_REQUESTS = 400;

function traceFor(req) {
  const path = req?.path || [];
  const steps = {};
  path.forEach((id, i) => { if (!(id in steps)) steps[id] = i + 1; });
  return { traceSteps: steps, tracePath: path };
}

function pathFromLines(lines, lineToNode, codeLines) {
  if (!lineToNode || !lines?.length) return [];
  const seen = new Set();
  const path = [];
  if (codeLines) {
    for (let i = lines[0] - 2; i >= 0; i--) {
      const t = (codeLines[i] || '').trim();
      if (!t.startsWith('@') && !/^(async\s+)?def\s/.test(t)) break;
      const id = lineToNode[i + 1];
      if (id && !seen.has(id)) { seen.add(id); path.unshift(id); }
    }
  }
  for (const ln of lines) {
    const id = lineToNode[ln];
    if (id && !seen.has(id)) { seen.add(id); path.push(id); }
  }
  return path;
}

function reduceBotEvent(s, ev) {
  if (!ev || typeof ev !== 'object') return {};
  const run = s.runInfo;
  const runId = run?.id ?? 0;
  const findIdx = (uid) => {
    for (let i = s.requests.length - 1; i >= 0; i--) {
      const r = s.requests[i];
      if (r.runId === runId && r.uid === uid && r.kind !== 'outgoing') return i;
    }
    return -1;
  };
  const replaceAt = (i, patch) => {
    const next = s.requests.slice();
    next[i] = { ...next[i], ...patch };
    return next;
  };
  const cap = (arr) => (arr.length > MAX_REQUESTS ? arr.slice(arr.length - MAX_REQUESTS) : arr);

  switch (ev.t) {
    case 'ready': {
      const name = ev.bot?.username ? `@${ev.bot.username}` : ev.bot?.name || 'бот';
      const entry = { id: `l${++_logSeq}`, ts: Date.now(), text: `Бот ${name} запущен и ждёт сообщений`, type: 'success', time: new Date().toLocaleTimeString('ru-RU') };
      return { runInfo: run ? { ...run, bot: ev.bot } : run, consoleLogs: [...s.consoleLogs, entry] };
    }
    case 'update': {
      const req = {
        id: `${runId}:${ev.uid}`, runId, uid: ev.uid, ts: ev.ts || Date.now(), kind: ev.kind || 'unknown',
        user: ev.user || null, chat: ev.chat || null, text: ev.text ?? null, data: ev.data ?? null,
        button: ev.button ?? null, contentType: ev.content_type || null, raw: ev.raw || null,
        calls: [], prints: [], lines: [], path: [], ms: null, handled: null, error: null, fsm: null,
        status: 'pending',
      };
      return { requests: cap([...s.requests, req]) };
    }
    case 'call': {
      const call = { method: ev.method, params: ev.params, result: ev.result, ms: ev.ms, ok: ev.ok !== false, error: ev.error || null, ts: Date.now() };
      if (ev.uid != null) {
        const i = findIdx(ev.uid);
        if (i >= 0) return { requests: replaceAt(i, { calls: [...s.requests[i].calls, call] }) };
      }
      const last = s.requests[s.requests.length - 1];
      if (last?.kind === 'outgoing' && last.runId === runId && Date.now() - last.lastTs < 2000) {
        return { requests: replaceAt(s.requests.length - 1, {
          calls: [...last.calls, call], lastTs: Date.now(),
          status: last.status === 'error' || !call.ok ? 'error' : 'ok',
        }) };
      }
      const req = {
        id: `o${++_outSeq}`, runId, uid: null, ts: Date.now(), lastTs: Date.now(), kind: 'outgoing',
        user: null, chat: null, calls: [call], prints: [], lines: [], path: [], ms: ev.ms, status: call.ok ? 'ok' : 'error',
      };
      return { requests: cap([...s.requests, req]) };
    }
    case 'print': {
      const i = findIdx(ev.uid);
      if (i < 0) return {};
      return { requests: replaceAt(i, { prints: [...s.requests[i].prints, { stream: ev.stream, text: ev.text }] }) };
    }
    case 'done': {
      const i = findIdx(ev.uid);
      if (i < 0) return {};
      const path = pathFromLines(ev.lines, run?.lineToNode, run?.codeLines);
      const status = ev.error ? 'error' : ev.handled ? 'ok' : 'unhandled';
      const requests = replaceAt(i, { ms: ev.ms, handled: ev.handled, error: ev.error || null, lines: ev.lines || [], path, fsm: ev.fsm || null, status });
      const out = { requests };
      if (s.followLive) {
        out.selectedRequestId = requests[i].id;
        Object.assign(out, traceFor(requests[i]));
      } else if (s.selectedRequestId === requests[i].id) {
        Object.assign(out, traceFor(requests[i]));
      }
      return out;
    }
    default:
      return {};
  }
}

export default useStore;
