const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require('child_process')
const fs = require("fs");

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

ipcMain.handle('get-sound-files', async () => {
  const soundDir = process.env.NODE_ENV === 'development'
    ? path.join(__dirname, '../renderer/public/assets/sounds')
    : path.join(__dirname, '../renderer/dist/assets/sounds');

  try {
    // 读取目录下的所有文件名
    const files = await fs.promises.readdir(soundDir);
    // 筛选出 .mp3 文件并返回
    return files.filter(file => file.endsWith('.mp3'));
  } catch (error) {
    console.error('无法读取声音目录:', error);
    return []; // 如果出错则返回空数组
  }
});

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 300,
    height: 300,
    transparent: true, // 开启透明窗口
    frame: false,      // 无边框窗口
    resizable: false,  // 禁止调整大小
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      webSecurity: false,
    },
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/dist/index.html"));
  }
}

app.whenReady().then(createWindow);
