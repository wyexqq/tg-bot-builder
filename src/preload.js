const { contextBridge, ipcRenderer, webFrame } = require('electron');

const listeners = new WeakMap();

contextBridge.exposeInMainWorld('electron', {
  setZoom: (factor) => webFrame.setZoomFactor(factor),
  getZoom: ()       => webFrame.getZoomFactor(),
  ipcRenderer: {
    on: (channel, func) => {
      const validChannels = [
        'bot-output', 'bot-error', 'bot-stopped', 'bot-event', 'shortcut',
        'term-out', 'term-err', 'term-done',
        'fs:changed', 'show-close-dialog',
        'pty:data', 'pty:exit',
      ];
      if (!validChannels.includes(channel)) return () => {};
      const wrapper = (_event, ...args) => func(...args);
      ipcRenderer.on(channel, wrapper);
      let list = listeners.get(func);
      if (!list) { list = []; listeners.set(func, list); }
      list.push({ channel, wrapper });
      return () => ipcRenderer.removeListener(channel, wrapper);
    },
    removeListener: (channel, func) => {
      const list = listeners.get(func);
      if (!list) return;
      for (const item of list.filter((x) => x.channel === channel)) {
        ipcRenderer.removeListener(channel, item.wrapper);
      }
      listeners.set(func, list.filter((x) => x.channel !== channel));
    },
    send: (channel, data) => {
      const validChannels = [
        'stop-bot', 'set-title', 'set-unsaved', 'close-confirmed',
        'term-run', 'term-kill', 'close-dialog-response',
      ];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    invoke: (channel, data) => {
      const validChannels = [
        'save-project', 'open-project', 'export-project', 'start-bot',
        'get-chat-history', 'clear-chat-history',
        'export-image',
        'fs:open-folder', 'fs:read-dir', 'fs:read-file', 'fs:write-file',
        'fs:create-file', 'fs:create-folder', 'fs:rename', 'fs:delete', 'fs:watch',
        'fs:search-files',
        'git:is-repo', 'git:init', 'git:status', 'git:diff',
        'git:stage', 'git:unstage', 'git:discard', 'git:commit',
        'git:log', 'git:branches', 'git:checkout', 'git:create-branch', 'git:merge',
        'git:get-remote', 'git:set-remote', 'git:fetch', 'git:pull', 'git:push', 'git:clone',
        'github:device-start', 'github:device-poll', 'github:list-repos', 'github:me',
        'term:create', 'term:write', 'term:resize', 'term:kill',
      ];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, data);
      }
    },
  },
});
