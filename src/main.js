const { app, BrowserWindow, globalShortcut, dialog, ipcMain, shell } = require('electron');
const { spawn } = require('child_process');
const path  = require('path');
const fs    = require('fs');
const https = require('https');

let mainWindow;
let hasUnsavedChanges = false;
let botProcess = null;

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

async function findPython() {
  for (const cmd of ['python', 'py', 'python3']) {
    try {
      await new Promise((resolve, reject) => {
        const p = spawn(cmd, ['--version'], { stdio: 'ignore', windowsHide: true });
        p.on('close', (code) => (code === 0 ? resolve() : reject()));
        p.on('error', reject);
      });
      return cmd;
    } catch {
    }
  }
  return null;
}

function runCommand(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, stdio: 'ignore', windowsHide: true });
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
    p.on('error', reject);
  });
}

function isPipPackageInstalled(pythonCmd, pkgName) {
  return new Promise((resolve) => {
    const p = spawn(pythonCmd, ['-m', 'pip', 'show', pkgName], { stdio: 'ignore', windowsHide: true });
    p.on('close', (code) => resolve(code === 0));
    p.on('error', () => resolve(false));
  });
}

function pipInstall(pythonCmd, pkgName) {
  return new Promise((resolve) => {
    const p = spawn(pythonCmd, ['-m', 'pip', 'install', pkgName], { windowsHide: true });
    const onLine = (d) => d.toString().split('\n')
      .filter((l) => l.trim())
      .forEach((l) => sendToRenderer('bot-output', l));
    p.stdout.on('data', onLine);
    p.stderr.on('data', onLine);
    p.on('close', (code) => resolve(code === 0));
    p.on('error', () => resolve(false));
  });
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
    title: 'TG Bot Builder',
  });

  mainWindow.maximize();
  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    const tag = ['LOG', 'WARN', 'ERROR', 'INFO'][level] || `L${level}`;
    process.stdout.write(`[renderer ${tag}] ${message}  (${sourceId}:${line})\n`);
  });
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    process.stdout.write(`[renderer GONE] ${JSON.stringify(details)}\n`);
  });

  mainWindow.on('focus', () => {
    globalShortcut.register('CmdOrCtrl+S',       () => sendToRenderer('shortcut', 'save'));
    globalShortcut.register('CmdOrCtrl+O',       () => sendToRenderer('shortcut', 'open'));
    globalShortcut.register('CmdOrCtrl+Shift+E', () => sendToRenderer('shortcut', 'export'));
    globalShortcut.register('CmdOrCtrl+W',       () => sendToRenderer('shortcut', 'close-tab'));
    globalShortcut.register('F5',                () => sendToRenderer('shortcut', 'start-bot'));
    globalShortcut.register('Shift+F5',          () => sendToRenderer('shortcut', 'stop-bot'));
  });
  mainWindow.on('blur', () => globalShortcut.unregisterAll());

  mainWindow.on('close', (e) => {
    if (!hasUnsavedChanges) return;
    e.preventDefault();
    sendToRenderer('show-close-dialog');
  });

  mainWindow.on('closed', () => {
    globalShortcut.unregisterAll();
    if (botProcess) { killTree(botProcess); botProcess = null; }
    mainWindow = null;
  });
};

ipcMain.on('set-title',      (_, title)  => { if (mainWindow) mainWindow.setTitle(title); });
ipcMain.on('set-unsaved',    (_, val)   => { hasUnsavedChanges = val; });
ipcMain.on('close-confirmed',()         => { hasUnsavedChanges = false; if (mainWindow) mainWindow.close(); });

ipcMain.on('close-dialog-response', (_, action) => {
  if (action === 'save') {
    sendToRenderer('shortcut', 'save-and-close');
  } else if (action === 'discard') {
    hasUnsavedChanges = false;
    if (mainWindow) mainWindow.close();
  }
});

