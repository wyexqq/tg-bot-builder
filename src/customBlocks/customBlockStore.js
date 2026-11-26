import { create } from 'zustand';
import { createDefaultFiles } from './codeBlockTemplates';

let _counter = Date.now();
const uid = () => `cb_${(++_counter).toString(36)}`;

const clone = (o) => JSON.parse(JSON.stringify(o));

const BLANK_BLOCK = () => ({
  id: uid(),
  version: 1,
  name: 'Новый блок',
  icon: '🧩',
  color: '#6366f1',
  category: '',
  description: '',

  handles: [
    { id: 'in',  type: 'target', position: 'top',    label: '' },
    { id: 'out', type: 'source', position: 'bottom', label: '' },
  ],

  properties: [
  ],

  preview_template: '',

  code: {
    available_vars: ['message', 'bot', 'state'],
    imports: '',
    main: 'async def {block_id}(message, bot, state, **props):\n    pass\n',
    injects: [
    ],
  },

  package_id: null,
});

export const AVAILABLE_VARS = [
  { key: 'message', label: 'message',  desc: 'Incoming Telegram message object' },
  { key: 'bot',     label: 'bot',      desc: 'Bot instance (send messages, etc.)' },
  { key: 'state',   label: 'state',    desc: 'FSM state (user context / data)' },
  { key: 'db',      label: 'db',       desc: 'Database connection (sqlite / aiosqlite)' },
  { key: 'config',  label: 'config',   desc: 'Bot configuration dict' },
  { key: 'dp',      label: 'dp',       desc: 'Dispatcher instance' },
];

export const PROPERTY_TYPES = [
  { value: 'text',     label: 'Текст' },
  { value: 'textarea', label: 'Многострочный текст' },
  { value: 'number',   label: 'Число' },
  { value: 'toggle',   label: 'Переключатель' },
  { value: 'select',   label: 'Выпадающий список' },
  { value: 'color',    label: 'Цвет' },
  { value: 'code',     label: 'Код (Monaco)' },
];

export const HANDLE_POSITIONS = [
  { value: 'top',    label: 'Сверху' },
  { value: 'bottom', label: 'Снизу' },
  { value: 'left',   label: 'Слева' },
  { value: 'right',  label: 'Справа' },
];

