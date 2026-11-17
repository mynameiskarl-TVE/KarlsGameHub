const path = require("node:path");
const { fileURLToPath } = require("node:url");
const { app, BrowserWindow, shell } = require("electron");
const { getSafeExternalUrl } = require("./navigation.cjs");

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || "http://127.0.0.1:5173";
const DEV_SERVER_ORIGIN = new URL(DEV_SERVER_URL).origin;
const DIST_DIRECTORY = path.resolve(__dirname, "../dist");

let mainWindow = null;

function isInsideDirectory(candidatePath, directory) {
  const relative = path.relative(directory, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isAllowedAppNavigation(rawUrl) {
  try {
    const parsed = new URL(rawUrl);

    if (!app.isPackaged && parsed.origin === DEV_SERVER_ORIGIN) {
      return true;
    }

    if (parsed.protocol !== "file:") return false;

    const targetPath = path.resolve(fileURLToPath(parsed));
    return isInsideDirectory(targetPath, DIST_DIRECTORY);
  } catch {
    return false;
  }
}

function openExternal(rawUrl) {
  const safeUrl = getSafeExternalUrl(rawUrl);
  if (safeUrl) {
    // External pages open in the system browser, never inside the privileged app window.
    void shell.openExternal(safeUrl);
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 340,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#142b26",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      spellcheck: false
    }
  });

  mainWindow.once("ready-to-show", () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isAllowedAppNavigation(url)) return;
    event.preventDefault();
    openExternal(url);
  });

  mainWindow.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });

  if (app.isPackaged) {
    void mainWindow.loadFile(path.join(DIST_DIRECTORY, "index.html"));
  } else {
    void mainWindow.loadURL(DEV_SERVER_URL);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  app.setAppUserModelId("com.miniarcadehub.app");
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
