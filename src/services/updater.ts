import { NetworkClient } from './network';

export interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  currentVersion: string;
  releaseNotes: string;
  downloadUrl?: string;
  mirrorUrl?: string;
  publishedAt?: string;
  error?: string;
}

export const CURRENT_VERSION = '1.0.4';
export const GITHUB_REPO = '123guaiguai/drive_comic';

export class UpdateService {
  /**
   * Check for updates via domestic CDN mirror first, then fallback to GitHub API
   */
  static async checkUpdate(): Promise<UpdateInfo> {
    const timestamp = Date.now();
    const cdnEndpoints = [
      `https://fastly.jsdelivr.net/gh/${GITHUB_REPO}@main/version.json?t=${timestamp}`,
      `https://cdn.jsdelivr.net/gh/${GITHUB_REPO}@main/version.json?t=${timestamp}`
    ];

    // 1. Try CDN mirrors (High-speed & unblocked in mainland China)
    for (const endpoint of cdnEndpoints) {
      try {
        const res = await NetworkClient.get(endpoint, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        
        let vData: any = null;
        if (res.status === 200 && res.data) {
          if (typeof res.data === 'string') {
            try {
              vData = JSON.parse(res.data.replace(/^\uFEFF/, '').trim());
            } catch (e) {
              vData = null;
            }
          } else if (typeof res.data === 'object') {
            vData = res.data;
          }
        }

        if (vData && vData.version) {
          const latestVersion = (vData.version || '').replace(/^v/, '').trim();
          const hasUpdate = this.compareVersions(latestVersion, CURRENT_VERSION) > 0;
          return {
            hasUpdate,
            latestVersion,
            currentVersion: CURRENT_VERSION,
            releaseNotes: vData.releaseNotes || '性能优化与体验改进',
            downloadUrl: vData.downloadUrl,
            mirrorUrl: vData.mirrorUrl || (vData.downloadUrl ? `https://gh-proxy.com/${vData.downloadUrl}` : undefined),
            publishedAt: vData.publishedAt
          };
        }
      } catch (err) {
        console.warn(`CDN check failed on ${endpoint}:`, err);
      }
    }

    // 2. Fallback to GitHub API
    try {
      const res = await NetworkClient.get(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest?t=${timestamp}`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        }
      );

      let release: any = res.data;
      if (typeof release === 'string') {
        try {
          release = JSON.parse(release.replace(/^\uFEFF/, '').trim());
        } catch (e) {
          release = null;
        }
      }

      if (res.status === 200 && release && release.tag_name) {
        const tagName: string = release.tag_name || '';
        const latestVersion = tagName.replace(/^v/, '').trim();
        const releaseNotes = release.body || '性能优化与体验改进';
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
          mirrorUrl: downloadUrl ? `https://gh-proxy.com/${downloadUrl}` : undefined,
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
      console.warn('GitHub API check failed:', e);
      return {
        hasUpdate: false,
        latestVersion: CURRENT_VERSION,
        currentVersion: CURRENT_VERSION,
        releaseNotes: '',
        error: e.message || '网络连接超时，请检查网络或开启代理'
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
