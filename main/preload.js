const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  playSound: (soundFile) => {
    try {
      ipcRenderer.send('play-sound', soundFile)
    } catch (err) {
      console.error('播放音效失败:', err)
    }
  },
  showTooltip: (text) => ipcRenderer.send('show-tooltip', text),
  onUpdatePosition: (callback) => {
    ipcRenderer.on('update-position', (_, position) => callback(position))
  }
})