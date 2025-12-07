import { ipcMain } from 'electron';
import { vaultManager } from '../vault/VaultManager';
import type { TagManager } from '../vault/TagManager';
import { PublishManager } from '../publish/PublishManager';
import { ConfigManager } from '../publish/ConfigManager';
import { PublishTimingManager } from '../publish/PublishTimingManager';
import type { BlogTarget } from '../publish/types';

let publishManager: PublishManager | null = null;
let configManager: ConfigManager | null = null;
let tagManagerInstance: TagManager | null = null;
let timingManager: PublishTimingManager | null = null;

// Track active publish start times
const publishStartTimes: Map<string, { startTime: number; blogId: string }> = new Map();

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
  timingManager = new PublishTimingManager(vaultPath);
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

  // Publish to blog with direct content (from blog block)
  ipcMain.handle('publish:to-blog-direct', async (_event, blogId: string, content: string) => {
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

      const jobId = await publishManager!.publishDirect(blog, content);

      // Track start time for this job
      publishStartTimes.set(jobId, { startTime: Date.now(), blogId });

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

      publishManager.onProgress(jobId, async job => {
        event.sender.send(`publish:progress:${jobId}`, {
          status: job.status,
          progress: job.progress,
          steps: job.steps,
          error: job.error
        });

        // Record timing when job completes
        if ((job.status === 'completed' || job.status === 'failed') && timingManager) {
          const startInfo = publishStartTimes.get(jobId);
          if (startInfo) {
            const durationMs = Date.now() - startInfo.startTime;
            await timingManager.recordTiming(startInfo.blogId, durationMs, job.status === 'completed');
            publishStartTimes.delete(jobId);
          }
        }
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

  // Get average publish time
  ipcMain.handle('publish:get-average-time', async () => {
    try {
      if (!timingManager) {
        const vaultPath = vaultManager.getVaultPath();
        if (!vaultPath) {
          return { success: true, averageMs: 30000 }; // Default 30 seconds
        }
        timingManager = new PublishTimingManager(vaultPath);
      }

      const averageMs = await timingManager.getAveragePublishTime();
      return { success: true, averageMs };
    } catch (error: any) {
      return { success: true, averageMs: 30000 }; // Default on error
    }
  });
}
