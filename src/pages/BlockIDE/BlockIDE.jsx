import { useState, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import Editor from '@monaco-editor/react';
import useCustomBlockStore from '../../customBlocks/customBlockStore';
import { compileCodeBlock, injectBlockCSS, removeBlockCSS } from '../../customBlocks/codeBlockRuntime';
import { registerCodeBlock, unregisterCodeBlock } from '../../customBlocks/dynamicNodeRegistry';
import { wrapNodeComponent } from '../../customBlocks/codeBlockRuntime';
import PreviewPane from './PreviewPane';
import { useT } from '../../i18n';
import useStore from '../../store/useStore';
import { monacoTheme } from '../../monacoSetup';
import './BlockIDE.css';

function fileIcon(name) {
  if (name.endsWith('.jsx')) return '⚛';
  if (name.endsWith('.js'))  return 'JS';
  if (name.endsWith('.css')) return '🎨';
  return '📄';
}

function langFor(name) {
  if (name.endsWith('.jsx')) return 'javascript';
  if (name.endsWith('.js'))  return 'javascript';
  if (name.endsWith('.css')) return 'css';
  return 'plaintext';
}

function HelpModal({ onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  return (
    <div className="bide__help-overlay">
      <div className="bide__help-modal" ref={ref}>
        <div className="bide__help-modal-header">
          <span>Справка — Block IDE</span>
          <button onClick={onClose}>×</button>
        </div>
        <div className="bide__help-modal-body">

          <div className="bide__help-section">
            <div className="bide__help-section-title">Файлы блока</div>
            <table className="bide__help-table">
              <tbody>
                <tr><td><code>Node.jsx</code></td><td>React-компонент, отображаемый на канвасе</td></tr>
                <tr><td><code>Inspector.jsx</code></td><td>Панель настроек блока в правой панели</td></tr>
                <tr><td><code>definition.js</code></td><td>Метаданные: имя, иконка, цвет, handles</td></tr>
                <tr><td><code>generator.js</code></td><td>Генерация Python-кода из данных блока</td></tr>
                <tr><td><code>parser.js</code></td><td>Разбор кода обратно в узел (опционально)</td></tr>
                <tr><td><code>styles.css</code></td><td>Стили для Node.jsx</td></tr>
              </tbody>
            </table>
          </div>

          <div className="bide__help-section">
            <div className="bide__help-section-title">Node.jsx — пропсы</div>
            <table className="bide__help-table">
              <tbody>
                <tr><td><code>data</code></td><td>Данные из инспектора (объект)</td></tr>
                <tr><td><code>selected</code></td><td>Блок выбран на канвасе?</td></tr>
                <tr><td><code>id</code></td><td>Уникальный ID ноды</td></tr>
                <tr><td><code>nodeColor</code></td><td>Цвет из definition.js</td></tr>
                <tr><td><code>defaultIcon</code></td><td>Иконка из definition.js</td></tr>
                <tr><td><code>onDuplicate</code></td><td>Функция дублирования ноды</td></tr>
                <tr><td><code>onDelete</code></td><td>Функция удаления ноды</td></tr>
              </tbody>
            </table>
            <div className="bide__help-note">Глобально доступны: <code>Handle</code>, <code>Position</code> (из ReactFlow)</div>
          </div>

          <div className="bide__help-section">
            <div className="bide__help-section-title">Inspector.jsx — пропсы</div>
            <table className="bide__help-table">
              <tbody>
                <tr><td><code>nodeId</code></td><td>ID ноды</td></tr>
                <tr><td><code>data</code></td><td>Текущие данные блока</td></tr>
                <tr><td><code>onChange(patch)</code></td><td>Обновить данные — передай объект с изменёнными полями</td></tr>
              </tbody>
            </table>
          </div>

          <div className="bide__help-section">
            <div className="bide__help-section-title">definition.js</div>
            <table className="bide__help-table">
              <tbody>
                <tr><td><code>name</code></td><td>Название блока в палитре</td></tr>
                <tr><td><code>icon</code></td><td>Emoji-иконка</td></tr>
                <tr><td><code>color</code></td><td>Hex-цвет блока</td></tr>
                <tr><td><code>category</code></td><td>Группа в палитре</td></tr>
                <tr><td><code>description</code></td><td>Подсказка под названием</td></tr>
                <tr><td><code>handles</code></td><td>Массив точек соединения: <code>{'{ id, type, position, label }'}</code></td></tr>
              </tbody>
            </table>
            <div className="bide__help-note">Значения <code>type</code>: <code>"source"</code> / <code>"target"</code>. Значения <code>position</code>: <code>"top"</code> / <code>"bottom"</code> / <code>"left"</code> / <code>"right"</code></div>
          </div>

          <div className="bide__help-section">
            <div className="bide__help-section-title">generator.js</div>
            <div className="bide__help-note">Экспортируй функцию <code>generate(node, context)</code> → <code>string</code>. Возвращай строку Python-кода для данного узла.</div>
          </div>

          <div className="bide__help-section">
            <div className="bide__help-section-title">parser.js</div>
            <div className="bide__help-note">Экспортируй функцию <code>parse(line, context)</code> → <code>{'{ matched, nodeId?, data? }'}</code>. Используется для разбора кода обратно в граф.</div>
          </div>

        </div>
      </div>
    </div>
  );
}

function BlockMenu({ blockId, onClose, onDuplicate, onDelete }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div ref={ref} className="bide__block-menu">
      <button onClick={() => { onDuplicate(); onClose(); }}>⧉ Дублировать</button>
      <button className="danger" onClick={() => { onDelete(); onClose(); }}>🗑 Удалить</button>
    </div>
  );
}

function BlockIDE({ onBack }) {
  const T                      = useT();
  const isDarkUI               = useStore((s) => s.isDark);
  const block                  = useCustomBlockStore((s) => s.editingBlock);
  const blocks                 = useCustomBlockStore((s) => s.blocks);
  const packages               = useCustomBlockStore((s) => s.packages);
  const openBlock              = useCustomBlockStore((s) => s.openBlock);
  const createCodeBlock        = useCustomBlockStore((s) => s.createCodeBlock);
  const updateFile             = useCustomBlockStore((s) => s.updateCodeFile);
  const quickSaveCodeBlock     = useCustomBlockStore((s) => s.quickSaveCodeBlock);
  const updateEditing          = useCustomBlockStore((s) => s.updateEditing);
  const updateEditingCode      = useCustomBlockStore((s) => s.updateEditingCode);
  const deleteBlock            = useCustomBlockStore((s) => s.deleteBlock);
  const duplicateBlock         = useCustomBlockStore((s) => s.duplicateBlock);
  const reorderFiles           = useCustomBlockStore((s) => s.reorderFiles);
  const createPackage          = useCustomBlockStore((s) => s.createPackage);
  const addBlockToPackage      = useCustomBlockStore((s) => s.addBlockToPackage);
  const removeBlockFromPackage = useCustomBlockStore((s) => s.removeBlockFromPackage);
  const deletePackage          = useCustomBlockStore((s) => s.deletePackage);
  const updatePackage          = useCustomBlockStore((s) => s.updatePackage);
  const setBlockPaletteHidden  = useCustomBlockStore((s) => s.setBlockPaletteHidden);
  const setPackagePaletteHidden = useCustomBlockStore((s) => s.setPackagePaletteHidden);
  const exportPackage          = useCustomBlockStore((s) => s.exportPackage);
  const importPackage          = useCustomBlockStore((s) => s.importPackage);

  const [activeFileId,   setActiveFileId]   = useState(null);
  const [status,         setStatus]         = useState(null);
  const [checking,       setChecking]       = useState(false);
  const [showPreview,    setShowPreview]     = useState(false);
  const [compiledDef,    setCompiledDef]     = useState(null);
  const [menuFor,        setMenuFor]         = useState(null);
  const [pkgMenuOpen,    setPkgMenuOpen]     = useState(false);
  const [helpOpen,       setHelpOpen]        = useState(false);
  const [previewH,       setPreviewH]        = useState(220);
  const [newPkgMode,      setNewPkgMode]      = useState(false);
  const [newPkgName,      setNewPkgName]      = useState('');
  const [sidebarPkgForm,  setSidebarPkgForm]  = useState(false);
  const [sidebarPkgName,  setSidebarPkgName]  = useState('');
  const newPkgInputRef     = useRef(null);
  const sidebarPkgInputRef = useRef(null);
  const pkgsSectionRef     = useRef(null);

  useEffect(() => {
    if (newPkgMode) {
      const t = setTimeout(() => newPkgInputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [newPkgMode]);

  useEffect(() => {
    if (sidebarPkgForm) {
      const t = setTimeout(() => {
        pkgsSectionRef.current?.scrollTo({ top: pkgsSectionRef.current.scrollHeight, behavior: 'smooth' });
        sidebarPkgInputRef.current?.focus();
      }, 40);
      return () => clearTimeout(t);
    }
  }, [sidebarPkgForm]);

  const confirmSidebarPkg = () => {
    const name = sidebarPkgName.trim() || 'Новый пакет';
    createPackage(name);
    setSidebarPkgForm(false);
    setSidebarPkgName('');
  };
  const pkgMenuRef  = useRef(null);
  const tabsBarRef  = useRef(null);

  const [tabDrag, setTabDrag] = useState(null);
  const tabDragToRef  = useRef(null);
  const tabDragMoved  = useRef(false);

  useEffect(() => {
    if (!pkgMenuOpen) return;
    const h = (e) => { if (pkgMenuRef.current && !pkgMenuRef.current.contains(e.target)) setPkgMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [pkgMenuOpen]);

  const startTabDrag = useCallback((e, fileId) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (!tabsBarRef.current) return;

    const tabEls = [...tabsBarRef.current.querySelectorAll('[data-tab-id]')];
    const fromIndex = tabEls.findIndex((el) => el.dataset.tabId === fileId);
    if (fromIndex === -1) return;

    const rects         = tabEls.map((el) => el.getBoundingClientRect());
    const rect          = rects[fromIndex];
    const containerRect = tabsBarRef.current.getBoundingClientRect();
    const startMouseX   = e.clientX;

    tabDragToRef.current = fromIndex;
    tabDragMoved.current = false;

    document.body.style.userSelect = 'none';

    const file = (useCustomBlockStore.getState().editingBlock?.files ?? [])[fromIndex];
    const ghostContent = file
      ? <><span className="bide__tab-icon" style={{ fontSize: 11, fontWeight: 700 }}>{fileIcon(file.name)}</span>{file.name}</>
      : null;

    const initialDrag = {
      fromIndex,
      toIndex: fromIndex,
      ghostX: rect.left,
      ghostY: rect.top,
      ghostW: rect.width,
      ghostH: rect.height,
      rects,
      ghostContent,
    };

    const onMove = (me) => {
      const wasMoved = tabDragMoved.current;
      if (Math.abs(me.clientX - startMouseX) > 4) {
        if (!wasMoved) {
          tabDragMoved.current = true;
          document.body.style.cursor = 'grabbing';
          setTabDrag(initialDrag);
        }
      }
      if (!tabDragMoved.current) return;

      setTabDrag((d) => {
        if (!d) return null;
        const mouseX = me.clientX;
        const deltaX = mouseX - startMouseX;
        let ghostX = rect.left + deltaX;
        ghostX = Math.max(containerRect.left, Math.min(containerRect.right - rect.width, ghostX));

        let newTo = d.fromIndex;
        for (let i = 0; i < d.rects.length; i++) {
          if (i === d.fromIndex) continue;
          const mid = (d.rects[i].left + d.rects[i].right) / 2;
          if (i > d.fromIndex && mouseX > mid) newTo = i;
          else if (i < d.fromIndex && mouseX < mid) newTo = i;
        }
        newTo = Math.max(0, Math.min(d.rects.length - 1, newTo));
        tabDragToRef.current = newTo;
        return { ...d, toIndex: newTo, ghostX };
      });
    };

    const onUp = () => {
      const from  = fromIndex;
      const to    = tabDragToRef.current;
      const moved = tabDragMoved.current;

      document.body.style.userSelect = '';
      document.body.style.cursor     = '';
      setTabDrag(null);
      tabDragToRef.current = null;

      if (!moved) {
        setActiveFileId(fileId);
      } else if (to !== null && to !== from) {
        const curFiles = useCustomBlockStore.getState().editingBlock?.files ?? [];
        if (curFiles[from] && curFiles[to]) {
          reorderFiles(curFiles[from].id, curFiles[to].id);
        }
      }

      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [reorderFiles]);

  const getTabStyle = useCallback((index) => {
    if (!tabDrag) return {};
    const { fromIndex, toIndex, rects } = tabDrag;

    if (index === fromIndex) return { opacity: 0, pointerEvents: 'none' };

    const itemW = rects[fromIndex]?.width ?? 80;
    const gap   = rects.length > 1
      ? Math.max(0, rects[Math.min(1, rects.length - 1)].left - rects[0].right)
      : 0;
    const step  = itemW + gap;

    let shift = 0;
    if (fromIndex < toIndex && index > fromIndex && index <= toIndex) shift = -step;
    if (fromIndex > toIndex && index < fromIndex && index >= toIndex) shift = +step;

    return {
      transform:  shift ? `translateX(${shift}px)` : 'none',
      transition: 'transform 0.13s cubic-bezier(.25,.46,.45,.94)',
    };
  }, [tabDrag]);

  const codeBlocks  = blocks.filter((b) => b.codeMode);
  const isCodeBlock = block?.codeMode;
  const files       = block?.files || [];
  const activeFile  = files.find((f) => f.id === activeFileId) || files[0] || null;
  const canPreview  = isCodeBlock && status?.type === 'ok' && compiledDef;

  const handleCheck = useCallback(async () => {
    if (!isCodeBlock) return;
    setChecking(true);
    setStatus({ type: 'info', text: 'Компилирую...' });
    setShowPreview(false);

    await new Promise((r) => setTimeout(r, 80));

    try {
      const result = compileCodeBlock(block.files);

      if (result.valid) {
        const { NodeComponent, definition, InspectorComponent, generatorFn, parserFn, css } = result.components;
        const Wrapped = wrapNodeComponent(NodeComponent, definition);
        registerCodeBlock(block.id, { Component: Wrapped, InspectorComponent, generatorFn, parserFn });
        if (css) injectBlockCSS(block.id, css);
        else removeBlockCSS(block.id);

        if (definition) {
          updateEditing({
            name:        definition.name        ?? block.name,
            icon:        definition.icon        ?? block.icon,
            color:       definition.color       ?? block.color,
            category:    definition.category    ?? block.category,
            description: definition.description ?? block.description,
          });
          setCompiledDef(definition);
        }

        setStatus({ type: 'ok', text: '✓ Компиляция успешна — блок зарегистрирован' });
        updateEditing({ valid: true, errors: [] });
      } else {
        unregisterCodeBlock(block.id);
        setCompiledDef(null);
        setStatus({ type: 'error', text: `✗ Ошибки (${result.errors.length})`, errors: result.errors });
        updateEditing({ valid: false, errors: result.errors });
      }
    } catch (err) {
      setCompiledDef(null);
      setStatus({ type: 'error', text: `✗ Критическая ошибка: ${err.message}`, errors: [err.message] });
      updateEditing({ valid: false, errors: [err.message] });
    }

    setChecking(false);
  }, [block, isCodeBlock, updateEditing]);

  const handleFileChange = useCallback((content) => {
    if (!activeFile) return;
    updateFile(activeFile.id, content || '');
  }, [activeFile, updateFile]);

  const monacoOpts = {
    minimap: { enabled: false },
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    fontSize: 13,
    fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
    tabSize: 2,
    wordWrap: 'off',
    automaticLayout: true,
    padding: { top: 8 },
  };

  return (
    <div className="bide">
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}

      <div className="bide__topbar">
        <button className="bide__back" onClick={onBack}>{T('bide.back')}</button>
        <div className="bide__title">{T('bide.title')}</div>
        <button className="bide__help-btn" onClick={() => setHelpOpen(true)} title={T('bide.help')}>?</button>
        <div className="bide__topbar-actions">
          {isCodeBlock && (
            <>
              <button
                className="bide__btn bide__btn--primary"
                onClick={quickSaveCodeBlock}
                title={T('bide.save')}
              >
                {T('bide.save')}
              </button>
              <button
                className="bide__btn bide__btn--check"
                onClick={handleCheck}
                disabled={checking}
              >
                {checking ? T('bide.checking') : T('bide.checkOnly')}
              </button>

              <div style={{ position: 'relative' }} ref={pkgMenuRef}>
                <button
                  className="bide__btn"
                  onClick={() => { setPkgMenuOpen((v) => !v); setNewPkgMode(false); setNewPkgName(''); }}
                >
                  {block?.package_id
                    ? `📦 ${packages.find((p) => p.id === block.package_id)?.name ?? 'Пакет'} ▾`
                    : `${T('bide.toPackage')} ▾`}
                </button>
                {pkgMenuOpen && (
                  <div className="bide__pkg-dropdown">
                    {block?.package_id && (() => {
                      const curPkg = packages.find((p) => p.id === block.package_id);
                      return curPkg ? (
                        <div className="bide__pkg-current">
                          <span>📦 {curPkg.name}</span>
                          <button
                            className="bide__pkg-remove"
                            onClick={() => { removeBlockFromPackage(); setPkgMenuOpen(false); }}
                            title="Убрать из пакета"
                          >✕</button>
                        </div>
                      ) : null;
                    })()}
                    {packages.filter((p) => p.id !== block?.package_id).length > 0 && (
                      <>
                        {block?.package_id && <div className="bide__pkg-dropdown-sep" />}
                        {packages
                          .filter((p) => p.id !== block?.package_id)
                          .map((p) => (
                            <button
                              key={p.id}
                              onClick={() => { addBlockToPackage(p.id); setPkgMenuOpen(false); }}
                            >
                              📦 {p.name}
                            </button>
                          ))}
                      </>
                    )}
                    {packages.length === 0 && !newPkgMode && (
                      <div className="bide__pkg-dropdown-empty">{T('bide.noPackages')}</div>
                    )}
                    <div className="bide__pkg-dropdown-sep" />
                    {newPkgMode ? (
                      <div className="bide__pkg-create-form">
                        <input
                          ref={newPkgInputRef}
                          className="bide__pkg-name-input"
                          value={newPkgName}
                          onChange={(e) => setNewPkgName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const id = createPackage(newPkgName.trim() || T('bide.pkg.newName'));
                              addBlockToPackage(id);
                              setPkgMenuOpen(false);
                              setNewPkgMode(false);
                            }
                            if (e.key === 'Escape') setNewPkgMode(false);
                          }}
                          placeholder={T('bide.pkg.newName')}
                        />
                        <button
                          className="bide__pkg-confirm"
                          onClick={() => {
                            const id = createPackage(newPkgName.trim() || T('bide.pkg.newName'));
                            addBlockToPackage(id);
                            setPkgMenuOpen(false);
                            setNewPkgMode(false);
                          }}
                        >✓</button>
                      </div>
                    ) : (
                      <button onClick={() => { setNewPkgMode(true); setNewPkgName(''); }}>
                        {T('bide.pkg.create')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bide__body">

        <div className="bide__sidebar">
          <div className="bide__sidebar-header">
            {T('bide.title')}
            <button
              className="bide__btn bide__btn--icon"
              onClick={() => { createCodeBlock(); setActiveFileId(null); setStatus(null); setShowPreview(false); setCompiledDef(null); }}
              title={T('bide.newBlock')}
            >+</button>
          </div>
          <div className="bide__block-list">
            {codeBlocks.length === 0 && (
              <div className="bide__empty-list">{T('bide.empty')}</div>
            )}
            {codeBlocks.map((b) => {
              const bPkg = b.package_id ? packages.find((p) => p.id === b.package_id) : null;
              return (
                <div
                  key={b.id}
                  className={`bide__block-item${block?.id === b.id ? ' bide__block-item--active' : ''}`}
                  onClick={() => {
                    openBlock(b.id);
                    setActiveFileId(null);
                    setStatus(null);
                    setShowPreview(false);
                    setCompiledDef(null);
                  }}
                  style={{ position: 'relative' }}
                >
                  <span className="bide__block-icon">{b.icon}</span>
                  <div className="bide__block-info">
                    <div className="bide__block-name">{b.name}</div>
                    <div className="bide__block-meta">
                      <span className={`bide__block-status ${b.valid ? 'ok' : 'err'}`}>
                        {b.valid ? '✓' : b.errors?.length ? `✗ ${b.errors.length}` : '⚪'}
                      </span>
                      {bPkg && <span className="bide__block-pkg-badge" title={bPkg.name}>📦</span>}
                      {b.paletteHidden && <span className="bide__block-hidden-badge" title="Скрыт из палитры">🚫</span>}
                    </div>
                  </div>
                  <button
                    className="bide__block-menu-btn"
                    onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === b.id ? null : b.id); }}
                    title="Действия"
                  >⋯</button>
                  {menuFor === b.id && (
                    <BlockMenu
                      blockId={b.id}
                      onClose={() => setMenuFor(null)}
                      onDuplicate={() => { duplicateBlock(b.id); setActiveFileId(null); setStatus(null); setShowPreview(false); setCompiledDef(null); }}
                      onDelete={() => {
                        if (confirm(`${b.name}?`)) {
                          unregisterCodeBlock(b.id);
                          removeBlockCSS(b.id);
                          deleteBlock(b.id);
                          setStatus(null); setShowPreview(false); setCompiledDef(null);
                        }
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="bide__packages-section" ref={pkgsSectionRef}>
            <div className="bide__sidebar-header" style={{ borderTop: '1px solid var(--c-border)' }}>
              ПАКЕТЫ
              <div style={{ display: 'flex', gap: 2 }}>
                <button
                  className="bide__btn bide__btn--icon"
                  title="Импортировать пакет из файла"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.json,.pkg.json';
                    input.onchange = (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        try {
                          const data = JSON.parse(ev.target.result);
                          importPackage(data);
                        } catch {
                          alert('Ошибка: файл повреждён или не является пакетом.');
                        }
                      };
                      reader.readAsText(file);
                    };
                    input.click();
                  }}
                >↑</button>
                <button
                  className="bide__btn bide__btn--icon"
                  title="Новый пакет"
                  onClick={() => { setSidebarPkgForm(true); setSidebarPkgName(''); }}
                >+</button>
              </div>
            </div>

            {packages.length === 0 && !sidebarPkgForm && (
              <div className="bide__empty-list" style={{ fontSize: 11 }}>Нет пакетов</div>
            )}

            {packages.map((pkg) => (
              <div key={pkg.id} className="bide__pkg-item">
                <span className="bide__pkg-item-icon">📦</span>
                <div className="bide__pkg-item-info">
                  <input
                    className="bide__pkg-item-name"
                    value={pkg.name}
                    onChange={(e) => updatePackage(pkg.id, { name: e.target.value })}
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    title="Переименовать пакет"
                  />
                  <span className="bide__pkg-item-count">
                    {blocks.filter((b) => b.package_id === pkg.id).length} бл.
                  </span>
                </div>
                <div className="bide__pkg-item-actions">
                  <button
                    className={`bide__pkg-vis-btn${pkg.paletteHidden ? ' hidden' : ''}`}
                    title={pkg.paletteHidden ? 'Показать в палитре' : 'Скрыть из палитры'}
                    onClick={() => setPackagePaletteHidden(pkg.id, !pkg.paletteHidden)}
                  >{pkg.paletteHidden ? '🚫' : '👁'}</button>
                  <button
                    className="bide__pkg-dl-btn"
                    title="Скачать пакет"
                    onClick={() => {
                      const data = exportPackage(pkg.id);
                      if (!data) return;
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${pkg.name.replace(/\s+/g, '_')}.pkg.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >↓</button>
                  <button
                    className="bide__pkg-del-btn"
                    title="Удалить пакет"
                    onClick={() => {
                      if (confirm(`Удалить пакет «${pkg.name}»?\nБлоки останутся, но будут откреплены от пакета.`)) deletePackage(pkg.id);
                    }}
                  >🗑</button>
                </div>
              </div>
            ))}

            {sidebarPkgForm && (
              <div
                className="bide__pkg-new-form"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <span className="bide__pkg-item-icon">📦</span>
                <input
                  ref={sidebarPkgInputRef}
                  className="bide__pkg-new-input"
                  value={sidebarPkgName}
                  onChange={(e) => setSidebarPkgName(e.target.value)}
                  placeholder="Название пакета…"
                  onMouseDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') confirmSidebarPkg();
                    if (e.key === 'Escape') { setSidebarPkgForm(false); setSidebarPkgName(''); }
                  }}
                />
                <button className="bide__pkg-new-ok"  onClick={confirmSidebarPkg} title="Создать">✓</button>
                <button className="bide__pkg-new-cancel" onClick={() => { setSidebarPkgForm(false); setSidebarPkgName(''); }} title="Отмена">✕</button>
              </div>
            )}
          </div>
        </div>

        <div className="bide__editor-area">
          {!isCodeBlock ? (
            <div className="bide__empty">
              <div className="bide__empty-icon">💻</div>
              <div>{T('bide.empty')}</div>
            </div>
          ) : (
            <>
              <div className="bide__editor-section">
                {tabDrag && ReactDOM.createPortal(
                  <div
                    className="bide__tab-ghost"
                    style={{
                      top:    tabDrag.ghostY,
                      left:   tabDrag.ghostX,
                      width:  tabDrag.ghostW,
                      height: tabDrag.ghostH,
                    }}
                  >
                    {tabDrag.ghostContent}
                  </div>,
                  document.body
                )}

                <div className="bide__tabs" ref={tabsBarRef}>
                  {files.map((f, idx) => (
                    <div
                      key={f.id}
                      data-tab-id={f.id}
                      className={`bide__tab${activeFile?.id === f.id ? ' bide__tab--active' : ''}`}
                      style={getTabStyle(idx)}
                      onMouseDown={(e) => startTabDrag(e, f.id)}
                    >
                      <span className="bide__tab-icon">{fileIcon(f.name)}</span>
                      {f.name}
                    </div>
                  ))}

                  {canPreview && (
                    <button
                      className={`bide__tab bide__tab--preview-btn${showPreview ? ' bide__tab--active' : ''}`}
                      style={{ marginLeft: 'auto', flexShrink: 0 }}
                      onClick={() => setShowPreview((v) => !v)}
                      title="Предпросмотр блока"
                    >
                      👁 Превью
                    </button>
                  )}
                </div>

                {activeFile && (
                  <div className="bide__monaco">
                    <Editor
                      key={activeFile.id}
                      height="100%"
                      language={langFor(activeFile.name)}
                      theme={monacoTheme(isDarkUI)}
                      value={activeFile.content}
                      onChange={handleFileChange}
                      options={monacoOpts}
                    />
                  </div>
                )}
              </div>

              {showPreview && canPreview && (
                <div className="bide__preview-wrapper" style={{ height: previewH, flexShrink: 0 }}>
                  <div
                    className="bide__preview-resize-handle"
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      e.preventDefault();
                      const startY = e.clientY;
                      const startH = previewH;
                      const onMove = (ev) => setPreviewH(Math.max(80, Math.min(600, startH - (ev.clientY - startY))));
                      const onUp   = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
                      document.addEventListener('mousemove', onMove);
                      document.addEventListener('mouseup', onUp);
                      document.body.style.cursor = 'row-resize';
                      document.body.style.userSelect = 'none';
                      onUp._orig = onUp;
                      document.addEventListener('mouseup', () => { document.body.style.cursor = ''; document.body.style.userSelect = ''; }, { once: true });
                    }}
                  />
                  <PreviewPane
                    key={block.id}
                    blockId={block.id}
                    definition={compiledDef}
                    onClose={() => setShowPreview(false)}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {isCodeBlock && (
          <div className="bide__info">
            <div className="bide__info-header">{T('bide.about')}</div>
            <div className="bide__info-body">
              <div className="bide__info-icon">{block.icon}</div>
              <input
                className="bide__info-input"
                value={block.name}
                onChange={(e) => updateEditing({ name: e.target.value })}
                placeholder={T('bide.namePlaceholder')}
              />
              <input
                className="bide__info-input"
                value={block.category}
                onChange={(e) => updateEditing({ category: e.target.value })}
                placeholder={T('bide.categoryPlaceholder')}
              />

              <div className="bide__info-field">
                <label className="bide__info-label">Библиотеки (импорты)</label>
                <textarea
                  className="bide__info-textarea"
                  value={block.code?.imports ?? ''}
                  onChange={(e) => updateEditingCode({ imports: e.target.value })}
                  placeholder={'import requests\nfrom datetime import datetime'}
                  spellCheck={false}
                  rows={3}
                />
                <div className="bide__info-hint">
                  Каждая строка — отдельный импорт. Они добавятся в начало bot.py (без дублей).
                </div>
              </div>

              {block.package_id
                ? (() => {
                    const curPkg = packages.find((p) => p.id === block.package_id);
                    return curPkg ? (
                      <div className="bide__info-pkg">
                        <span>📦 {curPkg.name}</span>
                        <button
                          className="bide__info-pkg-remove"
                          title="Убрать из пакета"
                          onClick={() => removeBlockFromPackage()}
                        >✕</button>
                      </div>
                    ) : null;
                  })()
                : <div className="bide__info-no-pkg">Не в пакете</div>
              }

              <label className="bide__info-toggle">
                <input
                  type="checkbox"
                  checked={!block.paletteHidden}
                  onChange={(e) => setBlockPaletteHidden(block.id, !e.target.checked)}
                />
                <span>Показывать в палитре</span>
              </label>

              {status && (
                <div className={`bide__status bide__status--${status.type}`}>
                  <div className="bide__status-title">{status.text}</div>
                  {status.errors?.map((e, i) => (
                    <div key={i} className="bide__status-error">{e}</div>
                  ))}
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BlockIDE;
