export type CloudDriveType = 'quark' | 'baidu' | 'webdav';

export interface CloudAccount {
  id: string;
  name: string;
  type: CloudDriveType;
  // Quark
  quarkCookie?: string;
  // Baidu
  baiduCookie?: string;
  baiduAccessToken?: string;
  // WebDAV / AList
  webdavUrl?: string;
  webdavUsername?: string;
  webdavPassword?: string;

  isActive: boolean;
  lastChecked?: number;
}

export interface DriveItem {
  id: string;
  name: string;
  path: string;
  isDir: boolean;
  size?: number;
  updatedAt?: number;
  driveType: CloudDriveType;
  thumbnail?: string;
  hasImages?: boolean;
  isPdf?: boolean;
}

export interface ComicBook {
  id: string;
  title: string;
  driveType: CloudDriveType;
  path: string;
  coverUrl?: string;
  isPdf?: boolean;
  lastReadChapterId?: string;
  lastReadChapterTitle?: string;
  lastReadPageIndex?: number;
  lastReadTime?: number;
  totalChapters?: number;
}

export interface ChapterItem {
  id: string;
  title: string;
  path: string;
  driveType: CloudDriveType;
  fileCount?: number;
  isPdf?: boolean;
}

export interface ComicPage {
  id: string;
  index: number;
  filename: string;
  url: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
  loaded?: boolean;
  error?: boolean;
  isPdfPage?: boolean;
}

export type ReadingMode = 'webtoon' | 'right-to-left' | 'left-to-right';

export interface ReaderSettings {
  mode: ReadingMode;
  backgroundColor: string; // '#000000' | '#121214' | '#1c1917' | '#f8fafc'
  keepAwake: boolean;
  preloadCount: number;
  doubleTapZoom: boolean;
}

export interface ReadHistoryItem {
  comicId: string;
  comicTitle: string;
  chapterId: string;
  chapterTitle: string;
  chapterPath: string;
  driveType: CloudDriveType;
  pageIndex: number;
  totalPages: number;
  timestamp: number;
  coverUrl?: string;
  isPdf?: boolean;
}

