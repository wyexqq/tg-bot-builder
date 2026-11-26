import { useEffect, useRef, useState } from 'react';
import useStore from '../store/useStore';
import useCustomBlockStore from '../customBlocks/customBlockStore';
import { getFlowInstance } from '../flowInstance';
import { useT, t } from '../i18n';
import { computeRequirements } from '../codeGenerator';
import { Icon, BlockIcon } from './Icons';
import './Toolbar.css';

function buildValidationErrors(nodes, edges) {
  const result = {};
  const add = (nodeId, message, level = 'warning') => {
    if (!result[nodeId]) result[nodeId] = [];
    result[nodeId].push({ message, level });
  };

  const targetIds = new Set(edges.map((e) => e.target));

  const SKIP_VALIDATION = new Set(['comment', 'group_frame']);
  const ROOT_TYPES = new Set(['command', 'message_handler', 'deep_link', 'schedule']);
  nodes.filter((n) => !n.data?.disabled && !SKIP_VALIDATION.has(n.type)).forEach((n) => {
    if (n.type === 'command' && !n.data?.command_name?.trim()) {
      add(n.id, 'Нет имени команды', 'error');
    }
    if (n.type === 'text' && !n.data?.message_text?.trim()) {
      add(n.id, 'Пустой текст сообщения', 'warning');
    }
    if (n.type === 'http_request' && !n.data?.url?.trim()) {
      add(n.id, 'Не указан URL', 'error');
    }
    if (n.type === 'variable' && !n.data?.var_name?.trim()) {
      add(n.id, 'Нет имени переменной', 'error');
    }
    if (!ROOT_TYPES.has(n.type) && !targetIds.has(n.id)) {
      add(n.id, 'Блок не подключён', 'warning');
    }
  });

  return result;
}

