const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
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
