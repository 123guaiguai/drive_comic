import { DriveItem, ComicPage } from '../types/comic';
import { isImageFile, isPdfFile, naturalCompare } from './naturalSort';
import { NetworkClient } from './network';

export class BaiduService {
  private cookie: string;
  private accessToken?: string;

  constructor(cookie: string = '', accessToken?: string) {
    this.cookie = cookie.trim();
    this.accessToken = accessToken?.trim();
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': 'netdisk;P2SP;2.2.60.26',
      'Referer': 'https://pan.baidu.com/'
    };
    if (this.cookie) {
      headers['Cookie'] = this.cookie;
    }
    return headers;
  }

  /**
   * Test Baidu Netdisk connection
   */
  async testConnection(): Promise<{ success: boolean; message: string; username?: string }> {
    try {
      if (this.accessToken) {
        const res = await NetworkClient.get(
          'https://pan.baidu.com/rest/2.0/xpan/nas?method=uinfo',
          {
            params: { access_token: this.accessToken }
          }
        );
        if (res.data?.errno === 0) {
          return {
            success: true,
            message: '百度网盘 Token 连接成功',
            username: res.data.baidu_name || res.data.netdisk_name
          };
        }
      }

      // Test with web API using Cookie
      const res = await NetworkClient.get('https://pan.baidu.com/api/list', {
        headers: this.getHeaders(),
        params: {
          dir: '/',
          order: 'name',
          desc: '0',
          clienttype: '0',
          app_id: '250528',
          web: '1',
          page: '1',
          num: '5'
        }
      });

      if (res.data?.errno === 0) {
        return { success: true, message: '百度网盘 Cookie 连接成功' };
      }

      return {
        success: false,
        message: res.data?.show_msg || `连接失败 (errno: ${res.data?.errno || res.status})`
      };
    } catch (e: any) {
      return { success: false, message: e.message || '网络连接超时或凭证失效' };
    }
  }

  /**
   * List files and folders inside a directory
   * @param dir Absolute directory path e.g. "/" or "/comics/onepiece"
   */
  async listFolder(dir: string = '/'): Promise<{ items: DriveItem[] }> {
    let formattedDir = dir.trim();
    if (!formattedDir.startsWith('/')) {
      formattedDir = '/' + formattedDir;
    }
    if (formattedDir.length > 1 && formattedDir.endsWith('/')) {
      formattedDir = formattedDir.slice(0, -1);
    }

    if (this.accessToken) {
      // Access token mode
      const res = await NetworkClient.get(
        'https://pan.baidu.com/rest/2.0/xpan/file?method=list',
        {
          params: {
            access_token: this.accessToken,
            dir: formattedDir,
            order: 'name',
            desc: '0',
            num: '1000'
          }
        }
      );

      if (res.data?.errno !== 0) {
        throw new Error(res.data?.errmsg || `百度网盘读取目录失败 (errno: ${res.data?.errno})`);
      }

      const list: any[] = res.data.list || [];
      const items: DriveItem[] = list.map((item) => {
        const isDir = item.isdir === 1;
        const rawThumb = item.thumbs?.url3 || item.thumbs?.url2 || item.thumbs?.url1;
        const hdThumb = rawThumb ? rawThumb.replace(/size=c\d+_u\d+/, 'size=c1600_u1600') : undefined;
        const isPdf = !isDir && isPdfFile(item.server_filename);

        return {
          id: item.path,
          name: item.server_filename,
          path: item.path,
          isDir,
          size: item.size,
          updatedAt: item.server_mtime ? item.server_mtime * 1000 : undefined,
          driveType: 'baidu',
          thumbnail: hdThumb,
          hasImages: isDir ? undefined : isImageFile(item.server_filename),
          isPdf
        };
      });

      items.sort((a, b) => {
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        return naturalCompare(a.name, b.name);
      });

      return { items };
    }

    // Web API with Cookie
    const res = await NetworkClient.get('https://pan.baidu.com/api/list', {
      headers: this.getHeaders(),
      params: {
        dir: formattedDir,
        order: 'name',
        desc: '0',
        clienttype: '0',
        app_id: '250528',
        web: '1',
        num: '1000',
        page: '1'
      }
    });

    if (res.data?.errno !== 0) {
      throw new Error(res.data?.show_msg || `百度网盘读取目录失败 (errno: ${res.data?.errno})`);
    }

    const list: any[] = res.data.list || [];
    const items: DriveItem[] = list.map((item) => {
      const isDir = item.isdir === 1;
      const rawThumb = item.thumbs?.url3 || item.thumbs?.url2 || item.thumbs?.url1;
      const hdThumb = rawThumb ? rawThumb.replace(/size=c\d+_u\d+/, 'size=c1600_u1600') : undefined;
      const isPdf = !isDir && isPdfFile(item.server_filename);

      return {
        id: item.path,
        name: item.server_filename,
        path: item.path,
        isDir,
        size: item.size,
        updatedAt: item.server_mtime ? item.server_mtime * 1000 : undefined,
        driveType: 'baidu',
        thumbnail: hdThumb,
        hasImages: isDir ? undefined : isImageFile(item.server_filename),
        isPdf
      };
    });

    items.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return naturalCompare(a.name, b.name);
    });

    return { items };
  }


  /**
   * Get comic pages in a folder
   */
  async getChapterPages(folderPath: string): Promise<ComicPage[]> {
    const res = await this.listFolder(folderPath);
    const imageFiles = res.items.filter((f) => !f.isDir && isImageFile(f.name));

    imageFiles.sort((a, b) => naturalCompare(a.name, b.name));

    if (imageFiles.length === 0) {
      return [];
    }

    return imageFiles.map((f, idx) => {
      let url = f.thumbnail || '';
      return {
        id: f.id,
        index: idx + 1,
        filename: f.name,
        url,
        downloadUrl: url,
        thumbnailUrl: f.thumbnail
      };
    });
  }

  /**
   * Download file binary data as ArrayBuffer
   */
  async getFileArrayBuffer(filePathOrFsid: string): Promise<ArrayBuffer> {
    if (this.accessToken) {
      // If filePathOrFsid is numeric (fs_id), try to fetch dlink directly
      if (/^\d+$/.test(filePathOrFsid)) {
        try {
          const metaMap = await this.batchGetFileMetas([filePathOrFsid]);
          const meta = metaMap[filePathOrFsid];
          if (meta?.dlink) {
            const dlink = meta.dlink.includes('?')
              ? `${meta.dlink}&access_token=${this.accessToken}`
              : `${meta.dlink}?access_token=${this.accessToken}`;
            return await NetworkClient.getArrayBuffer(dlink, {
              'User-Agent': 'pan.baidu.com'
            });
          }
        } catch (e) {
          console.warn('Failed to query dlink via filemetas:', e);
        }
      }

      const url = `https://pan.baidu.com/rest/2.0/xpan/file?method=download&access_token=${this.accessToken}&path=${encodeURIComponent(filePathOrFsid)}`;
      return await NetworkClient.getArrayBuffer(url, {
        'User-Agent': 'pan.baidu.com'
      });
    }

    // Try web streaming download with cookie
    const url = `https://pan.baidu.com/api/download?clienttype=0&app_id=250528&web=1&path=${encodeURIComponent(filePathOrFsid)}`;
    return await NetworkClient.getArrayBuffer(url, {
      ...this.getHeaders(),
      'User-Agent': 'pan.baidu.com'
    });
  }

  private async batchGetFileMetas(fsids: string[]): Promise<Record<string, any>> {
    const result: Record<string, any> = {};
    if (fsids.length === 0) return result;

    try {
      const chunkSize = 100;
      for (let i = 0; i < fsids.length; i += chunkSize) {
        const chunk = fsids.slice(i, i + chunkSize);
        const params: Record<string, string> = {
          method: 'filemetas',
          fsids: `[${chunk.join(',')}]`,
          thumb: '1',
          dlink: '1'
        };
        if (this.accessToken) {
          params['access_token'] = this.accessToken;
        }

        const res = await NetworkClient.get(
          'https://pan.baidu.com/rest/2.0/xpan/multimedia',
          {
            headers: this.getHeaders(),
            params
          }
        );

        if (res.data?.errno === 0 && Array.isArray(res.data?.info)) {
          for (const item of res.data.info) {
            result[item.fs_id.toString()] = item;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to get Baidu filemetas, using fallback thumbnail', e);
    }
    return result;
  }
}

