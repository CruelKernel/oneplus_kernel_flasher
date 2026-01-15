import type { GitHubRelease, GitHubAsset } from '../types';

const REPO_OWNER = 'CruelKernel';
const REPO_NAME = 'oneplus_kernel_patcher';

export class GitHubService {
  private releasesCache: GitHubRelease[] | null = null;

  async fetchReleases(): Promise<GitHubRelease[]> {
    if (this.releasesCache) {
      return this.releasesCache;
    }

    const response = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch releases: ${response.status} ${response.statusText}`);
    }

    this.releasesCache = await response.json();
    return this.releasesCache!;
  }

  async findMatchingRelease(firmwareVersion: string): Promise<GitHubRelease | null> {
    const releases = await this.fetchReleases();

    // Tag names match firmware version exactly
    // e.g., "CPH2551_15.0.0.822(EX01)"
    return releases.find(r => r.tag_name === firmwareVersion) || null;
  }

  getPatchedImageAsset(release: GitHubRelease): GitHubAsset | null {
    return release.assets.find(
      a => a.name === 'magisk_patched_init_boot.img'
    ) || null;
  }

  getStockImageAsset(release: GitHubRelease): GitHubAsset | null {
    return release.assets.find(
      a => a.name === 'init_boot.img'
    ) || null;
  }

  clearCache(): void {
    this.releasesCache = null;
  }
}
