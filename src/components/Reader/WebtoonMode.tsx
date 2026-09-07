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
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [isAnimating, setIsAnimating] = useState(false);

  // Synchronous refs for smooth 60-120fps gesture calculations
  const scaleRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const originRef = useRef({ x: 0, y: 0 });

  const applyTransform = useCallback((newScale: number, newX: number, newY: number, animate: boolean) => {
    scaleRef.current = newScale;
    panRef.current = { x: newX, y: newY };
    setScale(newScale);
    setPan({ x: newX, y: newY });
    setIsAnimating(animate);
  }, []);

  // Jump to target page when slider or chapter changes externally
  useEffect(() => {
    if (scaleRef.current > 1.05) {
      applyTransform(1, 0, 0, false);
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
  }, [targetPage, applyTransform]);

  // Throttled scroll listener to calculate visible page
  const lastReportedPage = useRef<number>(1);
  const handleScroll = useCallback(() => {
    if (isProgrammaticScroll.current || !containerRef.current || scaleRef.current > 1.05) return;

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

  const clampPan = (x: number, y: number, currentScale: number) => {
    if (currentScale <= 1.02) {
      return { x: 0, y: 0 };
    }
    const maxX = Math.max(0, ((currentScale - 1) * window.innerWidth) / 2);
    const maxY = Math.max(0, ((currentScale - 1) * (containerRef.current?.clientHeight || window.innerHeight)) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y))
    };
  };

  const resetZoom = () => {
    applyTransform(1, 0, 0, true);
  };

  // Touch gesture tracking ref
  const gestureRef = useRef<{
    activeTouches: number;
    startX: number;
    startY: number;
    startPan: { x: number; y: number };
    startDist: number;
    startScale: number;
    startMidX: number;
    startMidY: number;
    hasMoved: boolean;
  }>({
    activeTouches: 0,
    startX: 0,
    startY: 0,
    startPan: { x: 0, y: 0 },
    startDist: 0,
    startScale: 1,
    startMidX: 0,
    startMidY: 0,
    hasMoved: false
  });

  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });
  const singleTapTimerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
    };
  }, []);

  // Calculate local coordinate relative to inner content
  const calculateOrigin = (clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: window.innerWidth / 2, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const scrollTop = containerRef.current.scrollTop;
    const ox = clientX - rect.left;
    const oy = scrollTop + (clientY - rect.top);
    return { x: ox, y: oy };
  };

  // TOUCH START
  const handleTouchStart = (e: React.TouchEvent) => {
    isProgrammaticScroll.current = false;
    setIsAnimating(false);
    const g = gestureRef.current;
    g.activeTouches = e.touches.length;

    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      g.startDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      g.startScale = scaleRef.current;
      g.startMidX = (t1.clientX + t2.clientX) / 2;
      g.startMidY = (t1.clientY + t2.clientY) / 2;
      g.startPan = { ...panRef.current };
      g.hasMoved = false;

      // If starting zoom from scale = 1, anchor transformOrigin to two-finger midpoint
      if (scaleRef.current <= 1.05) {
        const o = calculateOrigin(g.startMidX, g.startMidY);
        originRef.current = o;
        setOrigin(o);
      }

      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      g.startX = t.clientX;
      g.startY = t.clientY;
      g.startPan = { ...panRef.current };
      g.hasMoved = false;
    }
  };

  // TOUCH MOVE
  const handleTouchMove = (e: React.TouchEvent) => {
    const g = gestureRef.current;

    // Seamless touch count transition without jumping
    if (e.touches.length !== g.activeTouches) {
      g.activeTouches = e.touches.length;
      if (e.touches.length === 1) {
        const t = e.touches[0];
        g.startX = t.clientX;
        g.startY = t.clientY;
        g.startPan = { ...panRef.current };
        return;
      } else if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        g.startDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        g.startScale = scaleRef.current;
        g.startMidX = (t1.clientX + t2.clientX) / 2;
        g.startMidY = (t1.clientY + t2.clientY) / 2;
        g.startPan = { ...panRef.current };
        return;
      }
    }

    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;

      if (g.startDist > 0) {
        g.hasMoved = true;
        const scaleFactor = dist / g.startDist;
        const targetScale = Math.min(3.2, Math.max(1, g.startScale * scaleFactor));

        const deltaMidX = midX - g.startMidX;
        const deltaMidY = midY - g.startMidY;
        const rawX = g.startPan.x + deltaMidX;
        const rawY = g.startPan.y + deltaMidY;

        const clamped = clampPan(rawX, rawY, targetScale);
        applyTransform(targetScale, clamped.x, clamped.y, false);
      }
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      const diffX = t.clientX - g.startX;
      const diffY = t.clientY - g.startY;

      if (Math.hypot(diffX, diffY) > 6) {
        g.hasMoved = true;
      }

      if (scaleRef.current > 1.05) {
        // In zoomed state, single finger pans in 2D
        const rawX = g.startPan.x + diffX;
        const rawY = g.startPan.y + diffY;
        const clamped = clampPan(rawX, rawY, scaleRef.current);
        applyTransform(scaleRef.current, clamped.x, clamped.y, false);
      }
    }
  };

  // TOUCH END
  const handleTouchEnd = (e: React.TouchEvent) => {
    const g = gestureRef.current;

    if (e.touches.length === 1) {
      // 1 finger remaining, re-anchor smoothly
      g.activeTouches = 1;
      const t = e.touches[0];
      g.startX = t.clientX;
      g.startY = t.clientY;
      g.startPan = { ...panRef.current };
      return;
    }

    if (e.touches.length === 0) {
      g.activeTouches = 0;

      if (scaleRef.current < 1.05) {
        applyTransform(1, 0, 0, true);
      } else {
        const clamped = clampPan(panRef.current.x, panRef.current.y, scaleRef.current);
        applyTransform(scaleRef.current, clamped.x, clamped.y, true);
      }

      // If user tapped without dragging -> Tap or Double-tap
      if (!g.hasMoved && e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        const now = Date.now();
        const lastTap = lastTapRef.current;
        const distFromLastTap = Math.hypot(touch.clientX - lastTap.x, touch.clientY - lastTap.y);

        if (now - lastTap.time < 280 && distFromLastTap < 40) {
          // Double Tap!
          if (singleTapTimerRef.current) {
            clearTimeout(singleTapTimerRef.current);
            singleTapTimerRef.current = null;
          }

          if (scaleRef.current > 1.05) {
            // Reset to 1x
            applyTransform(1, 0, 0, true);
          } else {
            // Zoom to 2.0x centered at double tap location
            const o = calculateOrigin(touch.clientX, touch.clientY);
            originRef.current = o;
            setOrigin(o);
            applyTransform(2.0, 0, 0, true);
          }
          lastTapRef.current = { time: 0, x: 0, y: 0 };
        } else {
          // First tap -> single tap timer
          lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
          singleTapTimerRef.current = setTimeout(() => {
            onToggleHUD();
            singleTapTimerRef.current = null;
          }, 260);
        }
      }
    }
  };

  // Wheel zoom with Ctrl key for desktop
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = -e.deltaY * 0.002;
      const newScale = Math.min(3.2, Math.max(1, scaleRef.current + delta));
      const clamped = clampPan(panRef.current.x, panRef.current.y, newScale);
      applyTransform(newScale, clamped.x, clamped.y, false);
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onWheel={handleWheel}
      className={`w-full h-full select-none ${
        scale > 1.05 ? 'overflow-hidden' : 'overflow-y-auto overscroll-y-contain'
      }`}
      style={{
        WebkitOverflowScrolling: 'touch',
        scrollBehavior: 'auto',
        touchAction: scale > 1.05 ? 'none' : 'pan-y'
      }}
    >
      <div
        className="w-full max-w-2xl mx-auto flex flex-col"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${scale})`,
          transformOrigin: `${origin.x}px ${origin.y}px`,
          transition: isAnimating ? 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
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
                referrerPolicy="no-referrer"
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
            className="flex items-center gap-1.5 bg-black/80 hover:bg-black/95 text-indigo-300 px-3.5 py-1.5 rounded-full border border-indigo-500/40 text-xs font-mono font-medium shadow-xl backdrop-blur-md active:scale-95 transition"
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
