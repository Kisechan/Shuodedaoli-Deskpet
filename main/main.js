const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

app.disableHardwareAcceleration(); // 高 DPI 缩放修复

let tray = null;
let isQuiting = false;

// 音效播放器
function playAudioFile(filePath) {
  if (process.platform === "win32") {
    spawn("cmd", ["/c", `start "" "${filePath}"`]);
  } else if (process.platform === "darwin") {
    spawn("afplay", [filePath]);
  } else {
    spawn("aplay", [filePath]);
  }
}

ipcMain.on("play-sound", (_, soundFile) => {
  let soundPath;

  // 判断是开发环境还是生产环境
  if (process.env.NODE_ENV === "development") {
    // 在开发模式下，直接指向 renderer/public 里的文件
    soundPath = path.join(
      __dirname,
      "../renderer/public/sounds",
      soundFile
    );
  } else {
    // 在生产模式下，Vite 会把 public 里的文件复制到 dist 文件夹
    soundPath = path.join(
      __dirname,
      "../renderer/dist/sounds",
      soundFile
    );
  }

  console.log("Main process trying to play sound at path:", soundPath);

  if (require("fs").existsSync(soundPath)) {
    playAudioFile(soundPath);
  } else {
    console.error("Sound file not found:", soundPath);
  }
});

ipcMain.handle("get-sound-path", (_, soundFile) => {
  let soundPath;

  if (process.env.NODE_ENV === "development") {
    soundPath = path.join(
      __dirname,
      "../renderer/public/sounds",
      soundFile
    );
  } else {
    soundPath = path.join(
      __dirname,
      "../renderer/dist/sounds",
      soundFile
    );
  }

  if (require("fs").existsSync(soundPath)) {
    // 返回一个可供 web 环境使用的 file 协议 URL
    return `file://${soundPath}`;
  } else {
    console.error("Sound file not found:", soundPath);
    return null;
  }
});

ipcMain.handle("get-sound-files", async () => {
  const soundDir =
    process.env.NODE_ENV === "development"
      ? path.join(__dirname, "../renderer/public/sounds")
      : path.join(__dirname, "../renderer/dist/sounds");

  try {
    // 读取目录下的所有文件名
    const files = await fs.promises.readdir(soundDir);
    // 筛选出 .mp3 文件并返回
    return files.filter((file) => file.endsWith(".mp3"));
  } catch (error) {
    console.error("无法读取声音目录:", error);
    return []; // 如果出错则返回空数组
  }
});

// 持久化用户设置 (用于保存所选宠物素材文件名)
const settingsFile = path.join(app.getPath('userData') || __dirname, 'settings.json');

ipcMain.handle('get-pet-selection', async () => {
  try {
    if (fs.existsSync(settingsFile)) {
      const data = JSON.parse(await fs.promises.readFile(settingsFile, 'utf8'));
      return data.petAsset || null;
    }
  } catch (err) {
    console.error('读取设置失败:', err);
  }
  return null;
});

