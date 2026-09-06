import { NetworkClient } from './network';

export interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  currentVersion: string;
  releaseNotes: string;
  downloadUrl?: string;
  publishedAt?: string;
}

export const CURRENT_VERSION = '1.0.0';
export const GITHUB_REPO = '123guaiguai/drive_comic';

export class UpdateService {
  /**
   * Check GitHub Releases for updates
   */
  static async checkUpdate(): Promise<UpdateInfo> {
    try {
      // Fetch latest release from GitHub API
      const res = await NetworkClient.get(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (res.status === 200 && res.data) {
        const release = res.data;
        const tagName: string = release.tag_name || '';
        const latestVersion = tagName.replace(/^v/, '').trim();
        const releaseNotes = release.body || '无详细更新说明';
        const publishedAt = release.published_at;

        // Find APK asset
        let downloadUrl = release.html_url;
        if (Array.isArray(release.assets)) {
          const apkAsset = release.assets.find(
            (a: any) => typeof a.name === 'string' && a.name.endsWith('.apk')
          );
          if (apkAsset && apkAsset.browser_download_url) {
            downloadUrl = apkAsset.browser_download_url;
          }
        }

        const hasUpdate = this.compareVersions(latestVersion, CURRENT_VERSION) > 0;

        return {
          hasUpdate,
          latestVersion,
          currentVersion: CURRENT_VERSION,
          releaseNotes,
          downloadUrl,
          publishedAt
        };
      }

      return {
        hasUpdate: false,
        latestVersion: CURRENT_VERSION,
        currentVersion: CURRENT_VERSION,
        releaseNotes: ''
      };
    } catch (e: any) {
      console.warn('Check update failed:', e);
      return {
        hasUpdate: false,
        latestVersion: CURRENT_VERSION,
        currentVersion: CURRENT_VERSION,
        releaseNotes: '网络请求超时或暂无发布版本'
      };
    }
  }

  /**
   * Compare semver strings: a > b -> 1, a < b -> -1, a == b -> 0
   */
  private static compareVersions(a: string, b: string): number {
    const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
    const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const na = pa[i] || 0;
      const nb = pb[i] || 0;
      if (na > nb) return 1;
      if (na < nb) return -1;
    }
    return 0;
  }
}
