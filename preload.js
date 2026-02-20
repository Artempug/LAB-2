const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('archiver', {
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectSavePath: () => ipcRenderer.invoke('select-save-path'),
  createArchive: (data) => ipcRenderer.invoke('create-archive', data),
  onProgress: (callback) => {
    ipcRenderer.on('archive-progress', (event, percent) => callback(percent));
  }
});