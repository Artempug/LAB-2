const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const archiver = require('archiver');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 700,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, 'icon.png'),
    titleBarStyle: 'default',
    title: 'Архіватор'
  });

  mainWindow.loadFile('index.html');
  // mainWindow.webContents.openDevTools(); // Розкоментувати для відладки
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── IPC Handlers ──────────────────────────────────────────────

// Вибір файлів для архівування
ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Оберіть файли для архівування',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Усі файли', extensions: ['*'] }]
  });

  if (result.canceled) return [];

  return result.filePaths.map(filePath => ({
    path: filePath,
    name: path.basename(filePath),
    size: fs.statSync(filePath).size
  }));
});

// Вибір місця збереження архіву
ipcMain.handle('select-save-path', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Зберегти архів як...',
    defaultPath: 'archive.zip',
    filters: [
      { name: 'ZIP архів', extensions: ['zip'] }
    ]
  });

  if (result.canceled) return null;
  return result.filePath;
});

// Створення архіву
ipcMain.handle('create-archive', async (event, { files, savePath }) => {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(savePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    let totalBytes = 0;
    let processedBytes = 0;

    // Обчислюємо загальний розмір файлів
    for (const file of files) {
      totalBytes += file.size;
    }

    output.on('close', () => {
      const archiveSize = archive.pointer();
      resolve({
        success: true,
        archiveSize,
        totalFiles: files.length,
        savePath
      });
    });

    archive.on('error', (err) => {
      reject({ success: false, error: err.message });
    });

    archive.on('progress', (progress) => {
      const percent = totalBytes > 0
        ? Math.round((progress.fs.processedBytes / totalBytes) * 100)
        : 0;
      mainWindow.webContents.send('archive-progress', percent);
    });

    archive.pipe(output);

    // Додаємо файли до архіву
    for (const file of files) {
      archive.file(file.path, { name: file.name });
    }

    archive.finalize();
  });
});