/**
 * Publishing-related type definitions
 */

export interface BlogTarget {
  id: string;
  name: string;
  siteUrl?: string; // e.g., "https://markmcdermott.io" - base URL for post links
  github: {
    repo: string; // e.g., "username/blog-repo"
    branch: string; // e.g., "main"
    token: string; // GitHub Personal Access Token
  };
  cloudflare?: {
    accountId: string; // Cloudflare account ID
    projectName: string; // Pages project name
    token: string; // Cloudflare API token
  };
  content: {
    path: string; // e.g., "src/content/posts/" - path in GitHub repo
    livePostPath?: string; // e.g., "/posts/" - URL path on live site
    format: 'single-file' | 'multi-file'; // Single file per tag or split by date
    filename?: string; // Template for filename (e.g., "{tag}.md")
  };
}

export interface PublishConfig {
  blogs: BlogTarget[];
}

export interface PublishJob {
  id: string;
  blogId: string;
  tag: string;
  status: PublishStatus;
  progress: number; // 0-100
  startedAt: number;
  completedAt?: number;
  error?: string;
  steps: PublishStep[];
  postUrl?: string; // URL to the published post
}

export type PublishStatus =
  | 'pending'
  | 'preparing'
  | 'pushing'
  | 'building'
  | 'deploying'
  | 'completed'
  | 'failed';

export interface PublishStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
  error?: string;
}

export interface GitHubCommitResponse {
  sha: string;
  url: string;
}

export type CloudflareDeploymentStage = 'queued' | 'initialize' | 'clone_repo' | 'build' | 'deploy' | 'success' | 'failure' | 'canceled';

export interface CloudflareDeployment {
  id: string;
  url: string;
  environment: 'production' | 'preview';
  latest_stage: {
    name: CloudflareDeploymentStage;
    status: 'idle' | 'active' | 'success' | 'failure' | 'canceled';
    started_on: string | null;
    ended_on: string | null;
  };
  deployment_trigger: {
    type: string;
    metadata: {
      branch: string;
      commit_hash: string;
      commit_message: string;
    };
  };
  created_on: string;
}

export interface CloudflareDeploymentsResponse {
  success: boolean;
  errors: any[];
  messages: any[];
  result: CloudflareDeployment[];
}