ipcMain.handle('save-project', async (_, { nodes, edges, code, botToken, filePath,
                                              customBlocks, customPackages, paletteConfig }) => {
  let targetPath = filePath;
  if (!targetPath) {
    const r = await dialog.showSaveDialog(mainWindow, {
      title: 'Сохранить проект',
      defaultPath: 'project.tgbot',
      filters: [{ name: 'TG Bot Project', extensions: ['tgbot'] }],
    });
    if (r.canceled) return { success: false };
    targetPath = r.filePath;
  }
  try {
    const payload = {
      version: '1.0',
      botToken: botToken || '',
      nodes,
      edges,
      code,
      settings: { lastModified: new Date().toISOString() },
    };
    if (customBlocks)  payload.customBlocks  = customBlocks;
    if (customPackages) payload.customPackages = customPackages;
    if (paletteConfig)  payload.paletteConfig  = paletteConfig;
    fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), 'utf8');
    return { success: true, filePath: targetPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('open-project', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Открыть проект',
    filters: [{ name: 'TG Bot Project', extensions: ['tgbot'] }],
    properties: ['openFile'],
  });
  if (r.canceled || !r.filePaths.length) return { success: false };
  try {
    const data = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8'));
    return { success: true, data, filePath: r.filePaths[0] };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('export-project', async (_, { code, hasDb, requirements }) => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Экспортировать в папку',
    properties: ['openDirectory'],
  });
  if (r.canceled || !r.filePaths.length) return { success: false };
  try {
    const folder = r.filePaths[0];
    const header = hasDb ? '# SQLite database: bot.db (создаётся автоматически при запуске)\n' : '';
    fs.writeFileSync(path.join(folder, 'bot.py'), header + (code || ''), 'utf8');
    const reqs = Array.isArray(requirements) && requirements.length ? requirements : ['aiogram'];
    const reqText = reqs.map((r) => (r === 'aiogram' ? 'aiogram>=3.0' : r)).join('\n') + '\n';
    fs.writeFileSync(path.join(folder, 'requirements.txt'), reqText, 'utf8');
    return { success: true, folder };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('export-image', async (_, { rect, dpr = 1 }) => {
  try {
    const full = await mainWindow.webContents.capturePage();
    const { width: fw, height: fh } = full.getSize();

    const cx = Math.max(0, Math.round(rect.x * dpr));
    const cy = Math.max(0, Math.round(rect.y * dpr));
    const cw = Math.min(Math.round(rect.width  * dpr), fw - cx);
    const ch = Math.min(Math.round(rect.height * dpr), fh - cy);
    const cropped = full.crop({ x: cx, y: cy, width: cw, height: ch });

    const r = await dialog.showSaveDialog(mainWindow, {
      title: 'Экспорт схемы',
      defaultPath: 'flowchart.png',
      filters: [{ name: 'PNG Image', extensions: ['png'] }],
    });
    if (r.canceled) return { success: false };

    fs.writeFileSync(r.filePath, cropped.toPNG());
    return { success: true, filePath: r.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

const EVENT_MARK = '\x1eTGB ';
let botStarting = false;
let botStopRequested = false;

function killTree(proc) {
  if (!proc || proc.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
      .on('error', () => { try { proc.kill(); } catch { } });
  } else {
    try { proc.kill(); } catch { }
  }
}

function lineReader(onLine) {
  let buf = '';
  return {
    push(chunk) {
      buf += chunk.toString('utf8');
      const parts = buf.split(/\r?\n/);
      buf = parts.pop();
      parts.forEach(onLine);
    },
    end() { if (buf) { onLine(buf); buf = ''; } },
  };
}

function stderrSink() {
  let tb = null;
  let timer = null;
  const flush = () => {
    clearTimeout(timer); timer = null;
    if (tb) { sendToRenderer('bot-error', tb.join('\n')); tb = null; }
  };
  const isLog = (l) => /^(INFO|DEBUG|WARNING):/.test(l);
  return {
    line(l) {
      if (!l.trim()) return;
      if (l.startsWith('Traceback (most recent call last)')) { flush(); tb = [l]; }
      else if (tb) {
        tb.push(l);
        if (!/^\s/.test(l) && !l.startsWith('During handling') && !l.startsWith('The above exception')) flush();
      } else {
        sendToRenderer(isLog(l) ? 'bot-output' : 'bot-error', l);
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(flush, 400);
    },
    flush,
  };
}

const pipName = (spec) => String(spec).split(/[<>=!~[\s;]/)[0];

ipcMain.handle('start-bot', async (_, { code, requirements } = {}) => {
  if (botProcess || botStarting) return { success: false, error: 'already_running' };
  botStarting = true;
  botStopRequested = false;

  const pythonCmd = await findPython();
  if (!pythonCmd) { botStarting = false; return { success: false, error: 'python_not_found' }; }

  const tempDir = path.join(app.getPath('temp'), 'tgbot_runner');
  try {
    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'bot.py'), code || '', 'utf8');
    fs.writeFileSync(path.join(tempDir, 'tgb_runner.py'),
      fs.readFileSync(path.join(__dirname, 'devtools', 'tgb_runner.py'), 'utf8'), 'utf8');
  } catch (err) {
    botStarting = false;
    return { success: false, error: err.message };
  }

  const pkgs = Array.isArray(requirements) && requirements.length ? requirements : ['aiogram'];

  (async () => {
    try {
      sendToRenderer('bot-output', 'Проверяю зависимости…');
      for (const spec of pkgs) {
        if (botStopRequested) break;
        if (await isPipPackageInstalled(pythonCmd, pipName(spec))) continue;
        sendToRenderer('bot-output', `Устанавливаю ${spec}…`);
        if (!(await pipInstall(pythonCmd, spec))) {
          sendToRenderer('bot-error', `Не удалось установить ${spec}. Установите вручную: pip install ${spec}`);
          sendToRenderer('bot-stopped', 1);
          return;
        }
        sendToRenderer('bot-output', `${spec} установлен`);
      }
      if (botStopRequested) { sendToRenderer('bot-stopped', 0); return; }

      sendToRenderer('bot-output', 'Бот запускается…');
      const proc = spawn(pythonCmd, ['-u', 'tgb_runner.py', 'bot.py'], {
        cwd: tempDir,
        windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' },
      });
      botProcess = proc;

      const out = lineReader((l) => {
        if (l.startsWith(EVENT_MARK)) {
          try { sendToRenderer('bot-event', JSON.parse(l.slice(EVENT_MARK.length))); } catch { }
        } else if (l.trim()) {
          sendToRenderer('bot-output', l);
        }
      });
      const errSink = stderrSink();
      const err = lineReader((l) => errSink.line(l));

      proc.stdout.on('data', (d) => out.push(d));
      proc.stderr.on('data', (d) => err.push(d));
      proc.on('close', (exitCode) => {
        out.end(); err.end(); errSink.flush();
        if (botProcess === proc) botProcess = null;
        sendToRenderer('bot-stopped', botStopRequested ? 0 : exitCode);
      });
      proc.on('error', (e) => {
        sendToRenderer('bot-error', `Процесс: ${e.message}`);
        if (botProcess === proc) botProcess = null;
        sendToRenderer('bot-stopped', 1);
      });
    } finally {
      botStarting = false;
    }
  })();

  return { success: true };
});

ipcMain.on('stop-bot', () => {
  botStopRequested = true;
  if (botProcess) killTree(botProcess);
});

let termProcess = null;

ipcMain.on('term-run', (_, cmd) => {
  if (termProcess) { termProcess.kill(); termProcess = null; }

  termProcess = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-Command', cmd], {
    windowsHide: true,
    env: { ...process.env },
  });

  const onOut = (d) => d.toString().split('\n')
    .filter((l) => l.trim())
    .forEach((l) => sendToRenderer('term-out', l));
  const onErr = (d) => d.toString().split('\n')
    .filter((l) => l.trim())
    .forEach((l) => sendToRenderer('term-err', l));

  termProcess.stdout.on('data', onOut);
  termProcess.stderr.on('data', onErr);
  termProcess.on('close', (code) => {
    sendToRenderer('term-done', code ?? 0);
    termProcess = null;
  });
  termProcess.on('error', (e) => {
    sendToRenderer('term-err', `Ошибка: ${e.message}`);
    sendToRenderer('term-done', 1);
    termProcess = null;
  });
});

ipcMain.on('term-kill', () => {
  if (termProcess) {
    termProcess.kill();
    termProcess = null;
  }
});

ipcMain.handle('get-chat-history', async (_, { limit = 300 } = {}) => {
  try {
    const logPath = path.join(app.getPath('temp'), 'tgbot_runner', 'chat_log.ndjson');
    if (!fs.existsSync(logPath)) return { success: true, messages: [] };
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n').filter((l) => l.trim());
    const messages = lines.slice(-limit).map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
    return { success: true, messages };
  } catch (err) {
    return { success: false, error: err.message, messages: [] };
  }
});

ipcMain.handle('clear-chat-history', async () => {
  try {
    const logPath = path.join(app.getPath('temp'), 'tgbot_runner', 'chat_log.ndjson');
    if (fs.existsSync(logPath)) fs.unlinkSync(logPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

let fsWatcher = null;

function readDirEntries(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries
      .filter((e) => !e.name.startsWith('.') && e.name !== '__pycache__' && e.name !== 'node_modules')
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      })
      .map((entry) => ({
        name: entry.name,
        path: path.join(dirPath, entry.name),
        type: entry.isDirectory() ? 'folder' : 'file',
      }));
  } catch {
    return [];
  }
}

ipcMain.handle('fs:open-folder', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Открыть папку проекта',
    properties: ['openDirectory'],
  });
  if (r.canceled || !r.filePaths.length) return null;
  return r.filePaths[0];
});

ipcMain.handle('fs:read-dir', async (_, dirPath) => {
  return readDirEntries(dirPath);
});

ipcMain.handle('fs:read-file', async (_, filePath) => {
  try {
    return { ok: true, content: fs.readFileSync(filePath, 'utf8') };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('fs:write-file', async (_, { filePath, content }) => {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('fs:create-file', async (_, filePath) => {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '', 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('fs:create-folder', async (_, folderPath) => {
  try {
    fs.mkdirSync(folderPath, { recursive: true });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('fs:rename', async (_, { oldPath, newPath }) => {
  try {
    fs.renameSync(oldPath, newPath);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('fs:delete', async (_, filePath) => {
  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      fs.rmSync(filePath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(filePath);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('fs:watch', async (_, folderPath) => {
  if (fsWatcher) {
    try { fsWatcher.close(); } catch { }
    fsWatcher = null;
  }
  if (!folderPath) return { ok: true };
  try {
    fsWatcher = fs.watch(folderPath, { recursive: true }, (eventType, filename) => {
      if (filename && !filename.includes('__pycache__') && !filename.endsWith('.pyc')) {
        sendToRenderer('fs:changed', { eventType, filename });
      }
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

const TEXT_EXTS = new Set(['.py','.js','.ts','.jsx','.tsx','.json','.txt','.md','.yaml','.yml','.toml','.cfg','.env','.ini','.html','.css','.sh','.bat']);

function extToLanguage(ext) {
  const map = { '.py':'python','.js':'javascript','.ts':'typescript','.jsx':'javascript','.tsx':'typescript','.json':'json','.md':'markdown','.html':'html','.css':'css' };
  return map[ext] ?? 'text';
}

ipcMain.handle('fs:search-files', async (_, { folderPath, query, excludePaths = [] }) => {
  if (!folderPath || !query) return { ok: true, results: [] };
  try {
    const results = [];
    const lower = query.toLowerCase();

    function searchDir(dir, depth) {
      if (results.length >= 500 || depth > 8) return;
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '__pycache__') continue;
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          searchDir(entryPath, depth + 1);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (!TEXT_EXTS.has(ext)) continue;
          if (excludePaths.includes(entryPath)) continue;
          let content;
          try { content = fs.readFileSync(entryPath, 'utf8'); } catch { continue; }
          const lines = content.split('\n');
          for (let i = 0; i < lines.length && results.length < 500; i++) {
            if (lines[i].toLowerCase().includes(lower)) {
              results.push({
                filePath: entryPath,
                fileName: entry.name,
                line: i + 1,
                text: lines[i].trim().slice(0, 200),
                col: lines[i].toLowerCase().indexOf(lower) + 1,
                language: extToLanguage(ext),
              });
            }
          }
        }
      }
    }

    searchDir(folderPath, 0);
    return { ok: true, results };
  } catch (e) {
    return { ok: false, error: e.message, results: [] };
  }
});

const ptySessions = new Map();

ipcMain.handle('term:create', async (_, { sessionId, cwd, shell }) => {
  if (ptySessions.has(sessionId)) {
    try { ptySessions.get(sessionId).proc.kill(); } catch { }
    ptySessions.delete(sessionId);
  }
  const isWin = process.platform === 'win32';
  const shellCmd = shell || (isWin ? 'powershell.exe' : (process.env.SHELL || '/bin/bash'));
  const args = isWin ? ['-NoLogo', '-NoProfile', '-NoExit'] : ['-i'];

  const startDir = cwd && fs.existsSync(cwd)
    ? cwd
    : (process.env.USERPROFILE || process.env.HOME || process.cwd());

  const proc = spawn(shellCmd, args, {
    cwd: startDir,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      FORCE_COLOR: '1', CLICOLOR_FORCE: '1',
      PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1',
    },
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  ptySessions.set(sessionId, { proc, cwd: startDir });

  const { StringDecoder } = require('string_decoder');
  const decOut = new StringDecoder('utf8');
  const decErr = new StringDecoder('utf8');
  proc.stdout.on('data', (d) => sendToRenderer('pty:data', { sessionId, data: decOut.write(d) }));
  proc.stderr.on('data', (d) => sendToRenderer('pty:data', { sessionId, data: decErr.write(d) }));

  if (isWin) {
    const init =
      'chcp 65001 > $null; ' +
      '[Console]::OutputEncoding=[Text.Encoding]::UTF8; ' +
      '$OutputEncoding=[Text.Encoding]::UTF8; ' +
      "function prompt {''}; " +
      '[Console]::Out.WriteLine("$([char]30)TGTERM$([char]30)$((Get-Location).Path)$([char]30)")\r\n';
    try { proc.stdin.write(init); } catch { }
  } else {
    const init = "export PS1=''; printf '\\036TGTERM\\036%s\\036\\n' \"$(pwd)\"\n";
    try { proc.stdin.write(init); } catch { }
  }

  proc.on('close', (code) => {
    sendToRenderer('pty:exit', { sessionId, code });
    ptySessions.delete(sessionId);
  });
  proc.on('error', (e) => {
    sendToRenderer('pty:data', { sessionId, data: `\r\n[error] ${e.message}\r\n` });
  });

  return { ok: true };
});

ipcMain.handle('term:write', async (_, { sessionId, data }) => {
  const session = ptySessions.get(sessionId);
  if (!session) return { ok: false };
  try { session.proc.stdin.write(data); return { ok: true }; }
  catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('term:resize', async () => ({ ok: true }));

ipcMain.handle('term:kill', async (_, { sessionId }) => {
  const session = ptySessions.get(sessionId);
  if (session) { try { session.proc.kill(); } catch { } ptySessions.delete(sessionId); }
  return { ok: true };
});

function getWorkspaceConfigPath() {
  return path.join(app.getPath('userData'), 'workspaces.json');
}

function loadWorkspaceConfig() {
  try {
    const p = getWorkspaceConfigPath();
    if (!fs.existsSync(p)) return { folders: [], recent: [] };
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return { folders: [], recent: [] };
  }
}

function saveWorkspaceConfig(cfg) {
  try {
    fs.writeFileSync(getWorkspaceConfigPath(), JSON.stringify(cfg, null, 2), 'utf8');
  } catch { }
}

ipcMain.handle('workspace:list', async () => {
  return loadWorkspaceConfig();
});

ipcMain.handle('workspace:add-folder', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Добавить папку в workspace',
    properties: ['openDirectory'],
  });
  if (r.canceled || !r.filePaths.length) return { ok: false };
  const folder = r.filePaths[0];
  const cfg = loadWorkspaceConfig();
  if (!cfg.folders.includes(folder)) cfg.folders.push(folder);
  cfg.recent = [folder, ...(cfg.recent || []).filter((x) => x !== folder)].slice(0, 20);
  saveWorkspaceConfig(cfg);
  return { ok: true, folder, ...cfg };
});

ipcMain.handle('workspace:remove', async (_, folder) => {
  const cfg = loadWorkspaceConfig();
  cfg.folders = cfg.folders.filter((f) => f !== folder);
  saveWorkspaceConfig(cfg);
  return { ok: true, ...cfg };
});

function runGit(cwd, args) {
  return new Promise((resolve) => {
    const p = spawn('git', args, { cwd, windowsHide: true });
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (d) => { stdout += d.toString(); });
    p.stderr.on('data', (d) => { stderr += d.toString(); });
    p.on('close', (code) => resolve({ code, stdout, stderr }));
    p.on('error', (e) => resolve({ code: -1, stdout: '', stderr: e.message }));
  });
}

ipcMain.handle('git:is-repo', async (_, cwd) => {
  if (!cwd) return { ok: false, isRepo: false };
  const r = await runGit(cwd, ['rev-parse', '--is-inside-work-tree']);
  return { ok: r.code === 0, isRepo: r.code === 0 && r.stdout.trim() === 'true' };
});

ipcMain.handle('git:init', async (_, cwd) => {
  if (!cwd) return { ok: false, error: 'no cwd' };
  const r = await runGit(cwd, ['init']);
  return { ok: r.code === 0, error: r.stderr };
});

ipcMain.handle('git:status', async (_, cwd) => {
  if (!cwd) return { ok: false, files: [] };
  const r = await runGit(cwd, ['status', '--porcelain=v1', '-uall']);
  if (r.code !== 0) return { ok: false, files: [], error: r.stderr };
  const files = r.stdout.split('\n').filter(Boolean).map((line) => {
    const x = line[0];
    const y = line[1];
    const name = line.slice(3);
    let status = 'modified';
    if (x === '?' && y === '?') status = 'untracked';
    else if (x === 'A' || y === 'A') status = 'added';
    else if (x === 'D' || y === 'D') status = 'deleted';
    else if (x === 'R' || y === 'R') status = 'renamed';
    else if (x === 'M' || y === 'M') status = 'modified';
    return {
      path: name,
      status,
      staged: x !== ' ' && x !== '?',
      unstaged: y !== ' ',
    };
  });
  return { ok: true, files };
});

ipcMain.handle('git:diff', async (_, { cwd, filePath, staged = false }) => {
  if (!cwd || !filePath) return { ok: false };
  const headArgs = staged
    ? ['show', `:${filePath}`]
    : ['show', `HEAD:${filePath}`];
  const head = await runGit(cwd, headArgs);
  let working = '';
  try {
    working = fs.readFileSync(path.join(cwd, filePath), 'utf8');
  } catch { }
  return {
    ok: true,
    original: head.code === 0 ? head.stdout : '',
    modified: working,
  };
});

ipcMain.handle('git:stage', async (_, { cwd, filePath }) => {
  const r = await runGit(cwd, ['add', '--', filePath]);
  return { ok: r.code === 0, error: r.stderr };
});

ipcMain.handle('git:unstage', async (_, { cwd, filePath }) => {
  const r = await runGit(cwd, ['reset', 'HEAD', '--', filePath]);
  return { ok: r.code === 0, error: r.stderr };
});

ipcMain.handle('git:discard', async (_, { cwd, filePath }) => {
  const r = await runGit(cwd, ['checkout', '--', filePath]);
  return { ok: r.code === 0, error: r.stderr };
});

ipcMain.handle('git:commit', async (_, { cwd, message }) => {
  if (!message?.trim()) return { ok: false, error: 'empty message' };
  const r = await runGit(cwd, ['commit', '-m', message]);
  return { ok: r.code === 0, output: r.stdout, error: r.stderr };
});

ipcMain.handle('git:log', async (_, { cwd, limit = 50 }) => {
  const r = await runGit(cwd, [
    'log', `-${limit}`, '--pretty=format:%H%x09%h%x09%an%x09%at%x09%s',
  ]);
  if (r.code !== 0) return { ok: false, commits: [] };
  const commits = r.stdout.split('\n').filter(Boolean).map((line) => {
    const [hash, short, author, ts, ...subj] = line.split('\t');
    return { hash, short, author, date: Number(ts) * 1000, subject: subj.join('\t') };
  });
  return { ok: true, commits };
});

ipcMain.handle('git:branches', async (_, cwd) => {
  const r = await runGit(cwd, ['branch', '-a']);
  if (r.code !== 0) return { ok: false, branches: [] };
  const branches = r.stdout.split('\n').filter(Boolean).map((line) => {
    const current = line.startsWith('*');
    const name = line.replace(/^\*?\s+/, '').trim();
    return { name, current };
  });
  return { ok: true, branches };
});

ipcMain.handle('git:checkout', async (_, { cwd, branch }) => {
  const r = await runGit(cwd, ['checkout', branch]);
  return { ok: r.code === 0, error: r.stderr };
});

ipcMain.handle('git:create-branch', async (_, { cwd, branch }) => {
  const r = await runGit(cwd, ['checkout', '-b', branch]);
  return { ok: r.code === 0, error: r.stderr };
});

ipcMain.handle('git:merge', async (_, { cwd, branch }) => {
  const r = await runGit(cwd, ['merge', '--no-edit', branch]);
  return { ok: r.code === 0, output: r.stdout, error: r.stderr };
});

ipcMain.handle('git:get-remote', async (_, cwd) => {
  const r = await runGit(cwd, ['remote', 'get-url', 'origin']);
  return { ok: r.code === 0, url: r.code === 0 ? r.stdout.trim() : '' };
});

ipcMain.handle('git:set-remote', async (_, { cwd, url }) => {
  const has = await runGit(cwd, ['remote', 'get-url', 'origin']);
  const r = has.code === 0
    ? await runGit(cwd, ['remote', 'set-url', 'origin', url])
    : await runGit(cwd, ['remote', 'add', 'origin', url]);
  return { ok: r.code === 0, error: r.stderr };
});

function authInject(url, token) {
  if (!token || !/^https:\/\//.test(url)) return null;
  const clean = url.replace(/^https:\/\/[^@]*@/, 'https://');
  return clean.replace('https://', `https://${encodeURIComponent(token)}@`);
}

async function withAuthedRemote(cwd, token, fn) {
  const cur = await runGit(cwd, ['remote', 'get-url', 'origin']);
  const cleanUrl = cur.code === 0 ? cur.stdout.trim() : '';
  const authed = authInject(cleanUrl, token);
  if (!authed) return fn();
  await runGit(cwd, ['remote', 'set-url', 'origin', authed]);
  try { return await fn(); }
  finally { await runGit(cwd, ['remote', 'set-url', 'origin', cleanUrl]); }
}

ipcMain.handle('git:fetch', async (_, { cwd, token }) =>
  withAuthedRemote(cwd, token, async () => {
    const r = await runGit(cwd, ['fetch', '--prune', 'origin']);
    return { ok: r.code === 0, output: r.stdout, error: r.stderr };
  }));

ipcMain.handle('git:pull', async (_, { cwd, token, branch }) =>
  withAuthedRemote(cwd, token, async () => {
    const args = branch ? ['pull', '--no-edit', 'origin', branch] : ['pull', '--no-edit'];
    const r = await runGit(cwd, args);
    return { ok: r.code === 0, output: r.stdout, error: r.stderr };
  }));

ipcMain.handle('git:push', async (_, { cwd, token, branch, setUpstream }) =>
  withAuthedRemote(cwd, token, async () => {
    const args = ['push'];
    if (setUpstream) args.push('-u');
    args.push('origin', branch);
    const r = await runGit(cwd, args);
    return { ok: r.code === 0, output: r.stdout, error: r.stderr };
  }));

ipcMain.handle('git:clone', async (_, { url, parentDir, token }) => {
  if (!url || !parentDir) return { ok: false, error: 'no url/dir' };
  const name = (url.split('/').pop() || 'repo').replace(/\.git$/, '');
  const dir = path.join(parentDir, name);
  const authed = authInject(url, token) || url;
  const r = await runGit(parentDir, ['clone', authed, dir]);
  if (r.code !== 0) return { ok: false, error: r.stderr };
  if (authed !== url) { try { await runGit(dir, ['remote', 'set-url', 'origin', url]); } catch { } }
  return { ok: true, dir };
});

function ghPostJson(url, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'User-Agent': 'TG-Bot-IDE',
      },
    }, (res) => {
      let buf = '';
      res.on('data', (d) => { buf += d; });
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve({ error: 'bad_response', raw: buf }); } });
    });
    req.on('error', (e) => resolve({ error: e.message }));
    req.write(data);
    req.end();
  });
}

ipcMain.handle('github:device-start', async (_, { clientId, scope }) => {
  const data = await ghPostJson('https://github.com/login/device/code', { client_id: clientId, scope: scope || 'repo' });
  if (data.device_code && data.verification_uri) {
    try { shell.openExternal(data.verification_uri); } catch { }
  }
  return data;
});

ipcMain.handle('github:device-poll', async (_, { clientId, deviceCode }) =>
  ghPostJson('https://github.com/login/oauth/access_token', {
    client_id: clientId,
    device_code: deviceCode,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  }));

function ghGetJson(pathName, token) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.github.com', path: pathName, method: 'GET',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'TG-Bot-IDE',
      },
    }, (res) => {
      let buf = '';
      res.on('data', (d) => { buf += d; });
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve({ error: 'bad_response' }); } });
    });
    req.on('error', (e) => resolve({ error: e.message }));
    req.end();
  });
}

ipcMain.handle('github:list-repos', async (_, { token }) => {
  const data = await ghGetJson('/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member', token);
  if (!Array.isArray(data)) return { ok: false, error: data?.error || data?.message || 'failed', repos: [] };
  return {
    ok: true,
    repos: data.map((r) => ({ name: r.name, full_name: r.full_name, clone_url: r.clone_url, private: r.private, default_branch: r.default_branch })),
  };
});

ipcMain.handle('github:me', async (_, { token }) => {
  const data = await ghGetJson('/user', token);
  return data && data.login ? { ok: true, login: data.login, name: data.name, avatar: data.avatar_url } : { ok: false };
});

app.on('ready', createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (mainWindow === null) createWindow(); });
