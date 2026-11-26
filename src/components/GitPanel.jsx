import { useEffect, useState, useCallback } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import useStore from '../store/useStore';
import { toast } from './ToastHost';
import './GitPanel.css';

const GITHUB_CLIENT_ID = 'Ov23liqu3Xz9tFqaLztG';

function repoNameFromUrl(url) {
  if (!url) return '';
  const m = url.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
  return m ? m[1] : url;
}

export default function GitPanel() {
  const folder = useStore((s) => s.explorerFolder);
  const isDark = useStore((s) => s.isDark);

  const [isRepo, setIsRepo]   = useState(null);
  const [files, setFiles]     = useState([]);
  const [selectedFile, setSelected] = useState(null);
  const [diff, setDiff]       = useState({ original: '', modified: '' });
  const [commitMsg, setCommitMsg] = useState('');
  const [branches, setBranches] = useState([]);
  const [log, setLog]         = useState([]);
  const [view, setView]       = useState('changes');
  const [busy, setBusy]       = useState(false);
  const [remoteUrl, setRemoteUrl] = useState('');

  const [token, setToken] = useState(() => { try { return localStorage.getItem('githubToken') || ''; } catch { return ''; } });
  const [me, setMe]       = useState(null);
  const [oauth, setOauth] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualVal, setManualVal]   = useState('');

  const [picker, setPicker]   = useState(false);
  const [repos, setRepos]     = useState(null);
  const [repoQuery, setRepoQuery] = useState('');
  const [copied, setCopied]   = useState(false);

  const copyCode = (code) => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const ipc = window.electron?.ipcRenderer;

  const saveToken = (v) => {
    setToken(v);
    try { v ? localStorage.setItem('githubToken', v) : localStorage.removeItem('githubToken'); } catch { }
    if (!v) { setMe(null); setRepos(null); }
  };

  const refresh = useCallback(async () => {
    if (!folder || !ipc) return;
    const repo = await ipc.invoke('git:is-repo', folder);
    setIsRepo(repo.isRepo);
    if (!repo.isRepo) { setFiles([]); setBranches([]); setLog([]); setRemoteUrl(''); return; }
    const [s, b, l, rem] = await Promise.all([
      ipc.invoke('git:status', folder),
      ipc.invoke('git:branches', folder),
      ipc.invoke('git:log', { cwd: folder, limit: 30 }),
      ipc.invoke('git:get-remote', folder),
    ]);
    setFiles(s.files || []); setBranches(b.branches || []); setLog(l.commits || []); setRemoteUrl(rem.url || '');
  }, [folder, ipc]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!folder) return;
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [folder, refresh]);

  useEffect(() => {
    if (!token || !ipc) { setMe(null); return; }
    ipc.invoke('github:me', { token }).then((r) => { if (r?.ok) setMe(r); });
  }, [token, ipc]);

  useEffect(() => {
    if (!selectedFile || !folder || !ipc) { setDiff({ original: '', modified: '' }); return; }
    let cancel = false;
    ipc.invoke('git:diff', { cwd: folder, filePath: selectedFile.path }).then((res) => {
      if (!cancel && res.ok) setDiff({ original: res.original || '', modified: res.modified || '' });
    });
    return () => { cancel = true; };
  }, [selectedFile, folder, ipc]);

  const run = async (fn, okMsg) => {
    setBusy(true);
    try { const r = await fn(); if (okMsg && r?.ok !== false) toast.success(okMsg); return r; }
    finally { setBusy(false); refresh(); }
  };
  const doStage    = (f) => run(() => ipc.invoke('git:stage',   { cwd: folder, filePath: f.path }));
  const doUnstage  = (f) => run(() => ipc.invoke('git:unstage', { cwd: folder, filePath: f.path }));
  const doDiscard  = (f) => { if (confirm(`Отбросить изменения в ${f.path}?`)) run(() => ipc.invoke('git:discard', { cwd: folder, filePath: f.path })); };
  const doCommit = async () => {
    if (!commitMsg.trim()) return;
    const r = await run(() => ipc.invoke('git:commit', { cwd: folder, message: commitMsg }));
    if (r?.ok) { setCommitMsg(''); toast.success('Закоммичено'); } else toast.error('Ошибка коммита: ' + (r?.error || '?'));
  };
  const doCheckout = (branch) => { if (branch) run(() => ipc.invoke('git:checkout', { cwd: folder, branch }), `Ветка: ${branch}`); };
  const doCreateBranch = async () => {
    const name = prompt('Имя новой ветки:');
    if (name?.trim()) run(() => ipc.invoke('git:create-branch', { cwd: folder, branch: name.trim() }), `Создана ветка ${name.trim()}`);
  };
  const doPull = async () => { const r = await run(() => ipc.invoke('git:pull', { cwd: folder, token, branch: currentBranch })); r?.ok ? toast.success('Pull выполнен') : toast.error('Pull: ' + (r?.error || '?')); };
  const doPush = async () => { const r = await run(() => ipc.invoke('git:push', { cwd: folder, token, branch: currentBranch, setUpstream: true })); r?.ok ? toast.success('Push выполнен') : toast.error('Push: ' + (r?.error || '?')); };

  const startGithubLogin = async () => {
    const r = await ipc.invoke('github:device-start', { clientId: GITHUB_CLIENT_ID, scope: 'repo' });
    if (!r?.device_code) { toast.error('GitHub: ' + (r?.error || 'не удалось начать вход')); return; }
    setOauth({ userCode: r.user_code });
    const interval = r.interval || 5;
    const deadline = Date.now() + (r.expires_in || 900) * 1000;
    const poll = async () => {
      if (Date.now() > deadline) { setOauth(null); toast.error('GitHub: время вышло'); return; }
      const p = await ipc.invoke('github:device-poll', { clientId: GITHUB_CLIENT_ID, deviceCode: r.device_code });
      if (p?.access_token) { saveToken(p.access_token); setOauth(null); toast.success('GitHub подключён ✓'); return; }
      if (p?.error === 'authorization_pending') setTimeout(poll, interval * 1000);
      else if (p?.error === 'slow_down')        setTimeout(poll, (interval + 5) * 1000);
      else { setOauth(null); toast.error('GitHub: ' + (p?.error || 'ошибка')); }
    };
    setTimeout(poll, interval * 1000);
  };

  const openPicker = async () => {
    setPicker(true); setRepoQuery('');
    if (!repos) {
      const r = await ipc.invoke('github:list-repos', { token });
      setRepos(r?.ok ? r.repos : []);
      if (!r?.ok) toast.error('Не удалось получить репозитории');
    }
  };
  const selectRepo = async (repo) => {
    setPicker(false);
    setBusy(true);
    try {
      const r = await ipc.invoke('git:is-repo', folder);
      if (!r.isRepo) await ipc.invoke('git:init', folder);
      await ipc.invoke('git:set-remote', { cwd: folder, url: repo.clone_url });
      await ipc.invoke('git:fetch', { cwd: folder, token });
      toast.success(`Репозиторий: ${repo.full_name}`);
    } finally { setBusy(false); refresh(); }
  };

  if (!folder) return <div className="git-empty">Откройте проект для работы с Git</div>;

  if (!token) {
    return (
      <div className="git-auth">
        <svg className="git-auth__logo" viewBox="0 0 24 24" width="34" height="34" fill="currentColor"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.5v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17 4.7 18 5 18 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.6.8.5 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>
        <button className="git-btn-primary git-btn-lg" onClick={startGithubLogin} disabled={!!oauth}>
          Войти через GitHub
        </button>
        {oauth && (
          <div className="git-code-hint">
            Открылся браузер. Введите код:
            <div className="git-code" onClick={() => copyCode(oauth.userCode)} title="Скопировать">{oauth.userCode}</div>
            <div className="git-copied">{copied ? 'Скопировано' : 'нажмите, чтобы скопировать'}</div>
          </div>
        )}
        {!manualOpen ? (
          <button className="git-textlink" onClick={() => setManualOpen(true)}>Ввести токен вручную</button>
        ) : (
          <div className="git-manual">
            <input className="git-field" type="password" placeholder="ghp_…" value={manualVal} onChange={(e) => setManualVal(e.target.value)} autoFocus />
            <button className="git-btn" onClick={() => { if (manualVal.trim()) saveToken(manualVal.trim()); }}>OK</button>
          </div>
        )}
      </div>
    );
  }

  const currentBranch = branches.find((b) => b.current)?.name || 'HEAD';
  const localBranches = branches.filter((b) => !b.name.startsWith('remotes/'));
  const stagedFiles   = files.filter((f) => f.staged);
  const unstagedFiles = files.filter((f) => !f.staged);
  const hasRepo = isRepo && remoteUrl;

  return (
    <div className="git-wrap">
      <div className="git-acct">
        {me?.avatar && <img className="git-acct__av" src={me.avatar} alt="" />}
        <span className="git-acct__name">{me?.login ? `@${me.login}` : 'GitHub'}</span>
        <button className="git-textlink git-acct__out" onClick={() => saveToken('')}>Выйти</button>
      </div>

      {!hasRepo ? (
        <div className="git-pick-wrap">
          {!picker ? (
            <button className="git-btn-primary git-btn-lg" onClick={openPicker} disabled={busy}>Выбрать репозиторий</button>
          ) : (
            <RepoList repos={repos} query={repoQuery} setQuery={setRepoQuery} onPick={selectRepo} onClose={() => setPicker(false)} />
          )}
        </div>
      ) : (
        <>
          <div className="git-repo-bar">
            <span className="git-repo-name" title={remoteUrl}>{repoNameFromUrl(remoteUrl)}</span>
            <button className="git-textlink" onClick={openPicker}>сменить</button>
          </div>
          {picker && (
            <RepoList repos={repos} query={repoQuery} setQuery={setRepoQuery} onPick={selectRepo} onClose={() => setPicker(false)} />
          )}

          <div className="git-sync">
            <select className="git-field git-branch" value={currentBranch} onChange={(e) => doCheckout(e.target.value)} disabled={busy}>
              {localBranches.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
            </select>
            <button className="git-ic" onClick={doCreateBranch} title="Новая ветка" disabled={busy}>＋</button>
            <div style={{ flex: 1 }} />
            <button className="git-ic" onClick={doPull} title="Pull" disabled={busy}>↓</button>
            <button className="git-ic" onClick={doPush} title="Push" disabled={busy}>↑</button>
          </div>

          <div className="git-tabs">
            <button className={`git-tab${view === 'changes' ? ' active' : ''}`} onClick={() => setView('changes')}>Изменения ({files.length})</button>
            <button className={`git-tab${view === 'history' ? ' active' : ''}`} onClick={() => setView('history')}>История</button>
          </div>

          {view === 'changes' && (
            <div className="git-scroll">
              {stagedFiles.length > 0 && <FileSection title="Staged" files={stagedFiles} selected={selectedFile} onSelect={setSelected} onAction={doUnstage} actionLabel="−" />}
              {unstagedFiles.length > 0 && <FileSection title="Изменения" files={unstagedFiles} selected={selectedFile} onSelect={setSelected} onAction={doStage} actionLabel="+" onDiscard={doDiscard} />}
              {files.length === 0 && <div className="git-empty">Нет изменений</div>}
              <div className="git-commit">
                <textarea value={commitMsg} onChange={(e) => setCommitMsg(e.target.value)} placeholder="Сообщение коммита (Ctrl+Enter)"
                  onKeyDown={(e) => { if (e.ctrlKey && e.key === 'Enter') doCommit(); }} className="git-commit-input" />
                <button className="git-btn-primary" onClick={doCommit} disabled={busy || !commitMsg.trim() || stagedFiles.length === 0}>
                  Commit ({stagedFiles.length})
                </button>
              </div>
            </div>
          )}

          {view === 'history' && (
            <div className="git-scroll">
              {log.map((c) => (
                <div key={c.hash} className="git-commit-row">
                  <div className="git-commit-subj">{c.subject}</div>
                  <div className="git-commit-meta"><span className="git-mono">{c.short}</span> · {c.author} · {new Date(c.date).toLocaleDateString()}</div>
                </div>
              ))}
              {log.length === 0 && <div className="git-empty">Нет коммитов</div>}
            </div>
          )}

          {view === 'changes' && selectedFile && (
            <div className="git-diff">
              <div className="git-diff-head">{selectedFile.path}</div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <DiffEditor original={diff.original} modified={diff.modified} language="python"
                  theme={isDark ? 'tgb-dark' : 'tgb-light'}
                  options={{ readOnly: true, renderSideBySide: false, fontSize: 12, minimap: { enabled: false }, scrollBeyondLastLine: false, automaticLayout: true }} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RepoList({ repos, query, setQuery, onPick, onClose }) {
  if (repos === null) return <div className="git-empty">Загрузка репозиториев…</div>;
  const filtered = repos.filter((r) => r.full_name.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="git-repolist">
      <div className="git-repolist-top">
        <input className="git-field" placeholder="Поиск репозитория…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
        <button className="git-textlink" onClick={onClose}>отмена</button>
      </div>
      <div className="git-repolist-items">
        {filtered.length === 0 && <div className="git-empty">Ничего не найдено</div>}
        {filtered.map((r) => (
          <button key={r.full_name} className="git-repo-item" onClick={() => onPick(r)}>
            <span className="git-repo-item__name">{r.full_name}</span>
            {r.private && <span className="git-repo-item__badge">private</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function FileSection({ title, files, selected, onSelect, onAction, actionLabel, onDiscard }) {
  const color = (s) => ({ modified: '#e2c08d', untracked: '#73c991', added: '#73c991', deleted: '#f85149', renamed: '#7ce0e0' }[s] || 'var(--c-text-2)');
  const letter = (s) => ({ modified: 'M', untracked: 'U', added: 'A', deleted: 'D', renamed: 'R' }[s] || '?');
  return (
    <div className="git-fsec">
      <div className="git-fsec-title">{title}</div>
      {files.map((f) => (
        <div key={f.path} className={`git-frow${selected?.path === f.path ? ' active' : ''}`} onClick={() => onSelect(f)}>
          <span className="git-fstatus" style={{ color: color(f.status) }}>{letter(f.status)}</span>
          <span className="git-fname">{f.path}</span>
          {onDiscard && <button className="git-fbtn" onClick={(e) => { e.stopPropagation(); onDiscard(f); }} title="Отбросить">↺</button>}
          <button className="git-fbtn" onClick={(e) => { e.stopPropagation(); onAction(f); }} title={actionLabel === '+' ? 'Stage' : 'Unstage'}>{actionLabel}</button>
        </div>
      ))}
    </div>
  );
}
