import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  onMenuNewFile: (callback: () => void) => {
    ipcRenderer.on('menu-new-file', callback);
  },
  onMenuOpenFile: (callback: (event: any, data: { path: string; content: string }) => void) => {
    ipcRenderer.on('menu-open-file', callback);
  },
  onMenuSaveFile: (callback: () => void) => {
    ipcRenderer.on('menu-save-file', callback);
  },
  onMenuSaveAsFile: (callback: () => void) => {
    ipcRenderer.on('menu-save-as-file', callback);
  },
  saveFile: (data: { path?: string; content: string }) => {
    return ipcRenderer.invoke('save-file', data);
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
