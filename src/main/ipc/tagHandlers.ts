import { ipcMain } from 'electron';
import type { TagManager } from '../vault/TagManager';

let tagManager: TagManager | null = null;

export function setTagManager(manager: TagManager): void {
  tagManager = manager;
}

/**
 * Register all tag-related IPC handlers
 */
export function registerTagHandlers(): void {
  // Build/rebuild tag index
  ipcMain.handle('tags:build-index', async () => {
    try {
      if (!tagManager) {
        return { success: false, error: 'Tag manager not initialized' };
      }
      await tagManager.buildIndex();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Get all tags
  ipcMain.handle('tags:get-all', async () => {
    try {
      if (!tagManager) {
        return { success: false, error: 'Tag manager not initialized' };
      }
      // Rebuild index to pick up any new tags
      await tagManager.buildIndex();
      const tags = tagManager.getAllTags();
      return { success: true, tags };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Get content for a specific tag
  ipcMain.handle('tags:get-content', async (_event, tag: string) => {
    try {
      if (!tagManager) {
        return { success: false, error: 'Tag manager not initialized' };
      }
      const content = tagManager.getTaggedContent(tag);
      return { success: true, content };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Extract tags from content
  ipcMain.handle('tags:extract', async (_event, content: string) => {
    try {
      if (!tagManager) {
        return { success: false, error: 'Tag manager not initialized' };
      }
      const tags = tagManager.extractTagsFromContent(content);
      return { success: true, tags };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Get tag statistics
  ipcMain.handle('tags:get-stats', async (_event, tag: string) => {
    try {
      if (!tagManager) {
        return { success: false, error: 'Tag manager not initialized' };
      }
      const stats = tagManager.getTagStats(tag);
      return { success: true, ...stats };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Delete all content for a tag
  ipcMain.handle('tags:delete-content', async (_event, tag: string) => {
    try {
      if (!tagManager) {
        return { success: false, error: 'Tag manager not initialized' };
      }
      const result = await tagManager.deleteTagContent(tag);
      return { success: true, ...result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
