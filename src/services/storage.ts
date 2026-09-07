import { Preferences } from '@capacitor/preferences';
import { CloudAccount, ComicBook, ReadHistoryItem, ReaderSettings } from '../types/comic';

const KEYS = {
  ACCOUNTS: 'comic_cloud_accounts',
  CURRENT_ACCOUNT: 'comic_current_account_id',
  BOOKSHELF: 'comic_bookshelf',
  HISTORY: 'comic_read_history',
  SETTINGS: 'comic_reader_settings'
};

export class StorageService {
  private static async getRaw(key: string): Promise<string | null> {
    try {
      const { value } = await Preferences.get({ key });
      if (value !== null) return value;
    } catch {
      // fallback
    }
    return localStorage.getItem(key);
  }

  private static async setRaw(key: string, value: string): Promise<void> {
    try {
      await Preferences.set({ key, value });
    } catch {
      // fallback
    }
    localStorage.setItem(key, value);
  }

  // --- Accounts ---
  static async getAccounts(): Promise<CloudAccount[]> {
    const raw = await this.getRaw(KEYS.ACCOUNTS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static async saveAccount(account: CloudAccount): Promise<void> {
    const accounts = await this.getAccounts();
    const idx = accounts.findIndex((a) => a.id === account.id);
    if (idx >= 0) {
      accounts[idx] = account;
    } else {
      accounts.push(account);
    }
    await this.setRaw(KEYS.ACCOUNTS, JSON.stringify(accounts));
  }

  static async deleteAccount(id: string): Promise<void> {
    const accounts = await this.getAccounts();
    const filtered = accounts.filter((a) => a.id !== id);
    await this.setRaw(KEYS.ACCOUNTS, JSON.stringify(filtered));
  }

  static async getCurrentAccountId(): Promise<string | null> {
    return await this.getRaw(KEYS.CURRENT_ACCOUNT);
  }

  static async setCurrentAccountId(id: string): Promise<void> {
    await this.setRaw(KEYS.CURRENT_ACCOUNT, id);
  }

  // --- Bookshelf ---
  static async getBookshelf(): Promise<ComicBook[]> {
    const raw = await this.getRaw(KEYS.BOOKSHELF);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static async addToBookshelf(book: ComicBook): Promise<void> {
    const list = await this.getBookshelf();
    const idx = list.findIndex((b) => b.id === book.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...book };
    } else {
      list.unshift(book);
    }
    await this.setRaw(KEYS.BOOKSHELF, JSON.stringify(list));
  }

  static async removeFromBookshelf(bookId: string): Promise<void> {
    const list = await this.getBookshelf();
    const filtered = list.filter((b) => b.id !== bookId);
    await this.setRaw(KEYS.BOOKSHELF, JSON.stringify(filtered));
  }

  static async isBookInBookshelf(bookId: string): Promise<boolean> {
    const list = await this.getBookshelf();
    return list.some((b) => b.id === bookId);
  }

  // --- Read History ---
  static async getHistory(): Promise<ReadHistoryItem[]> {
    const raw = await this.getRaw(KEYS.HISTORY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static async updateHistory(item: ReadHistoryItem): Promise<void> {
    const list = await this.getHistory();
    const filtered = list.filter((h) => h.comicId !== item.comicId);
    filtered.unshift(item);
    // Keep maximum 100 history items
    if (filtered.length > 100) filtered.pop();
    await this.setRaw(KEYS.HISTORY, JSON.stringify(filtered));

    // Also update bookshelf item's last read progress if present
    const books = await this.getBookshelf();
    const bookIdx = books.findIndex((b) => b.id === item.comicId);
    if (bookIdx >= 0) {
      books[bookIdx].lastReadChapterId = item.chapterId;
      books[bookIdx].lastReadChapterTitle = item.chapterTitle;
      books[bookIdx].lastReadPageIndex = item.pageIndex;
      books[bookIdx].lastReadTime = item.timestamp;
      if (item.coverUrl && !books[bookIdx].coverUrl) {
        books[bookIdx].coverUrl = item.coverUrl;
      }
      await this.setRaw(KEYS.BOOKSHELF, JSON.stringify(books));
    }
  }

  static async clearHistory(): Promise<void> {
    await this.setRaw(KEYS.HISTORY, JSON.stringify([]));
  }

  // --- Settings ---
  static async getSettings(): Promise<ReaderSettings> {
    const raw = await this.getRaw(KEYS.SETTINGS);
    const defaults: ReaderSettings = {
      mode: 'webtoon',
      backgroundColor: '#121214',
      keepAwake: true,
      preloadCount: 4,
      doubleTapZoom: true
    };
    if (!raw) return defaults;
    try {
      return { ...defaults, ...JSON.parse(raw) };
    } catch {
      return defaults;
    }
  }

  static async saveSettings(settings: Partial<ReaderSettings>): Promise<ReaderSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    await this.setRaw(KEYS.SETTINGS, JSON.stringify(updated));
    return updated;
  }

  // --- Backup & Restore ---
  static async exportBackup(): Promise<string> {
    const accounts = await this.getAccounts();
    const bookshelf = await this.getBookshelf();
    const history = await this.getHistory();
    const settings = await this.getSettings();
    const currentAccountId = await this.getCurrentAccountId();

    const backupData = {
      app: 'CloudComic',
      version: 1,
      exportedAt: new Date().toISOString(),
      currentAccountId,
      accounts,
      bookshelf,
      history,
      settings
    };

    return JSON.stringify(backupData, null, 2);
  }

  static async importBackup(jsonString: string): Promise<{
    accountsCount: number;
    bookshelfCount: number;
    historyCount: number;
  }> {
    const data = JSON.parse(jsonString.trim());
    if (!data || typeof data !== 'object') {
      throw new Error('备份数据格式不正确');
    }

    let accountsCount = 0;
    let bookshelfCount = 0;
    let historyCount = 0;

    // Restore accounts
    if (Array.isArray(data.accounts)) {
      const existingAccounts = await this.getAccounts();
      const mergedMap = new Map<string, CloudAccount>();
      for (const a of existingAccounts) mergedMap.set(a.id, a);
      for (const a of data.accounts) {
        if (a.id && a.name && a.type) {
          mergedMap.set(a.id, a);
          accountsCount++;
        }
      }
      const newAccounts = Array.from(mergedMap.values());
      await this.setRaw(KEYS.ACCOUNTS, JSON.stringify(newAccounts));

      if (data.currentAccountId && mergedMap.has(data.currentAccountId)) {
        await this.setCurrentAccountId(data.currentAccountId);
      } else if (newAccounts.length > 0) {
        await this.setCurrentAccountId(newAccounts[0].id);
      }
    }

    // Restore bookshelf
    if (Array.isArray(data.bookshelf)) {
      const existingBooks = await this.getBookshelf();
      const mergedBookMap = new Map<string, ComicBook>();
      for (const b of existingBooks) mergedBookMap.set(b.id, b);
      for (const b of data.bookshelf) {
        if (b.id && b.title) {
          mergedBookMap.set(b.id, b);
          bookshelfCount++;
        }
      }
      await this.setRaw(KEYS.BOOKSHELF, JSON.stringify(Array.from(mergedBookMap.values())));
    }

    // Restore history
    if (Array.isArray(data.history)) {
      const existingHistory = await this.getHistory();
      const mergedHistMap = new Map<string, ReadHistoryItem>();
      for (const h of existingHistory) mergedHistMap.set(h.comicId, h);
      for (const h of data.history) {
        if (h.comicId && h.comicTitle) {
          mergedHistMap.set(h.comicId, h);
          historyCount++;
        }
      }
      const sortedHistory = Array.from(mergedHistMap.values()).sort(
        (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
      );
      await this.setRaw(KEYS.HISTORY, JSON.stringify(sortedHistory.slice(0, 100)));
    }

    // Restore settings
    if (data.settings && typeof data.settings === 'object') {
      await this.saveSettings(data.settings);
    }

    return {
      accountsCount,
      bookshelfCount,
      historyCount
    };
  }
}

