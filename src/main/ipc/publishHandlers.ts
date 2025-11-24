import { ipcMain } from 'electron';
import { vaultManager } from '../vault/VaultManager';
import type { TagManager } from '../vault/TagManager';
import { PublishManager } from '../publish/PublishManager';
import { ConfigManager } from '../publish/ConfigManager';
import type { BlogTarget } from '../publish/types';

let publishManager: PublishManager | null = null;
let configManager: ConfigManager | null = null;
let tagManagerInstance: TagManager | null = null;

/**
 * Set the tag manager instance
 */
export function setPublishTagManager(manager: TagManager): void {
  tagManagerInstance = manager;
}

/**
 * Initialize publish managers when vault is ready
 */
export function initializePublishManagers(vaultPath: string): void {
  if (!tagManagerInstance) {
    throw new Error('Tag manager not set');
  }
  configManager = new ConfigManager(vaultPath);
  publishManager = new PublishManager(tagManagerInstance);
}

/**
 * Register all publish-related IPC handlers
 */
export function registerPublishHandlers(): void {
  // Get all blog configurations
  ipcMain.handle('publish:get-blogs', async () => {
    try {
      if (!configManager) {
        const vaultPath = vaultManager.getVaultPath();
        if (!vaultPath) {
          return { success: false, error: 'Vault not initialized' };
        }
        initializePublishManagers(vaultPath);
      }

      const blogs = await configManager!.load();
      return { success: true, blogs: blogs.blogs };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Get a specific blog configuration
  ipcMain.handle('publish:get-blog', async (_event, blogId: string) => {
    try {
      if (!configManager) {
        return { success: false, error: 'Vault not initialized' };
      }

      const blog = await configManager.getBlog(blogId);
      if (!blog) {
        return { success: false, error: 'Blog not found' };
      }

      return { success: true, blog };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Save blog configuration
  ipcMain.handle('publish:save-blog', async (_event, blog: BlogTarget) => {
    try {
      if (!configManager) {
        const vaultPath = vaultManager.getVaultPath();
        if (!vaultPath) {
          return { success: false, error: 'Vault not initialized' };
        }
        initializePublishManagers(vaultPath);
      }

      await configManager!.saveBlog(blog);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Delete blog configuration
  ipcMain.handle('publish:delete-blog', async (_event, blogId: string) => {
    try {
      if (!configManager) {
        return { success: false, error: 'Vault not initialized' };
      }

      const deleted = await configManager.deleteBlog(blogId);
      return { success: true, deleted };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Publish to blog
  ipcMain.handle('publish:to-blog', async (_event, blogId: string, tag: string) => {
    try {
      if (!publishManager || !configManager) {
        const vaultPath = vaultManager.getVaultPath();
        if (!vaultPath) {
          return { success: false, error: 'Vault not initialized' };
        }
        initializePublishManagers(vaultPath);
      }

      const blog = await configManager!.getBlog(blogId);
      if (!blog) {
        return { success: false, error: 'Blog not found' };
      }

      const jobId = await publishManager!.publish(blog, tag);
      return { success: true, jobId };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Get publish job status
  ipcMain.handle('publish:get-status', async (_event, jobId: string) => {
    try {
      if (!publishManager) {
        return { success: false, error: 'Publish manager not initialized' };
      }

      const job = publishManager.getJob(jobId);
      if (!job) {
        return { success: false, error: 'Job not found' };
      }

      return {
        success: true,
        status: job.status,
        progress: job.progress,
        steps: job.steps,
        error: job.error
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Subscribe to job progress
  ipcMain.handle('publish:subscribe', async (event, jobId: string) => {
    try {
      if (!publishManager) {
        return { success: false, error: 'Publish manager not initialized' };
      }

      publishManager.onProgress(jobId, job => {
        event.sender.send(`publish:progress:${jobId}`, {
          status: job.status,
          progress: job.progress,
          steps: job.steps,
          error: job.error
        });
      });

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Unsubscribe from job progress
  ipcMain.handle('publish:unsubscribe', async (_event, jobId: string) => {
    try {
      if (!publishManager) {
        return { success: false, error: 'Publish manager not initialized' };
      }

      publishManager.offProgress(jobId);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
