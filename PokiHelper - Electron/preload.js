'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pokiHelper', {
  moveMouse: (x, y) => ipcRenderer.invoke('poki-helper:move-mouse', x, y),
  getMousePosition: () => ipcRenderer.invoke('poki-helper:get-mouse-position'),
  clickMouse: (button) => ipcRenderer.invoke('poki-helper:click-mouse', button),
  moveMouseThenClick: (x, y, button) =>
    ipcRenderer.invoke('poki-helper:move-mouse-then-click', x, y, button),
  doubleClickMouse: (button) => ipcRenderer.invoke('poki-helper:double-click-mouse', button),
  scrollMouseVertical: (amount) => ipcRenderer.invoke('poki-helper:scroll-mouse-vertical', amount),
  typeText: (text) => ipcRenderer.invoke('poki-helper:type-text', text),
  keyTap: (keyName) => ipcRenderer.invoke('poki-helper:key-tap', keyName),
  keyChord: (modifierKeyNames, keyName) =>
    ipcRenderer.invoke('poki-helper:key-chord', modifierKeyNames, keyName),
  waitForNextClickCoordinates: (opts) =>
    ipcRenderer.invoke('poki-helper:wait-next-click-coordinates', opts ?? {}),
  cancelWaitForNextClickCoordinates: () =>
    ipcRenderer.invoke('poki-helper:cancel-wait-next-click-coordinates'),
});
