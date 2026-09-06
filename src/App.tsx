import React, { useState, useEffect } from 'react';
import { CloudAccount, ComicBook, DriveItem, ReadHistoryItem } from './types/comic';
import { StorageService } from './services/storage';
import { DriveManager } from './services/driveManager';
import { Navbar } from './components/Navbar';
import { Bookshelf } from './components/Bookshelf';
import { Explorer } from './components/Explorer';
import { HistoryList } from './components/HistoryList';
import { AccountModal } from './components/AccountModal';
import { ComicReader } from './components/Reader/ComicReader';
import { UpdateModal } from './components/UpdateModal';
import { UpdateService, UpdateInfo } from './services/updater';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'bookshelf' | 'explorer' | 'history'>('bookshelf');
  const [accounts, setAccounts] = useState<CloudAccount[]>([]);
  const [activeAccount, setActiveAccount] = useState<CloudAccount | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  // Update check
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  const [bookshelf, setBookshelf] = useState<ComicBook[]>([]);
  const [history, setHistory] = useState<ReadHistoryItem[]>([]);

  // Active Reader state
  const [readingSession, setReadingSession] = useState<{
    comicId: string;
    comicTitle: string;
    currentChapter: { id: string; name: string; path: string };
    initialPage?: number;
    allChapters?: { id: string; name: string; path: string }[];
  } | null>(null);

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
  const handleOpenBook = (book: ComicBook) => {
    // If book already has last read chapter
    if (book.lastReadChapterId && book.lastReadChapterTitle) {
      setReadingSession({
        comicId: book.id,
        comicTitle: book.title,
        currentChapter: {
          id: book.lastReadChapterId,
          name: book.lastReadChapterTitle,
          path: book.lastReadChapterId
        },
        initialPage: book.lastReadPageIndex || 1
      });
    } else {
      // Read the book's root folder directly
      setReadingSession({
        comicId: book.id,
        comicTitle: book.title,
        currentChapter: {
          id: book.path,
          name: book.title,
          path: book.path
        },
        initialPage: 1
      });
    }
  };

  const handleReadFolder = (
    folder: { id: string; name: string; path: string },
    allItems?: DriveItem[]
  ) => {
    // Collect sibling chapter folders if present
    const siblingChapters = allItems
      ? allItems.filter((i) => i.isDir).map((i) => ({ id: i.id, name: i.name, path: i.path }))
      : undefined;

    setReadingSession({
      comicId: folder.id,
      comicTitle: folder.name,
      currentChapter: folder,
      initialPage: 1,
      allChapters: siblingChapters
    });
  };

  const handleOpenHistory = (item: ReadHistoryItem) => {
    setReadingSession({
      comicId: item.comicId,
      comicTitle: item.comicTitle,
      currentChapter: {
        id: item.chapterId,
        name: item.chapterTitle,
        path: item.chapterPath
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
            onExploreBookFolder={(book) => {
              setCurrentTab('explorer');
            }}
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
    </div>
  );
};
