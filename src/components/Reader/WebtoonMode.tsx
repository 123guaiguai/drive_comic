import React, { useRef, useEffect, useCallback } from 'react';
import { ComicPage } from '../../types/comic';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface WebtoonModeProps {
  pages: ComicPage[];
  targetPage?: number;
  onPageVisible: (pageIndex: number) => void;
  onToggleHUD: () => void;
  onRetryPage: (pageId: string) => void;
}

export const WebtoonMode: React.FC<WebtoonModeProps> = ({
  pages,
  targetPage,
  onPageVisible,
  onToggleHUD,
  onRetryPage
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isProgrammaticScroll = useRef(false);
  const scrollTimeoutRef = useRef<any>(null);

  // Jump to target page when slider or chapter changes externally
  useEffect(() => {
    if (targetPage === undefined || targetPage < 1) return;
    const targetEl = pageRefs.current[targetPage - 1];
    if (targetEl && containerRef.current) {
      isProgrammaticScroll.current = true;
      targetEl.scrollIntoView({ behavior: 'auto', block: 'start' });

      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 200);
    }
  }, [targetPage]);

  // Throttled scroll listener to calculate visible page without triggering feedback loops
  const lastReportedPage = useRef<number>(1);
  const handleScroll = useCallback(() => {
    if (isProgrammaticScroll.current || !containerRef.current) return;

    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const viewportMiddle = scrollTop + container.clientHeight * 0.4;

    for (let i = 0; i < pageRefs.current.length; i++) {
      const el = pageRefs.current[i];
      if (el) {
        const top = el.offsetTop;
        const bottom = top + el.offsetHeight;
        if (viewportMiddle >= top && viewportMiddle < bottom) {
          const newPage = i + 1;
          if (newPage !== lastReportedPage.current) {
            lastReportedPage.current = newPage;
            onPageVisible(newPage);
          }
          break;
        }
      }
    }
  }, [onPageVisible]);

  // Touch gesture handling: clearly distinguish between scroll and center tap
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isDragging = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    // User touches screen -> immediately cancel any programmatic scroll
    isProgrammaticScroll.current = false;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
    if (dx > 10 || dy > 10) {
      isDragging.current = true;
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging.current) {
      // Tap without movement -> toggle HUD
      onToggleHUD();
    }
  };

  const handleClick = () => {
    // Desktop mouse fallback
    if (!isDragging.current) {
      onToggleHUD();
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
      className="w-full h-full overflow-y-auto overscroll-y-contain select-none touch-pan-y"
      style={{
        WebkitOverflowScrolling: 'touch',
        scrollBehavior: 'auto'
      }}
    >
      <div className="w-full max-w-2xl mx-auto flex flex-col">
        {pages.map((page, idx) => (
          <div
            key={page.id}
            ref={(el) => (pageRefs.current[idx] = el)}
            data-page-index={page.index}
            className="w-full relative min-h-[260px] flex items-center justify-center bg-transparent"
          >
            {page.error ? (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onRetryPage(page.id);
                }}
                className="w-full aspect-[2/3] bg-gray-900/80 border border-gray-800 rounded-xl flex flex-col items-center justify-center p-4 text-center cursor-pointer m-2"
              >
                <AlertCircle className="w-8 h-8 text-amber-500 mb-2" />
                <p className="text-xs text-gray-300 font-medium">第 {page.index} 页加载失败</p>
                <button className="mt-3 flex items-center gap-1 text-xs text-indigo-400 bg-indigo-950/50 px-3 py-1.5 rounded-lg border border-indigo-500/30">
                  <RefreshCw className="w-3.5 h-3.5" /> 点击重试
                </button>
              </div>
            ) : (
              <img
                src={page.url}
                alt={`Page ${page.index}`}
                loading={idx < 5 ? 'eager' : 'lazy'}
                draggable={false}
                className="w-full h-auto block select-none pointer-events-none comic-page-img"
                onError={() => onRetryPage(page.id)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
