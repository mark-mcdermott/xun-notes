/**
 * Manages publishing workflows to blogs via GitHub and Cloudflare Pages
 */

import { randomUUID } from 'crypto';
import type { TagManager } from '../vault/TagManager';
import { GitHubClient } from './GitHubClient';
import { CloudflareClient } from './CloudflareClient';
import type { BlogTarget, PublishJob, PublishStatus, PublishStep } from './types';

export class PublishManager {
  private tagManager: TagManager;
  private jobs = new Map<string, PublishJob>();
  private progressCallbacks = new Map<string, (job: PublishJob) => void>();

  constructor(tagManager: TagManager) {
    this.tagManager = tagManager;
  }

  /**
   * Start a publish job
   */
  async publish(blogTarget: BlogTarget, tag: string): Promise<string> {
    const jobId = randomUUID();

    const hasCloudflare = Boolean(blogTarget.cloudflare?.token);
    const steps: PublishStep[] = [
      { name: 'Preparing content', status: 'in_progress' },
      { name: 'Pushing to GitHub', status: 'pending' }
    ];

    if (hasCloudflare) {
      steps.push({ name: 'Waiting for Cloudflare deployment to finish', status: 'pending' });
    }
    steps.push({ name: 'Publish complete', status: 'pending' });

    const job: PublishJob = {
      id: jobId,
      blogId: blogTarget.id,
      tag,
      status: 'preparing',
      progress: 0,
      startedAt: Date.now(),
      steps
    };

    this.jobs.set(jobId, job);
    this.notifyProgress(jobId);

    // Run publish workflow in background
    this.runPublishWorkflow(jobId, blogTarget, tag).catch(error => {
      this.updateJobStatus(jobId, 'failed', 0, error.message);
    });

    return jobId;
  }

  /**
   * Start a publish job with direct content (from blog block)
   */
  async publishDirect(blogTarget: BlogTarget, content: string): Promise<string> {
    const jobId = randomUUID();

    const hasCloudflare = Boolean(blogTarget.cloudflare?.token);
    const steps: PublishStep[] = [
      { name: 'Preparing content', status: 'in_progress' },
      { name: 'Pushing to GitHub', status: 'pending' }
    ];

    if (hasCloudflare) {
      steps.push({ name: 'Waiting for Cloudflare deployment to finish', status: 'pending' });
    }
    steps.push({ name: 'Publish complete', status: 'pending' });

    const job: PublishJob = {
      id: jobId,
      blogId: blogTarget.id,
      tag: 'direct',
      status: 'preparing',
      progress: 0,
      startedAt: Date.now(),
      steps
    };

    this.jobs.set(jobId, job);
    this.notifyProgress(jobId);

    // Run publish workflow in background
    this.runPublishDirectWorkflow(jobId, blogTarget, content).catch(error => {
      this.updateJobStatus(jobId, 'failed', 0, error.message);
    });

    return jobId;
  }

  /**
   * Get job status
   */
  getJob(jobId: string): PublishJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Subscribe to job progress updates
   */
  onProgress(jobId: string, callback: (job: PublishJob) => void): void {
    this.progressCallbacks.set(jobId, callback);
  }

  /**
   * Unsubscribe from job progress updates
   */
  offProgress(jobId: string): void {
    this.progressCallbacks.delete(jobId);
  }

