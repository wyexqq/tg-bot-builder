import { useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import useStore from '../store/useStore';
import EditorTabs from './EditorTabs';
import { useT } from '../i18n';
import { registerPythonIntelliSense } from '../pythonIntelliSense';
import Breadcrumbs from './Breadcrumbs';
import { toast } from './ToastHost';
import { Icon } from './Icons';
import { monacoTheme } from '../monacoSetup';
import './CodeEditor.css';

export default function CodeEditor() {
  const code                   = useStore((s) => s.code);
  const setCode                = useStore((s) => s.setCode);
  const isDark                 = useStore((s) => s.isDark);
  const setIsUserEditingCode   = useStore((s) => s.setIsUserEditingCode);
  const syncEnabled            = useStore((s) => s.syncEnabled);
  const setSyncEnabled         = useStore((s) => s.setSyncEnabled);
  const codeManuallyEdited     = useStore((s) => s.codeManuallyEdited);
  const setCodeManuallyEdited  = useStore((s) => s.setCodeManuallyEdited);

  const explorerOpenFiles       = useStore((s) => s.explorerOpenFiles);
  const explorerActiveFile      = useStore((s) => s.explorerActiveFile);
  const updateFileContent       = useStore((s) => s.updateExplorerFileContent);
  const markFileSaved           = useStore((s) => s.markExplorerFileSaved);

  const panelConfig    = useStore((s) => s.panelConfig);
  const setPanelProp   = useStore((s) => s.setPanelProp);
  const startFloatDrag = useStore((s) => s.startFloatDrag);
  const codeCfg        = panelConfig.code;

  const T    = useT();
  const lang = useStore((s) => s.lang);

  const activeFileData = explorerOpenFiles.find((f) => f.path === explorerActiveFile) ?? null;
  const isFileMode     = !!activeFileData;

  const editorValue    = isFileMode ? activeFileData.content   : code;
  const editorLanguage = isFileMode ? activeFileData.language  : 'python';

  const saveFileRef = useRef(null);
  saveFileRef.current = async () => {
    const { explorerActiveFile: path, explorerOpenFiles: files, markExplorerFileSaved } = useStore.getState();
    if (!path) return;
    const file = files.find((f) => f.path === path);
    if (!file) return;
    const res = await window.electron?.ipcRenderer.invoke('fs:write-file', {
      filePath: file.path,
      content: file.content,
    });
    if (res?.ok) {
      markExplorerFileSaved(file.path);
      toast.success(`Сохранено: ${file.name}`);
    } else if (res?.error) {
      toast.error(`Ошибка сохранения: ${res.error}`);
    }
  };

  const editorRef = useRef(null);
  const setEditorCursor = useStore((s) => s.setEditorCursor);

  const handleEditorMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    registerPythonIntelliSense(monaco);

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveFileRef.current?.();
    });

    const updateCursor = () => {
      const pos = editor.getPosition();
      if (!pos) return;
      const { explorerActiveFile, explorerOpenFiles } = useStore.getState();
      const af = explorerOpenFiles.find((f) => f.path === explorerActiveFile);
      setEditorCursor({
        line: pos.lineNumber,
        column: pos.column,
        filePath: af?.path ?? null,
        language: af?.language ?? 'python',
      });
    };
    updateCursor();
    editor.onDidChangeCursorPosition(updateCursor);

    const handler = (evt) => {
      const { line, filePath } = evt.detail ?? {};
      const { explorerActiveFile: af } = useStore.getState();
      if (filePath && af !== filePath) return;
      if (line) {
        editor.revealLineInCenter(line);
        editor.setPosition({ lineNumber: line, column: 1 });
        editor.focus();
      }
    };
    window.addEventListener('monaco-goto-line', handler);
    editor.onDidDispose(() => window.removeEventListener('monaco-goto-line', handler));
  }, []);

  const handleApplyCode = () => {
    const ok = window.__applyCodeToGraph?.();
    if (ok) setCodeManuallyEdited(false);
  };

  const onHeaderMouseDown = (e) => {
    if (e.button !== 0 || !codeCfg.floating) return;
    e.stopPropagation();
    startFloatDrag('code', e.clientX, e.clientY);
  };

  const handleChange = (value) => {
    if (isFileMode) {
      updateFileContent(activeFileData.path, value ?? '');
    } else {
      setCode(value ?? '');
      setIsUserEditingCode(true);
      setCodeManuallyEdited(true);
    }
  };

  const toggleFullscreen = () => setPanelProp('code', 'fullscreen', !codeCfg.fullscreen);

  return (
    <div className="code-editor">
      <div
        className="ce-head"
        onMouseDown={onHeaderMouseDown}
        style={codeCfg.floating ? { cursor: 'move' } : undefined}
      >
        <EditorTabs />
        <div className="ce-tools" onMouseDown={(e) => e.stopPropagation()}>
          {!isFileMode ? (
            <>
              <button
                className="ce-sync"
                onClick={() => setSyncEnabled(!syncEnabled)}
                title={syncEnabled ? T('code.sync.on') : T('code.sync.off')}
              >
                <span>{lang === 'en' ? 'Sync' : 'Синхр.'}</span>
                <span className={`sw${syncEnabled ? ' on' : ''}`} />
              </button>
              {(codeManuallyEdited || !syncEnabled) && (
                <button className="ce-apply" onClick={handleApplyCode} title={T('code.toCanvas.title')}>
                  <Icon name="flow" size={13} stroke={2} />
                  {T('code.toCanvas')}
                </button>
              )}
            </>
          ) : (
            <button
              className={`ce-apply${activeFileData.modified ? '' : ' ce-apply--quiet'}`}
              onClick={() => saveFileRef.current?.()}
              title="Сохранить файл (Ctrl+S)"
            >
              <Icon name="save" size={13} stroke={2} />
              {lang === 'en' ? 'Save' : 'Сохранить'}
            </button>
          )}
          {codeCfg.floating && (
            <button className="ib2" onClick={() => setPanelProp('code', 'floating', false)} title={T('panel.dock')}>
              <Icon name="layout" size={14} />
            </button>
          )}
          <button
            className="ib2"
            onClick={toggleFullscreen}
            title={codeCfg.fullscreen ? T('panel.restore') : T('panel.fullscreen')}
          >
            <Icon name={codeCfg.fullscreen ? 'minimize' : 'maximize'} size={14} />
          </button>
        </div>
      </div>

      {isFileMode && <Breadcrumbs />}

      <div className="editor-wrap">
        <Editor
          key={isFileMode ? activeFileData.path : '__bot_code__'}
          language={editorLanguage}
          value={editorValue}
          onChange={handleChange}
          onMount={handleEditorMount}
          theme={monacoTheme(isDark)}
          options={{
            fontSize: 13,
            lineHeight: 20,
            minimap: { enabled: false },
            glyphMargin: false,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            lineNumbers: 'on',
            renderLineHighlight: 'line',
            fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
            fontLigatures: true,
            tabSize: 4,
            insertSpaces: true,
            automaticLayout: true,
            padding: { top: 10, bottom: 10 },
            lineNumbersMinChars: 3,
            lineDecorationsWidth: 10,
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            guides: { indentation: true },
            scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
            quickSuggestions: { other: true, comments: false, strings: false },
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            tabCompletion: 'on',
            parameterHints: { enabled: true, cycle: true },
            suggest: { showKeywords: true, showSnippets: true, showFunctions: true },
            wordBasedSuggestions: 'currentDocument',
          }}
          loading={<div className="editor-loading">Загрузка редактора...</div>}
        />
      </div>
    </div>
  );
}
