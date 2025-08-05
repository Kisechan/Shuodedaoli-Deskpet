const { app, BrowserWindow } = require('electron')
const path = require('path')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 300,
    height: 300,
    transparent: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, '../renderer/src/preload.js'),
      contextIsolation: true
    }
  })

  mainWindow.loadURL(
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:5173'
      : `file://${path.join(__dirname, '../renderer/dist/index.html')}`
  )
}

app.whenReady().then(createWindow)