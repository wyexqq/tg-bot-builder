import { useState } from 'react';
import useStore from '../store/useStore';
import './ProjectModal.css';

const sepOf = (p) => (p.includes('\\') ? '\\' : '/');
const join = (base, name) => base.replace(/[\\/]+$/, '') + sepOf(base) + name;
const baseName = (p) => p.split(/[\\/]/).filter(Boolean).pop() || p;

const STARTER_BOT = `import asyncio
from aiogram import Bot, Dispatcher
from aiogram.filters import Command
from aiogram.types import Message

BOT_TOKEN = ""  # вставьте токен или используйте .env
dp = Dispatcher()


@dp.message(Command("start"))
async def cmd_start(message: Message):
    await message.answer("Привет! Я новый бот 🤖")


async def main():
    bot = Bot(token=BOT_TOKEN)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
`;

const GITIGNORE = `__pycache__/
*.pyc
.env
bot.db
.venv/
`;

export default function ProjectModal({ onClose, canClose = true }) {
  const recent              = useStore((s) => s.recentProjects);
  const openProjectFolder   = useStore((s) => s.openProjectFolder);
  const removeRecentProject = useStore((s) => s.removeRecentProject);

  const api = window.electron?.ipcRenderer;

  const [tab, setTab]       = useState(recent.length ? 'recent' : 'new');
  const [name, setName]     = useState('my-bot');
  const [parent, setParent] = useState('');
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState('');

  const pickParent = async () => {
    const p = await api?.invoke('fs:open-folder');
    if (p) setParent(p);
  };

  const createProject = async () => {
    setError('');
    const clean = name.trim().replace(/[<>:"/\\|?*]/g, '');
    if (!clean) { setError('Введите название проекта'); return; }
    if (!parent) { setError('Выберите расположение'); return; }
    setBusy(true);
    const dir = join(parent, clean);
    const mk = await api?.invoke('fs:create-folder', dir);
    if (!mk?.ok) { setBusy(false); setError('Не удалось создать папку'); return; }
    await api?.invoke('fs:create-file', join(dir, 'bot.py'));
    await api?.invoke('fs:write-file', { filePath: join(dir, 'bot.py'), content: STARTER_BOT });
    await api?.invoke('fs:create-file', join(dir, 'requirements.txt'));
    await api?.invoke('fs:write-file', { filePath: join(dir, 'requirements.txt'), content: 'aiogram>=3.0\n' });
    await api?.invoke('fs:create-file', join(dir, '.gitignore'));
    await api?.invoke('fs:write-file', { filePath: join(dir, '.gitignore'), content: GITIGNORE });
    setBusy(false);
    openProjectFolder(dir);
  };

  const openExisting = async () => {
    const p = await api?.invoke('fs:open-folder');
    if (p) openProjectFolder(p);
  };

  return (
    <div className="pm-overlay" onMouseDown={() => canClose && onClose?.()}>
      <div className="pm-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pm-head">
          <div className="pm-brand"><span className="pm-brand__mark">TG</span> Bot IDE</div>
          {canClose && <button className="pm-close" onClick={onClose}>×</button>}
        </div>

        <div className="pm-tabs">
          <button className={`pm-tab${tab === 'recent' ? ' active' : ''}`} onClick={() => setTab('recent')}>Недавние</button>
          <button className={`pm-tab${tab === 'new' ? ' active' : ''}`}    onClick={() => setTab('new')}>Создать</button>
          <button className={`pm-tab${tab === 'open' ? ' active' : ''}`}   onClick={() => setTab('open')}>Открыть</button>
        </div>

        <div className="pm-body">
          {tab === 'recent' && (
            <div className="pm-recent">
              {recent.length === 0 && <div className="pm-empty">Нет недавних проектов</div>}
              {recent.map((p) => (
                <div key={p} className="pm-recent-row" onClick={() => openProjectFolder(p)} title={p}>
                  <div className="pm-recent-info">
                    <span className="pm-recent-name">{baseName(p)}</span>
                    <span className="pm-recent-path">{p}</span>
                  </div>
                  <button
                    className="pm-recent-x"
                    title="Убрать из списка"
                    onClick={(e) => { e.stopPropagation(); removeRecentProject(p); }}
                  >×</button>
                </div>
              ))}
            </div>
          )}

          {tab === 'new' && (
            <div className="pm-form">
              <label className="pm-label">Название проекта</label>
              <input className="pm-input" value={name} onChange={(e) => setName(e.target.value)} spellCheck={false} autoFocus />

              <label className="pm-label">Расположение</label>
              <div className="pm-path-row">
                <input className="pm-input" value={parent} placeholder="Выберите папку…" readOnly />
                <button className="pm-btn" onClick={pickParent}>Обзор…</button>
              </div>
              {parent && name.trim() && (
                <div className="pm-preview">Будет создано: <code>{join(parent, name.trim())}</code></div>
              )}
              {error && <div className="pm-error">{error}</div>}
              <button className="pm-btn pm-btn--primary pm-create" onClick={createProject} disabled={busy}>
                {busy ? 'Создание…' : 'Создать проект'}
              </button>
            </div>
          )}

          {tab === 'open' && (
            <div className="pm-form pm-open">
              <p className="pm-open-hint">Откройте существующую папку как проект.</p>
              <button className="pm-btn pm-btn--primary" onClick={openExisting}>Выбрать папку…</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