ipcMain.handle('set-pet-selection', async (_, petAsset) => {
  try {
    let data = {};
    if (fs.existsSync(settingsFile)) {
      try {
        data = JSON.parse(await fs.promises.readFile(settingsFile, 'utf8')) || {};
      } catch (e) {
        data = {};
      }
    }
    data.petAsset = petAsset;
    await fs.promises.writeFile(settingsFile, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('写入设置失败:', err);
    return false;
  }
});

ipcMain.on("show-context-menu", async () => {
  // 尝试动态读取 renderer 下的 public/pets 目录，开发/生产路径均尝试
  const devAssets = path.join(__dirname, "../renderer/public/pets");
  const prodAssets = path.join(__dirname, "../renderer/dist/pets");
  let assetsDir = null;
  if (fs.existsSync(devAssets)) assetsDir = devAssets;
  else if (fs.existsSync(prodAssets)) assetsDir = prodAssets;

  // 读取当前保存的选择（文件名）
  let currentSelection = null;
  try {
    if (fs.existsSync(settingsFile)) {
      const data = JSON.parse(await fs.promises.readFile(settingsFile, 'utf8')) || {};
      currentSelection = data.petAsset || null;
    }
  } catch (e) {
    console.error('读取当前选择失败:', e);
  }

  // 构建素材菜单项，如果无法读取目录，则提供一个默认值
  let assetItems = [];
  try {
    if (assetsDir) {
      const files = await fs.promises.readdir(assetsDir);
      const imgs = files.filter(f => /\.(png|jpg|jpeg|gif)$/i.test(f));
      assetItems = imgs.map((f) => {
        const nameWithoutExt = f.replace(/\.[^.]+$/, '');
        const displayLabel = nameWithoutExt + (/\.gif$/i.test(f) ? '（可动）' : '');
        return ({
          label: displayLabel,
          type: 'radio',
          checked: f === currentSelection,
          click: async () => {
          try {
            // 写入 settings.json
            let data = {};
            if (fs.existsSync(settingsFile)) {
              try { data = JSON.parse(await fs.promises.readFile(settingsFile, 'utf8')) || {}; } catch (e) { data = {}; }
            }
            data.petAsset = f;
            await fs.promises.writeFile(settingsFile, JSON.stringify(data, null, 2), 'utf8');
            // 通知渲染进程更新
            if (mainWindow && mainWindow.webContents) {
              mainWindow.webContents.send('pet-selection-changed', f);
            }
          } catch (err) {
            console.error('写入选择失败:', err);
          }
        }
        });
      });
    }
  } catch (err) {
    console.error('读取 assets 目录失败:', err);
    assetItems = [];
  }

  // 如果没有任何可用素材，提供占位项
  if (assetItems.length === 0) {
    assetItems = [
      { label: '（无可用素材）', enabled: false }
    ];
  }

  const template = [
    {
      label: "置顶显示",
      type: "checkbox",
      checked: isAlwaysOnTop,
      click: () => {
        isAlwaysOnTop = !isAlwaysOnTop;
        if (mainWindow) mainWindow.setAlwaysOnTop(isAlwaysOnTop);
      },
    },
    { type: 'separator' },
    {
      label: '选择素材',
      submenu: assetItems,
    },
    { type: 'separator' },
    {
      label: "退出",
  click: () => { isQuiting = true; app.quit(); },
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  menu.popup({ window: mainWindow });
});

// 提供给渲染进程：列出 public/pets 中的素材文件（开发/生产路径）
ipcMain.handle('get-pet-files', async () => {
  const devDir = path.join(__dirname, '../renderer/public/pets');
  const prodDir = path.join(__dirname, '../renderer/dist/pets');
  const dir = fs.existsSync(devDir) ? devDir : (fs.existsSync(prodDir) ? prodDir : null);
  if (!dir) return [];
  try {
    const files = await fs.promises.readdir(dir);
    return files.filter(f => /\.(png|jpg|jpeg|gif)$/i.test(f));
  } catch (e) {
    console.error('读取 pets 目录失败:', e);
    return [];
  }
});

ipcMain.handle('get-pet-url', (_, fileName) => {
  // 在开发时，public 文件由 dev server 以根路径提供
  if (process.env.NODE_ENV === 'development') {
    return `http://localhost:5173/pets/${encodeURIComponent(fileName)}`;
  }
  // 生产时，从 dist/pets 返回 file:// URL
  const prodPath = path.join(__dirname, '../renderer/dist/pets', fileName);
  if (fs.existsSync(prodPath)) return `file://${prodPath}`;
  // fallback: try public path in source tree
  const devPath = path.join(__dirname, '../renderer/public/pets', fileName);
  if (fs.existsSync(devPath)) return `file://${devPath}`;
  return null;
});

let isAlwaysOnTop = true;
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 200,
    height: 200,
    transparent: true,  // 开启透明窗口
    frame: false,       // 无边框窗口
    resizable: false,   // 禁止调整大小
    title: "说的道理桌面宠物（前端）",
    alwaysOnTop: isAlwaysOnTop,   // 窗口始终在最上层
    skipTaskbar: true,  // 不在任务栏显示
    icon: path.join(__dirname, "../build/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      webSecurity: false,
    },
  });

  // 创建托盘图标
  try {
    // 修改托盘图标路径以确保在开发和生产环境中正确加载
    const iconPath = process.env.NODE_ENV === "development"
      ? path.join(__dirname, "../assets/icon.ico") // 开发环境路径
      : path.join(__dirname, "../renderer/public/images/icon.ico"); // 生产环境路径

    const trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      console.error("托盘图标加载失败，路径:", iconPath);
    } else {
      tray = new Tray(trayIcon);
    }
  } catch (e) {
    console.error('创建托盘失败:', e);
  }

  // 当渲染进程传来这个事件时，就移动窗口
  ipcMain.on("move-window", (event, { x, y }) => {
    // 使用 Math.round 避免非整数坐标可能带来的问题
    mainWindow.setPosition(Math.round(x), Math.round(y), false);
  });

  // 添加一个 handle，用于响应前端获取窗口位置的请求
  ipcMain.handle("get-window-position", () => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      return { x, y };
    }
    return { x: 0, y: 0 };
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/dist/index.html"));
  }

  // 启动时显示窗口（允许随后最小化到托盘）
  try { mainWindow.show(); } catch (e) {}

  // 最小化时隐藏到托盘
  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });

  // 关闭窗口时隐藏到托盘，除非用户选择真正退出
  mainWindow.on('close', (event) => {
    if (!isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

app.whenReady().then(createWindow);
