import { useRef, useState, useCallback, useEffect } from 'react';
import Toolbar from './components/Toolbar';
import CodeEditor from './components/CodeEditor';
import FlowCanvas from './components/FlowCanvas';
import BlockPalette from './components/BlockPalette';
import NodeInspector from './components/NodeInspector';
import ConflictDialog from './components/ConflictDialog';
import CloseDialog from './components/CloseDialog';
import ChatHistory from './components/ChatHistory';
import TelegramSimulator from './components/TelegramSimulator';
import VariablesPanel from './components/VariablesPanel';
import AnalyticsPanel from './components/AnalyticsPanel';
import useStore from './store/useStore';
import { useT } from './i18n';
import BlockIDE from './pages/BlockIDE/BlockIDE';
import FileExplorer from './components/FileExplorer';
import SearchModal from './components/SearchModal';
import ProjectModal from './components/ProjectModal';
import BottomPanel from './components/BottomPanel';
import { Icon } from './components/Icons';
import CommandPalette from './components/CommandPalette';
import ToastHost, { toast } from './components/ToastHost';
import { generateCode } from './codeGenerator';
import { parseCodeToGraph } from './codeParser';
import { getFlowInstance } from './flowInstance';
import './App.css';
import './theme.css';

function ActivityIcon({ view, page, setPage, title, children }) {
  const leftView    = useStore((s) => s.leftView);
  const setLeftView = useStore((s) => s.setLeftView);

  const isActive = page === 'main' && leftView === view;

  const onClick = () => {
    if (page !== 'main') { setPage('main'); setLeftView(view); return; }
    setLeftView(isActive ? null : view);
  };

  return (
    <button className={`activity-icon${isActive ? ' active' : ''}`}
            onClick={onClick} title={title}>
      {children}
    </button>
  );
}

function RightIcon({ view, page, setPage, title, children }) {
  const rightView    = useStore((s) => s.rightView);
  const setRightView = useStore((s) => s.setRightView);

  const isActive = page === 'main' && rightView === view;

  const onClick = () => {
    if (page !== 'main') { setPage('main'); setRightView(view); return; }
    setRightView(isActive ? null : view);
  };

  return (
    <button className={`activity-icon${isActive ? ' active' : ''}`}
            onClick={onClick} title={title}>
      {children}
    </button>
  );
}

