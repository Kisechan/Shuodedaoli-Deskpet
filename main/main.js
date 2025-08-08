const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require('child_process')

// 音效播放器
function playAudioFile(filePath) {
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', `start "" "${filePath}"`])
  } else if (process.platform === 'darwin') {
    spawn('afplay', [filePath])
  } else {
    spawn('aplay', [filePath])
  }
}

ipcMain.on('play-sound', (_, soundFile) => {
  let soundPath;

  // 判断是开发环境还是生产环境
  if (process.env.NODE_ENV === 'development') {
    // 在开发模式下，直接指向 renderer/public 里的文件
    soundPath = path.join(__dirname, '../renderer/public/assets/sounds', soundFile);
  } else {
    // 在生产模式下，Vite 会把 public 里的文件复制到 dist 文件夹
    soundPath = path.join(__dirname, '../renderer/dist/assets/sounds', soundFile);
  }

  console.log('Main process trying to play sound at path:', soundPath);

  if (require('fs').existsSync(soundPath)) {
    playAudioFile(soundPath);
  } else {
    console.error('Sound file not found:', soundPath);
  }
});

ipcMain.handle('get-sound-path', (_, soundFile) => {
  let soundPath;

  if (process.env.NODE_ENV === 'development') {
    soundPath = path.join(__dirname, '../renderer/public/assets/sounds', soundFile);
  } else {
    soundPath = path.join(__dirname, '../renderer/dist/assets/sounds', soundFile);
  }

  if (require('fs').existsSync(soundPath)) {
    // 返回一个可供 web 环境使用的 file 协议 URL
    return `file://${soundPath}`; 
  } else {
    console.error('Sound file not found:', soundPath);
    return null;
  }
});

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 300,
    height: 300,
    transparent: true,
    frame: false,
    resizable: false, // 固定大小
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      webSecurity: false, // 信任应用，并允许加载本地资源
    },
  });

  // 开发模式加载Vite服务器
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/dist/index.html"));
  }

  // 窗口拖拽功能
  let isDragging = false;
  mainWindow.webContents.on("before-input-event", (_, input) => {
    if (input.type === "mouseDown") {
      isDragging = true;
      mainWindow.webContents.executeJavaScript(`
        window.dragOffset = { x: ${input.x}, y: ${input.y} }
      `);
    } else if (input.type === "mouseUp") {
      isDragging = false;
    }
  });

  mainWindow.on("moved", () => {
    if (isDragging) {
      mainWindow.webContents.executeJavaScript(`
        window.electronAPI.updatePosition()
      `);
    }
    const [x, y] = mainWindow.getPosition();
    mainWindow.webContents.send("update-position", { x, y });
  });
}

app.whenReady().then(createWindow);