function ValidationPanel({ errors, onClose }) {
  const setSelectedNodeId = useStore((s) => s.setSelectedNodeId);
  const T = useT();

  const items = Object.entries(errors).flatMap(([nodeId, errs]) =>
    errs.map((e) => ({ nodeId, ...e }))
  );

  const nodes = useStore((s) => s.nodes);
  const nodeTypeOf = (id) => nodes.find((n) => n.id === id)?.type;

  const focusNode = (nodeId) => {
    setSelectedNodeId(nodeId);
    const rf = getFlowInstance();
    if (rf) {
      const node = rf.getNodes().find((n) => n.id === nodeId);
      if (node) rf.fitView({ nodes: [{ id: nodeId }], padding: 0.4, duration: 300 });
    }
  };

  return (
    <div className="val-panel">
      <div className="val-panel__header">
        <span className="val-panel__title">
          {T('val.panel.title')} <span className="val-panel__count">{items.length}</span>
        </span>
        <button className="ib2" onClick={onClose} title="Закрыть"><Icon name="x" size={14} /></button>
      </div>
      <div className="val-panel__list">
        {items.map((item, i) => (
          <div
            key={i}
            className={`val-panel__item val-panel__item--${item.level}`}
            onClick={() => focusNode(item.nodeId)}
            title={T('val.panel.clickFocus')}
          >
            <span className="val-panel__icon"><Icon name={item.level === 'error' ? 'error' : 'warn'} size={15} /></span>
            {nodeTypeOf(item.nodeId) && <BlockIcon type={nodeTypeOf(item.nodeId)} size={20} />}
            <span className="val-panel__msg">{item.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Toolbar() {
  const isRunning          = useStore((s) => s.isRunning);
  const botStatus          = useStore((s) => s.botStatus);
  const setBotStatus       = useStore((s) => s.setBotStatus);
  const hasUnsavedChanges  = useStore((s) => s.hasUnsavedChanges);
  const addLog             = useStore((s) => s.addLog);
  const undo               = useStore((s) => s.undo);
  const redo               = useStore((s) => s.redo);
  const botInfo            = useStore((s) => s.botInfo);
  const explorerFolder     = useStore((s) => s.explorerFolder);
  const setProjectModalOpen = useStore((s) => s.setProjectModalOpen);
  const T                  = useT();

  const projectName = explorerFolder ? explorerFolder.split(/[\\/]/).filter(Boolean).pop() : 'Нет проекта';

  const nodes              = useStore((s) => s.nodes);
  const edges              = useStore((s) => s.edges);
  const code               = useStore((s) => s.code);
  const botToken           = useStore((s) => s.botToken);
  const currentFilePath    = useStore((s) => s.currentFilePath);
  const setCurrentFilePath = useStore((s) => s.setCurrentFilePath);
  const setHasUnsavedChanges = useStore((s) => s.setHasUnsavedChanges);
  const loadProject        = useStore((s) => s.loadProject);
  const nodeErrors         = useStore((s) => s.nodeErrors);
  const setNodeErrors      = useStore((s) => s.setNodeErrors);

  const [showValPanel, setShowValPanel] = useState(false);

  const errorCount   = Object.values(nodeErrors).flat().filter((e) => e.level === 'error').length;
  const warningCount = Object.values(nodeErrors).flat().filter((e) => e.level === 'warning').length;
  const totalCount   = errorCount + warningCount;
  const hasCritical  = errorCount > 0;

  const stateRef = useRef({});
  stateRef.current = {
    nodes, edges, code, botToken, currentFilePath,
    setCurrentFilePath, setHasUnsavedChanges, loadProject,
    addLog, setBotStatus, isRunning,
  };

  useEffect(() => {
    if (nodes.length === 0) { setNodeErrors({}); return; }
    const errs = buildValidationErrors(nodes, edges);
    setNodeErrors(errs);
  }, [nodes, edges]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStart = async () => {
    const { botToken: token, code: c, nodes: n, edges: e,
            addLog: log, setBotStatus: setStatus } = stateRef.current;
    const lang = useStore.getState().lang;

    if (!token.trim()) { log(t('val.noToken', lang), 'error'); return; }

    const errs = buildValidationErrors(n, e);
    setNodeErrors(errs);
    const criticalCount = Object.values(errs).flat().filter((x) => x.level === 'error').length;

    if (criticalCount > 0) {
      log(t('val.blockStart', lang, { count: criticalCount }), 'error');
      setShowValPanel(true);
      return;
    }

    const warnCount = Object.values(errs).flat().filter((x) => x.level === 'warning').length;
    if (warnCount > 0) {
      log(t('val.warnStart', lang, { count: warnCount }), 'warn');
      setShowValPanel(true);
    }

    setStatus('running');
    const st = useStore.getState();
    st.startRun(c);
    const requirements = computeRequirements(n, { sqlDialect: st.sqlDialect });
    const result = await window.electron?.ipcRenderer.invoke('start-bot', { code: c, requirements });
    if (!result?.success) {
      if (result?.error === 'python_not_found') log(t('val.noPython', lang), 'error');
      else if (result?.error === 'already_running') log(t('val.alreadyRunning', lang), 'warn');
      else log(`${t('val.startError', lang)} ${result?.error || '?'}`, 'error');
      setStatus('error');
    }
  };

  const handleStop = () => window.electron?.ipcRenderer.send('stop-bot');

  const save = async (forceDialog = false) => {
    const { nodes: n, edges: e, code: c, botToken: tk,
            currentFilePath: fp, setCurrentFilePath: scp,
            setHasUnsavedChanges: suh } = stateRef.current;
    const customData = useCustomBlockStore.getState().serialise();
    const paletteConfig = useStore.getState().serialisePaletteConfig();
    const result = await window.electron?.ipcRenderer.invoke('save-project', {
      nodes: n, edges: e, code: c, botToken: tk,
      ...customData, paletteConfig, filePath: forceDialog ? null : fp,
    });
    if (result?.success) { scp(result.filePath); suh(false); }
    return result;
  };

  const open = async () => {
    const { loadProject: lp, setCurrentFilePath: scp } = stateRef.current;
    const result = await window.electron?.ipcRenderer.invoke('open-project');
    if (result?.success) { lp(result.data); scp(result.filePath); }
  };

  const exportProject = async () => {
    const { nodes: n, code: c, addLog: log } = stateRef.current;
    const lang = useStore.getState().lang;
    const hasDb = n.some((nd) => nd.type?.startsWith('db'));
    const requirements = computeRequirements(n, { sqlDialect: useStore.getState().sqlDialect });
    const result = await window.electron?.ipcRenderer.invoke('export-project', { code: c, hasDb, requirements });
    if (result?.success) log(`${t('val.exported', lang)} ${result.folder}`, 'success');
  };

  const exportImage = async () => {
    const { addLog: log } = stateRef.current;
    const container = document.querySelector('.react-flow');
    if (!container) return;

    const rf = getFlowInstance();
    const prevViewport = rf?.getViewport();
    if (rf) {
      rf.fitView({ padding: 0.08, duration: 250 });
      await new Promise((r) => setTimeout(r, 320));
    }

    const hideStyle = document.createElement('style');
    hideStyle.id = '__rf-export-hide';
    hideStyle.textContent = `
      .react-flow__controls,
      .react-flow__minimap,
      .react-flow__panel { visibility: hidden !important; }
      .react-flow__node.selected,
      .react-flow__node.selected > * { box-shadow: none !important; outline: none !important; }
      .react-flow__edge.selected .react-flow__edge-path { stroke: var(--c-border) !important; }
    `;
    document.head.appendChild(hideStyle);

    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const rect = container.getBoundingClientRect();
    const dpr  = window.devicePixelRatio || 1;
    const result = await window.electron?.ipcRenderer.invoke('export-image', {
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      dpr,
    });

    document.getElementById('__rf-export-hide')?.remove();
    if (rf && prevViewport) rf.setViewport(prevViewport, { duration: 200 });

    if (result?.success) log(`Схема сохранена: ${result.filePath}`, 'success');
    else if (result?.error) log(`Ошибка экспорта: ${result.error}`, 'error');
  };

  useEffect(() => {
    const off = window.electron?.ipcRenderer.on('shortcut', async (name) => {
      if (name === 'save') await save(false);
      else if (name === 'open') await open();
      else if (name === 'save-and-close') { const r = await save(false); if (r?.success) window.electron?.ipcRenderer.send('close-confirmed'); }
      else if (name === 'export') await exportProject();
      else if (name === 'start-bot') { if (!stateRef.current.isRunning) handleStart(); }
      else if (name === 'stop-bot')  { if (stateRef.current.isRunning)  handleStop(); }
    });
    return () => { if (typeof off === 'function') off(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const codeVisible   = useStore((s) => s.panelConfig.code.visible);
  const canvasVisible = useStore((s) => s.panelConfig.canvas.visible);
  const setPanelProp  = useStore((s) => s.setPanelProp);
  const viewMode = codeVisible && canvasVisible ? 'both' : codeVisible ? 'code' : canvasVisible ? 'canvas' : 'none';
  const setViewMode = (m) => {
    window.__setAppPage?.('main');
    setPanelProp('code', 'visible', m !== 'canvas');
    setPanelProp('canvas', 'visible', m !== 'code');
  };

  const statusLabel = botStatus === 'running' ? T('toolbar.status.running')
    : botStatus === 'error' ? T('toolbar.status.error')
    : T('toolbar.status.stopped');

  const botChipLabel = botInfo.status === 'valid'    ? botInfo.username
    : botInfo.status === 'checking' ? 'Проверка токена…'
    : botInfo.status === 'invalid'  ? 'Токен неверный'
    : 'Указать токен';

  const parentDir = explorerFolder ? explorerFolder.split(/[\\/]/).filter(Boolean).slice(-2, -1)[0] : '';
  const dotCls = botStatus === 'running' ? 'run'
    : botStatus === 'error' ? 'err'
    : botInfo.status === 'valid' ? 'ok'
    : botInfo.status === 'invalid' ? 'err' : 'idle';

  return (
    <>
      <header className="topbar">
        <div className="tb-group">
          <div className="tb-logo" title="TG Bot Builder">
            <svg viewBox="0 0 24 24"><path d="M21.5 3.6 2.9 10.8c-1 .4-1 1.4 0 1.7l4.7 1.5 1.8 5.6c.2.7 1 .9 1.6.4l2.6-2.3 4.9 3.6c.7.5 1.6.1 1.8-.7l3.2-15.4c.2-1-.7-1.9-1.9-1.4zM9.6 14.3l8.6-6.8-6.6 7.7-.3 3.3z" /></svg>
          </div>

          <button className="capsule glass tb-proj" onClick={() => setProjectModalOpen(true)} title="Сменить проект">
            <span className="tb-proj__name">{projectName}</span>
            {parentDir && <span className="tb-proj__path">{parentDir}</span>}
            <Icon name="chev" size={13} stroke={2} />
          </button>

          <div className="capsule glass">
            <button
              className={`tb-ib${hasUnsavedChanges ? ' tb-ib--dirty' : ''}`}
              onClick={() => save(false)}
              title={hasUnsavedChanges ? 'Сохранить (Ctrl+S) — есть несохранённые изменения' : 'Сохранить (Ctrl+S)'}
            >
              <Icon name="save" size={15} />
            </button>
            <button className="tb-ib" onClick={open} title={T('toolbar.title.open')}><Icon name="folder" size={15} /></button>
            <button className="tb-ib" onClick={exportProject} title={T('toolbar.title.export')}><Icon name="export" size={15} /></button>
            <button className="tb-ib" onClick={exportImage} title="Экспорт схемы в PNG"><Icon name="image" size={15} /></button>
          </div>

          <div className="capsule glass">
            <button className="tb-ib" onClick={undo} title="Отменить (Ctrl+Z)"><Icon name="undo" size={15} /></button>
            <button className="tb-ib" onClick={redo} title="Повторить (Ctrl+Y)"><Icon name="redo" size={15} /></button>
          </div>
        </div>

        <div className="tb-center">
          <div className="seg glass" role="tablist" aria-label="Вид">
            <button className={viewMode === 'code' ? 'on' : ''} onClick={() => setViewMode('code')}>
              <Icon name="code" size={13} stroke={1.9} />Код
            </button>
            <button className={viewMode === 'both' ? 'on' : ''} onClick={() => setViewMode('both')}>
              <Icon name="split" size={13} stroke={1.9} />Код + схема
            </button>
            <button className={viewMode === 'canvas' ? 'on' : ''} onClick={() => setViewMode('canvas')}>
              <Icon name="flow" size={13} stroke={1.9} />Схема
            </button>
          </div>
        </div>

        <div className="tb-group">
          {totalCount > 0 && (
            <button
              className={`chip glass ${hasCritical ? 'chip--err' : 'chip--warn'}`}
              onClick={() => setShowValPanel((v) => !v)}
              title={T('val.panel.title')}
            >
              <Icon name={hasCritical ? 'error' : 'warn'} size={14} stroke={2} />{totalCount}
            </button>
          )}

          <button
            className="chip glass tb-bot"
            onClick={() => window.__setAppPage?.('settings')}
            title={`${statusLabel} · настройки токена`}
          >
            <span className={`tb-dot tb-dot--${dotCls}`} />
            <b>{botChipLabel}</b>
          </button>

          {!isRunning ? (
            <button
              className={`tb-run${hasCritical ? ' tb-run--blocked' : ''}`}
              onClick={handleStart}
              title={hasCritical ? T('val.panel.blockedTitle') : 'Запустить бота (F5)'}
            >
              <Icon name="play" size={13} stroke={0} style={{ fill: 'currentColor' }} />
              {T('toolbar.start')}{hasCritical ? ` · ${errorCount}` : ''}
            </button>
          ) : (
            <button className="tb-run tb-run--stop" onClick={handleStop} title="Остановить бота (Shift+F5)">
              <Icon name="stop" size={12} stroke={0} style={{ fill: 'currentColor' }} />
              {T('toolbar.stop')}
            </button>
          )}
        </div>
      </header>

      {showValPanel && totalCount > 0 && (
        <ValidationPanel errors={nodeErrors} onClose={() => setShowValPanel(false)} />
      )}
    </>
  );
}

export default Toolbar;
