import { contextBridge, ipcRenderer } from 'electron';

// Import types from main process
export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  extension?: string;
  modifiedAt?: number;
}

interface VaultResponse<T = any> {
  success: boolean;
  error?: string;
  [key: string]: any;
}

// Define the API that will be exposed to the renderer process
export interface ElectronAPI {
  // Vault operations
  vault: {
    initialize: (vaultPath?: string) => Promise<VaultResponse<{ path: string }>>;
    getPath: () => Promise<VaultResponse<{ path: string | null }>>;
    getFiles: () => Promise<VaultResponse<{ tree: FileNode }>>;
    readFile: (path: string) => Promise<VaultResponse<{ content: string }>>;
    writeFile: (path: string, content: string) => Promise<VaultResponse>;
    createFile: (path: string, content?: string) => Promise<VaultResponse>;
    deleteFile: (path: string) => Promise<VaultResponse>;
    createFolder: (path: string) => Promise<VaultResponse>;
    getTodayNote: () => Promise<
      VaultResponse<{ path: string; content: string; isNew: boolean }>
    >;
    getDailyNote: (date: string) => Promise<
      VaultResponse<{ path: string; content: string; isNew: boolean }>
    >;
    getDailyNoteDates: () => Promise<VaultResponse<{ dates: string[] }>>;
  };

  // Tag operations
  tags: {
    buildIndex: () => Promise<VaultResponse>;
    getAllTags: () => Promise<VaultResponse<{ tags: string[] }>>;
    getContent: (tag: string) => Promise<
      VaultResponse<{ content: Array<{ date: string; filePath: string; content: string }> }>
    >;
    extract: (content: string) => Promise<VaultResponse<{ tags: string[] }>>;
    getStats: (tag: string) => Promise<VaultResponse<{ count: number; lastUpdated: number }>>;
    deleteContent: (tag: string) => Promise<
      VaultResponse<{ filesModified: string[]; sectionsDeleted: number }>
    >;
  };

  // Publishing operations
  publish: {
    getBlogs: () => Promise<VaultResponse<{ blogs: any[] }>>;
    getBlog: (blogId: string) => Promise<VaultResponse<{ blog: any }>>;
    saveBlog: (blog: any) => Promise<VaultResponse>;
    deleteBlog: (blogId: string) => Promise<VaultResponse<{ deleted: boolean }>>;
    toBlog: (blogId: string, tag: string) => Promise<VaultResponse<{ jobId: string }>>;
    toBlogDirect: (blogId: string, content: string) => Promise<VaultResponse<{ jobId: string }>>;
    getStatus: (jobId: string) => Promise<
      VaultResponse<{ status: string; progress: number; steps: any[]; error?: string }>
    >;
    subscribe: (jobId: string, callback: (data: any) => void) => Promise<VaultResponse>;
    unsubscribe: (jobId: string) => Promise<VaultResponse>;
    getAverageTime: () => Promise<VaultResponse<{ averageMs: number }>>;
  };
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const api: ElectronAPI = {
  vault: {
    initialize: (vaultPath?: string) => ipcRenderer.invoke('vault:initialize', vaultPath),
    getPath: () => ipcRenderer.invoke('vault:get-path'),
    getFiles: () => ipcRenderer.invoke('vault:get-files'),
    readFile: (path: string) => ipcRenderer.invoke('vault:read-file', path),
    writeFile: (path: string, content: string) =>
      ipcRenderer.invoke('vault:write-file', path, content),
    createFile: (path: string, content: string = '') =>
      ipcRenderer.invoke('vault:create-file', path, content),
    deleteFile: (path: string) => ipcRenderer.invoke('vault:delete-file', path),
    createFolder: (path: string) => ipcRenderer.invoke('vault:create-folder', path),
    getTodayNote: () => ipcRenderer.invoke('vault:get-today-note'),
    getDailyNote: (date: string) => ipcRenderer.invoke('vault:get-daily-note', date),
    getDailyNoteDates: () => ipcRenderer.invoke('vault:get-daily-note-dates')
  },

  tags: {
    buildIndex: () => ipcRenderer.invoke('tags:build-index'),
    getAllTags: () => ipcRenderer.invoke('tags:get-all'),
    getContent: (tag: string) => ipcRenderer.invoke('tags:get-content', tag),
    extract: (content: string) => ipcRenderer.invoke('tags:extract', content),
    getStats: (tag: string) => ipcRenderer.invoke('tags:get-stats', tag),
    deleteContent: (tag: string) => ipcRenderer.invoke('tags:delete-content', tag)
  },

  publish: {
    getBlogs: () => ipcRenderer.invoke('publish:get-blogs'),
    getBlog: (blogId: string) => ipcRenderer.invoke('publish:get-blog', blogId),
    saveBlog: (blog: any) => ipcRenderer.invoke('publish:save-blog', blog),
    deleteBlog: (blogId: string) => ipcRenderer.invoke('publish:delete-blog', blogId),
    toBlog: (blogId: string, tag: string) =>
      ipcRenderer.invoke('publish:to-blog', blogId, tag),
    toBlogDirect: (blogId: string, content: string) =>
      ipcRenderer.invoke('publish:to-blog-direct', blogId, content),
    getStatus: (jobId: string) => ipcRenderer.invoke('publish:get-status', jobId),
    subscribe: async (jobId: string, callback: (data: any) => void) => {
      ipcRenderer.on(`publish:progress:${jobId}`, (_event, data) => callback(data));
      return ipcRenderer.invoke('publish:subscribe', jobId);
    },
    unsubscribe: (jobId: string) => {
      ipcRenderer.removeAllListeners(`publish:progress:${jobId}`);
      return ipcRenderer.invoke('publish:unsubscribe', jobId);
    },
    getAverageTime: () => ipcRenderer.invoke('publish:get-average-time')
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