function SettingsSidebar() {
  const botToken          = useStore((s) => s.botToken);
  const setBotToken       = useStore((s) => s.setBotToken);
  const syncEnabled       = useStore((s) => s.syncEnabled);
  const setSyncEnabled    = useStore((s) => s.setSyncEnabled);
  const loggingEnabled    = useStore((s) => s.loggingEnabled);
  const setLoggingEnabled = useStore((s) => s.setLoggingEnabled);
  const proxyEnabled      = useStore((s) => s.proxyEnabled);
  const setProxyEnabled   = useStore((s) => s.setProxyEnabled);
  const proxyUrl          = useStore((s) => s.proxyUrl);
  const setProxyUrl       = useStore((s) => s.setProxyUrl);
  const autoLayout        = useStore((s) => s.autoLayout);
  const botInfo           = useStore((s) => s.botInfo);
  const sqlDialect        = useStore((s) => s.sqlDialect);
  const setSqlDialect     = useStore((s) => s.setSqlDialect);
  const dbConfig          = useStore((s) => s.dbConfig);
  const setDbConfig       = useStore((s) => s.setDbConfig);
  const T                 = useT();

  const tokenStatus = botInfo.status;
  const botName     = botInfo.username;

  return (
    <div className="settings-sidebar">
      <div className="settings-group">
        <div className="settings-group-title">
          {T('settings.token')}
        </div>
        {tokenStatus === 'checking' && <div className="token-status token-status--checking">…</div>}
        {tokenStatus === 'valid'    && <div className="token-status token-status--valid" title={botName}>✓ {botName}</div>}
        {tokenStatus === 'invalid'  && <div className="token-status token-status--invalid">✗ Токен неверный</div>}
        <input
          className={`settings-input${tokenStatus === 'valid' ? ' settings-input--valid' : tokenStatus === 'invalid' ? ' settings-input--invalid' : ''}`}
          type="text"
          placeholder="1234567890:AABBcc..."
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
          spellCheck={false}
        />
      </div>

      <div className="settings-group">
        <div className="settings-group-title">{T('settings.sync')}</div>
        <label className="settings-toggle">
          <input type="checkbox" checked={syncEnabled} onChange={(e) => setSyncEnabled(e.target.checked)} />
          {T('settings.syncLabel')}
        </label>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">{T('settings.logging')}</div>
        <label className="settings-toggle">
          <input type="checkbox" checked={loggingEnabled} onChange={(e) => setLoggingEnabled(e.target.checked)} />
          {T('settings.logEnable')}
        </label>
        <label className="settings-toggle" style={{ marginTop: 4 }}>
          <input type="checkbox" checked={proxyEnabled} onChange={(e) => setProxyEnabled(e.target.checked)} />
          {T('settings.proxyEnable')}
        </label>
        {proxyEnabled && (
          <input
            className="settings-input"
            type="text"
            placeholder="socks5://host:port"
            value={proxyUrl}
            onChange={(e) => setProxyUrl(e.target.value)}
            style={{ marginTop: 6 }}
            spellCheck={false}
          />
        )}
      </div>

      <div className="settings-group">
        <div className="settings-group-title">База данных (SQL)</div>
        <select
          className="settings-input"
          value={sqlDialect}
          onChange={(e) => setSqlDialect(e.target.value)}
        >
          <option value="sqlite">SQLite (по умолчанию, файл bot.db)</option>
          <option value="postgres">PostgreSQL</option>
          <option value="mysql">MySQL / MariaDB</option>
        </select>
        {sqlDialect !== 'sqlite' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            <input className="settings-input" placeholder="host" value={dbConfig.host} onChange={(e) => setDbConfig({ host: e.target.value })} spellCheck={false} />
            <input className="settings-input" placeholder={sqlDialect === 'postgres' ? 'port (5432)' : 'port (3306)'} value={dbConfig.port} onChange={(e) => setDbConfig({ port: e.target.value })} spellCheck={false} />
            <input className="settings-input" placeholder="user" value={dbConfig.user} onChange={(e) => setDbConfig({ user: e.target.value })} spellCheck={false} />
            <input className="settings-input" type="password" placeholder="password" value={dbConfig.password} onChange={(e) => setDbConfig({ password: e.target.value })} spellCheck={false} />
            <input className="settings-input" placeholder="database" value={dbConfig.database} onChange={(e) => setDbConfig({ database: e.target.value })} spellCheck={false} />
            <div style={{ fontSize: 10.5, color: 'var(--c-text-3)', lineHeight: 1.5 }}>
              Потребуется пакет {sqlDialect === 'postgres' ? 'psycopg2' : 'pymysql'} (pip install).
            </div>
          </div>
        )}
      </div>

      <div className="settings-group">
        <div className="settings-group-title">{T('settings.layout')}</div>
        <button className="settings-btn" onClick={autoLayout}>{T('settings.autoLayout')}</button>
      </div>
    </div>
  );
}

