import React, { useState, useEffect, useRef } from 'react';
import { ComicPage, ReaderSettings } from '../../types/comic';
import { DriveManager } from '../../services/driveManager';
import { PdfService } from '../../services/pdfService';
import { isPdfFile } from '../../services/naturalSort';
import { StorageService } from '../../services/storage';
import { ReaderHUD } from './ReaderHUD';
import { WebtoonMode } from './WebtoonMode';
import { PagerMode } from './PagerMode';
import { ChapterModal, ChapterItemData } from '../ChapterModal';
import { RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';

interface ComicReaderProps {
  comicId: string;
  comicTitle: string;
  currentChapter: { id: string; name: string; path: string; isPdf?: boolean };
  initialPage?: number;
  prevChapter?: { id: string; name: string; path: string };
  nextChapter?: { id: string; name: string; path: string };
  allChapters?: { id: string; name: string; path: string }[];
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
  allChapters,
  onChapterChange,
  onClose
}) => {
  const [pages, setPages] = useState<ComicPage[]>([]);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [targetPage, setTargetPage] = useState<number | undefined>(initialPage);
  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('正在解析漫画章节图片...');
  const [error, setError] = useState<string | null>(null);
  const [showHUD, setShowHUD] = useState(false);
  const [isChapterModalOpen, setIsChapterModalOpen] = useState(false);
  const [localChapters, setLocalChapters] = useState<{ id: string; name: string; path: string }[]>(
    allChapters || []
  );

  const isPdfComic = isPdfFile(currentChapter.name || '') || isPdfFile(currentChapter.path || '') || !!currentChapter.isPdf;

  // Sync or discover sibling chapters
  useEffect(() => {
    if (allChapters && allChapters.length > 0) {
      setLocalChapters(allChapters);
    } else {
      const curPath = currentChapter.path;
      const parts = curPath.replace(/\/+$/, '').split('/');
      if (parts.length > 1) {
        parts.pop();
        const parentPath = parts.join('/') || '/';
        DriveManager.getComicChapters(parentPath)
          .then((res) => {
            if (res.hasSubChapters && res.chapters.length > 0) {
              setLocalChapters(res.chapters);
            }
          })
          .catch(() => {});
      }
    }
  }, [currentChapter.path, allChapters]);

  // Touch gesture for left-edge swipe to exit (Android full-screen back gesture)
  const edgeStartX = useRef(0);
  const edgeStartY = useRef(0);
  const isEdgeSwipe = useRef(false);

  const handleTouchStartGlobal = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (touch.clientX < 35) {
        edgeStartX.current = touch.clientX;
        edgeStartY.current = touch.clientY;
        isEdgeSwipe.current = true;
      } else {
        isEdgeSwipe.current = false;
      }
    }
  };

  const handleTouchMoveGlobal = (e: React.TouchEvent) => {
    if (!isEdgeSwipe.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - edgeStartX.current;
    const dy = Math.abs(touch.clientY - edgeStartY.current);

    if (dx > 65 && dy < 45) {
      isEdgeSwipe.current = false;
      onClose();
    }
  };

  const handleTouchEndGlobal = () => {
    isEdgeSwipe.current = false;
  };

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

  // Close PDF session on unmount or chapter change
  useEffect(() => {
    return () => {
      PdfService.closeActiveSession();
    };
  }, [currentChapter.id]);

  // Load Chapter Pages (Supports standard images & PDF manga)
  const loadPages = async () => {
    setLoading(true);
    setError(null);

    try {
      if (isPdfComic) {
        setLoadingText('正在从网盘下载并解析 PDF 漫画...');
        const targetIdOrPath = currentChapter.path || currentChapter.id;
        const buffer = await DriveManager.getPdfBuffer(targetIdOrPath);
        setLoadingText('正在渲染 PDF 漫画高清页面...');
        const session = await PdfService.loadPdfFromBuffer(buffer);

        if (session.totalPages === 0) {
          throw new Error('PDF 文件为空或无法解析有效页面');
        }

        const initialPages = session.generateComicPages(currentChapter.name);
        setPages(initialPages);

        const validPage = Math.min(Math.max(1, initialPage), session.totalPages);
        setCurrentPage(validPage);
        setTargetPage(validPage);

        // Render current page immediately
        const firstUrl = await session.renderPage(validPage);
        setPages((prev) =>
          prev.map((p) => (p.index === validPage ? { ...p, url: firstUrl, downloadUrl: firstUrl, loaded: true } : p))
        );

        // Preload nearby pages
        session.preloadPages(validPage, 3);
      } else {
        setLoadingText('正在解析漫画章节图片...');
        const pageList = await DriveManager.getChapterPages(currentChapter.id);
        if (pageList.length === 0) {
          setError('该文件夹中未找到支持的漫画图片（支持 jpg, png, webp, gif 等）');
        } else {
          setPages(pageList);
          const validPage = Math.min(Math.max(1, initialPage), pageList.length);
          setCurrentPage(validPage);
          setTargetPage(validPage);
        }
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

  // Dynamic on-demand preloading for PDF pages
  useEffect(() => {
    const session = PdfService.getActiveSession();
    if (!isPdfComic || !session || pages.length === 0) return;

    session.preloadPages(currentPage, 3);

    // Check if any nearby page rendered in background, sync URL to state
    const range = 3;
    const minP = Math.max(1, currentPage - range);
    const maxP = Math.min(pages.length, currentPage + range);

    for (let p = minP; p <= maxP; p++) {
      if (!pages[p - 1]?.url) {
        session.renderPage(p).then((url) => {
          setPages((prev) =>
            prev.map((item) => (item.index === p ? { ...item, url, downloadUrl: url, loaded: true } : item))
          );
        }).catch(() => {});
      }
    }
  }, [currentPage, isPdfComic, pages.length]);

  // Record reading progress to history
  useEffect(() => {
    if (pages.length > 0 && currentPage >= 1) {
      const activeAccount = DriveManager.getActiveAccount();
      const firstPage = pages[0];
      const cover = firstPage?.thumbnailUrl || firstPage?.url;

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
        coverUrl: cover || undefined,
        isPdf: isPdfComic
      });
    }
  }, [currentPage, pages.length, currentChapter.id, isPdfComic]);

  const handlePageVisible = (index: number) => {
    setCurrentPage(index);
  };

  const handleRetryPage = async (pageId: string) => {
    const targetPageObj = pages.find((p) => p.id === pageId);
    if (!targetPageObj) return;

    if (isPdfComic) {
      const session = PdfService.getActiveSession();
      if (session) {
        try {
          const url = await session.renderPage(targetPageObj.index);
          setPages((prev) =>
            prev.map((p) => (p.id === pageId ? { ...p, error: false, url, downloadUrl: url, loaded: true } : p))
          );
          return;
        } catch {
          // retry failed
        }
      }
    }

    setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, error: false, url: `${p.url}#retry=${Date.now()}` } : p))
    );
  };

  const currentChapterIndex = localChapters.findIndex((c) => c.id === currentChapter.id);

  return (
    <div
      onTouchStart={handleTouchStartGlobal}
      onTouchMove={handleTouchMoveGlobal}
      onTouchEnd={handleTouchEndGlobal}
      className="fixed inset-0 z-50 overflow-hidden flex flex-col transition-colors duration-200 select-none"
      style={{ backgroundColor: settings.backgroundColor }}
    >
      {/* Loading state */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
          <RefreshCw className="w-9 h-9 animate-spin text-indigo-500 mb-3" />
          <p className="text-sm font-medium">{loadingText}</p>
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
        <div className="flex-1 w-full h-full overflow-hidden relative">
          {settings.mode === 'webtoon' ? (
            <WebtoonMode
              pages={pages}
              targetPage={targetPage}
              onPageVisible={handlePageVisible}
              onToggleHUD={() => setShowHUD((prev) => !prev)}
              onRetryPage={handleRetryPage}
            />
          ) : (
            <PagerMode
              pages={pages}
              currentPage={currentPage}
              direction={settings.mode === 'right-to-left' ? 'right-to-left' : 'left-to-right'}
              onPageChange={(p) => {
                setCurrentPage(p);
                setTargetPage(p);
              }}
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
        onPrevChapter={() => {
          setTargetPage(1);
          prevChapter && onChapterChange(prevChapter);
        }}
        onNextChapter={() => {
          setTargetPage(1);
          nextChapter && onChapterChange(nextChapter);
        }}
        onPageChange={(p) => {
          setCurrentPage(p);
          setTargetPage(p);
        }}
        onSettingsChange={handleSettingsChange}
        onCloseReader={onClose}
        onToggleHUD={() => setShowHUD((prev) => !prev)}
        onOpenChapterModal={() => setIsChapterModalOpen(true)}
        allChaptersCount={localChapters.length}
        currentChapterIndex={currentChapterIndex >= 0 ? currentChapterIndex : undefined}
      />

      {/* Chapter Selection Drawer / Modal */}
      <ChapterModal
        isOpen={isChapterModalOpen}
        onClose={() => setIsChapterModalOpen(false)}
        title={comicTitle}
        chapters={localChapters}
        currentChapterId={currentChapter.id}
        onSelectChapter={(chap) => {
          setTargetPage(1);
          onChapterChange(chap);
        }}
      />
    </div>
  );
};
