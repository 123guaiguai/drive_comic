import { CloudAccount, ComicPage, DriveItem } from '../types/comic';
import { BaiduService } from './baiduService';
import { QuarkService } from './quarkService';
import { StorageService } from './storage';
import { WebDavService } from './webdavService';
import { isImageFile, isPdfFile, naturalCompare } from './naturalSort';

export class DriveManager {
  private static currentAccount: CloudAccount | null = null;
  private static quarkService: QuarkService | null = null;
  private static baiduService: BaiduService | null = null;
  private static webdavService: WebDavService | null = null;

  static async init(): Promise<CloudAccount | null> {
    const accounts = await StorageService.getAccounts();
    const currentId = await StorageService.getCurrentAccountId();
    let active = accounts.find((a) => a.id === currentId);
    if (!active && accounts.length > 0) {
      active = accounts[0];
      await StorageService.setCurrentAccountId(active.id);
    }
    this.setActiveAccount(active || null);
    return active || null;
  }

  static setActiveAccount(account: CloudAccount | null) {
    this.currentAccount = account;
    this.quarkService = null;
    this.baiduService = null;
    this.webdavService = null;

    if (!account) return;

    if (account.type === 'quark' && account.quarkCookie) {
      this.quarkService = new QuarkService(account.quarkCookie);
    } else if (account.type === 'baidu') {
      this.baiduService = new BaiduService(account.baiduCookie, account.baiduAccessToken);
    } else if (account.type === 'webdav' && account.webdavUrl) {
      this.webdavService = new WebDavService(
        account.webdavUrl,
        account.webdavUsername,
        account.webdavPassword
      );
    }
  }

  static getActiveAccount(): CloudAccount | null {
    return this.currentAccount;
  }

  static isPdf(itemPathOrName: string): boolean {
    return isPdfFile(itemPathOrName);
  }

  static async getPdfBuffer(fileIdOrPath: string): Promise<ArrayBuffer> {
    if (!this.currentAccount) {
      throw new Error('未选择或未连接网盘账号');
    }

    if (this.currentAccount.type === 'quark') {
      if (!this.quarkService) throw new Error('夸克网盘未就绪');
      return await this.quarkService.getFileArrayBuffer(fileIdOrPath);
    }

    if (this.currentAccount.type === 'baidu') {
      if (!this.baiduService) throw new Error('百度网盘未就绪');
      return await this.baiduService.getFileArrayBuffer(fileIdOrPath);
    }

    if (this.currentAccount.type === 'webdav') {
      if (!this.webdavService) throw new Error('WebDAV 服务未就绪');
      return await this.webdavService.getFileArrayBuffer(fileIdOrPath);
    }

    throw new Error('不支持的网盘类型');
  }

  static async listFolder(folderIdOrPath: string = ''): Promise<{ items: DriveItem[]; hasMore?: boolean }> {
    if (!this.currentAccount) {
      throw new Error('未选择或未连接网盘账号，请先在右上角添加网盘');
    }

    if (this.currentAccount.type === 'quark') {
      if (!this.quarkService) throw new Error('夸克网盘未配置 Cookie');
      const fid = folderIdOrPath || '0';
      return await this.quarkService.listFolder(fid);
    }

    if (this.currentAccount.type === 'baidu') {
      if (!this.baiduService) throw new Error('百度网盘未配置 Cookie 或 Token');
      const path = folderIdOrPath || '/';
      return await this.baiduService.listFolder(path);
    }

    if (this.currentAccount.type === 'webdav') {
      if (!this.webdavService) throw new Error('WebDAV 服务未配置');
      const path = folderIdOrPath || '/';
      return await this.webdavService.listFolder(path);
    }

    throw new Error('不支持的网盘类型');
  }

  /**
   * Analyze folder structure: check if it contains chapter subfolders or direct images
   */
  static async getComicChapters(folderIdOrPath: string): Promise<{
    hasSubChapters: boolean;
    chapters: { id: string; name: string; path: string }[];
    directImagesCount: number;
    parentPath?: string;
  }> {
    const res = await this.listFolder(folderIdOrPath);
    const subfolders = res.items.filter((it) => it.isDir);
    const directImages = res.items.filter((it) => !it.isDir && isImageFile(it.name));

    if (subfolders.length > 0) {
      subfolders.sort((a, b) => naturalCompare(a.name, b.name));
      return {
        hasSubChapters: true,
        chapters: subfolders.map((s) => ({
          id: s.id,
          name: s.name,
          path: s.path || s.id
        })),
        directImagesCount: directImages.length,
        parentPath: folderIdOrPath
      };
    }

    return {
      hasSubChapters: false,
      chapters: [],
      directImagesCount: directImages.length,
      parentPath: folderIdOrPath
    };
  }

  static async getChapterPages(folderIdOrPath: string): Promise<ComicPage[]> {
    if (!this.currentAccount) {
      throw new Error('请先选择网盘账号');
    }

    let pages: ComicPage[] = [];

    if (this.currentAccount.type === 'quark') {
      if (!this.quarkService) throw new Error('夸克网盘未就绪');
      pages = await this.quarkService.getChapterPages(folderIdOrPath);
    } else if (this.currentAccount.type === 'baidu') {
      if (!this.baiduService) throw new Error('百度网盘未就绪');
      pages = await this.baiduService.getChapterPages(folderIdOrPath);
    } else if (this.currentAccount.type === 'webdav') {
      if (!this.webdavService) throw new Error('WebDAV 服务未就绪');
      pages = await this.webdavService.getChapterPages(folderIdOrPath);
    }

    // If folder itself has no images, check if it's a comic parent folder with chapter subfolders
    if (pages.length === 0) {
      try {
        const structure = await this.getComicChapters(folderIdOrPath);
        if (structure.hasSubChapters && structure.chapters.length > 0) {
          const firstChapter = structure.chapters[0];
          return await this.getChapterPages(firstChapter.id);
        }
      } catch (e) {
        console.warn('Auto subfolder resolution failed:', e);
      }
    }

    return pages;
  }
}

