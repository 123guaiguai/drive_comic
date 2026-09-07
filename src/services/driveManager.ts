import { CloudAccount, CloudDriveType, ComicPage, DriveItem } from '../types/comic';
import { BaiduService } from './baiduService';
import { QuarkService } from './quarkService';
import { StorageService } from './storage';
import { WebDavService } from './webdavService';
import { isImageFile, naturalCompare } from './naturalSort';

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

  /**
   * Get specific driver service based on driveType or fallback to active account
   */
  private static async getDriverService(driveType?: CloudDriveType): Promise<{
    type: CloudDriveType;
    service: QuarkService | BaiduService | WebDavService;
  }> {
    // If driveType is specified and differs from currentAccount type, find corresponding account
    if (driveType && (!this.currentAccount || this.currentAccount.type !== driveType)) {
      const accounts = await StorageService.getAccounts();
      const targetAcc = accounts.find((a) => a.type === driveType);
      if (targetAcc) {
        if (targetAcc.type === 'quark' && targetAcc.quarkCookie) {
          return { type: 'quark', service: new QuarkService(targetAcc.quarkCookie) };
        }
        if (targetAcc.type === 'baidu') {
          return {
            type: 'baidu',
            service: new BaiduService(targetAcc.baiduCookie, targetAcc.baiduAccessToken)
          };
        }
        if (targetAcc.type === 'webdav' && targetAcc.webdavUrl) {
          return {
            type: 'webdav',
            service: new WebDavService(
              targetAcc.webdavUrl,
              targetAcc.webdavUsername,
              targetAcc.webdavPassword
            )
          };
        }
      }
    }

    // Default to currently active account
    if (!this.currentAccount) {
      throw new Error('未选择或未连接网盘账号，请先在右上角添加网盘');
    }

    if (this.currentAccount.type === 'quark') {
      if (!this.quarkService && this.currentAccount.quarkCookie) {
        this.quarkService = new QuarkService(this.currentAccount.quarkCookie);
      }
      if (!this.quarkService) throw new Error('夸克网盘未配置 Cookie');
      return { type: 'quark', service: this.quarkService };
    }

    if (this.currentAccount.type === 'baidu') {
      if (!this.baiduService) {
        this.baiduService = new BaiduService(
          this.currentAccount.baiduCookie,
          this.currentAccount.baiduAccessToken
        );
      }
      return { type: 'baidu', service: this.baiduService };
    }

    if (this.currentAccount.type === 'webdav') {
      if (!this.webdavService && this.currentAccount.webdavUrl) {
        this.webdavService = new WebDavService(
          this.currentAccount.webdavUrl,
          this.currentAccount.webdavUsername,
          this.currentAccount.webdavPassword
        );
      }
      if (!this.webdavService) throw new Error('WebDAV 服务未配置');
      return { type: 'webdav', service: this.webdavService };
    }

    throw new Error('不支持的网盘类型');
  }

  static async listFolder(
    folderIdOrPath: string = '',
    driveType?: CloudDriveType
  ): Promise<{ items: DriveItem[]; hasMore?: boolean }> {
    const driver = await this.getDriverService(driveType);

    if (driver.type === 'quark') {
      const fid = folderIdOrPath || '0';
      return await (driver.service as QuarkService).listFolder(fid);
    }

    if (driver.type === 'baidu') {
      const path = folderIdOrPath || '/';
      return await (driver.service as BaiduService).listFolder(path);
    }

    if (driver.type === 'webdav') {
      const path = folderIdOrPath || '/';
      return await (driver.service as WebDavService).listFolder(path);
    }

    throw new Error('不支持的网盘类型');
  }

  /**
   * Analyze folder structure: check if it contains chapter subfolders or direct images
   */
  static async getComicChapters(
    folderIdOrPath: string,
    driveType?: CloudDriveType
  ): Promise<{
    hasSubChapters: boolean;
    chapters: { id: string; name: string; path: string; driveType: CloudDriveType }[];
    directImagesCount: number;
    parentPath?: string;
  }> {
    const res = await this.listFolder(folderIdOrPath, driveType);
    const subfolders = res.items.filter((it) => it.isDir);
    const directImages = res.items.filter((it) => !it.isDir && isImageFile(it.name));
    const effectiveType = driveType || this.currentAccount?.type || 'quark';

    if (subfolders.length > 0) {
      subfolders.sort((a, b) => naturalCompare(a.name, b.name));
      return {
        hasSubChapters: true,
        chapters: subfolders.map((s) => ({
          id: s.id,
          name: s.name,
          path: s.path || s.id,
          driveType: effectiveType
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

  static async getChapterPages(
    folderIdOrPath: string,
    driveType?: CloudDriveType
  ): Promise<ComicPage[]> {
    const driver = await this.getDriverService(driveType);

    let pages: ComicPage[] = [];

    if (driver.type === 'quark') {
      pages = await (driver.service as QuarkService).getChapterPages(folderIdOrPath);
    } else if (driver.type === 'baidu') {
      pages = await (driver.service as BaiduService).getChapterPages(folderIdOrPath);
    } else if (driver.type === 'webdav') {
      pages = await (driver.service as WebDavService).getChapterPages(folderIdOrPath);
    }

    // If folder itself has no images, check if it's a comic parent folder with chapter subfolders
    if (pages.length === 0) {
      try {
        const structure = await this.getComicChapters(folderIdOrPath, driver.type);
        if (structure.hasSubChapters && structure.chapters.length > 0) {
          const firstChapter = structure.chapters[0];
          return await this.getChapterPages(firstChapter.id, driver.type);
        }
      } catch (e) {
        console.warn('Auto subfolder resolution failed:', e);
      }
    }

    return pages;
  }

  /**
   * Intelligently retrieve a cover URL for a comic folder (even if it's a multi-chapter folder)
   */
  static async getCoverForFolder(
    folderIdOrPath: string,
    driveType?: CloudDriveType
  ): Promise<string | undefined> {
    try {
      const res = await this.listFolder(folderIdOrPath, driveType);
      const directImages = res.items.filter((it) => !it.isDir && isImageFile(it.name));
      if (directImages.length > 0) {
        directImages.sort((a, b) => naturalCompare(a.name, b.name));
        return directImages[0].thumbnail;
      }

      // Check subchapters
      const subfolders = res.items.filter((it) => it.isDir);
      if (subfolders.length > 0) {
        subfolders.sort((a, b) => naturalCompare(a.name, b.name));
        const firstSub = subfolders[0];
        const subRes = await this.listFolder(firstSub.path || firstSub.id, driveType);
        const subImages = subRes.items.filter((it) => !it.isDir && isImageFile(it.name));
        if (subImages.length > 0) {
          subImages.sort((a, b) => naturalCompare(a.name, b.name));
          return subImages[0].thumbnail;
        }
      }
    } catch (e) {
      console.warn('Failed to retrieve cover for folder:', e);
    }
    return undefined;
  }
}

