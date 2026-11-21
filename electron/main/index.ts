import { app, BrowserWindow, shell, protocol, net } from 'electron';
import path from 'path';
import { registerIpcHandlers, cleanupSession } from './ipc';
import { initializeDatabase, disconnectDatabase } from '../../server/database/client';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development';

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'School Management System',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: true,
    autoHideMenuBar: !isDev,
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('destroyed', () => {
    cleanupSession(mainWindow!.webContents.id);
  });

  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

import { pathToFileURL } from 'url';

// Register a safe custom protocol to serve uploaded files.
// Usage in renderer: <img src="localfile://C:/path/to/file.jpg" />
protocol.registerSchemesAsPrivileged([
  { scheme: 'localfile', privileges: { secure: true, standard: false, supportFetchAPI: true, bypassCSP: true } },
]);

app.whenReady().then(async () => {
  // Serve local filesystem files via localfile:// protocol
  protocol.handle('localfile', (request) => {
    try {
      let rawPath = request.url.replace(/^localfile:\/\//i, '');
      rawPath = decodeURIComponent(rawPath);
      // Remove leading slash before drive letter on Windows (e.g., /C:/path -> C:/path)
      if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(rawPath)) {
        rawPath = rawPath.slice(1);
      }
      return net.fetch(pathToFileURL(rawPath).toString());
    } catch (e) {
      console.error('Failed to fetch localfile:', e);
      return new Response('File not found', { status: 404 });
    }
  });

  await initializeDatabase();
  registerIpcHandlers();
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  await disconnectDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  await disconnectDatabase();
});

export { mainWindow };
