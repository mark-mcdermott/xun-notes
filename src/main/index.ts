import { app, BrowserWindow } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { registerVaultHandlers } from './ipc/vaultHandlers';
import { registerTagHandlers, setTagManager } from './ipc/tagHandlers';
import { registerPublishHandlers, initializePublishManagers, setPublishTagManager } from './ipc/publishHandlers';
import { vaultManager } from './vault/VaultManager';
import { TagManager } from './vault/TagManager';

// ES modules equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 }
  });

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// Create tag manager
const tagManager = new TagManager(vaultManager);

// Register IPC handlers
registerVaultHandlers();
registerTagHandlers();
registerPublishHandlers();
setTagManager(tagManager);
setPublishTagManager(tagManager);

// This method will be called when Electron has finished
// initialization and is ready to create browser windows
app.whenReady().then(async () => {
  // Initialize vault before creating window
  try {
    await vaultManager.initialize();
    console.log('Vault initialized at:', vaultManager.getVaultPath());

    // Build tag index
    await tagManager.buildIndex();
    console.log('Tag index built, tags:', tagManager.getAllTags());

    // Initialize publish managers
    const vaultPath = vaultManager.getVaultPath();
    if (vaultPath) {
      initializePublishManagers(vaultPath);
    }
  } catch (error) {
    console.error('Failed to initialize vault:', error);
  }

  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
