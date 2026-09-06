import React, { useRef, useEffect, useCallback, useState } from 'react';
import { ComicPage } from '../../types/comic';
import { AlertCircle, RefreshCw, ZoomIn, RotateCcw } from 'lucide-react';

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

  // Zoom & Pan state
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isAnimating, setIsAnimating] = useState(false);

  // Jump to target page when slider or chapter changes externally
  useEffect(() => {
    // Reset zoom on chapter or target page change
    if (scale > 1) {
      setScale(1);
      setPan({ x: 0, y: 0 });
    }

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
    if (isProgrammaticScroll.current || !containerRef.current || scale > 1.05) return;

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
  }, [onPageVisible, scale]);

  const clampPan = (x: number, y: number, currentScale: number) => {
    if (currentScale <= 1.02) {
      return { x: 0, y: 0 };
    }
    const maxX = ((currentScale - 1) * window.innerWidth) / 2;
    const maxY = ((currentScale - 1) * window.innerHeight) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y))
    };
  };

  const resetZoom = () => {
    setIsAnimating(true);
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  // Touch gesture handling
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const startPanRef = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const isPinching = useRef(false);
  const pinchStartDist = useRef(0);
  const pinchStartScale = useRef(1);
  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });
  const singleTapTimerRef = useRef<any>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    isProgrammaticScroll.current = false;
    setIsAnimating(false);

    if (e.touches.length === 2) {
      // 2 fingers pinch
      isPinching.current = true;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      pinchStartDist.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      pinchStartScale.current = scale;
      startPanRef.current = { ...pan };
      isDragging.current = true;

      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
    } else if (e.touches.length === 1) {
      isPinching.current = false;
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      startPanRef.current = { ...pan };
      isDragging.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && isPinching.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

      if (pinchStartDist.current > 0) {
        isDragging.current = true;
        const targetScale = Math.min(3.0, Math.max(1, pinchStartScale.current * (dist / pinchStartDist.current)));
        setScale(targetScale);

        if (targetScale <= 1.02) {
          setPan({ x: 0, y: 0 });
        } else {
          setPan((prev) => clampPan(prev.x, prev.y, targetScale));
        }
      }
    } else if (e.touches.length === 1 && !isPinching.current) {
      const dx = e.touches[0].clientX - touchStartX.current;
      const dy = e.touches[0].clientY - touchStartY.current;

      if (Math.hypot(dx, dy) > 8) {
        isDragging.current = true;
      }

      if (scale > 1.05) {
        // Pan 2D image layer when zoomed in
        const nextX = startPanRef.current.x + dx;
        const nextY = startPanRef.current.y + dy;
        setPan(clampPan(nextX, nextY, scale));
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isPinching.current) {
      if (e.touches.length === 0) {
        isPinching.current = false;
        setIsAnimating(true);
        if (scale < 1.05) {
          setScale(1);
          setPan({ x: 0, y: 0 });
        } else {
          setPan((prev) => clampPan(prev.x, prev.y, scale));
        }
      }
      return;
    }

    if (!isDragging.current && e.changedTouches.length === 1) {
      // Tap or Double Tap
      const touch = e.changedTouches[0];
      const now = Date.now();
      const lastTap = lastTapRef.current;
      const distFromLastTap = Math.hypot(touch.clientX - lastTap.x, touch.clientY - lastTap.y);

      if (now - lastTap.time < 280 && distFromLastTap < 40) {
        // Double tap confirmed! Cancel pending single tap
        if (singleTapTimerRef.current) {
          clearTimeout(singleTapTimerRef.current);
          singleTapTimerRef.current = null;
        }

        setIsAnimating(true);
        if (scale > 1.05) {
          // Reset zoom
          setScale(1);
          setPan({ x: 0, y: 0 });
        } else {
          // Zoom into double-tap spot
          const targetScale = 2.0;
          const focalX = (window.innerWidth / 2 - touch.clientX) * (targetScale - 1);
          const focalY = (window.innerHeight / 2 - touch.clientY) * (targetScale - 1);
          setScale(targetScale);
          setPan(clampPan(focalX, focalY, targetScale));
        }
        lastTapRef.current = { time: 0, x: 0, y: 0 };
      } else {
        // First tap -> schedule single-tap HUD toggle
        lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
        singleTapTimerRef.current = setTimeout(() => {
          onToggleHUD();
          singleTapTimerRef.current = null;
        }, 260);
      }
    }
  };

  // Wheel zoom with Ctrl key for desktop
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = -e.deltaY * 0.002;
      const newScale = Math.min(3.0, Math.max(1, scale + delta));
      setIsAnimating(false);
      setScale(newScale);
      if (newScale <= 1.02) {
        setPan({ x: 0, y: 0 });
      } else {
        setPan((prev) => clampPan(prev.x, prev.y, newScale));
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      className={`w-full h-full select-none ${
        scale > 1.05 ? 'overflow-hidden' : 'overflow-y-auto overscroll-y-contain touch-pan-y'
      }`}
      style={{
        WebkitOverflowScrolling: 'touch',
        scrollBehavior: 'auto'
      }}
    >
      <div
        className="w-full max-w-2xl mx-auto flex flex-col"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${scale})`,
          transformOrigin: 'center center',
          transition: isAnimating ? 'transform 0.24s cubic-bezier(0.2, 0, 0, 1)' : 'none',
          willChange: 'transform'
        }}
      >
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

      {/* Floating Zoom Indicator & Quick Reset Button */}
      {scale > 1.05 && (
        <div className="fixed top-4 right-4 z-30 animate-fade-in pointer-events-auto">
          <button
            onClick={(e) => {
              e.stopPropagation();
              resetZoom();
            }}
            className="flex items-center gap-1.5 bg-black/75 hover:bg-black/90 text-indigo-300 px-3 py-1.5 rounded-full border border-indigo-500/40 text-xs font-mono font-medium shadow-lg backdrop-blur-md active:scale-95 transition"
          >
            <ZoomIn className="w-3.5 h-3.5 text-indigo-400" />
            <span>{scale.toFixed(1)}x</span>
            <RotateCcw className="w-3 h-3 text-gray-400 ml-1 hover:text-white" />
          </button>
        </div>
      )}
    </div>
  );
};