  private async runPublishWorkflow(
    jobId: string,
    blogTarget: BlogTarget,
    tag: string
  ): Promise<void> {
    try {
      console.log('PublishManager: Starting workflow for tag:', tag);
      const hasCloudflare = Boolean(blogTarget.cloudflare?.token);

      // Step 1: Prepare content
      this.updateJobProgress(jobId, 'preparing', 10);
      const content = await this.prepareContent(tag);

      if (!content) {
        throw new Error('Content preparation returned empty result');
      }

      this.updateStepStatus(jobId, 0, 'completed');

      // Step 2: Push to GitHub
      this.updateJobProgress(jobId, 'pushing', 30);
      this.updateStepStatus(jobId, 1, 'in_progress');

      const githubClient = new GitHubClient(blogTarget.github.token);
      const commitSha = await this.pushToGitHub(githubClient, blogTarget, tag, content);

      this.updateStepStatus(jobId, 1, 'completed', `Pushed commit ${commitSha.slice(0, 7)}`);

      // Step 3: Wait for Cloudflare deployment (if configured)
      if (hasCloudflare && blogTarget.cloudflare) {
        this.updateJobProgress(jobId, 'building', 40);
        this.updateStepStatus(jobId, 2, 'in_progress');

        const cloudflareClient = new CloudflareClient(
          blogTarget.cloudflare.token,
          blogTarget.cloudflare.accountId
        );

        await this.waitForCloudflareDeployment(
          jobId,
          cloudflareClient,
          blogTarget,
          commitSha
        );

        this.updateStepStatus(jobId, 2, 'completed', 'Deployment successful');
        this.updateStepStatus(jobId, 3, 'completed');
      } else {
        // No Cloudflare config - just mark as complete
        this.updateStepStatus(jobId, 2, 'completed');
      }

      this.updateJobStatus(jobId, 'completed', 100);
    } catch (error) {
      console.error('PublishManager: Workflow error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : '';
      console.error('PublishManager: Error stack:', errorStack);
      this.updateJobStatus(jobId, 'failed', 0, errorMessage);
      // Don't re-throw - we want to keep the UI alive to show the error
    }
  }

  private async runPublishDirectWorkflow(
    jobId: string,
    blogTarget: BlogTarget,
    rawContent: string
  ): Promise<void> {
    try {
      console.log('PublishManager: Starting direct workflow');
      const hasCloudflare = Boolean(blogTarget.cloudflare?.token);

      // Step 1: Prepare content from raw blog block content
      this.updateJobProgress(jobId, 'preparing', 10);
      const content = this.prepareDirectContent(rawContent);

      if (!content) {
        throw new Error('Content preparation returned empty result');
      }

      this.updateStepStatus(jobId, 0, 'completed');

      // Step 2: Push to GitHub
      this.updateJobProgress(jobId, 'pushing', 30);
      this.updateStepStatus(jobId, 1, 'in_progress');

      const githubClient = new GitHubClient(blogTarget.github.token);
      // Extract title from frontmatter for filename
      const titleMatch = content.match(/title:\s*"([^"]*)"/);
      const title = titleMatch?.[1] || 'untitled';
      const { sha: commitSha, slug } = await this.pushToGitHubDirect(githubClient, blogTarget, title, content);

      this.updateStepStatus(jobId, 1, 'completed', `Pushed commit ${commitSha.slice(0, 7)}`);

      // Store slug and postUrl in job for the renderer to retrieve
      const job = this.jobs.get(jobId);
      if (job) {
        (job as any).slug = slug;
        // Construct post URL - use siteUrl if configured, otherwise derive from blog name
        let baseUrl = blogTarget.siteUrl?.replace(/\/$/, '');
        if (!baseUrl && blogTarget.name.includes('.')) {
          // Blog name looks like a domain (e.g., "markmcdermott.io")
          baseUrl = `https://${blogTarget.name}`;
        }
        if (baseUrl) {
          job.postUrl = `${baseUrl}/posts/${slug}`;
        }
      }

      // Step 3: Wait for Cloudflare deployment (if configured)
      if (hasCloudflare && blogTarget.cloudflare) {
        this.updateJobProgress(jobId, 'building', 40);
        this.updateStepStatus(jobId, 2, 'in_progress');

        const cloudflareClient = new CloudflareClient(
          blogTarget.cloudflare.token,
          blogTarget.cloudflare.accountId
        );

        await this.waitForCloudflareDeployment(
          jobId,
          cloudflareClient,
          blogTarget,
          commitSha
        );

        this.updateStepStatus(jobId, 2, 'completed', 'Deployment successful');
        this.updateStepStatus(jobId, 3, 'completed');
      } else {
        // No Cloudflare config - just mark as complete
        this.updateStepStatus(jobId, 2, 'completed');
      }

      this.updateJobStatus(jobId, 'completed', 100);
    } catch (error) {
      console.error('PublishManager: Direct workflow error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateJobStatus(jobId, 'failed', 0, errorMessage);
    }
  }

  /**
   * Prepare content from a direct blog block (already has frontmatter, just needs formatting)
   */
  private prepareDirectContent(rawContent: string): string {
    // The content already has frontmatter (---, title, description, etc.)
    // Just need to ensure it's properly formatted
    // The blog: field has already been stripped by the editor

    // If content starts with ---, it's already frontmatter
    if (rawContent.trim().startsWith('---')) {
      // Check if date field is missing and add current date if so
      const hasDate = /\bdate:\s*"/.test(rawContent);
      if (!hasDate) {
        const today = new Date().toISOString().split('T')[0];
        // Insert date after the opening ---
        return rawContent.replace(
          /^(---\s*\n)/,
          `$1date: "${today}"\n`
        );
      }
      return rawContent;
    }

    // Otherwise, the content is the frontmatter body - we need to extract and format
    // This shouldn't happen if the editor sends correctly, but handle gracefully
    return rawContent;
  }

  private async pushToGitHubDirect(
    client: GitHubClient,
    blogTarget: BlogTarget,
    title: string,
    content: string
  ): Promise<{ sha: string; slug: string }> {
    console.log('PublishManager: pushToGitHubDirect called');
    console.log('  title:', title);
    console.log('  content length:', content?.length);

    const { repo, branch } = blogTarget.github;
    const { path: basePath, filename } = blogTarget.content;

    // Extract date from frontmatter (format: YYYY-MM-DD)
    const dateMatch = content.match(/\bdate:\s*"(\d{4}-\d{2}-\d{2})"/);
    const dateValue = dateMatch?.[1] || new Date().toISOString().split('T')[0];

    // Sanitize title for filename
    const titleSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Full slug includes date prefix (YYYY-MM-DD-title-slug)
    const newSlug = `${dateValue}-${titleSlug}`;

    // Check if there's an existing slug in the content (from previous publish)
    const slugMatch = content.match(/slug:\s*"([^"]*)"/);
    const oldSlug = slugMatch?.[1];

    console.log('  newSlug:', newSlug);
    console.log('  oldSlug:', oldSlug);

    // If slug changed, delete the old file first
    if (oldSlug && oldSlug !== newSlug) {
      const oldFileName = filename?.replace('{tag}', oldSlug) || `${oldSlug}.md`;
      const oldFilePath = `${basePath}${oldFileName}`;
      console.log('  Slug changed, deleting old file:', oldFilePath);

      const oldFile = await client.getFileContent(repo, oldFilePath, branch);
      if (oldFile) {
        await client.deleteFile(
          repo,
          oldFilePath,
          `Rename ${oldSlug} to ${newSlug}`,
          branch,
          oldFile.sha
        );
        console.log('  Old file deleted');
      }
    }

    // Determine new file path
    const fileName = filename?.replace('{tag}', newSlug) || `${newSlug}.md`;
    const filePath = `${basePath}${fileName}`;
    console.log('  filePath:', filePath);

    // Check if new file path exists (for update case where slug didn't change)
    const existing = await client.getFileContent(repo, filePath, branch);

    // Create or update file
    const commitMessage = existing
      ? `Update ${title}`
      : `Add ${title}`;

    const result = await client.updateFile(
      repo,
      filePath,
      content,
      commitMessage,
      branch,
      existing?.sha
    );

    return { sha: result.sha, slug: newSlug };
  }

