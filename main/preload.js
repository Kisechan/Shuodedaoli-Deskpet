const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  playSound: (soundFile) => {
    try {
      ipcRenderer.send('play-sound', soundFile)
    } catch (err) {
      console.error('播放音效失败:', err)
    }
  },
  getSoundPath: (soundFile) => ipcRenderer.invoke('get-sound-path', soundFile),
  getSoundFiles: () => ipcRenderer.invoke('get-sound-files'),
  getPetSelection: () => ipcRenderer.invoke('get-pet-selection'),
  setPetSelection: (petAsset) => ipcRenderer.invoke('set-pet-selection', petAsset),
  onPetSelectionChanged: (callback) => {
    ipcRenderer.on('pet-selection-changed', (_, fileName) => callback(fileName));
  },
  showTooltip: (text) => ipcRenderer.send('show-tooltip', text),
  onUpdatePosition: (callback) => {
    ipcRenderer.on('update-position', (_, position) => callback(position))
  },
  moveWindow: (position) => ipcRenderer.send('move-window', position),
  // 暴露获取窗口位置的函数
  getWindowPosition: () => ipcRenderer.invoke('get-window-position'),
  showContextMenu: () => ipcRenderer.send('show-context-menu')
})