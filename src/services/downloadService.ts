import { CloudDriveType, ComicPage } from '../types/comic';

export interface CachedChapterMeta {
  chapterId: string;
  comicId: string;
  comicTitle: string;
  chapterTitle: string;
  driveType: CloudDriveType;
  pageCount: number;
  downloadedAt: number;
  totalBytes: number;
}

const DB_NAME = 'CloudComic_Offline_DB';
const DB_VERSION = 1;
const STORE_CHAPTERS = 'chapters';
const STORE_IMAGES = 'images';

export class DownloadService {
  private static dbPromise: Promise<IDBDatabase> | null = null;

  private static getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_CHAPTERS)) {
          db.createObjectStore(STORE_CHAPTERS, { keyPath: 'chapterId' });
        }
        if (!db.objectStoreNames.contains(STORE_IMAGES)) {
          const store = db.createObjectStore(STORE_IMAGES, { keyPath: ['chapterId', 'index'] });
          store.createIndex('chapterId', 'chapterId', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  /**
   * Check if a chapter is already cached locally
   */
  static async isChapterCached(chapterId: string): Promise<boolean> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_CHAPTERS, 'readonly');
        const store = tx.objectStore(STORE_CHAPTERS);
        const req = store.get(chapterId);
        req.onsuccess = () => resolve(!!req.result);
        req.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  }

  /**
   * Get cached comic pages as Blob ObjectURLs
   */
  static async getCachedPages(chapterId: string): Promise<ComicPage[] | null> {
    try {
      const db = await this.getDB();
      const meta = await new Promise<CachedChapterMeta | undefined>((resolve) => {
        const tx = db.transaction(STORE_CHAPTERS, 'readonly');
        const store = tx.objectStore(STORE_CHAPTERS);
        const req = store.get(chapterId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(undefined);
      });

      if (!meta) return null;

      const images = await new Promise<any[]>((resolve) => {
        const tx = db.transaction(STORE_IMAGES, 'readonly');
        const store = tx.objectStore(STORE_IMAGES);
        const index = store.index('chapterId');
        const req = index.getAll(chapterId);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });

      if (images.length === 0) return null;

      images.sort((a, b) => a.index - b.index);

      return images.map((img) => {
        let blob: Blob;
        if (img.blob instanceof Blob) {
          blob = img.blob;
        } else if (img.blob instanceof ArrayBuffer) {
          blob = new Blob([img.blob], { type: img.mimeType || 'image/jpeg' });
        } else {
          blob = new Blob([], { type: 'image/jpeg' });
        }
        const blobUrl = URL.createObjectURL(blob);
        return {
          id: `${chapterId}_${img.index}`,
          index: img.index,
          filename: img.filename,
          url: blobUrl,
          downloadUrl: blobUrl,
          thumbnailUrl: blobUrl
        };
      });
    } catch (e) {
      console.warn('Failed to retrieve cached pages:', e);
      return null;
    }
  }

  /**
   * Download and cache an entire chapter's images into IndexedDB
   */
  static async cacheChapter(params: {
    comicId: string;
    comicTitle: string;
    chapterId: string;
    chapterTitle: string;
    driveType: CloudDriveType;
    pages: ComicPage[];
    onProgress?: (downloaded: number, total: number) => void;
  }): Promise<void> {
    const { comicId, comicTitle, chapterId, chapterTitle, driveType, pages, onProgress } = params;
    if (pages.length === 0) return;

    const db = await this.getDB();
    let totalBytes = 0;
    const downloadedImages: {
      chapterId: string;
      index: number;
      filename: string;
      blob: Blob;
      mimeType: string;
    }[] = [];

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const targetUrl = page.url || page.downloadUrl;
      if (!targetUrl) continue;

      try {
        let blob: Blob;
        const res = await fetch(targetUrl, {
          referrerPolicy: 'no-referrer'
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        blob = await res.blob();
        totalBytes += blob.size;

        downloadedImages.push({
          chapterId,
          index: page.index,
          filename: page.filename,
          blob,
          mimeType: blob.type || 'image/jpeg'
        });
      } catch (err) {
        console.error(`Failed to download page ${page.index} (${page.filename}):`, err);
        throw new Error(`第 ${page.index} 页下载失败: ${page.filename}`);
      }

      if (onProgress) {
        onProgress(i + 1, pages.length);
      }
    }

    // Save all to IndexedDB in a single transaction
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_CHAPTERS, STORE_IMAGES], 'readwrite');
      const chapStore = tx.objectStore(STORE_CHAPTERS);
      const imgStore = tx.objectStore(STORE_IMAGES);

      const meta: CachedChapterMeta = {
        chapterId,
        comicId,
        comicTitle,
        chapterTitle,
        driveType,
        pageCount: downloadedImages.length,
        downloadedAt: Date.now(),
        totalBytes
      };

      chapStore.put(meta);

      for (const img of downloadedImages) {
        imgStore.put(img);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Delete a cached chapter
   */
  static async deleteCachedChapter(chapterId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_CHAPTERS, STORE_IMAGES], 'readwrite');
      const chapStore = tx.objectStore(STORE_CHAPTERS);
      const imgStore = tx.objectStore(STORE_IMAGES);
      const index = imgStore.index('chapterId');

      chapStore.delete(chapterId);

      const range = IDBKeyRange.only(chapterId);
      const req = index.openCursor(range);
      req.onsuccess = (e: any) => {
        const cursor: IDBCursorWithValue = e.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * List all cached chapters
   */
  static async getAllCachedChapters(): Promise<CachedChapterMeta[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_CHAPTERS, 'readonly');
        const store = tx.objectStore(STORE_CHAPTERS);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  /**
   * Clear all offline cache
   */
  static async clearAllCache(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_CHAPTERS, STORE_IMAGES], 'readwrite');
      tx.objectStore(STORE_CHAPTERS).clear();
      tx.objectStore(STORE_IMAGES).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
