const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  playSound: (soundFile) => ipcRenderer.send('play-sound', soundFile),
  showTooltip: (text) => ipcRenderer.send('show-tooltip', text),
  onUpdatePosition: (callback) => {
    ipcRenderer.on('update-position', (_, position) => callback(position))
  }
})