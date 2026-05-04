const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const helper = require('./helper');
const coordinatePickOverlay = require('./coordinate-pick-overlay');

function registerPokiHelperIpc() {
  ipcMain.handle('poki-helper:move-mouse', (_e, x, y) => helper.moveMouse(x, y));
  ipcMain.handle('poki-helper:get-mouse-position', () => helper.getMousePosition());
  ipcMain.handle('poki-helper:click-mouse', (_e, button) => helper.clickMouse(button));
  ipcMain.handle('poki-helper:double-click-mouse', (_e, button) => helper.doubleClickMouse(button));
  ipcMain.handle('poki-helper:scroll-mouse-vertical', (_e, amount) =>
    helper.scrollMouseVertical(amount),
  );
  ipcMain.handle('poki-helper:type-text', (_e, text) => helper.typeText(text));
  ipcMain.handle('poki-helper:key-tap', (_e, keyName) => helper.keyTap(keyName));
  ipcMain.handle('poki-helper:key-chord', (_e, modifierKeyNames, keyName) =>
    helper.keyChord(modifierKeyNames, keyName),
  );
  ipcMain.handle('poki-helper:wait-next-click-coordinates', (_e, opts) =>
    coordinatePickOverlay.startPick(opts ?? {}),
  );
  ipcMain.handle('poki-helper:cancel-wait-next-click-coordinates', () =>
    coordinatePickOverlay.cancelPick(),
  );
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const indexHtml = path.join(__dirname, 'AngularBuilt', 'index.html');
  if (!fs.existsSync(indexHtml)) {
    win.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><title>PokiHelper</title><style>body{font-family:system-ui;padding:2rem;max-width:40rem;margin:auto}</style></head><body>
          <h1>Angular build not found</h1>
          <p>Run <code>npm run build</code> in the <strong>PokiHelper - Angular</strong> folder first. Output is written to <code>AngularBuilt</code> in this project.</p>
        </body></html>`,
      )}`,
    );
    return;
  }

  win.loadFile(indexHtml);
}

app.whenReady().then(() => {
  registerPokiHelperIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  coordinatePickOverlay.dispose();
});