function StatusBar() {
  const botStatus       = useStore((s) => s.botStatus);
  const syncEnabled     = useStore((s) => s.syncEnabled);
  const setSyncEnabled  = useStore((s) => s.setSyncEnabled);
  const currentFilePath = useStore((s) => s.currentFilePath);
  const hasUnsavedChanges = useStore((s) => s.hasUnsavedChanges);
  const isDark          = useStore((s) => s.isDark);
  const toggleTheme     = useStore((s) => s.toggleTheme);
  const lang            = useStore((s) => s.lang);
  const toggleLang      = useStore((s) => s.toggleLang);
  const dockReset       = useStore((s) => s.dockReset);
  const editorCursor    = useStore((s) => s.editorCursor);

  const requests = useStore((s) => s.requests);
  const runBot   = useStore((s) => s.runInfo?.bot);

  const fileName = currentFilePath
    ? currentFilePath.split(/[\/]/).pop()
    : 'Без имени';

  const statusLabel = botStatus === 'running' ? (runBot?.username ? `Запущен · @${runBot.username}` : 'Запущен')
    : botStatus === 'error' ? 'Ошибка'
    : 'Остановлен';
  const reqCount = requests.filter((r) => r.kind !== 'outgoing').length;
  const errCount = requests.filter((r) => r.status === 'error').length;

  const openRequests = () => useStore.getState().dockShowPanel('requests', 'bottom');

  return (
    <footer className="status-bar">
      <button className="status-item clickable" onClick={openRequests} title="Открыть «Запросы»">
        <span className={`status-dot status-dot--${botStatus}`} />
        {statusLabel}
      </button>
      {reqCount > 0 && (
        <button className="status-item clickable" onClick={openRequests} title="Запросы за этот запуск">
          {reqCount} {reqCount % 10 === 1 && reqCount % 100 !== 11 ? 'запрос' : (reqCount % 10 >= 2 && reqCount % 10 <= 4 && (reqCount % 100 < 12 || reqCount % 100 > 14)) ? 'запроса' : 'запросов'}
          {errCount > 0 && <span style={{ color: 'var(--err)' }}>· {errCount} с ошибкой</span>}
        </button>
      )}
      <button
        className="status-item clickable"
        onClick={() => setSyncEnabled(!syncEnabled)}
        title="Синхронизация кода и схемы"
      >
        <Icon name="sync" size={13} stroke={1.9} />
        {syncEnabled ? 'Синхронизация' : 'Синхронизация выкл.'}
      </button>
      <span className="status-spacer" />
      <span className="status-item" title={currentFilePath || ''}>
        {fileName}{hasUnsavedChanges ? ' •' : ''}
      </span>
      <span className="status-item" title="Положение курсора">
        Стр {editorCursor.line}, Кол {editorCursor.column}
      </span>
      <span className="status-item" title="Язык файла">
        {(editorCursor.language || 'python') === 'python' ? 'Python' : editorCursor.language}
      </span>
      <button className="status-item clickable" onClick={toggleLang} title="Язык интерфейса">
        {lang.toUpperCase()}
      </button>
      <button className="status-item clickable" onClick={toggleTheme} title="Сменить тему">
        <Icon name={isDark ? 'moon' : 'sun'} size={13} stroke={1.9} />
        {isDark ? 'Тёмная' : 'Светлая'}
      </button>
      <button
        className="status-item clickable"
        onClick={() => { if (confirm('Сбросить раскладку панелей?')) dockReset(); }}
        title="Сбросить раскладку панелей"
      >
        <Icon name="reset" size={13} stroke={1.9} />
      </button>
    </footer>
  );
}

