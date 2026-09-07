import React, { useState, useEffect, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import { CloudAccount, ComicBook, DriveItem, ReadHistoryItem } from './types/comic';
import { StorageService } from './services/storage';
import { DriveManager } from './services/driveManager';
import { isPdfFile } from './services/naturalSort';
import { Navbar } from './components/Navbar';

import { Bookshelf } from './components/Bookshelf';
import { Explorer } from './components/Explorer';
import { HistoryList } from './components/HistoryList';
import { AccountModal } from './components/AccountModal';
import { ComicReader } from './components/Reader/ComicReader';
import { UpdateModal } from './components/UpdateModal';
import { UpdateService, UpdateInfo } from './services/updater';
import { ChapterModal, ChapterItemData } from './components/ChapterModal';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'bookshelf' | 'explorer' | 'history'>('bookshelf');
  const [accounts, setAccounts] = useState<CloudAccount[]>([]);
  const [activeAccount, setActiveAccount] = useState<CloudAccount | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  // Update check
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  // Bookshelf chapter selector modal
  const [bookshelfModalState, setBookshelfModalState] = useState<{
    title: string;
    chapters: ChapterItemData[];
  } | null>(null);

  const [bookshelf, setBookshelf] = useState<ComicBook[]>([]);
  const [history, setHistory] = useState<ReadHistoryItem[]>([]);

  // Active Reader state
  const [readingSession, setReadingSession] = useState<{
    comicId: string;
    comicTitle: string;
    currentChapter: { id: string; name: string; path: string; isPdf?: boolean };
    initialPage?: number;
    allChapters?: { id: string; name: string; path: string }[];
  } | null>(null);


  // State refs for native backButton listener
  const readingSessionRef = useRef(readingSession);
  readingSessionRef.current = readingSession;

  const bookshelfModalRef = useRef(bookshelfModalState);
  bookshelfModalRef.current = bookshelfModalState;

  const isAccountModalOpenRef = useRef(isAccountModalOpen);
  isAccountModalOpenRef.current = isAccountModalOpen;

  const isUpdateModalOpenRef = useRef(isUpdateModalOpen);
  isUpdateModalOpenRef.current = isUpdateModalOpen;

  // Initialize data
  const loadData = async () => {
    const accs = await StorageService.getAccounts();
    setAccounts(accs);

    const active = await DriveManager.init();
    setActiveAccount(active);

    const books = await StorageService.getBookshelf();
    setBookshelf(books);

    const hist = await StorageService.getHistory();
    setHistory(hist);
  };

  useEffect(() => {
    loadData();
    // Check update after app initialization
    setTimeout(() => {
      UpdateService.checkUpdate().then((info) => {
        if (info.hasUpdate) {
          setUpdateInfo(info);
          setIsUpdateModalOpen(true);
        }
      });
    }, 2000);

    // Hardware back button and full-screen edge swipe back listener
    const backListener = CapApp.addListener('backButton', () => {
      if (bookshelfModalRef.current) {
        setBookshelfModalState(null);
        return;
      }
      if (readingSessionRef.current) {
        setReadingSession(null);
        return;
      }
      if (isAccountModalOpenRef.current) {
        setIsAccountModalOpen(false);
        return;
      }
      if (isUpdateModalOpenRef.current) {
        setIsUpdateModalOpen(false);
        return;
      }
      CapApp.exitApp();
    });

    return () => {
      backListener.then((sub) => sub.remove());
    };
  }, []);

  // Account operations
  const handleSaveAccount = async (account: CloudAccount) => {
    await StorageService.saveAccount(account);
    await StorageService.setCurrentAccountId(account.id);
    DriveManager.setActiveAccount(account);
    setActiveAccount(account);
    const accs = await StorageService.getAccounts();
    setAccounts(accs);
    setIsAccountModalOpen(false);
  };

  const handleSelectAccount = async (account: CloudAccount) => {
    await StorageService.setCurrentAccountId(account.id);
    DriveManager.setActiveAccount(account);
    setActiveAccount(account);
    setIsAccountModalOpen(false);
  };

  const handleDeleteAccount = async (id: string) => {
    await StorageService.deleteAccount(id);
    const accs = await StorageService.getAccounts();
    setAccounts(accs);
    if (activeAccount?.id === id) {
      const nextActive = accs[0] || null;
      DriveManager.setActiveAccount(nextActive);
      setActiveAccount(nextActive);
      if (nextActive) {
        await StorageService.setCurrentAccountId(nextActive.id);
      }
    }
  };

  // Bookshelf operations
  const handleAddToBookshelf = async (book: ComicBook) => {
    await StorageService.addToBookshelf(book);
    const books = await StorageService.getBookshelf();
    setBookshelf(books);
  };

  const handleRemoveFromBookshelf = async (bookId: string) => {
    await StorageService.removeFromBookshelf(bookId);
    const books = await StorageService.getBookshelf();
    setBookshelf(books);
  };

  // History operations
  const handleClearHistory = async () => {
    await StorageService.clearHistory();
    setHistory([]);
  };

  // Reader Launchers
  const handleOpenBook = async (book: ComicBook) => {
    // If book is a PDF file
    if (book.isPdf || isPdfFile(book.title) || isPdfFile(book.path)) {
      setReadingSession({
        comicId: book.id,
        comicTitle: book.title,
        currentChapter: {
          id: book.id,
          name: book.title,
          path: book.path,
          isPdf: true
        },
        initialPage: book.lastReadPageIndex || 1
      });
      return;
    }

    try {
      const struct = await DriveManager.getComicChapters(book.path);
      if (struct.hasSubChapters && struct.chapters.length > 0) {
        let targetChapter = struct.chapters[0];
        let initialPage = 1;

        if (book.lastReadChapterId) {
          const found = struct.chapters.find((c) => c.id === book.lastReadChapterId);
          if (found) {
            targetChapter = found;
            initialPage = book.lastReadPageIndex || 1;
          }
        }

        setReadingSession({
          comicId: book.id,
          comicTitle: book.title,
          currentChapter: targetChapter,
          initialPage,
          allChapters: struct.chapters
        });
        return;
      }
    } catch (e) {
      console.warn('Checking comic structure failed, falling back to direct open', e);
    }

    // Direct single chapter open fallback
    setReadingSession({
      comicId: book.id,
      comicTitle: book.title,
      currentChapter: {
        id: book.lastReadChapterId || book.path,
        name: book.lastReadChapterTitle || book.title,
        path: book.lastReadChapterId || book.path
      },
      initialPage: book.lastReadPageIndex || 1
    });
  };

  const handleExploreBookFolder = async (book: ComicBook) => {
    try {
      const struct = await DriveManager.getComicChapters(book.path);
      if (struct.hasSubChapters && struct.chapters.length > 0) {
        setBookshelfModalState({
          title: book.title,
          chapters: struct.chapters
        });
        return;
      }
    } catch (e) {
      console.warn('Failed to get chapters for bookshelf item', e);
    }
    setCurrentTab('explorer');
  };

  const handleReadFolder = (
    folder: { id: string; name: string; path: string; isPdf?: boolean },
    allItems?: DriveItem[]
  ) => {
    const isPdf = folder.isPdf || isPdfFile(folder.name) || isPdfFile(folder.path);

    // Collect sibling chapter folders if present (for normal series)
    const siblingChapters = allItems && !isPdf
      ? allItems.filter((i) => i.isDir).map((i) => ({ id: i.id, name: i.name, path: i.path }))
      : undefined;

    setReadingSession({
      comicId: folder.id,
      comicTitle: folder.name,
      currentChapter: { ...folder, isPdf },
      initialPage: 1,
      allChapters: siblingChapters
    });
  };

  const handleOpenHistory = (item: ReadHistoryItem) => {
    const isPdf = item.isPdf || isPdfFile(item.chapterTitle) || isPdfFile(item.chapterPath);
    setReadingSession({
      comicId: item.comicId,
      comicTitle: item.comicTitle,
      currentChapter: {
        id: item.chapterId,
        name: item.chapterTitle,
        path: item.chapterPath,
        isPdf
      },
      initialPage: item.pageIndex
    });
  };


  // Calculate adjacent chapters
  let prevChapter: { id: string; name: string; path: string } | undefined;
  let nextChapter: { id: string; name: string; path: string } | undefined;

  if (readingSession?.allChapters && readingSession.allChapters.length > 0) {
    const curIdx = readingSession.allChapters.findIndex(
      (c) => c.id === readingSession.currentChapter.id
    );
    if (curIdx > 0) {
      prevChapter = readingSession.allChapters[curIdx - 1];
    }
    if (curIdx >= 0 && curIdx < readingSession.allChapters.length - 1) {
      nextChapter = readingSession.allChapters[curIdx + 1];
    }
  }

  return (
    <div className="min-h-screen bg-[#121214] text-gray-100 flex flex-col font-sans">
      {/* Navigation Bar */}
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        activeAccount={activeAccount}
        onOpenAccountModal={() => setIsAccountModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-10">
        {currentTab === 'bookshelf' && (
          <Bookshelf
            books={bookshelf}
            onOpenBook={handleOpenBook}
            onExploreBookFolder={handleExploreBookFolder}
            onRemoveBook={handleRemoveFromBookshelf}
            onNavigateToExplorer={() => setCurrentTab('explorer')}
          />
        )}

        {currentTab === 'explorer' && (
          <Explorer
            activeAccount={activeAccount}
            onOpenAccountModal={() => setIsAccountModalOpen(true)}
            onReadFolder={handleReadFolder}
            onAddToBookshelf={handleAddToBookshelf}
            bookshelfBookIds={bookshelf.map((b) => b.id)}
          />
        )}

        {currentTab === 'history' && (
          <HistoryList
            history={history}
            onOpenHistory={handleOpenHistory}
            onClearHistory={handleClearHistory}
            onNavigateToExplorer={() => setCurrentTab('explorer')}
          />
        )}
      </main>

      {/* Cloud Account Management Modal */}
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        accounts={accounts}
        activeAccount={activeAccount}
        onSaveAccount={handleSaveAccount}
        onSelectAccount={handleSelectAccount}
        onDeleteAccount={handleDeleteAccount}
        onOpenUpdateModal={(info) => {
          setUpdateInfo(info);
          setIsUpdateModalOpen(true);
        }}
      />

      {/* Fullscreen Comic Reader Modal */}
      {readingSession && (
        <ComicReader
          comicId={readingSession.comicId}
          comicTitle={readingSession.comicTitle}
          currentChapter={readingSession.currentChapter}
          initialPage={readingSession.initialPage}
          prevChapter={prevChapter}
          nextChapter={nextChapter}
          allChapters={readingSession.allChapters}
          onChapterChange={(chap) => {
            setReadingSession((prev) => (prev ? { ...prev, currentChapter: chap, initialPage: 1 } : null));
          }}
          onClose={() => {
            setReadingSession(null);
            // Refresh history and bookshelf after reading
            StorageService.getHistory().then(setHistory);
            StorageService.getBookshelf().then(setBookshelf);
          }}
        />
      )}

      {/* App Version Update Modal */}
      <UpdateModal
        isOpen={isUpdateModalOpen}
        updateInfo={updateInfo}
        onClose={() => setIsUpdateModalOpen(false)}
      />

      {/* Bookshelf Chapter Selection Modal */}
      {bookshelfModalState && (
        <ChapterModal
          isOpen={true}
          onClose={() => setBookshelfModalState(null)}
          title={bookshelfModalState.title}
          chapters={bookshelfModalState.chapters}
          onSelectChapter={(chap) => {
            setReadingSession({
              comicId: chap.id,
              comicTitle: bookshelfModalState.title,
              currentChapter: chap,
              initialPage: 1,
              allChapters: bookshelfModalState.chapters
            });
            setBookshelfModalState(null);
          }}
        />
      )}
    </div>
  );
};
