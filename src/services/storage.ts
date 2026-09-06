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
}
