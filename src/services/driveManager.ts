import { CloudAccount, ComicPage, DriveItem } from '../types/comic';
import { BaiduService } from './baiduService';
import { QuarkService } from './quarkService';
import { StorageService } from './storage';
import { WebDavService } from './webdavService';

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

  static async getChapterPages(folderIdOrPath: string): Promise<ComicPage[]> {
    if (!this.currentAccount) {
      throw new Error('请先选择网盘账号');
    }

    if (this.currentAccount.type === 'quark') {
      if (!this.quarkService) throw new Error('夸克网盘未就绪');
      return await this.quarkService.getChapterPages(folderIdOrPath);
    }

    if (this.currentAccount.type === 'baidu') {
      if (!this.baiduService) throw new Error('百度网盘未就绪');
      return await this.baiduService.getChapterPages(folderIdOrPath);
    }

    if (this.currentAccount.type === 'webdav') {
      if (!this.webdavService) throw new Error('WebDAV 服务未就绪');
      return await this.webdavService.getChapterPages(folderIdOrPath);
    }

    return [];
  }
}
