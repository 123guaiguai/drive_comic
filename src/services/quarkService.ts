import { DriveItem, ComicPage } from '../types/comic';
import { isImageFile, naturalCompare } from './naturalSort';
import { NetworkClient } from './network';

export interface QuarkFileUrls {
  previewUrl?: string;
  downloadUrl?: string;
  bigThumbnail?: string;
  thumbnail?: string;
}

export class QuarkService {
  private cookie: string;

  constructor(cookie: string) {
    this.cookie = cookie.trim();
  }

  private getHeaders(): Record<string, string> {
    return {
      'Cookie': this.cookie,
      'Referer': 'https://pan.quark.cn/',
      'Origin': 'https://pan.quark.cn'
    };
  }

  /**
   * Check if the cookie is valid
   */
  async testConnection(): Promise<{ success: boolean; message: string; nickname?: string }> {
    try {
      const res = await NetworkClient.get(
        'https://drive-pc.quark.cn/1/clouddrive/file/sort',
        {
          headers: this.getHeaders(),
          params: {
            pr: 'ucpro',
            fr: 'pc',
            pdir_fid: '0',
            _page: '1',
            _size: '5'
          }
        }
      );

      if (res.data && res.data.code === 0) {
        return { success: true, message: '夸克网盘连接成功' };
      }
      return {
        success: false,
        message: res.data?.message || `连接失败 (代码: ${res.data?.code || res.status})`
      };
    } catch (e: any) {
      return { success: false, message: e.message || '网络连接超时或 Cookie 失效' };
    }
  }

  /**
   * List files and folders inside a directory
   * @param pdir_fid '0' for root, or folder fid
   */
  async listFolder(pdir_fid: string = '0', page: number = 1, size: number = 200): Promise<{
    items: DriveItem[];
    total: number;
    hasMore: boolean;
  }> {
    const res = await NetworkClient.get(
      'https://drive-pc.quark.cn/1/clouddrive/file/sort',
      {
        headers: this.getHeaders(),
        params: {
          pr: 'ucpro',
          fr: 'pc',
          pdir_fid,
          _page: page.toString(),
          _size: size.toString(),
          _sort: 'file_name:asc'
        }
      }
    );

    if (!res.data || res.data.code !== 0) {
      throw new Error(res.data?.message || '获取夸克网盘目录失败');
    }

    const rawList: any[] = res.data.data?.list || [];
    const total: number = res.data.data?._total || rawList.length;

    const items: DriveItem[] = rawList.map((item) => {
      const isDir = item.file_type === 0 || item.format_type === 'folder';
      const preview = item.preview_url || item.big_thumbnail || item.thumbnail;
      return {
        id: item.fid,
        name: item.file_name,
        path: item.fid,
        isDir,
        size: item.size,
        updatedAt: item.updated_at,
        driveType: 'quark',
        thumbnail: preview || undefined,
        hasImages: isDir ? undefined : isImageFile(item.file_name)
      };
    });

    // Sort items: folders first, then natural order by name
    items.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return naturalCompare(a.name, b.name);
    });

    return {
      items,
      total,
      hasMore: page * size < total
    };
  }

  /**
   * Get comic pages (all image files in a folder, sorted naturally, with download links)
   */
  async getChapterPages(folderFid: string): Promise<ComicPage[]> {
    // 1. Get all files in the folder
    let allFiles: DriveItem[] = [];
    let page = 1;
    const pageSize = 200;
    let hasMore = true;

    while (hasMore) {
      const res = await this.listFolder(folderFid, page, pageSize);
      allFiles = allFiles.concat(res.items);
      hasMore = res.hasMore;
      page++;
    }

    // 2. Filter image files only
    const imageFiles = allFiles.filter((f) => !f.isDir && isImageFile(f.name));

    // 3. Sort by natural filename order
    imageFiles.sort((a, b) => naturalCompare(a.name, b.name));

    if (imageFiles.length === 0) {
      return [];
    }

    // 4. Batch request download links for all images in the chapter
    const fids = imageFiles.map((f) => f.id);
    const downloadMap = await this.batchGetDownloadUrls(fids);

    return imageFiles.map((f, idx) => {
      const info = downloadMap[f.id];
      // Quark preview_url is the HD preview with token authentication (works directly in browser/webview with no-referrer).
      // Fallback to download_url, bigThumbnail, or list thumbnail if not available.
      const url = info?.previewUrl || info?.downloadUrl || f.thumbnail || '';
      return {
        id: f.id,
        index: idx + 1,
        filename: f.name,
        url,
        downloadUrl: info?.downloadUrl || url,
        thumbnailUrl: info?.bigThumbnail || info?.thumbnail || f.thumbnail
      };
    });
  }

  /**
   * Batch get direct download / image URLs
   */
  async batchGetDownloadUrls(fids: string[]): Promise<Record<string, QuarkFileUrls>> {
    const result: Record<string, QuarkFileUrls> = {};
    if (fids.length === 0) return result;

    // Quark allows batch downloading up to 50-100 files at a time
    const chunkSize = 50;
    for (let i = 0; i < fids.length; i += chunkSize) {
      const chunk = fids.slice(i, i + chunkSize);
      try {
        const res = await NetworkClient.post(
          'https://drive-pc.quark.cn/1/clouddrive/file/download?pr=ucpro&fr=pc',
          { fids: chunk },
          { headers: this.getHeaders() }
        );

        if (res.data?.code === 0 && Array.isArray(res.data?.data)) {
          for (const item of res.data.data) {
            if (item.fid) {
              result[item.fid] = {
                previewUrl: item.preview_url,
                downloadUrl: item.download_url,
                bigThumbnail: item.big_thumbnail,
                thumbnail: item.thumbnail
              };
            }
          }
        }
      } catch (e) {
        console.error('Failed to get download URLs for chunk', e);
      }
    }

    return result;
  }
}
