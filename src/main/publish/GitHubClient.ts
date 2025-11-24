/**
 * GitHub API client for committing and pushing content
 */

import type { GitHubCommitResponse } from './types';

export class GitHubClient {
  private token: string;
  private baseUrl = 'https://api.github.com';

  constructor(token: string) {
    this.token = token;
  }

  /**
   * Get the latest commit SHA for a branch
   */
  async getLatestCommitSha(repo: string, branch: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/repos/${repo}/git/refs/heads/${branch}`, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to get latest commit: ${response.statusText}`);
    }

    const data = await response.json();
    return data.object.sha;
  }

  /**
   * Get file content from repository
   */
  async getFileContent(
    repo: string,
    path: string,
    branch: string
  ): Promise<{ content: string; sha: string } | null> {
    console.log('GitHubClient: getFileContent called');
    console.log('  repo:', repo);
    console.log('  path:', path);
    console.log('  branch:', branch);

    const response = await fetch(
      `${this.baseUrl}/repos/${repo}/contents/${path}?ref=${branch}`,
      {
        headers: this.getHeaders()
      }
    );

    console.log('  response status:', response.status);

    if (response.status === 404) {
      console.log('  File not found, returning null');
      return null; // File doesn't exist
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('  GitHub API error:', errorText);
      throw new Error(`Failed to get file content: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('  data keys:', Object.keys(data));
    console.log('  data.content type:', typeof data.content);
    console.log('  data.content length:', data.content?.length);

    const content = Buffer.from(data.content, 'base64').toString('utf-8');

    return {
      content,
      sha: data.sha
    };
  }

  /**
   * Create or update a file in the repository
   */
  async updateFile(
    repo: string,
    path: string,
    content: string,
    message: string,
    branch: string,
    sha?: string
  ): Promise<GitHubCommitResponse> {
    const encodedContent = Buffer.from(content).toString('base64');

    const body: any = {
      message,
      content: encodedContent,
      branch
    };

    if (sha) {
      body.sha = sha; // Required for updates
    }

    const response = await fetch(`${this.baseUrl}/repos/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to update file: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    return {
      sha: data.commit.sha,
      url: data.commit.html_url
    };
  }

  /**
   * Get repository information
   */
  async getRepository(repo: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/repos/${repo}`, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to get repository: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get latest workflow run for a commit
   */
  async getWorkflowRunsForCommit(repo: string, commitSha: string): Promise<any[]> {
    const response = await fetch(
      `${this.baseUrl}/repos/${repo}/actions/runs?head_sha=${commitSha}`,
      {
        headers: this.getHeaders()
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get workflow runs: ${response.statusText}`);
    }

    const data = await response.json();
    return data.workflow_runs || [];
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }
}
