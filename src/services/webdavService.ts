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

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Depth': '1',
      'Content-Type': 'application/xml; charset="utf-8"'
    };
    if (this.user && this.pass) {
      const basic = btoa(`${this.user}:${this.pass}`);
      headers['Authorization'] = `Basic ${basic}`;
    }
    return headers;
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
    const requestPath = path.startsWith('/') ? path : '/' + path;
    const fullUrl = `${this.url}${encodeURI(requestPath)}`;
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
      headers: {
        ...this.getHeaders(),
        'Content-Type': 'application/xml; charset="utf-8"'
      },
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
        normalizedHref.endsWith(cleanReqPath) && (responses.length > 1 && i === 0)
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
    const cleanPath = filePath.startsWith('/') ? filePath : '/' + filePath;
    if (this.user && this.pass) {
      const urlObj = new URL(this.url);
      const authPrefix = `${encodeURIComponent(this.user)}:${encodeURIComponent(this.pass)}@`;
      return `${urlObj.protocol}//${authPrefix}${urlObj.host}${urlObj.pathname.replace(/\/+$/, '')}${encodeURI(cleanPath)}`;
    }
    return `${this.url}${encodeURI(cleanPath)}`;
  }

  async getFileArrayBuffer(filePath: string): Promise<ArrayBuffer> {
    const cleanPath = filePath.startsWith('/') ? filePath : '/' + filePath;
    const downloadUrl = `${this.url}${encodeURI(cleanPath)}`;
    const headers: Record<string, string> = {};
    if (this.user && this.pass) {
      const basic = btoa(`${this.user}:${this.pass}`);
      headers['Authorization'] = `Basic ${basic}`;
    }
    return await NetworkClient.getArrayBuffer(downloadUrl, headers);
  }

  async getChapterPages(folderPath: string): Promise<ComicPage[]> {
    const res = await this.listFolder(folderPath);
    const imageFiles = res.items.filter((f) => !f.isDir && isImageFile(f.name));

    imageFiles.sort((a, b) => naturalCompare(a.name, b.name));

    let authPrefix = '';
    if (this.user && this.pass) {
      const urlObj = new URL(this.url);
      authPrefix = `${encodeURIComponent(this.user)}:${encodeURIComponent(this.pass)}@`;
      const baseWithAuth = `${urlObj.protocol}//${authPrefix}${urlObj.host}${urlObj.pathname.replace(/\/+$/, '')}`;

      return imageFiles.map((f, idx) => ({
        id: f.id,
        index: idx + 1,
        filename: f.name,
        url: `${baseWithAuth}${encodeURI(f.path.startsWith('/') ? f.path : '/' + f.path)}`
      }));
    }

    return imageFiles.map((f, idx) => ({
      id: f.id,
      index: idx + 1,
      filename: f.name,
      url: `${this.url}${encodeURI(f.path.startsWith('/') ? f.path : '/' + f.path)}`
    }));
  }
}

