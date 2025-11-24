/**
 * Manages publishing workflows to blogs via GitHub and Vercel
 */

import { randomUUID } from 'crypto';
import type { TagManager } from '../vault/TagManager';
import { GitHubClient } from './GitHubClient';
import { VercelClient } from './VercelClient';
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

    const job: PublishJob = {
      id: jobId,
      blogId: blogTarget.id,
      tag,
      status: 'preparing',
      progress: 0,
      startedAt: Date.now(),
      steps: [
        { name: 'Preparing content', status: 'in_progress' },
        { name: 'Pushing to GitHub', status: 'pending' },
        { name: 'Triggering Vercel deployment', status: 'pending' },
        { name: 'Publish complete', status: 'pending' }
      ]
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

      // Step 3: Note about Vercel deployment
      this.updateJobProgress(jobId, 'building', 75);
      this.updateStepStatus(jobId, 2, 'completed', 'Vercel will auto-deploy from GitHub');

      // Step 4: Complete
      this.updateStepStatus(jobId, 3, 'completed');
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

  private async prepareContent(tag: string): Promise<string> {
    console.log('PublishManager: prepareContent called with tag:', tag);
    const content = this.tagManager.getTaggedContent(tag);
    console.log('PublishManager: getTaggedContent returned:', content);

    if (!content || content.length === 0) {
      throw new Error('No content found for tag');
    }

    // Get the most recent date for publishDate
    const latestDate = content[0]?.date || new Date().toISOString().split('T')[0];

    // Collect all content and parse first line as title, second as description
    let allContent = '';
    for (const entry of content) {
      allContent += entry.content + '\n\n';
    }

    // Split into lines and extract title/description
    const lines = allContent.split('\n');
    const title = lines[0]?.trim() || tag.replace(/^#/, '');
    const description = lines[1]?.trim() || `Notes for ${tag}`;

    // Body starts after the first two lines and any blank lines
    let bodyStartIndex = 2;
    while (bodyStartIndex < lines.length && !lines[bodyStartIndex].trim()) {
      bodyStartIndex++;
    }
    const body = lines.slice(bodyStartIndex).join('\n').trim();

    // Format content as Astro markdown with frontmatter
    let markdown = `---\n`;
    markdown += `title: "${title}"\n`;
    markdown += `description: "${description}"\n`;
    markdown += `publishDate: "${latestDate}"\n`;
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

  private async waitForVercelDeployment(
    jobId: string,
    client: VercelClient,
    blogTarget: BlogTarget,
    commitSha: string
  ): Promise<void> {
    const { projectId, teamId } = blogTarget.vercel;

    console.log('PublishManager: Waiting for Vercel deployment');
    console.log('  projectId:', projectId);
    console.log('  commitSha:', commitSha);
    console.log('  teamId:', teamId);

    // Poll for deployment that matches the commit
    let deployment = null;
    let attempts = 0;
    const maxAttempts = 40; // 2 minutes max wait for deployment to appear (40 × 3s = 120s)

    while (!deployment && attempts < maxAttempts) {
      console.log(`  Polling attempt ${attempts + 1}/${maxAttempts}`);
      deployment = await client.findDeploymentByCommit(projectId, commitSha, teamId);
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
      throw new Error('Deployment not found on Vercel');
    }

    // Wait for deployment to complete
    console.log('  Waiting for deployment to complete...');
    await client.waitForDeployment(deployment.id, teamId, {
      pollInterval: 3000,
      timeout: 600000, // 10 minutes
      onProgress: dep => {
        console.log('  Deployment status:', dep.readyState);
        const progress = 50 + (client.getDeploymentProgress(dep) / 2); // 50-100%
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