function App() {
  const isDark               = useStore((s) => s.isDark);
  const nodes                = useStore((s) => s.nodes);
  const edges                = useStore((s) => s.edges);
  const onNodesChange        = useStore((s) => s.onNodesChange);
  const duplicateNodes       = useStore((s) => s.duplicateNodes);
  const undo                 = useStore((s) => s.undo);
  const botToken             = useStore((s) => s.botToken);
  const setBotToken          = useStore((s) => s.setBotToken);
  const isUserEditingCode    = useStore((s) => s.isUserEditingCode);
  const setCode              = useStore((s) => s.setCode);
  const setNodeLineMap       = useStore((s) => s.setNodeLineMap);
  const code                 = useStore((s) => s.code);
  const currentFilePath      = useStore((s) => s.currentFilePath);
  const hasUnsavedChanges    = useStore((s) => s.hasUnsavedChanges);
  const setHasUnsavedChanges = useStore((s) => s.setHasUnsavedChanges);
  const addLog               = useStore((s) => s.addLog);
  const setBotStatus         = useStore((s) => s.setBotStatus);
  const syncEnabled          = useStore((s) => s.syncEnabled);
  const setSyncEnabled       = useStore((s) => s.setSyncEnabled);
  const codeManuallyEdited   = useStore((s) => s.codeManuallyEdited);
  const setCodeManuallyEdited = useStore((s) => s.setCodeManuallyEdited);
  const loggingEnabled       = useStore((s) => s.loggingEnabled);
  const proxyEnabled         = useStore((s) => s.proxyEnabled);
  const proxyUrl             = useStore((s) => s.proxyUrl);
  const sqlDialect           = useStore((s) => s.sqlDialect);
  const dbConfig             = useStore((s) => s.dbConfig);
  const loadProject          = useStore((s) => s.loadProject);
  const _snapshot            = useStore((s) => s._snapshot);
  const setBotInfo           = useStore((s) => s.setBotInfo);

  const leftView                 = useStore((s) => s.leftView);
  const setLeftView              = useStore((s) => s.setLeftView);
  const projectModalOpen         = useStore((s) => s.projectModalOpen);
  const setProjectModalOpen      = useStore((s) => s.setProjectModalOpen);
  const openProjectFolder        = useStore((s) => s.openProjectFolder);
  const triggerExplorerCreate    = useStore((s) => s.triggerExplorerCreate);
  const closeExplorerFile        = useStore((s) => s.closeExplorerFile);
  const explorerActiveFile       = useStore((s) => s.explorerActiveFile);
  const setExplorerActiveFile    = useStore((s) => s.setExplorerActiveFile);
  const explorerOpenFiles        = useStore((s) => s.explorerOpenFiles);
  const explorerFolder           = useStore((s) => s.explorerFolder);
  const openExplorerFile         = useStore((s) => s.openExplorerFile);

  const panelConfig         = useStore((s) => s.panelConfig);
  const setPanelProp        = useStore((s) => s.setPanelProp);
  const moveFloatDrag       = useStore((s) => s.moveFloatDrag);
  const endFloatDrag        = useStore((s) => s.endFloatDrag);
  const toggleTheme         = useStore((s) => s.toggleTheme);
  const botEvent            = useStore((s) => s.botEvent);
  const setGenerated        = useStore((s) => s.setGenerated);

  const codeCfg    = panelConfig.code;
  const canvasCfg  = panelConfig.canvas;
  const chatCfg    = panelConfig.chat;
  const simCfg     = panelConfig.simulator;
  const termCfg    = panelConfig.terminal;

  const T = useT();

  const [page, setPage] = useState('main');

  const rightView    = useStore((s) => s.rightView);
  const setRightView = useStore((s) => s.setRightView);

  const [searchOpen, setSearchOpen] = useState(false);


  const [conflictPending, setConflictPending] = useState(false);

  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const pendingCodeRef = useRef(null);
  const suppressRegenRef = useRef(false);

  const clipboardRef = useRef([]);

  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    if (!syncEnabled) return;
    if (isUserEditingCode) return;
    if (suppressRegenRef.current) { suppressRegenRef.current = false; return; }

    const result = generateCode(nodes, edges, botToken, { loggingEnabled, proxyEnabled, proxyUrl, sqlDialect, dbConfig });
    const newCode = result?.code ?? result ?? '';
    if (result?.nodeLineMap) setNodeLineMap(result.nodeLineMap);
    setGenerated(newCode, result?.nodeLines);

    if (codeManuallyEdited) {
      pendingCodeRef.current = newCode;
      setConflictPending(true);
    } else {
      setCode(newCode);
    }
  }, [nodes, edges, botToken, loggingEnabled, proxyEnabled, proxyUrl, sqlDialect, dbConfig]); // eslint-disable-line

  useEffect(() => {
    if (isUserEditingCode) setCodeManuallyEdited(true);
  }, [isUserEditingCode]); // eslint-disable-line

  const applyCodeToGraph = useCallback(() => {
    const result = parseCodeToGraph(code);
    if (!result) {
      addLog('⚠ Не удалось разобрать код.', 'warn');
      return false;
    }
    _snapshot();
    suppressRegenRef.current = true;
    const resolvedToken = result.botToken ?? botToken;
    if (result.botToken && result.botToken !== botToken) setBotToken(result.botToken);
    loadProject({ nodes: result.nodes, edges: result.edges, code, botToken: resolvedToken });
    setSyncEnabled(false);
    setCodeManuallyEdited(false);
    return true;
  }, [code, botToken, setBotToken, _snapshot, loadProject, addLog, setCodeManuallyEdited, setSyncEnabled]);

  const applyCodeRef = useRef(applyCodeToGraph);
  applyCodeRef.current = applyCodeToGraph;
  useEffect(() => { window.__applyCodeToGraph = () => applyCodeRef.current(); }, []);

  const handleConflictApplyUML = () => {
    if (pendingCodeRef.current) setCode(pendingCodeRef.current);
    setCodeManuallyEdited(false);
    setConflictPending(false);
  };

  const handleConflictApplyCode = () => {
    applyCodeRef.current();
    setConflictPending(false);
  };

  const handleConflictKeepBoth = () => setConflictPending(false);

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    setHasUnsavedChanges(true);
  }, [nodes, edges, botToken]); // eslint-disable-line

  useEffect(() => {
    window.electron?.ipcRenderer.send('set-unsaved', hasUnsavedChanges);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const ipc = window.electron?.ipcRenderer;
    if (!ipc) return undefined;
    const offs = [
      ipc.on('bot-output', (text) => addLog(text, 'info')),
      ipc.on('bot-error',  (text) => addLog(text, 'error')),
      ipc.on('bot-event',  (ev) => botEvent(ev)),
      ipc.on('bot-stopped', (exitCode) => {
        if (exitCode && exitCode !== 0) {
          addLog(`Процесс бота завершился с кодом ${exitCode}`, 'error');
          toast.error(`Бот остановился с ошибкой (код ${exitCode})`);
        } else {
          addLog('Бот остановлен', 'system');
        }
        setBotStatus(exitCode && exitCode !== 0 ? 'error' : 'stopped');
      }),
      ipc.on('show-close-dialog', () => setShowCloseDialog(true)),
    ];
    return () => offs.forEach((off) => typeof off === 'function' && off());
  }, []); // eslint-disable-line

  useEffect(() => {
    const name = currentFilePath ? currentFilePath.split(/[\\/]/).pop() : 'Untitled';
    const marker = hasUnsavedChanges ? ' ●' : '';
    window.electron?.ipcRenderer.send('set-title', `TG Bot Builder — ${name}${marker}`);
  }, [currentFilePath, hasUnsavedChanges]);


  useEffect(() => {
    const offShortcut = window.electron?.ipcRenderer.on('shortcut', (name) => {
      if (name === 'close-tab') {
        const st = useStore.getState();
        if (st.explorerActiveFile) st.closeExplorerFile(st.explorerActiveFile);
      }
    });
    const onAppSave = () => window.dispatchEvent(new CustomEvent('app:trigger-save'));
    window.addEventListener('app:save', onAppSave);
    return () => {
      window.removeEventListener('app:save', onAppSave);
      if (typeof offShortcut === 'function') offShortcut();
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    const onKeyDown = (e) => {
      const ctrl  = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const code  = e.code;

      if (code === 'Escape') {
        if (codeCfg.fullscreen)    setPanelProp('code',    'fullscreen', false);
        if (canvasCfg.fullscreen)  setPanelProp('canvas',  'fullscreen', false);
        return;
      }

      if (!ctrl) return;

      const active   = document.activeElement;
      const tag      = active?.tagName;
      const inInput  = tag === 'INPUT' || tag === 'TEXTAREA' || active?.isContentEditable;
      const inMonaco = !!active?.closest?.('.monaco-editor');

      if (code === 'KeyF' && shift) {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }

      if (code === 'KeyN' && !shift && !inMonaco && !inInput) {
        e.preventDefault();
        const files = useStore.getState().explorerOpenFiles;
        const nums  = files
          .map((f) => { const m = f.name.match(/^untitled(\d+)\.txt$/i); return m ? +m[1] : 0; })
          .filter(Boolean);
        const n    = nums.length ? Math.max(...nums) + 1 : 1;
        const name = `untitled${n}.txt`;
        openExplorerFile({ path: `__untitled_${n}_${Date.now()}__`, name, content: '', modified: false, language: 'plaintext' });
        setPage('main');
        setLeftView('explorer');
        return;
      }

      if (code === 'KeyN' && shift && explorerFolder && !inMonaco && !inInput) {
        e.preventDefault();
        setPage('main'); setLeftView('explorer');
        triggerExplorerCreate('folder');
        return;
      }

      if (code === 'Tab') {
        const files = useStore.getState().explorerOpenFiles;
        if (files.length > 0) {
          e.preventDefault();
          const idx  = files.findIndex((f) => f.path === explorerActiveFile);
          const next = shift ? (idx - 1 + files.length) % files.length : (idx + 1) % files.length;
          setExplorerActiveFile(files[next].path);
          return;
        }
      }

      if (inMonaco || inInput) return;

      const getSelectedIds = () => {
        const rf = getFlowInstance();
        const rfIds = rf ? rf.getNodes().filter((n) => n.selected).map((n) => n.id) : [];
        if (rfIds.length) return rfIds;
        const storeIds = useStore.getState().nodes.filter((n) => n.selected).map((n) => n.id);
        if (storeIds.length) return storeIds;
        const sid = useStore.getState().selectedNodeId;
        return sid ? [sid] : [];
      };

      if (code === 'KeyZ' && !shift) {
        e.preventDefault();
        undo();
      } else if ((code === 'KeyZ' && shift) || code === 'KeyY') {
        e.preventDefault();
        useStore.getState().redo();
      } else if (code === 'KeyC') {
        const ids = getSelectedIds();
        if (ids.length) {
          e.preventDefault();
          clipboardRef.current = useStore.getState().nodes
            .filter((n) => ids.includes(n.id))
            .map((n) => JSON.parse(JSON.stringify(n)));
        }
      } else if (code === 'KeyV') {
        if (clipboardRef.current.length) {
          e.preventDefault();
          const allNodes = useStore.getState().nodes;
          const paste = clipboardRef.current.map((n) => ({
            ...n,
            id: `${n.type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            position: { x: n.position.x + 40, y: n.position.y + 40 },
            selected: true,
            data: JSON.parse(JSON.stringify(n.data)),
          }));
          onNodesChange(allNodes.map((n) => ({ type: 'select', id: n.id, selected: false })));
          onNodesChange(paste.map((n) => ({ type: 'add', item: n })));
        }
      } else if (code === 'KeyD') {
        const ids = getSelectedIds();
        if (ids.length) {
          e.preventDefault();
          duplicateNodes(ids);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [codeCfg.fullscreen, canvasCfg.fullscreen, setPanelProp, // eslint-disable-line
      undo, duplicateNodes, onNodesChange, openExplorerFile,
      explorerFolder, explorerActiveFile, triggerExplorerCreate, setExplorerActiveFile, setLeftView]);

  const dockLayout         = useStore((s) => s.dockLayout);
  const dockMovePanelFn    = useStore((s) => s.dockMovePanel);
  const dockSetActiveFn    = useStore((s) => s.dockSetActive);
  const dockSetSizeFn      = useStore((s) => s.dockSetSize);
  const dockShowPanelFn    = useStore((s) => s.dockShowPanel);
  const dockToggleCollapsedFn = useStore((s) => s.dockToggleCollapsed);

  const sidebarW    = dockLayout.sizes.left;
  const rightPanelW = dockLayout.sizes.right;
  const bottomH     = dockLayout.sizes.bottom;

  const [leftWidth, setLeftWidth] = useState(35);
  const draggingRef   = useRef(null);
  const editorsRowRef = useRef(null);
  const workspaceRef  = useRef(null);

  useEffect(() => { document.documentElement.classList.toggle('dark', isDark); }, [isDark]);

  useEffect(() => {
    const token = botToken?.trim();
    if (!token || !/^\d{8,12}:[A-Za-z0-9_-]{35,}$/.test(token)) {
      setBotInfo({ status: 'idle', username: '' });
      return;
    }
    setBotInfo({ status: 'checking', username: '' });
    const timer = setTimeout(async () => {
      try {
        const res  = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const json = await res.json();
        if (json.ok) {
          const name = json.result.username ? `@${json.result.username}` : json.result.first_name;
          setBotInfo({ status: 'valid', username: name });
        } else {
          setBotInfo({ status: 'invalid', username: '' });
        }
      } catch {
        setBotInfo({ status: 'invalid', username: '' });
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [botToken, setBotInfo]);

  useEffect(() => {
    const saved = parseFloat(localStorage.getItem('appZoom') || '0.85');
    window.electron?.setZoom?.(saved);

    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const current = window.electron?.getZoom?.() ?? 1;
      const next    = Math.min(2, Math.max(0.4, current - e.deltaY * 0.001));
      window.electron?.setZoom?.(next);
      localStorage.setItem('appZoom', next);
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  const onDividerMouseDown = useCallback((e) => {
    e.preventDefault();
    draggingRef.current = 'center';
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const onSidebarResizeDown = useCallback((e) => {
    e.preventDefault();
    draggingRef.current = 'sidebar';
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const onRightResizeDown = useCallback((e) => {
    e.preventDefault();
    draggingRef.current = 'right';
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const onMouseMove = useCallback((e) => {
    const what = draggingRef.current;
    if (what === 'center' && editorsRowRef.current) {
      const rect = editorsRowRef.current.getBoundingClientRect();
      setLeftWidth(Math.max(15, Math.min(80, ((e.clientX - rect.left) / rect.width) * 100)));
    } else if (what === 'sidebar' && workspaceRef.current) {
      const rect = workspaceRef.current.getBoundingClientRect();
      const newW = e.clientX - rect.left - 52;
      dockSetSizeFn('left', Math.max(200, Math.min(420, newW)));
    } else if (what === 'right' && workspaceRef.current) {
      const rect = workspaceRef.current.getBoundingClientRect();
      const newW = rect.right - e.clientX - 52;
      dockSetSizeFn('right', Math.max(240, Math.min(520, newW)));
    } else if (what === 'bottom' && workspaceRef.current) {
      const rect = workspaceRef.current.getBoundingClientRect();
      const newH = rect.bottom - e.clientY;
      dockSetSizeFn('bottom', Math.max(120, Math.min(rect.height - 170, newH)));
    }
    moveFloatDrag(e.clientX, e.clientY);
  }, [moveFloatDrag, dockSetSizeFn]);

  const onMouseUp = useCallback(() => {
    if (draggingRef.current) {
      draggingRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    endFloatDrag();
  }, [endFloatDrag]);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  useEffect(() => {
    window.__setAppPage = setPage;
  }, [setPage]);

  const codeInLayout   = codeCfg.visible    && !codeCfg.floating;
  const canvasInLayout = canvasCfg.visible  && !canvasCfg.floating;

  const showLeftSidebar  = (page === 'main' && !!leftView) || page === 'settings';
  const bottomCollapsed  = !!dockLayout.collapsed?.bottom;

  const panelChildren = {
    palette:    <BlockPalette />,
    explorer:   <FileExplorer />,
    properties: <NodeInspector />,
    simulator:  <TelegramSimulator />,
    variables:  <VariablesPanel />,
    analytics:  <AnalyticsPanel />,
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        dockShowPanelFn('terminal', 'bottom');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dockShowPanelFn]);

  const [paletteMode, setPaletteMode] = useState(null);
  useEffect(() => {
    const onKey = (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      if (e.shiftKey && (e.code === 'KeyP' || e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        setPaletteMode('commands');
      }
      else if (!e.shiftKey && (e.code === 'KeyP' || e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        setPaletteMode('files');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const selectedNodeId = useStore((s) => s.selectedNodeId);
  useEffect(() => {
    if (selectedNodeId) setRightView('properties');
  }, [selectedNodeId]); // eslint-disable-line

  const startupRef = useRef(false);
  useEffect(() => {
    if (startupRef.current) return;
    startupRef.current = true;
    let last = null;
    try { last = localStorage.getItem('lastProject'); } catch { }
    if (last) openProjectFolder(last);
    else setProjectModalOpen(true);
  }, [openProjectFolder, setProjectModalOpen]);

  return (
    <div className="app">
      <Toolbar />

      <div className="workspace" ref={workspaceRef}>
        <nav className="activity-bar">
          <div className="activity-bar__group">
            <ActivityIcon view="palette" page={page} setPage={setPage} title="Блоки">
              <Icon name="blocks" size={18} />
            </ActivityIcon>
            <ActivityIcon view="explorer" page={page} setPage={setPage} title="Файлы проекта">
              <Icon name="files" size={18} />
            </ActivityIcon>
            <button className="activity-icon" onClick={() => setSearchOpen(true)} title="Поиск по проекту (Ctrl+Shift+F)">
              <Icon name="search" size={18} />
            </button>
          </div>

          <div className="activity-bar__spacer" />

          <div className="activity-bar__group">
            <button
              className={`activity-icon${page === 'ide' ? ' active' : ''}`}
              onClick={() => setPage(page === 'ide' ? 'main' : 'ide')}
              title="Block IDE — свои блоки"
            >
              <Icon name="code" size={18} />
            </button>
            <button
              className={`activity-icon${page === 'settings' ? ' active' : ''}`}
              onClick={() => setPage(page === 'settings' ? 'main' : 'settings')}
              title="Настройки"
            >
              <Icon name="gear" size={18} />
            </button>
          </div>
        </nav>

        {showLeftSidebar && (
          <>
            <aside className="left-sidebar island glass" style={{ width: sidebarW }}>
              {page === 'main' && leftView && (
                <div className="left-view">{panelChildren[leftView]}</div>
              )}
              {page === 'settings' && (
                <>
                  <div className="sidebar-section-title">Настройки</div>
                  <SettingsSidebar />
                </>
              )}
            </aside>
            <div className="sidebar-resize-handle" onMouseDown={onSidebarResizeDown} />
          </>
        )}

        <div className="editor-area">
          {page === 'ide' && (
            <div className="inline-page island glass">
              <BlockIDE onBack={() => setPage('main')} />
            </div>
          )}

          {(page === 'main' || page === 'settings') && <>
          <div className="editors-row" ref={editorsRowRef}>
            {codeInLayout && (
              <div
                className={`code-panel island glass${codeCfg.fullscreen ? ' panel--fullscreen' : ''}`}
                style={!codeCfg.fullscreen ? (canvasInLayout ? { width: `${leftWidth}%` } : { flex: 1 }) : undefined}
              >
                <CodeEditor />
              </div>
            )}

            {codeInLayout && canvasInLayout && !codeCfg.fullscreen && !canvasCfg.fullscreen && (
              <div className="divider" onMouseDown={onDividerMouseDown} />
            )}

            {canvasInLayout && (
              <div className={`canvas-panel${canvasCfg.fullscreen ? ' panel--fullscreen' : ''}`}>
                <FlowCanvas />
              </div>
            )}

            {!codeInLayout && !canvasInLayout && (
              <div className="canvas-panel right-panel-empty">
                <Icon name="split" size={28} stroke={1.4} />
                <div className="right-panel-empty-text">Код и схема скрыты — включите их переключателем вверху</div>
              </div>
            )}
          </div>

          <div
            className={`bottom-panel island glass${bottomCollapsed ? ' is-collapsed' : ''}`}
            style={{ height: bottomH }}
          >
            {!bottomCollapsed && (
              <div
                className="bottom-resize-handle"
                onMouseDown={(e) => {
                  e.preventDefault();
                  draggingRef.current = 'bottom';
                  document.body.style.cursor = 'row-resize';
                  document.body.style.userSelect = 'none';
                }}
              />
            )}
            <BottomPanel
              active={dockLayout.activeTab.bottom === 'terminal' ? 'terminal' : 'requests'}
              onActive={(id) => dockSetActiveFn('bottom', id)}
              collapsed={bottomCollapsed}
              onToggleCollapsed={() => dockToggleCollapsedFn('bottom')}
            />
          </div>
          </>}
        </div>

        {(page === 'main' || page === 'settings') && rightView && (
          <>
            <div className="right-resize-handle" onMouseDown={onRightResizeDown} />
            <aside className="right-panel island glass" style={{ width: rightPanelW }}>
              <div className="right-view">{panelChildren[rightView]}</div>
            </aside>
          </>
        )}

        {(page === 'main' || page === 'settings') && (
          <nav className="activity-bar activity-bar--right">
            <div className="activity-bar__group">
              <RightIcon view="properties" page={page} setPage={setPage} title="Свойства блока"><Icon name="sliders" size={18} /></RightIcon>
              <RightIcon view="simulator"  page={page} setPage={setPage} title="Симулятор"><Icon name="phone" size={18} /></RightIcon>
              <RightIcon view="variables"  page={page} setPage={setPage} title="Переменные"><Icon name="braces" size={18} /></RightIcon>
              <RightIcon view="analytics"  page={page} setPage={setPage} title="Аналитика"><Icon name="stats" size={18} /></RightIcon>
            </div>
            <div className="activity-bar__spacer" />
            <div className="activity-bar__group">
              <button className="activity-icon" onClick={toggleTheme} title={isDark ? 'Светлая тема' : 'Тёмная тема'}>
                <Icon name={isDark ? 'sun' : 'moon'} size={18} />
              </button>
            </div>
          </nav>
        )}
      </div>

      <StatusBar />

      {codeCfg.visible && codeCfg.floating && (
        <div
          className={`panel-floating${codeCfg.fullscreen ? ' panel--fullscreen' : ''}`}
          style={!codeCfg.fullscreen ? {
            left: codeCfg.floatX, top: codeCfg.floatY,
            width: codeCfg.floatW, height: codeCfg.floatH,
          } : undefined}
        >
          <CodeEditor />
        </div>
      )}

      {canvasCfg.visible && canvasCfg.floating && (
        <div
          className={`panel-floating${canvasCfg.fullscreen ? ' panel--fullscreen' : ''}`}
          style={!canvasCfg.fullscreen ? {
            left: canvasCfg.floatX, top: canvasCfg.floatY,
            width: canvasCfg.floatW, height: canvasCfg.floatH,
          } : undefined}
        >
          <FlowCanvas />
        </div>
      )}

      {paletteMode && (
        <CommandPalette mode={paletteMode} onClose={() => setPaletteMode(null)} />
      )}

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}

      {projectModalOpen && (
        <ProjectModal
          onClose={() => setProjectModalOpen(false)}
          canClose={!!explorerFolder}
        />
      )}

      <ToastHost />

      {conflictPending && (
        <ConflictDialog
          onApplyUML={handleConflictApplyUML}
          onApplyCode={handleConflictApplyCode}
          onKeepBoth={handleConflictKeepBoth}
          onCancel={handleConflictKeepBoth}
        />
      )}

      {showCloseDialog && (
        <CloseDialog
          onSave={() => {
            setShowCloseDialog(false);
            window.electron?.ipcRenderer.send('close-dialog-response', 'save');
          }}
          onDiscard={() => {
            setShowCloseDialog(false);
            window.electron?.ipcRenderer.send('close-dialog-response', 'discard');
          }}
          onCancel={() => {
            setShowCloseDialog(false);
            window.electron?.ipcRenderer.send('close-dialog-response', 'cancel');
          }}
        />
      )}
    </div>
  );
}

export default App;
