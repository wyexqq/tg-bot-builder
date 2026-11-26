import { useEffect, useRef, useState, useMemo } from 'react';
import useStore from '../store/useStore';
import './CommandPalette.css';

function fuzzyMatch(query, target) {
  if (!query) return { score: 1, positions: [] };
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  const positions = [];
  let qi = 0;
  let consecutive = 0;
  let score = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      positions.push(ti);
      qi++;
      consecutive++;
      const isStart = ti === 0;
      const isBoundary = ti > 0 && /[\s/\\._-]/.test(t[ti - 1]);
      score += 1 + (isStart ? 5 : 0) + (isBoundary ? 3 : 0) + consecutive;
    } else {
      consecutive = 0;
    }
  }
  if (qi < q.length) return { score: 0, positions: [] };
  score -= (t.length - positions.length) * 0.05;
  return { score, positions };
}

function HighlightedText({ text, positions }) {
  if (!positions.length) return text;
  const parts = [];
  let last = 0;
  for (const pos of positions) {
    if (pos > last) parts.push(<span key={`p${last}`}>{text.slice(last, pos)}</span>);
    parts.push(<mark key={`m${pos}`}>{text[pos]}</mark>);
    last = pos + 1;
  }
  if (last < text.length) parts.push(<span key={`tail`}>{text.slice(last)}</span>);
  return parts;
}

