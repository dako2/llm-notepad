import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

const isDev = process.env.ELECTRON_IS_DEV === '1';

let mainWindow: BrowserWindow;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    height: 800,
    width: 1200,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist-web/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null as any;
  });
}

app.whenReady().then(() => {
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function createMenu() {
  const template: any = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New File',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-new-file');
          }
        },
        {
          label: 'Open File',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'All Files', extensions: ['*'] },
                { name: 'Text Files', extensions: ['txt', 'md', 'js', 'ts', 'html', 'css', 'json', 'py', 'java', 'cpp', 'c', 'h'] }
              ]
            });
            
            if (!result.canceled && result.filePaths.length > 0) {
              const filePath = result.filePaths[0];
              try {
                const content = fs.readFileSync(filePath, 'utf-8');
                mainWindow.webContents.send('menu-open-file', { path: filePath, content });
              } catch (error) {
                console.error('Error reading file:', error);
              }
            }
          }
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('menu-save-file');
          }
        },
        {
          label: 'Save As',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            mainWindow.webContents.send('menu-save-as-file');
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectall' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

ipcMain.handle('save-file', async (event, { path: filePath, content }) => {
  try {
    if (filePath) {
      fs.writeFileSync(filePath, content, 'utf-8');
      return { success: true, path: filePath };
    } else {
      const result = await dialog.showSaveDialog(mainWindow, {
        filters: [
          { name: 'All Files', extensions: ['*'] },
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'JavaScript', extensions: ['js'] },
          { name: 'TypeScript', extensions: ['ts'] },
          { name: 'HTML', extensions: ['html'] },
          { name: 'CSS', extensions: ['css'] },
          { name: 'JSON', extensions: ['json'] },
          { name: 'Python', extensions: ['py'] },
          { name: 'Java', extensions: ['java'] },
          { name: 'C++', extensions: ['cpp'] },
          { name: 'C', extensions: ['c'] }
        ]
      });
      
      if (!result.canceled && result.filePath) {
        fs.writeFileSync(result.filePath, content, 'utf-8');
        return { success: true, path: result.filePath };
      }
    }
    return { success: false };
  } catch (error) {
    console.error('Error saving file:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});