  private async prepareContent(tag: string): Promise<string> {
    console.log('PublishManager: prepareContent called with tag:', tag);
    const content = this.tagManager.getTaggedContent(tag);
    console.log('PublishManager: getTaggedContent returned:', content);

    if (!content || content.length === 0) {
      throw new Error('No content found for tag');
    }

    // Collect all content
    let allContent = '';
    for (const entry of content) {
      allContent += entry.content + '\n\n';
    }

    // Check for === blog block format
    const blogBlockMatch = allContent.match(/^===\s*\n([\s\S]*?)\n===\s*$/m);
    if (blogBlockMatch) {
      console.log('PublishManager: Found === blog block');
      const blockContent = blogBlockMatch[1];

      // Extract frontmatter from inside the block
      const frontmatterMatch = blockContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        const body = frontmatterMatch[2].trim();

        // Parse frontmatter fields
        const titleMatch = frontmatter.match(/title:\s*"([^"]*)"/);
        const subtitleMatch = frontmatter.match(/subtitle:\s*"([^"]*)"/);
        const dateMatch = frontmatter.match(/date:\s*"([^"]*)"/);
        const tagsMatch = frontmatter.match(/tags:\s*\[([^\]]*)\]/);

        const title = titleMatch?.[1] || tag.replace(/^#/, '');
        const subtitle = subtitleMatch?.[1] || `Notes for ${tag}`;
        const dateValue = dateMatch?.[1] || new Date().toISOString().split('T')[0];
        const tags = tagsMatch?.[1] || `"${tag.replace(/^#/, '')}"`;

        // Build final markdown with extracted frontmatter
        let markdown = `---\n`;
        markdown += `title: "${title}"\n`;
        markdown += `subtitle: "${subtitle}"\n`;
        markdown += `date: "${dateValue}"\n`;
        markdown += `tags: [${tags}]\n`;
        markdown += `---\n\n`;
        markdown += body || subtitle;

        console.log('PublishManager: prepared markdown from blog block:', markdown.substring(0, 100));
        return markdown;
      }
    }

    // Fallback: Legacy format without === blocks
    console.log('PublishManager: Using legacy format (no === block found)');

    // Get the most recent date for the post
    const latestDate = content[0]?.date || new Date().toISOString().split('T')[0];

    // Split into lines and extract title/subtitle
    const lines = allContent.split('\n');
    const title = lines[0]?.trim() || tag.replace(/^#/, '');
    const subtitle = lines[1]?.trim() || `Notes for ${tag}`;

    // Body starts after the first two lines and any blank lines
    let bodyStartIndex = 2;
    while (bodyStartIndex < lines.length && !lines[bodyStartIndex].trim()) {
      bodyStartIndex++;
    }
    const body = lines.slice(bodyStartIndex).join('\n').trim() || subtitle;

    // Format content as Astro markdown with frontmatter
    const tagName = tag.replace(/^#/, '');
    let markdown = `---\n`;
    markdown += `title: "${title}"\n`;
    markdown += `subtitle: "${subtitle}"\n`;
    markdown += `date: "${latestDate}"\n`;
    markdown += `tags: ["${tagName}"]\n`;
    markdown += `---\n\n`;
    markdown += body;

    console.log('PublishManager: prepared markdown:', markdown.substring(0, 100));
    return markdown;
  }

  private async pushToGitHub(
    client: GitHubClient,
    blogTarget: BlogTarget,
    tag: string,
    content: string
  ): Promise<string> {
    console.log('PublishManager: pushToGitHub called');
    console.log('  tag:', tag);
    console.log('  content length:', content?.length);
    console.log('  content type:', typeof content);

    const { repo, branch } = blogTarget.github;
    const { path: basePath, filename } = blogTarget.content;

    // Remove # from tag for filename (GitHub doesn't handle # well in URLs)
    const sanitizedTag = tag.replace(/^#/, '');

    // Determine file path
    const fileName = filename?.replace('{tag}', sanitizedTag) || `${sanitizedTag}.md`;
    const filePath = `${basePath}${fileName}`;
    console.log('  sanitizedTag:', sanitizedTag);
    console.log('  filePath:', filePath);

    // Check if file exists
    const existing = await client.getFileContent(repo, filePath, branch);

    // Create or update file
    const commitMessage = existing
      ? `Update ${tag} content`
      : `Add ${tag} content`;

    console.log('  Calling updateFile with content:', content.substring(0, 50));
    const result = await client.updateFile(
      repo,
      filePath,
      content,
      commitMessage,
      branch,
      existing?.sha
    );

    return result.sha;
  }

  private async waitForCloudflareDeployment(
    jobId: string,
    client: CloudflareClient,
    blogTarget: BlogTarget,
    commitSha: string
  ): Promise<void> {
    const projectName = blogTarget.cloudflare!.projectName;

    console.log('PublishManager: Waiting for Cloudflare Pages deployment');
    console.log('  projectName:', projectName);
    console.log('  commitSha:', commitSha);

    // Poll for deployment that matches the commit
    let deployment = null;
    let attempts = 0;
    const maxAttempts = 40; // 2 minutes max wait for deployment to appear (40 × 3s = 120s)

    while (!deployment && attempts < maxAttempts) {
      console.log(`  Polling attempt ${attempts + 1}/${maxAttempts}`);
      deployment = await client.findDeploymentByCommit(projectName, commitSha);
      if (!deployment) {
        console.log('  No matching deployment found yet, waiting...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        attempts++;
      } else {
        console.log('  Found deployment:', deployment.id);
      }
    }

    if (!deployment) {
      console.error('  Deployment not found after', maxAttempts, 'attempts');
      throw new Error('Deployment not found on Cloudflare Pages');
    }

    // Wait for deployment to complete
    console.log('  Waiting for deployment to complete...');
    await client.waitForDeployment(projectName, deployment.id, {
      pollInterval: 3000,
      timeout: 600000, // 10 minutes
      onProgress: dep => {
        console.log('  Deployment stage:', dep.latest_stage.name, dep.latest_stage.status);
        const progress = 40 + (client.getDeploymentProgress(dep) * 0.6); // 40-100%
        this.updateJobProgress(jobId, 'building', progress);
      }
    });
  }

  private updateJobProgress(jobId: string, status: PublishStatus, progress: number): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = status;
    job.progress = progress;
    this.notifyProgress(jobId);
  }

  private updateJobStatus(
    jobId: string,
    status: PublishStatus,
    progress: number,
    error?: string
  ): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = status;
    job.progress = progress;
    if (error) job.error = error;
    if (status === 'completed' || status === 'failed') {
      job.completedAt = Date.now();
    }

    this.notifyProgress(jobId);
  }

  private updateStepStatus(
    jobId: string,
    stepIndex: number,
    status: PublishStep['status'],
    message?: string
  ): void {
    const job = this.jobs.get(jobId);
    if (!job || !job.steps[stepIndex]) return;

    job.steps[stepIndex].status = status;
    if (message) job.steps[stepIndex].message = message;
    this.notifyProgress(jobId);
  }

  private notifyProgress(jobId: string): void {
    const job = this.jobs.get(jobId);
    const callback = this.progressCallbacks.get(jobId);

    if (job && callback) {
      callback(job);
    }
  }
}
