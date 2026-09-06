import React, { useRef, useEffect } from 'react';
import { ComicPage } from '../../types/comic';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface WebtoonModeProps {
  pages: ComicPage[];
  currentPage: number;
  onPageVisible: (pageIndex: number) => void;
  onToggleHUD: () => void;
  onRetryPage: (pageId: string) => void;
}

export const WebtoonMode: React.FC<WebtoonModeProps> = ({
  pages,
  currentPage,
  onPageVisible,
  onToggleHUD,
  onRetryPage
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Observe page intersections to update current visible page
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
            const index = Number(entry.target.getAttribute('data-page-index'));
            if (!isNaN(index)) {
              onPageVisible(index);
            }
          }
        }
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: [0.3]
      }
    );

    pageRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [pages]);

  // Scroll to page when slider changes externally
  const isInternalScroll = useRef(false);
  useEffect(() => {
    if (isInternalScroll.current) {
      isInternalScroll.current = false;
      return;
    }
    const targetEl = pageRefs.current[currentPage - 1];
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentPage]);

  return (
    <div
      ref={containerRef}
      onClick={onToggleHUD}
      className="w-full min-h-screen flex flex-col items-center select-none"
    >
      <div className="w-full max-w-2xl mx-auto flex flex-col">
        {pages.map((page, idx) => (
          <div
            key={page.id}
            ref={(el) => (pageRefs.current[idx] = el)}
            data-page-index={page.index}
            className="w-full relative min-h-[300px] flex items-center justify-center bg-transparent"
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
                loading={idx < 4 ? 'eager' : 'lazy'}
                className="w-full h-auto block select-none comic-page-img"
                onError={() => onRetryPage(page.id)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
