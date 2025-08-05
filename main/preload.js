const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  playSound: (file) => ipcRenderer.send('play-sound', file),
  showTooltip: (text) => ipcRenderer.send('show-tooltip', text)
})