'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('coordinatePick', {
  submit(payload) {
    ipcRenderer.send('poki-helper:overlay-pick-result', payload);
  },
  cancel() {
    ipcRenderer.send('poki-helper:overlay-pick-cancel');
  },
});
