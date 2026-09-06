import React, { useState, useRef } from 'react';
import { ComicPage } from '../../types/comic';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface PagerModeProps {
  pages: ComicPage[];
  currentPage: number;
  direction: 'right-to-left' | 'left-to-right';
  onPageChange: (newPage: number) => void;
  onToggleHUD: () => void;
  onRetryPage: (pageId: string) => void;
}

export const PagerMode: React.FC<PagerModeProps> = ({
  pages,
  currentPage,
  direction,
  onPageChange,
  onToggleHUD,
  onRetryPage
}) => {
  const [scale, setScale] = useState(1);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const activePage = pages[currentPage - 1];

  const goNext = () => {
    if (currentPage < pages.length) {
      onPageChange(currentPage + 1);
    }
  };

  const goPrev = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  // Screen tap areas:
  // Left 30%, Center 40%, Right 30%
  const handleScreenClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const width = window.innerWidth;
    const x = e.clientX;

    if (scale > 1) {
      // If zoomed in, tap resets zoom
      setScale(1);
      return;
    }

    if (x < width * 0.3) {
      // Tapped left
      if (direction === 'right-to-left') {
        goNext();
      } else {
        goPrev();
      }
    } else if (x > width * 0.7) {
      // Tapped right
      if (direction === 'right-to-left') {
        goPrev();
      } else {
        goNext();
      }
    } else {
      // Tapped center
      onToggleHUD();
    }
  };

  // Touch gestures for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (scale > 1) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = endX - touchStartX.current;
    const diffY = endY - touchStartY.current;

    // Horizontal swipe threshold
    if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 0) {
        // Swiped right
        if (direction === 'right-to-left') {
          goPrev();
        } else {
          goNext();
        }
      } else {
        // Swiped left
        if (direction === 'right-to-left') {
          goNext();
        } else {
          goPrev();
        }
      }
    }
  };

  // Double tap zoom
  const lastTapRef = useRef<number>(0);
  const handleDoubleTap = (e: React.MouseEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setScale((prev) => (prev > 1 ? 1 : 2));
    }
    lastTapRef.current = now;
  };

  if (!activePage) {
    return (
      <div className="w-full h-screen flex items-center justify-center text-gray-500">
        没有可显示的页面
      </div>
    );
  }

  return (
    <div
      onClick={(e) => {
        handleDoubleTap(e);
        handleScreenClick(e);
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="w-full h-screen relative flex items-center justify-center overflow-hidden select-none"
    >
      <div
        className="w-full h-full flex items-center justify-center transition-transform duration-150"
        style={{ transform: `scale(${scale})` }}
      >
        {activePage.error ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onRetryPage(activePage.id);
            }}
            className="p-6 bg-gray-900 border border-gray-800 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer"
          >
            <AlertCircle className="w-10 h-10 text-amber-500 mb-2" />
            <p className="text-sm text-gray-300">第 {activePage.index} 页加载失败</p>
            <button className="mt-3 flex items-center gap-1.5 text-xs text-indigo-400 bg-indigo-950/50 px-4 py-2 rounded-xl border border-indigo-500/30">
              <RefreshCw className="w-3.5 h-3.5" /> 点击重试
            </button>
          </div>
        ) : (
          <img
            src={activePage.url}
            alt={`Page ${activePage.index}`}
            className="max-w-full max-h-full object-contain pointer-events-none"
            onError={() => onRetryPage(activePage.id)}
          />
        )}
      </div>

      {/* Preload adjacent page in background */}
      {currentPage < pages.length && pages[currentPage]?.url && (
        <img
          src={pages[currentPage].url}
          alt="preload"
          className="hidden"
          loading="eager"
        />
      )}
    </div>
  );
};
