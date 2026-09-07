import { DriveItem, ComicPage } from '../types/comic';
import { isImageFile, isPdfFile, naturalCompare } from './naturalSort';
import { NetworkClient } from './network';

export class WebDavService {
  private url: string;
  private user?: string;
  private pass?: string;

  constructor(url: string, user?: string, pass?: string) {
    this.url = url.replace(/\/+$/, '');
    this.user = user;
    this.pass = pass;
  }

  private buildAuthHeader(): string | undefined {
    if (this.user && this.pass) {
      try {
        return `Basic ${btoa(unescape(encodeURIComponent(`${this.user}:${this.pass}`)))}`;
      } catch {
        return `Basic ${btoa(`${this.user}:${this.pass}`)}`;
      }
    }
    return undefined;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Depth': '1',
      'Content-Type': 'application/xml; charset="utf-8"'
    };
    const auth = this.buildAuthHeader();
    if (auth) {
      headers['Authorization'] = auth;
    }
    return headers;
  }

  /**
   * Safely resolve WebDAV URL without duplicate path prefixes and with proper encoding
   */
  resolveUrl(filePathOrHref: string): string {
    if (filePathOrHref.startsWith('http://') || filePathOrHref.startsWith('https://')) {
      return filePathOrHref;
    }

    try {
      const baseUrl = new URL(this.url);
      const basePath = baseUrl.pathname.replace(/\/+$/, '');

      let path = filePathOrHref;
      // If path already contains basePath, strip it so it doesn't get doubled
      if (basePath && (path === basePath || path.startsWith(basePath + '/'))) {
        path = path.slice(basePath.length);
      }

      if (!path.startsWith('/')) {
        path = '/' + path;
      }

      const segments = path
        .split('/')
        .map((seg) => {
          if (!seg) return '';
          try {
            return encodeURIComponent(decodeURIComponent(seg));
          } catch {
            return encodeURIComponent(seg);
          }
        });

      const cleanEncodedPath = segments.join('/');
      return `${baseUrl.origin}${basePath}${cleanEncodedPath}`;
    } catch {
      const cleanPath = filePathOrHref.startsWith('/') ? filePathOrHref : '/' + filePathOrHref;
      return `${this.url}${cleanPath}`;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await this.propfind('/');
      if (res.status >= 200 && res.status < 300) {
        return { success: true, message: 'WebDAV / AList 连接成功' };
      }
      return { success: false, message: `连接异常状态码: ${res.status}` };
    } catch (e: any) {
      return { success: false, message: e.message || '无法连接到 WebDAV 服务器' };
    }
  }

  private async propfind(path: string) {
    const fullUrl = this.resolveUrl(path);
    const propfindXml = `<?xml version="1.0" encoding="utf-8" ?>
      <D:propfind xmlns:D="DAV:">
        <D:prop>
          <D:displayname/>
          <D:resourcetype/>
          <D:getcontentlength/>
          <D:getlastmodified/>
        </D:prop>
      </D:propfind>`;

    return await NetworkClient.post(fullUrl, propfindXml, {
      headers: this.getHeaders(),
      responseType: 'text'
    });
  }

  async listFolder(folderPath: string = '/'): Promise<{ items: DriveItem[] }> {
    const res = await this.propfind(folderPath);
    if (!res.data) {
      return { items: [] };
    }

    const items: DriveItem[] = [];
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(res.data, 'text/xml');
    const responses = xmlDoc.getElementsByTagNameNS('*', 'response');

    const cleanReqPath = folderPath.replace(/\/+$/, '');

    for (let i = 0; i < responses.length; i++) {
      const resp = responses[i];
      const href = resp.getElementsByTagNameNS('*', 'href')[0]?.textContent || '';
      const decodedHref = decodeURIComponent(href);

      // Check if directory
      const resourcetype = resp.getElementsByTagNameNS('*', 'resourcetype')[0];
      const isDir = !!resourcetype?.getElementsByTagNameNS('*', 'collection').length;

      // Extract display name
      let name = resp.getElementsByTagNameNS('*', 'displayname')[0]?.textContent;
      if (!name) {
        const parts = decodedHref.replace(/\/+$/, '').split('/');
        name = parts[parts.length - 1] || '未命名';
      }

      // Skip the requested directory itself
      const normalizedHref = decodedHref.replace(/\/+$/, '');
      if (
        normalizedHref === cleanReqPath ||
        (normalizedHref.endsWith(cleanReqPath) && responses.length > 1 && i === 0)
      ) {
        continue;
      }

      const sizeStr = resp.getElementsByTagNameNS('*', 'getcontentlength')[0]?.textContent;
      const size = sizeStr ? parseInt(sizeStr, 10) : undefined;

      const fullItemPath = decodedHref;
      const isPdf = !isDir && isPdfFile(name);

      items.push({
        id: fullItemPath,
        name,
        path: fullItemPath,
        isDir,
        size,
        driveType: 'webdav',
        hasImages: isDir ? undefined : isImageFile(name),
        isPdf
      });
    }

    items.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return naturalCompare(a.name, b.name);
    });

    return { items };
  }

  getFileUrl(filePath: string): string {
    const resolvedUrl = this.resolveUrl(filePath);
    if (this.user && this.pass) {
      try {
        const urlObj = new URL(resolvedUrl);
        const authPrefix = `${encodeURIComponent(this.user)}:${encodeURIComponent(this.pass)}@`;
        return `${urlObj.protocol}//${authPrefix}${urlObj.host}${urlObj.pathname}${urlObj.search}`;
      } catch {
        return resolvedUrl;
      }
    }
    return resolvedUrl;
  }

  async getFileArrayBuffer(filePath: string): Promise<ArrayBuffer> {
    const downloadUrl = this.resolveUrl(filePath);
    const headers: Record<string, string> = {};
    const auth = this.buildAuthHeader();
    if (auth) {
      headers['Authorization'] = auth;
    }
    return await NetworkClient.getArrayBuffer(downloadUrl, headers);
  }

  async getChapterPages(folderPath: string): Promise<ComicPage[]> {
    const res = await this.listFolder(folderPath);
    const imageFiles = res.items.filter((f) => !f.isDir && isImageFile(f.name));

    imageFiles.sort((a, b) => naturalCompare(a.name, b.name));

    return imageFiles.map((f, idx) => ({
      id: f.id,
      index: idx + 1,
      filename: f.name,
      url: this.getFileUrl(f.path)
    }));
  }
}