const useCustomBlockStore = create((set, get) => ({
  blocks: [],
  packages: [],

  editingBlock: null,

  createBlock: () => {
    const block = BLANK_BLOCK();
    set({ editingBlock: clone(block) });
    return block.id;
  },

  duplicateBlock: (blockId) => {
    const src = get().blocks.find((b) => b.id === blockId);
    if (!src) return null;
    const dup = { ...clone(src), id: uid(), version: 1, name: `${src.name} (копия)`, package_id: null };
    set({ editingBlock: clone(dup) });
    return dup.id;
  },

  openBlock: (blockId) => {
    const block = get().blocks.find((b) => b.id === blockId);
    if (!block) return;
    set({ editingBlock: clone(block) });
  },

  saveBlock: () => {
    const { editingBlock, blocks } = get();
    if (!editingBlock) return;

    const idx = blocks.findIndex((b) => b.id === editingBlock.id);
    if (idx === -1) {
      set({ blocks: [...blocks, clone(editingBlock)] });
    } else {
      const updated = { ...clone(editingBlock), version: blocks[idx].version + 1 };
      const next = [...blocks];
      next[idx] = updated;
      set({ blocks: next, editingBlock: clone(updated) });
    }
  },

  deleteBlock: (blockId) => {
    set((s) => ({
      blocks: s.blocks.filter((b) => b.id !== blockId),
      editingBlock: s.editingBlock?.id === blockId ? null : s.editingBlock,
    }));
  },

  closeEditor: () => set({ editingBlock: null }),

  createCodeBlock: () => {
    const id = uid();
    const block = {
      id,
      version: 1,
      name: 'Новый код-блок',
      icon: '🧩',
      color: '#6366f1',
      category: '',
      description: '',
      codeMode: true,
      files: createDefaultFiles('Новый код-блок', '#6366f1'),
      valid: false,
      errors: [],
      package_id: null,
      handles: [
        { id: 'in',  type: 'target', position: 'top',    label: '' },
        { id: 'out', type: 'source', position: 'bottom', label: '' },
      ],
    };
    set({ editingBlock: clone(block) });
    return id;
  },

  updateCodeFile: (fileId, content) => {
    set((s) => {
      if (!s.editingBlock?.codeMode) return s;
      return {
        editingBlock: {
          ...s.editingBlock,
          files: s.editingBlock.files.map((f) =>
            f.id === fileId ? { ...f, content } : f
          ),
        },
      };
    });
  },

  reorderFiles: (fromId, toId) => {
    set((s) => {
      if (!s.editingBlock?.codeMode) return s;
      const files = [...s.editingBlock.files];
      const fromIdx = files.findIndex((f) => f.id === fromId);
      const toIdx   = files.findIndex((f) => f.id === toId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return s;
      const [item] = files.splice(fromIdx, 1);
      files.splice(toIdx, 0, item);
      return { editingBlock: { ...s.editingBlock, files } };
    });
  },

  quickSaveCodeBlock: () => {
    const { editingBlock, blocks } = get();
    if (!editingBlock?.codeMode) return;
    const idx = blocks.findIndex((b) => b.id === editingBlock.id);
    const updated = clone(editingBlock);
    if (idx !== -1) updated.version = blocks[idx].version + 1;
    const next = idx === -1
      ? [...blocks, updated]
      : blocks.map((b, i) => i === idx ? updated : b);
    set({ blocks: next, editingBlock: clone(updated) });
  },

  saveCodeBlock: (valid, errors) => {
    const { editingBlock, blocks } = get();
    if (!editingBlock?.codeMode) return;

    const idx = blocks.findIndex((b) => b.id === editingBlock.id);
    const updated = { ...clone(editingBlock), valid, errors: errors || [] };
    if (idx !== -1) updated.version = blocks[idx].version + 1;

    const next = idx === -1 ? [...blocks, updated] : blocks.map((b, i) => i === idx ? updated : b);
    set({ blocks: next, editingBlock: clone(updated) });
  },

  updateEditing: (patch) => {
    set((s) => {
      if (!s.editingBlock) return s;
      return { editingBlock: { ...s.editingBlock, ...patch } };
    });
  },

  updateEditingCode: (patch) => {
    set((s) => {
      if (!s.editingBlock) return s;
      return {
        editingBlock: {
          ...s.editingBlock,
          code: { ...s.editingBlock.code, ...patch },
        },
      };
    });
  },

  addHandle: (type = 'source') => {
    set((s) => {
      if (!s.editingBlock) return s;
      const handles = [...s.editingBlock.handles];
      const count = handles.filter((h) => h.type === type).length;
      handles.push({
        id: `${type === 'target' ? 'in' : 'out'}_${count + 1}`,
        type,
        position: type === 'target' ? 'top' : 'bottom',
        label: '',
      });
      return { editingBlock: { ...s.editingBlock, handles } };
    });
  },

  updateHandle: (handleId, patch) => {
    set((s) => {
      if (!s.editingBlock) return s;
      const handles = s.editingBlock.handles.map((h) =>
        h.id === handleId ? { ...h, ...patch } : h
      );
      return { editingBlock: { ...s.editingBlock, handles } };
    });
  },

  removeHandle: (handleId) => {
    set((s) => {
      if (!s.editingBlock) return s;
      return {
        editingBlock: {
          ...s.editingBlock,
          handles: s.editingBlock.handles.filter((h) => h.id !== handleId),
        },
      };
    });
  },

  addProperty: () => {
    set((s) => {
      if (!s.editingBlock) return s;
      const n = s.editingBlock.properties.length;
      const properties = [
        ...s.editingBlock.properties,
        {
          key: `field_${n + 1}`,
          label: `Поле ${n + 1}`,
          type: 'text',
          default: '',
          required: false,
          options: [],
          section: '',
        },
      ];
      return { editingBlock: { ...s.editingBlock, properties } };
    });
  },

  updateProperty: (idx, patch) => {
    set((s) => {
      if (!s.editingBlock) return s;
      const properties = [...s.editingBlock.properties];
      properties[idx] = { ...properties[idx], ...patch };
      return { editingBlock: { ...s.editingBlock, properties } };
    });
  },

  removeProperty: (idx) => {
    set((s) => {
      if (!s.editingBlock) return s;
      const properties = s.editingBlock.properties.filter((_, i) => i !== idx);
      return { editingBlock: { ...s.editingBlock, properties } };
    });
  },

  moveProperty: (fromIdx, toIdx) => {
    set((s) => {
      if (!s.editingBlock) return s;
      const properties = [...s.editingBlock.properties];
      const [item] = properties.splice(fromIdx, 1);
      properties.splice(toIdx, 0, item);
      return { editingBlock: { ...s.editingBlock, properties } };
    });
  },

  addInject: () => {
    set((s) => {
      if (!s.editingBlock) return s;
      const injects = [
        ...s.editingBlock.code.injects,
        { target: '', position: 'end', code: '' },
      ];
      return {
        editingBlock: {
          ...s.editingBlock,
          code: { ...s.editingBlock.code, injects },
        },
      };
    });
  },

  updateInject: (idx, patch) => {
    set((s) => {
      if (!s.editingBlock) return s;
      const injects = [...s.editingBlock.code.injects];
      injects[idx] = { ...injects[idx], ...patch };
      return {
        editingBlock: {
          ...s.editingBlock,
          code: { ...s.editingBlock.code, injects },
        },
      };
    });
  },

  removeInject: (idx) => {
    set((s) => {
      if (!s.editingBlock) return s;
      const injects = s.editingBlock.code.injects.filter((_, i) => i !== idx);
      return {
        editingBlock: {
          ...s.editingBlock,
          code: { ...s.editingBlock.code, injects },
        },
      };
    });
  },

  createPackage: (name = 'Новый пакет') => {
    const pkg = { id: uid(), name, version: '1.0.0', description: '', blocks: [] };
    set((s) => ({ packages: [...s.packages, pkg] }));
    return pkg.id;
  },

  addBlockToPackage: (packageId) => {
    const { editingBlock, blocks, packages } = get();
    const blockId = editingBlock?.id;
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;

    set({
      packages: packages.map((p) => {
        if (p.id !== packageId) return p;
        const existing = p.blocks.findIndex((b) => b.id === block.id);
        const nextBlocks = [...p.blocks];
        if (existing !== -1) {
          nextBlocks[existing] = clone(block);
        } else {
          nextBlocks.push(clone(block));
        }
        return { ...p, blocks: nextBlocks };
      }),
      blocks: blocks.map((b) => (b.id === blockId ? { ...b, package_id: packageId } : b)),
    });
  },

  removeBlockFromPackage: () => {
    const { editingBlock, blocks, packages } = get();
    const blockId = editingBlock?.id;
    const block = blocks.find((b) => b.id === blockId);
    if (!block || !block.package_id) return;
    set({
      packages: packages.map((p) =>
        p.id !== block.package_id ? p : { ...p, blocks: p.blocks.filter((b) => b.id !== blockId) }
      ),
      blocks: blocks.map((b) => (b.id === blockId ? { ...b, package_id: null } : b)),
      editingBlock: editingBlock ? { ...editingBlock, package_id: null } : null,
    });
  },

  setBlockPaletteHidden: (blockId, hidden) => {
    set((s) => ({
      blocks: s.blocks.map((b) => (b.id === blockId ? { ...b, paletteHidden: hidden } : b)),
      editingBlock: s.editingBlock?.id === blockId
        ? { ...s.editingBlock, paletteHidden: hidden }
        : s.editingBlock,
    }));
  },

  setPackagePaletteHidden: (pkgId, hidden) => {
    set((s) => ({
      packages: s.packages.map((p) => (p.id === pkgId ? { ...p, paletteHidden: hidden } : p)),
    }));
  },

  deletePackage: (packageId) => {
    set((s) => ({
      packages: s.packages.filter((p) => p.id !== packageId),
      blocks: s.blocks.map((b) => (b.package_id === packageId ? { ...b, package_id: null } : b)),
    }));
  },

  updatePackage: (packageId, patch) => {
    set((s) => ({
      packages: s.packages.map((p) => (p.id === packageId ? { ...p, ...patch } : p)),
    }));
  },

  exportPackage: (packageId) => {
    const pkg = get().packages.find((p) => p.id === packageId);
    if (!pkg) return null;
    const blockDefs = get().blocks.filter((b) => b.package_id === packageId);
    return clone({ ...pkg, blocks: blockDefs });
  },

  importPackage: (data) => {
    if (!data || !data.blocks) return;
    const pkgId = data.id || uid();
    const pkg = {
      id: pkgId,
      name: data.name || 'Imported',
      version: data.version || '1.0.0',
      description: data.description || '',
      blocks: data.blocks || [],
    };
    const importedBlocks = (data.blocks || []).map((b) => ({ ...b, package_id: pkgId }));
    set((s) => ({
      packages: [...s.packages.filter((p) => p.id !== pkgId), pkg],
      blocks: [
        ...s.blocks.filter((b) => !importedBlocks.find((ib) => ib.id === b.id)),
        ...importedBlocks,
      ],
    }));
  },

  serialise: () => {
    const { blocks, packages } = get();
    return { customBlocks: clone(blocks), customPackages: clone(packages) };
  },

  hydrate: (data) => {
    if (!data) return;
    set({
      blocks: data.customBlocks || [],
      packages: data.customPackages || [],
    });
  },

  getBlockDef: (blockId) => get().blocks.find((b) => b.id === blockId),
}));

export default useCustomBlockStore;
