import * as fs from 'fs/promises';
import * as path from 'path';

interface PublishTiming {
  timestamp: string;
  durationMs: number;
  blogId: string;
  success: boolean;
}

interface TimingData {
  timings: PublishTiming[];
}

const DEFAULT_PUBLISH_TIME_MS = 30000; // 30 seconds default
const MAX_TIMINGS_TO_KEEP = 50; // Keep last 50 timings

export class PublishTimingManager {
  private vaultPath: string;
  private timingFilePath: string;

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
    this.timingFilePath = path.join(vaultPath, '.xun', 'publish-times.json');
  }

  private async ensureXunFolder(): Promise<void> {
    const xunFolder = path.join(this.vaultPath, '.xun');
    try {
      await fs.mkdir(xunFolder, { recursive: true });
    } catch {
      // Folder might already exist
    }
  }

  private async loadTimings(): Promise<TimingData> {
    try {
      const content = await fs.readFile(this.timingFilePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return { timings: [] };
    }
  }

  private async saveTimings(data: TimingData): Promise<void> {
    await this.ensureXunFolder();
    await fs.writeFile(this.timingFilePath, JSON.stringify(data, null, 2));
  }

  /**
   * Record a publish timing
   */
  async recordTiming(blogId: string, durationMs: number, success: boolean): Promise<void> {
    const data = await this.loadTimings();

    data.timings.push({
      timestamp: new Date().toISOString(),
      durationMs,
      blogId,
      success
    });

    // Keep only the most recent timings
    if (data.timings.length > MAX_TIMINGS_TO_KEEP) {
      data.timings = data.timings.slice(-MAX_TIMINGS_TO_KEEP);
    }

    await this.saveTimings(data);
  }

  /**
   * Get the average publish time in milliseconds
   * Only considers successful publishes
   */
  async getAveragePublishTime(): Promise<number> {
    const data = await this.loadTimings();

    // Filter to only successful publishes
    const successfulTimings = data.timings.filter(t => t.success);

    if (successfulTimings.length === 0) {
      return DEFAULT_PUBLISH_TIME_MS;
    }

    const totalMs = successfulTimings.reduce((sum, t) => sum + t.durationMs, 0);
    return Math.round(totalMs / successfulTimings.length);
  }

  /**
   * Get all timings (for debugging/stats)
   */
  async getAllTimings(): Promise<PublishTiming[]> {
    const data = await this.loadTimings();
    return data.timings;
  }
}
