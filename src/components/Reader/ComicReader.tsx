import React, { useState, useEffect } from 'react';
import { ComicPage, ReaderSettings } from '../../types/comic';
import { DriveManager } from '../../services/driveManager';
import { StorageService } from '../../services/storage';
import { ReaderHUD } from './ReaderHUD';
import { WebtoonMode } from './WebtoonMode';
import { PagerMode } from './PagerMode';
import { RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';

interface ComicReaderProps {
  comicId: string;
  comicTitle: string;
  currentChapter: { id: string; name: string; path: string };
  initialPage?: number;
  prevChapter?: { id: string; name: string; path: string };
  nextChapter?: { id: string; name: string; path: string };
  onChapterChange: (chapter: { id: string; name: string; path: string }) => void;
  onClose: () => void;
}

export const ComicReader: React.FC<ComicReaderProps> = ({
  comicId,
  comicTitle,
  currentChapter,
  initialPage = 1,
  prevChapter,
  nextChapter,
  onChapterChange,
  onClose
}) => {
  const [pages, setPages] = useState<ComicPage[]>([]);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHUD, setShowHUD] = useState(false);

  const [settings, setSettings] = useState<ReaderSettings>({
    mode: 'webtoon',
    backgroundColor: '#121214',
    keepAwake: true,
    preloadCount: 4,
    doubleTapZoom: true
  });

  // Load Settings
  useEffect(() => {
    StorageService.getSettings().then(setSettings);
  }, []);

  const handleSettingsChange = (partial: Partial<ReaderSettings>) => {
    StorageService.saveSettings(partial).then(setSettings);
  };

  // Load Chapter Pages
  const loadPages = async () => {
    setLoading(true);
    setError(null);
    try {
      const pageList = await DriveManager.getChapterPages(currentChapter.id);
      if (pageList.length === 0) {
        setError('该文件夹中未找到支持的漫画图片（支持 jpg, png, webp, gif 等）');
      } else {
        setPages(pageList);
        const validPage = Math.min(Math.max(1, initialPage), pageList.length);
        setCurrentPage(validPage);
      }
    } catch (e: any) {
      setError(e.message || '加载漫画页面失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPages();
  }, [currentChapter.id]);

  // Record reading progress to history
  useEffect(() => {
    if (pages.length > 0 && currentPage >= 1) {
      const activeAccount = DriveManager.getActiveAccount();
      StorageService.updateHistory({
        comicId,
        comicTitle,
        chapterId: currentChapter.id,
        chapterTitle: currentChapter.name,
        chapterPath: currentChapter.path,
        driveType: activeAccount?.type || 'quark',
        pageIndex: currentPage,
        totalPages: pages.length,
        timestamp: Date.now(),
        coverUrl: pages[0]?.thumbnailUrl || pages[0]?.url
      });
    }
  }, [currentPage, pages.length, currentChapter.id]);

  const handlePageVisible = (index: number) => {
    setCurrentPage(index);
  };

  const handleRetryPage = (pageId: string) => {
    setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, error: false, url: `${p.url}#retry=${Date.now()}` } : p))
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden flex flex-col transition-colors duration-200"
      style={{ backgroundColor: settings.backgroundColor }}
    >
      {/* Loading state */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
          <RefreshCw className="w-9 h-9 animate-spin text-indigo-500 mb-3" />
          <p className="text-sm font-medium">正在解析漫画章节图片...</p>
          <p className="text-xs text-gray-500 mt-1">{currentChapter.name}</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
          <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
          <h3 className="text-base font-bold text-gray-200">无法加载漫画</h3>
          <p className="text-xs text-gray-400 mt-2 mb-6 leading-relaxed">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-semibold"
            >
              返回目录
            </button>
            <button
              onClick={loadPages}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30"
            >
              重试加载
            </button>
          </div>
        </div>
      )}

      {/* Reader View */}
      {!loading && !error && pages.length > 0 && (
        <div className="flex-1 w-full h-full overflow-y-auto">
          {settings.mode === 'webtoon' ? (
            <WebtoonMode
              pages={pages}
              currentPage={currentPage}
              onPageVisible={handlePageVisible}
              onToggleHUD={() => setShowHUD((prev) => !prev)}
              onRetryPage={handleRetryPage}
            />
          ) : (
            <PagerMode
              pages={pages}
              currentPage={currentPage}
              direction={settings.mode === 'right-to-left' ? 'right-to-left' : 'left-to-right'}
              onPageChange={(p) => setCurrentPage(p)}
              onToggleHUD={() => setShowHUD((prev) => !prev)}
              onRetryPage={handleRetryPage}
            />
          )}
        </div>
      )}

      {/* Control HUD Overlay */}
      <ReaderHUD
        showHUD={showHUD}
        title={comicTitle}
        chapterTitle={currentChapter.name}
        currentPage={currentPage}
        totalPages={pages.length}
        settings={settings}
        hasPrevChapter={!!prevChapter}
        hasNextChapter={!!nextChapter}
        onPrevChapter={() => prevChapter && onChapterChange(prevChapter)}
        onNextChapter={() => nextChapter && onChapterChange(nextChapter)}
        onPageChange={(p) => setCurrentPage(p)}
        onSettingsChange={handleSettingsChange}
        onCloseReader={onClose}
      />
    </div>
  );
};
