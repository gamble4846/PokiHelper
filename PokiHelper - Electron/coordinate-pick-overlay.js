'use strict';

const { BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

/** @type {any[]} */
let overlayWins = [];

/** @type {null | { resolve: (v: { x: number; y: number; button: string }) => void, reject: (e: Error) => void, timer: ReturnType<typeof setTimeout>, want: string, onResult: Function, onCancel: Function, wins: any[] }} */
let session = null;

function parseWantButton(value) {
  if (value === undefined || value === null) return 'left';
  const b = String(value).toLowerCase();
  if (b === 'any' || b === 'left' || b === 'right' || b === 'middle') return b;
  return 'left';
}

function clampTimeout(ms) {
  const n = Math.trunc(Number(ms));
  if (!Number.isFinite(n)) return 120_000;
  return Math.min(600_000, Math.max(1_000, n));
}

function isSessionWebContents(sender) {
  if (!session || !session.wins) return false;
  return session.wins.some((w) => !w.isDestroyed() && w.webContents === sender);
}

function destroyOverlayWindows() {
  const toClose = [...overlayWins];
  overlayWins = [];
  for (const w of toClose) {
    if (w && !w.isDestroyed()) {
      w.removeAllListeners('closed');
      w.close();
    }
  }
}

function clearSessionListeners() {
  if (!session) return;
  clearTimeout(session.timer);
  ipcMain.removeListener('poki-helper:overlay-pick-result', session.onResult);
  ipcMain.removeListener('poki-helper:overlay-pick-cancel', session.onCancel);
}

/**
 * One overlay per physical display (Windows/macOS multi-monitor); resolves on first matching click.
 * @param {{ timeoutMs?: number, button?: string }} [opts]
 */
function startPick(opts = {}) {
  return new Promise((resolve, reject) => {
    if (session) {
      reject(new Error('waitForNextClickCoordinates is already active'));
      return;
    }

    const raw = opts && typeof opts === 'object' ? opts : {};
    const timeoutMs = clampTimeout(raw.timeoutMs ?? 120_000);
    const want = parseWantButton(raw.button);
    const displays = screen.getAllDisplays();

    if (!displays.length) {
      reject(new Error('No displays available'));
      return;
    }

    /** @type {any[]} */
    const wins = [];

    for (const d of displays) {
      const { x, y, width, height } = d.bounds;
      const win = new BrowserWindow({
        x,
        y,
        width: Math.max(1, width),
        height: Math.max(1, height),
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        skipTaskbar: true,
        alwaysOnTop: true,
        show: false,
        hasShadow: false,
        focusable: true,
        autoHideMenuBar: true,
        webPreferences: {
          preload: path.join(__dirname, 'coordinate-pick-preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });

      win.webContents.on('context-menu', (e) => {
        e.preventDefault();
      });

      try {
        win.setAlwaysOnTop(true, 'screen-saver');
      } catch {
        win.setAlwaysOnTop(true);
      }
      if (process.platform === 'darwin') {
        win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      } else {
        win.setVisibleOnAllWorkspaces(true);
      }

      win.once('closed', () => {
        if (!session) return;
        const rej = session.reject;
        clearSessionListeners();
        session = null;
        destroyOverlayWindows();
        rej(new Error('Coordinate pick overlay closed'));
      });

      wins.push(win);
    }

    overlayWins = wins;

    const onResult = (event, payload) => {
      if (!session || !isSessionWebContents(event.sender)) return;
      if (!payload || typeof payload !== 'object') return;
      const p = /** @type {{ x?: unknown; y?: unknown; button?: unknown }} */ (payload);
      if (typeof p.x !== 'number' || typeof p.y !== 'number') return;
      const btn = typeof p.button === 'string' ? p.button : 'left';
      if (want !== 'any' && btn !== want) return;

      const res = session.resolve;
      clearSessionListeners();
      session = null;
      destroyOverlayWindows();
      res({
        x: Math.round(p.x),
        y: Math.round(p.y),
        button: btn,
      });
    };

    const onCancel = (event) => {
      if (!session || !isSessionWebContents(event.sender)) return;
      const rej = session.reject;
      clearSessionListeners();
      session = null;
      destroyOverlayWindows();
      rej(new Error('waitForNextClickCoordinates was cancelled'));
    };

    const onTimeout = () => {
      if (!session) return;
      const rej = session.reject;
      clearSessionListeners();
      session = null;
      destroyOverlayWindows();
      rej(new Error(`waitForNextClickCoordinates timed out after ${timeoutMs}ms`));
    };

    ipcMain.on('poki-helper:overlay-pick-result', onResult);
    ipcMain.on('poki-helper:overlay-pick-cancel', onCancel);

    const timer = setTimeout(onTimeout, timeoutMs);

    session = { resolve, reject, timer, want, onResult, onCancel, wins };

    for (const win of wins) {
      win.loadFile(path.join(__dirname, 'coordinate-pick-overlay.html'));
      win.once('ready-to-show', () => {
        if (win.isDestroyed()) return;
        win.show();
      });
    }

    const primary = screen.getPrimaryDisplay();
    const primaryIdx = displays.findIndex((d) => d.id === primary.id);
    const focusWin = wins[primaryIdx >= 0 ? primaryIdx : 0];
    if (focusWin && !focusWin.isDestroyed()) {
      focusWin.focus();
    }
  });
}

function cancelPick() {
  if (!session) return false;
  const rej = session.reject;
  clearSessionListeners();
  session = null;
  destroyOverlayWindows();
  rej(new Error('waitForNextClickCoordinates was cancelled'));
  return true;
}

function dispose() {
  if (session) {
    clearSessionListeners();
    session = null;
  }
  destroyOverlayWindows();
}

module.exports = {
  startPick,
  cancelPick,
  dispose,
};