export default function CommandPalette({ mode, onClose }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef  = useRef(null);
  const [fileResults, setFileResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const explorerFolder    = useStore((s) => s.explorerFolder);
  const explorerOpenFiles = useStore((s) => s.explorerOpenFiles);

  const commands = useCommands(onClose);

  const items = mode === 'commands' ? commands : fileResults;

  useEffect(() => {
    if (mode !== 'files') return;
    let cancel = false;
    (async () => {
      const open = explorerOpenFiles.map((f) => ({
        kind: 'file',
        title: f.name,
        subtitle: f.path,
        path: f.path,
        action: () => {
          useStore.getState().setExplorerActiveFile(f.path);
          onClose();
        },
      }));
      if (!explorerFolder) {
        if (!cancel) setFileResults(open);
        return;
      }
      setLoading(true);
      const files = [];
      const walk = async (dir, depth) => {
        if (depth > 5 || files.length >= 500) return;
        const entries = await window.electron?.ipcRenderer.invoke('fs:read-dir', dir);
        if (!entries) return;
        for (const e of entries) {
          if (cancel) return;
          if (e.type === 'folder') {
            await walk(e.path, depth + 1);
          } else {
            files.push({
              kind: 'file',
              title: e.name,
              subtitle: e.path.replace(explorerFolder + '\\', '').replace(explorerFolder + '/', ''),
              path: e.path,
              action: () => {
                useStore.getState().openExplorerFileFromPath?.(e.path)
                  || (async () => {
                    const res = await window.electron?.ipcRenderer.invoke('fs:read-file', e.path);
                    if (res?.ok) {
                      const lang = (e.name.endsWith('.py') ? 'python'
                                  : e.name.endsWith('.json') ? 'json'
                                  : e.name.endsWith('.md') ? 'markdown'
                                  : 'plaintext');
                      useStore.getState().openExplorerFile({
                        path: e.path, name: e.name, content: res.content,
                        modified: false, language: lang,
                      });
                    }
                  })();
                onClose();
              },
            });
          }
        }
      };
      await walk(explorerFolder, 0);
      if (!cancel) {
        const seen = new Set(open.map((f) => f.path));
        const merged = [...open, ...files.filter((f) => !seen.has(f.path))];
        setFileResults(merged);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [mode, explorerFolder]); // eslint-disable-line

  const filtered = useMemo(() => {
    if (!query) return items.slice(0, 50);
    return items
      .map((it) => {
        const titleMatch = fuzzyMatch(query, it.title);
        const subMatch   = it.subtitle ? fuzzyMatch(query, it.subtitle) : { score: 0, positions: [] };
        const score = Math.max(titleMatch.score, subMatch.score * 0.5);
        return { ...it, _score: score, _titlePos: titleMatch.positions, _subPos: subMatch.positions };
      })
      .filter((it) => it._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 50);
  }, [query, items]);

  useEffect(() => { setActive(0); }, [query, mode]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`.cp-item[data-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(filtered.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const it = filtered[active];
      if (it?.action) it.action();
    }
  };

  return (
    <div className="cp-backdrop" onClick={onClose}>
      <div className="cp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cp-header">
          <span className="cp-mode-tag">{mode === 'commands' ? '>' : '~'}</span>
          <input
            ref={inputRef}
            className="cp-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder={mode === 'commands'
              ? 'Введите команду...'
              : 'Имя файла или путь...'}
            spellCheck={false}
          />
        </div>

        <div className="cp-list" ref={listRef}>
          {loading && <div className="cp-empty">Загрузка...</div>}
          {!loading && filtered.length === 0 && (
            <div className="cp-empty">Ничего не найдено</div>
          )}
          {filtered.map((it, idx) => (
            <div key={it.id || it.path || `${idx}-${it.title}`}
                 className={`cp-item${idx === active ? ' cp-active' : ''}`}
                 data-idx={idx}
                 onClick={() => it.action?.()}
                 onMouseEnter={() => setActive(idx)}>
              {it.icon && <span className="cp-icon">{it.icon}</span>}
              <div className="cp-text">
                <div className="cp-title">
                  <HighlightedText text={it.title} positions={it._titlePos || []} />
                </div>
                {it.subtitle && (
                  <div className="cp-subtitle">
                    <HighlightedText text={it.subtitle} positions={it._subPos || []} />
                  </div>
                )}
              </div>
              {it.shortcut && <span className="cp-shortcut">{it.shortcut}</span>}
            </div>
          ))}
        </div>

        <div className="cp-footer">
          <span>↑↓ навигация</span>
          <span>↵ выбрать</span>
          <span>esc отмена</span>
        </div>
      </div>
    </div>
  );
}

function useCommands(onClose) {
  const ipc = window.electron?.ipcRenderer;
  return useMemo(() => {
    const exec = (fn) => () => { fn?.(); onClose(); };
    const st = () => useStore.getState();

    return [
      { id: 'bot.start', title: 'Бот: Запустить', subtitle: 'Запустить сгенерированный код Python', icon: '▶', shortcut: 'F5',
        action: exec(() => { ipc?.invoke('start-bot', { code: st().code }); st().setBotStatus('running'); }) },
      { id: 'bot.stop', title: 'Бот: Остановить', subtitle: 'Завершить процесс бота', icon: '■', shortcut: 'Shift+F5',
        action: exec(() => ipc?.send('stop-bot')) },

      { id: 'file.save', title: 'Файл: Сохранить', subtitle: 'Сохранить активный файл', icon: '💾', shortcut: 'Ctrl+S',
        action: exec(() => window.dispatchEvent(new CustomEvent('app:save'))) },
      { id: 'file.open', title: 'Файл: Открыть проект', subtitle: 'Открыть .tgbot файл', icon: '📂', shortcut: 'Ctrl+O',
        action: exec(async () => {
          const r = await ipc?.invoke('open-project');
          if (r?.success) st().loadProject(r.data);
        }) },
      { id: 'file.export', title: 'Файл: Экспорт', subtitle: 'Экспортировать в папку', icon: '📤',
        action: exec(() => ipc?.invoke('export-project', { code: st().code })) },

      { id: 'view.terminal',  title: 'Вид: Терминал',     subtitle: 'Показать панель терминала', icon: '⌨', shortcut: 'Ctrl+`',
        action: exec(() => st().dockShowPanel('terminal', 'bottom')) },
      { id: 'view.console',   title: 'Вид: Консоль',      subtitle: 'Логи бота',                 icon: '📋',
        action: exec(() => st().dockShowPanel('console', 'bottom')) },
      { id: 'view.explorer',  title: 'Вид: Проводник',    subtitle: 'Файлы проекта',             icon: '📁',
        action: exec(() => st().setLeftView('explorer')) },
      { id: 'view.search',    title: 'Вид: Поиск',        subtitle: 'Поиск по проекту',          icon: '🔍', shortcut: 'Ctrl+Shift+F',
        action: exec(() => st().setLeftView('search')) },
      { id: 'view.workspace', title: 'Вид: Воркспейс',    subtitle: 'Несколько папок',           icon: '🗂',
        action: exec(() => st().setLeftView('workspace')) },
      { id: 'view.palette',   title: 'Вид: Блоки',        subtitle: 'Палитра блоков',            icon: '◫',
        action: exec(() => st().setLeftView('palette')) },
      { id: 'view.props',     title: 'Вид: Свойства',     subtitle: 'Свойства выделенного блока', icon: 'ℹ',
        action: exec(() => st().dockShowPanel('properties', 'right')) },
      { id: 'view.simulator', title: 'Вид: Симулятор',    subtitle: 'Тестирование бота',         icon: '📱',
        action: exec(() => st().dockShowPanel('simulator', 'right')) },
      { id: 'view.variables', title: 'Вид: Переменные',   subtitle: 'Состояние бота',            icon: '𝑥',
        action: exec(() => st().dockShowPanel('variables', 'right')) },
      { id: 'view.analytics', title: 'Вид: Аналитика',    subtitle: 'Статистика',                icon: '📊',
        action: exec(() => st().dockShowPanel('analytics', 'right')) },

      { id: 'layout.reset',   title: 'Раскладка: Сбросить', subtitle: 'Вернуть панели в дефолт', icon: '⟲',
        action: exec(() => { if (confirm('Сбросить раскладку?')) st().dockReset(); }) },

      { id: 'theme.toggle',   title: 'Тема: Переключить', subtitle: 'Светлая ↔ Тёмная',          icon: '◐',
        action: exec(() => st().toggleTheme()) },
      { id: 'lang.toggle',    title: 'Язык: Переключить', subtitle: 'Русский ↔ English',         icon: '🌐',
        action: exec(() => st().toggleLang()) },

      { id: 'edit.undo',      title: 'Правка: Отменить',  subtitle: 'Откат последнего действия', icon: '↶', shortcut: 'Ctrl+Z',
        action: exec(() => st().undo()) },
      { id: 'edit.redo',      title: 'Правка: Повторить', subtitle: 'Повторить отменённое',      icon: '↷', shortcut: 'Ctrl+Y',
        action: exec(() => st().redo()) },

      { id: 'sync.toggle',    title: 'Синхронизация: Переключить', subtitle: 'UML ↔ Код', icon: '⇄',
        action: exec(() => st().setSyncEnabled(!st().syncEnabled)) },
      { id: 'sync.apply',     title: 'Применить код к холсту', subtitle: 'Распарсить и обновить блоки', icon: '⇒',
        action: exec(() => window.__applyCodeToGraph?.()) },
    ];
  }, [ipc, onClose]);
}
