const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

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
