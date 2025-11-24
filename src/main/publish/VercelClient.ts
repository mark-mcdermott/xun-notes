/**
 * Vercel API client for monitoring deployments
 */

import type { VercelDeployment, VercelDeploymentsResponse } from './types';

export class VercelClient {
  private token: string;
  private baseUrl = 'https://api.vercel.com';

  constructor(token: string) {
    this.token = token;
  }

  /**
   * Get recent deployments for a project
   */
  async getDeployments(
    projectId: string,
    teamId?: string,
    limit = 10
  ): Promise<VercelDeployment[]> {
    const params = new URLSearchParams({
      projectId,
      limit: limit.toString()
    });

    if (teamId) {
      params.append('teamId', teamId);
    }

    const response = await fetch(`${this.baseUrl}/v6/deployments?${params}`, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to get deployments: ${response.statusText}`);
    }

    const data: VercelDeploymentsResponse = await response.json();
    return data.deployments;
  }

  /**
   * Get a specific deployment by ID
   */
  async getDeployment(deploymentId: string, teamId?: string): Promise<VercelDeployment> {
    const params = new URLSearchParams();
    if (teamId) {
      params.append('teamId', teamId);
    }

    const url = `${this.baseUrl}/v13/deployments/${deploymentId}${params.toString() ? `?${params}` : ''}`;

    const response = await fetch(url, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to get deployment: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get the latest deployment for a project
   */
  async getLatestDeployment(projectId: string, teamId?: string): Promise<VercelDeployment | null> {
    const deployments = await this.getDeployments(projectId, teamId, 1);
    return deployments.length > 0 ? deployments[0] : null;
  }

  /**
   * Wait for a deployment to complete (with timeout)
   */
  async waitForDeployment(
    deploymentId: string,
    teamId?: string,
    options: {
      pollInterval?: number; // ms
      timeout?: number; // ms
      onProgress?: (deployment: VercelDeployment) => void;
    } = {}
  ): Promise<VercelDeployment> {
    const { pollInterval = 3000, timeout = 600000, onProgress } = options; // Default: 3s poll, 10min timeout

    const startTime = Date.now();

    while (true) {
      const deployment = await this.getDeployment(deploymentId, teamId);

      if (onProgress) {
        onProgress(deployment);
      }

      // Terminal states
      if (deployment.readyState === 'READY') {
        return deployment;
      }

      if (deployment.readyState === 'ERROR' || deployment.readyState === 'CANCELED') {
        throw new Error(`Deployment ${deployment.readyState.toLowerCase()}`);
      }

      // Check timeout
      if (Date.now() - startTime > timeout) {
        throw new Error('Deployment timeout exceeded');
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  /**
   * Find deployment by commit SHA (requires matching git metadata)
   */
  async findDeploymentByCommit(
    projectId: string,
    commitSha: string,
    teamId?: string
  ): Promise<VercelDeployment | null> {
    const deployments = await this.getDeployments(projectId, teamId, 20);

    console.log('VercelClient: Found', deployments.length, 'recent deployments');

    // Vercel deployments have gitSource metadata that includes commit SHA
    for (const deployment of deployments) {
      const gitSource = (deployment as any).gitSource;
      console.log('  Deployment', deployment.id, 'gitSource:', gitSource ? gitSource.sha : 'no git source');
      if (gitSource && gitSource.sha === commitSha) {
        console.log('  ✓ Match found!');
        return deployment;
      }
    }

    console.log('  No matching deployment found. Looking for SHA:', commitSha);
    return null;
  }

  /**
   * Get deployment progress as percentage (0-100)
   */
  getDeploymentProgress(deployment: VercelDeployment): number {
    switch (deployment.readyState) {
      case 'INITIALIZING':
        return 10;
      case 'QUEUED':
        return 25;
      case 'BUILDING':
        return 50;
      case 'READY':
        return 100;
      case 'ERROR':
      case 'CANCELED':
        return 0;
      default:
        return 0;
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }
}
