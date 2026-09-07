import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ComicPage } from '../../types/comic';
import { AlertCircle, RefreshCw, ZoomIn, RotateCcw } from 'lucide-react';

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
  // Visual state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isAnimating, setIsAnimating] = useState(false);

  // Synchronous refs to prevent React state closure latency/drift during 60-120fps touch events
  const scaleRef = useRef(1);
  const posRef = useRef({ x: 0, y: 0 });

  // Update transform synchronously in both refs and React state
  const applyTransform = useCallback((newScale: number, newX: number, newY: number, animate: boolean) => {
    scaleRef.current = newScale;
    posRef.current = { x: newX, y: newY };
    setScale(newScale);
    setPosition({ x: newX, y: newY });
    setIsAnimating(animate);
  }, []);

  // Clamps translation to ensure the image stays within viewing bounds
  const clampPosition = (x: number, y: number, currentScale: number) => {
    if (currentScale <= 1.02) {
      return { x: 0, y: 0 };
    }
    const maxX = Math.max(0, ((currentScale - 1) * window.innerWidth) / 2);
    const maxY = Math.max(0, ((currentScale - 1) * window.innerHeight) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y))
    };
  };

  // Gesture tracking ref
  const gestureRef = useRef<{
    activeTouches: number;
    // 1-finger pan / swipe
    startX: number;
    startY: number;
    startPos: { x: number; y: number };
    hasMoved: boolean;
    // 2-finger pinch
    startDist: number;
    startScale: number;
    startMidX: number;
    startMidY: number;
  }>({
    activeTouches: 0,
    startX: 0,
    startY: 0,
    startPos: { x: 0, y: 0 },
    hasMoved: false,
    startDist: 0,
    startScale: 1,
    startMidX: 0,
    startMidY: 0
  });

  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });
  const singleTapTimerRef = useRef<any>(null);

  const activePage = pages[currentPage - 1];

  // Auto reset zoom when turning to another page
  useEffect(() => {
    applyTransform(1, 0, 0, false);
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
    }
  }, [currentPage, applyTransform]);

  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
    };
  }, []);

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

  const resetZoom = () => {
    applyTransform(1, 0, 0, true);
  };

  // Single tap action (Left/Right to flip page, Center to toggle HUD)
  const handleSingleTap = (clientX: number) => {
    const width = window.innerWidth;
    if (scaleRef.current > 1.05) {
      // In zoomed state, single tap toggles HUD
      onToggleHUD();
      return;
    }

    if (clientX < width * 0.3) {
      if (direction === 'right-to-left') {
        goNext();
      } else {
        goPrev();
      }
    } else if (clientX > width * 0.7) {
      if (direction === 'right-to-left') {
        goPrev();
      } else {
        goNext();
      }
    } else {
      onToggleHUD();
    }
  };

  // TOUCH START
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsAnimating(false);
    const g = gestureRef.current;
    g.activeTouches = e.touches.length;

    if (e.touches.length === 2) {
      // Pinch started
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      g.startDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      g.startScale = scaleRef.current;
      g.startMidX = (t1.clientX + t2.clientX) / 2;
      g.startMidY = (t1.clientY + t2.clientY) / 2;
      g.startPos = { ...posRef.current };
      g.hasMoved = false;

      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
    } else if (e.touches.length === 1) {
      // 1-finger pan or potential tap
      const t = e.touches[0];
      g.startX = t.clientX;
      g.startY = t.clientY;
      g.startPos = { ...posRef.current };
      g.hasMoved = false;
    }
  };

  // TOUCH MOVE
  const handleTouchMove = (e: React.TouchEvent) => {
    const g = gestureRef.current;

    // Handle 2-to-1 or 1-to-2 transitions smoothly without jumps
    if (e.touches.length !== g.activeTouches) {
      g.activeTouches = e.touches.length;
      if (e.touches.length === 1) {
        // Re-anchor remaining finger
        const t = e.touches[0];
        g.startX = t.clientX;
        g.startY = t.clientY;
        g.startPos = { ...posRef.current };
        return;
      } else if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        g.startDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        g.startScale = scaleRef.current;
        g.startMidX = (t1.clientX + t2.clientX) / 2;
        g.startMidY = (t1.clientY + t2.clientY) / 2;
        g.startPos = { ...posRef.current };
        return;
      }
    }

    if (e.touches.length === 2) {
      // Two-finger Pinch & Pan
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;

      if (g.startDist > 0) {
        g.hasMoved = true;
        const scaleFactor = dist / g.startDist;
        const targetScale = Math.min(3.5, Math.max(1, g.startScale * scaleFactor));

        // Follow midpoint movement while pinching
        const deltaMidX = midX - g.startMidX;
        const deltaMidY = midY - g.startMidY;
        const rawX = g.startPos.x + deltaMidX;
        const rawY = g.startPos.y + deltaMidY;

        const clamped = clampPosition(rawX, rawY, targetScale);
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
        // Drag / Pan zoomed comic
        const rawX = g.startPos.x + diffX;
        const rawY = g.startPos.y + diffY;
        const clamped = clampPosition(rawX, rawY, scaleRef.current);
        applyTransform(scaleRef.current, clamped.x, clamped.y, false);
      }
    }
  };

  // TOUCH END
  const handleTouchEnd = (e: React.TouchEvent) => {
    const g = gestureRef.current;

    if (e.touches.length === 1) {
      // One finger released, re-anchor remaining finger immediately
      g.activeTouches = 1;
      const remaining = e.touches[0];
      g.startX = remaining.clientX;
      g.startY = remaining.clientY;
      g.startPos = { ...posRef.current };
      return;
    }

    if (e.touches.length === 0) {
      g.activeTouches = 0;

      // When all touches lifted:
      if (scaleRef.current < 1.05) {
        // Snap back to 1.0x
        applyTransform(1, 0, 0, true);
      } else {
        // Spring-back to valid clamped boundary
        const clamped = clampPosition(posRef.current.x, posRef.current.y, scaleRef.current);
        applyTransform(scaleRef.current, clamped.x, clamped.y, true);
      }

      // If it was a horizontal swipe in normal mode (scale <= 1.05)
      if (g.hasMoved && scaleRef.current <= 1.05 && e.changedTouches.length === 1) {
        const endTouch = e.changedTouches[0];
        const diffX = endTouch.clientX - g.startX;
        const diffY = endTouch.clientY - g.startY;

        if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY)) {
          if (diffX > 0) {
            direction === 'right-to-left' ? goPrev() : goNext();
          } else {
            direction === 'right-to-left' ? goNext() : goPrev();
          }
        }
        return;
      }

      // If user tapped without dragging -> Tap or Double-tap
      if (!g.hasMoved && e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        const now = Date.now();
        const lastTap = lastTapRef.current;
        const distFromLastTap = Math.hypot(touch.clientX - lastTap.x, touch.clientY - lastTap.y);

        if (now - lastTap.time < 280 && distFromLastTap < 40) {
          // Double Tap confirmed!
          if (singleTapTimerRef.current) {
            clearTimeout(singleTapTimerRef.current);
            singleTapTimerRef.current = null;
          }

          if (scaleRef.current > 1.1) {
            // Reset to 1x
            applyTransform(1, 0, 0, true);
          } else {
            // Smooth zoom to 2.2x centered on tap location
            const targetScale = 2.2;
            const focalX = (window.innerWidth / 2 - touch.clientX) * (targetScale - 1);
            const focalY = (window.innerHeight / 2 - touch.clientY) * (targetScale - 1);
            const clamped = clampPosition(focalX, focalY, targetScale);
            applyTransform(targetScale, clamped.x, clamped.y, true);
          }
          lastTapRef.current = { time: 0, x: 0, y: 0 };
        } else {
          // First tap -> start single tap timer
          lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
          const clientX = touch.clientX;
          singleTapTimerRef.current = setTimeout(() => {
            handleSingleTap(clientX);
            singleTapTimerRef.current = null;
          }, 260);
        }
      }
    }
  };

  // Desktop wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.002;
    const newScale = Math.min(3.5, Math.max(1, scaleRef.current + delta));
    const clamped = clampPosition(posRef.current.x, posRef.current.y, newScale);
    applyTransform(newScale, clamped.x, clamped.y, false);
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
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onWheel={handleWheel}
      className="w-full h-screen relative flex items-center justify-center overflow-hidden select-none bg-black"
      style={{ touchAction: 'none' }}
    >
      <div
        className="w-full h-full flex items-center justify-center pointer-events-auto"
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0px) scale(${scale})`,
          transformOrigin: 'center center',
          transition: isAnimating ? 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
          willChange: 'transform'
        }}
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
        ) : !activePage.url ? (
          <div className="p-8 bg-gray-900/80 border border-gray-800/80 rounded-2xl flex flex-col items-center justify-center text-center animate-pulse">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-400 mb-3" />
            <p className="text-sm font-medium text-gray-300">正在渲染第 {activePage.index} 页...</p>
          </div>
        ) : (
          <img
            src={activePage.url}
            alt={`Page ${activePage.index}`}
            draggable={false}
            className="max-w-full max-h-full object-contain pointer-events-none user-select-none"
            onError={() => onRetryPage(activePage.id)}
          />
        )}

      </div>

      {/* Floating Zoom Indicator & Quick Reset Button */}
      {scale > 1.05 && (
        <div className="absolute top-4 right-4 z-30 animate-fade-in pointer-events-auto">
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
