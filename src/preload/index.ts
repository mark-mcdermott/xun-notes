import { contextBridge, ipcRenderer } from 'electron';

// Define the API that will be exposed to the renderer process
export interface ElectronAPI {
  // Vault operations
  vault: {
    getFiles: () => Promise<string[]>;
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
    createFile: (path: string, content: string) => Promise<void>;
    deleteFile: (path: string) => Promise<void>;
    createFolder: (path: string) => Promise<void>;
  };

  // Tag operations
  tags: {
    extractTags: (content: string) => Promise<string[]>;
    getTaggedContent: (tag: string) => Promise<Array<{ date: string; content: string }>>;
  };

  // Publishing operations
  publish: {
    toBlog: (blogId: string, tag: string) => Promise<{ success: boolean; jobId: string }>;
    getStatus: (jobId: string) => Promise<{ status: string; progress: number }>;
  };
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const api: ElectronAPI = {
  vault: {
    getFiles: () => ipcRenderer.invoke('vault:get-files'),
    readFile: (path: string) => ipcRenderer.invoke('vault:read-file', path),
    writeFile: (path: string, content: string) =>
      ipcRenderer.invoke('vault:write-file', path, content),
    createFile: (path: string, content: string) =>
      ipcRenderer.invoke('vault:create-file', path, content),
    deleteFile: (path: string) => ipcRenderer.invoke('vault:delete-file', path),
    createFolder: (path: string) => ipcRenderer.invoke('vault:create-folder', path)
  },

  tags: {
    extractTags: (content: string) => ipcRenderer.invoke('tags:extract', content),
    getTaggedContent: (tag: string) => ipcRenderer.invoke('tags:get-content', tag)
  },

  publish: {
    toBlog: (blogId: string, tag: string) =>
      ipcRenderer.invoke('publish:to-blog', blogId, tag),
    getStatus: (jobId: string) => ipcRenderer.invoke('publish:get-status', jobId)
  }
};

// Use contextBridge to safely expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', api);

// Type declaration for TypeScript in renderer process
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
