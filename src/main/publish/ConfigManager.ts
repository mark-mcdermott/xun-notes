/**
 * Manages blog target configurations
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { BlogTarget, PublishConfig } from './types';

export class ConfigManager {
  private configPath: string;
  private config: PublishConfig | null = null;

  constructor(vaultPath: string) {
    this.configPath = path.join(vaultPath, '.olite', 'publish-config.json');
  }

  /**
   * Load configuration from disk
   */
  async load(): Promise<PublishConfig> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(data);
      return this.config!;
    } catch (error) {
      // File doesn't exist, return empty config
      this.config = { blogs: [] };
      return this.config;
    }
  }

  /**
   * Save configuration to disk
   */
  async save(config: PublishConfig): Promise<void> {
    this.config = config;

    // Ensure .olite directory exists
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });

    // Write config
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  /**
   * Get all blog targets
   */
  async getBlogs(): Promise<BlogTarget[]> {
    if (!this.config) {
      await this.load();
    }
    return this.config!.blogs;
  }

  /**
   * Get a specific blog target by ID
   */
  async getBlog(id: string): Promise<BlogTarget | undefined> {
    const blogs = await this.getBlogs();
    return blogs.find(blog => blog.id === id);
  }

  /**
   * Add or update a blog target
   */
  async saveBlog(blog: BlogTarget): Promise<void> {
    if (!this.config) {
      await this.load();
    }

    const index = this.config!.blogs.findIndex(b => b.id === blog.id);

    if (index >= 0) {
      this.config!.blogs[index] = blog;
    } else {
      this.config!.blogs.push(blog);
    }

    await this.save(this.config!);
  }

  /**
   * Delete a blog target
   */
  async deleteBlog(id: string): Promise<boolean> {
    if (!this.config) {
      await this.load();
    }

    const index = this.config!.blogs.findIndex(b => b.id === id);

    if (index >= 0) {
      this.config!.blogs.splice(index, 1);
      await this.save(this.config!);
      return true;
    }

    return false;
  }
}
