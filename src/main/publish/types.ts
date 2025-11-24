/**
 * Publishing-related type definitions
 */

export interface BlogTarget {
  id: string;
  name: string;
  github: {
    repo: string; // e.g., "username/blog-repo"
    branch: string; // e.g., "main"
    token: string; // GitHub Personal Access Token
  };
  vercel: {
    projectId: string;
    teamId?: string;
    token: string; // Vercel API token
  };
  content: {
    path: string; // e.g., "src/content/posts/"
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

export interface VercelDeployment {
  id: string;
  url: string;
  state: 'BUILDING' | 'ERROR' | 'INITIALIZING' | 'QUEUED' | 'READY' | 'CANCELED';
  readyState: 'BUILDING' | 'ERROR' | 'INITIALIZING' | 'QUEUED' | 'READY' | 'CANCELED';
  created: number;
  creator: {
    uid: string;
    username: string;
  };
}

export interface VercelDeploymentsResponse {
  deployments: VercelDeployment[];
}
