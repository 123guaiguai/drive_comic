import React, { useState, useRef, useEffect } from 'react';
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
  // Zoom & Pan states
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isAnimating, setIsAnimating] = useState(false);

  // Gesture refs
  const touchStateRef = useRef<{
    mode: 'idle' | 'pan' | 'pinch' | 'swipe';
    startX: number;
    startY: number;
    startDistance: number;
    startScale: number;
    startPos: { x: number; y: number };
    hasMoved: boolean;
  }>({
    mode: 'idle',
    startX: 0,
    startY: 0,
    startDistance: 0,
    startScale: 1,
    startPos: { x: 0, y: 0 },
    hasMoved: false
  });

  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });
  const singleTapTimerRef = useRef<any>(null);

  const activePage = pages[currentPage - 1];

  // Auto reset zoom when turning to another page
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsAnimating(false);
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
    }
  }, [currentPage]);

  // Clean up timer on unmount
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
    setIsAnimating(true);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Clamp translation so image cannot be dragged entirely off-screen
  const clampPosition = (x: number, y: number, currentScale: number) => {
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

  // Single tap action (Left/Right to flip page, Center to toggle HUD)
  const handleSingleTap = (clientX: number) => {
    const width = window.innerWidth;
    if (scale > 1.05) {
      // In zoomed state, single tap toggles HUD
      onToggleHUD();
      return;
    }

    if (clientX < width * 0.3) {
      // Left 30%
      if (direction === 'right-to-left') {
        goNext();
      } else {
        goPrev();
      }
    } else if (clientX > width * 0.7) {
      // Right 30%
      if (direction === 'right-to-left') {
        goPrev();
      } else {
        goNext();
      }
    } else {
      // Center 40%
      onToggleHUD();
    }
  };

  // Touch handlers for Pinch, Pan, Double-Tap and Swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsAnimating(false);

    if (e.touches.length === 2) {
      // 2 fingers -> Pinch to zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);

      touchStateRef.current = {
        mode: 'pinch',
        startX: (touch1.clientX + touch2.clientX) / 2,
        startY: (touch1.clientY + touch2.clientY) / 2,
        startDistance: distance,
        startScale: scale,
        startPos: { ...position },
        hasMoved: false
      };

      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
    } else if (e.touches.length === 1) {
      // 1 finger
      const touch = e.touches[0];
      touchStateRef.current = {
        mode: scale > 1.05 ? 'pan' : 'swipe',
        startX: touch.clientX,
        startY: touch.clientY,
        startDistance: 0,
        startScale: scale,
        startPos: { ...position },
        hasMoved: false
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const state = touchStateRef.current;

    if (e.touches.length === 2 && state.mode === 'pinch') {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);

      if (state.startDistance > 0) {
        state.hasMoved = true;
        const ratio = distance / state.startDistance;
        const targetScale = Math.min(3.5, Math.max(1, state.startScale * ratio));
        setScale(targetScale);

        if (targetScale <= 1.02) {
          setPosition({ x: 0, y: 0 });
        } else {
          setPosition((prev) => clampPosition(prev.x, prev.y, targetScale));
        }
      }
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      const diffX = touch.clientX - state.startX;
      const diffY = touch.clientY - state.startY;

      if (Math.hypot(diffX, diffY) > 8) {
        state.hasMoved = true;
      }

      if (state.mode === 'pan' && scale > 1.05) {
        const nextX = state.startPos.x + diffX;
        const nextY = state.startPos.y + diffY;
        setPosition(clampPosition(nextX, nextY, scale));
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const state = touchStateRef.current;

    if (state.mode === 'pinch') {
      if (e.touches.length === 0) {
        setIsAnimating(true);
        if (scale < 1.05) {
          setScale(1);
          setPosition({ x: 0, y: 0 });
        } else {
          setPosition((prev) => clampPosition(prev.x, prev.y, scale));
        }
        touchStateRef.current.mode = 'idle';
      }
      return;
    }

    if (state.mode === 'swipe' && state.hasMoved && scale <= 1.05) {
      const endTouch = e.changedTouches[0];
      const diffX = endTouch.clientX - state.startX;
      const diffY = endTouch.clientY - state.startY;

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
      touchStateRef.current.mode = 'idle';
      return;
    }

    if (!state.hasMoved && e.changedTouches.length === 1) {
      // User tapped screen (Tap or Double Tap)
      const touch = e.changedTouches[0];
      const now = Date.now();
      const lastTap = lastTapRef.current;
      const distFromLastTap = Math.hypot(touch.clientX - lastTap.x, touch.clientY - lastTap.y);

      if (now - lastTap.time < 280 && distFromLastTap < 40) {
        // Double tap confirmed! Cancel pending single-tap action
        if (singleTapTimerRef.current) {
          clearTimeout(singleTapTimerRef.current);
          singleTapTimerRef.current = null;
        }

        setIsAnimating(true);
        if (scale > 1.1) {
          // Reset zoom
          setScale(1);
          setPosition({ x: 0, y: 0 });
        } else {
          // Zoom into double-tap location
          const targetScale = 2.2;
          const focalX = (window.innerWidth / 2 - touch.clientX) * (targetScale - 1);
          const focalY = (window.innerHeight / 2 - touch.clientY) * (targetScale - 1);
          setScale(targetScale);
          setPosition(clampPosition(focalX, focalY, targetScale));
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

    touchStateRef.current.mode = 'idle';
  };

  // Wheel zoom for desktop
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.002;
    const newScale = Math.min(3.5, Math.max(1, scale + delta));
    setIsAnimating(false);
    setScale(newScale);
    if (newScale <= 1.02) {
      setPosition({ x: 0, y: 0 });
    } else {
      setPosition((prev) => clampPosition(prev.x, prev.y, newScale));
    }
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
      onWheel={handleWheel}
      className="w-full h-screen relative flex items-center justify-center overflow-hidden select-none bg-black"
    >
      <div
        className="w-full h-full flex items-center justify-center pointer-events-auto"
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0px) scale(${scale})`,
          transformOrigin: 'center center',
          transition: isAnimating ? 'transform 0.24s cubic-bezier(0.2, 0, 0, 1)' : 'none',
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
            className="flex items-center gap-1.5 bg-black/75 hover:bg-black/90 text-indigo-300 px-3 py-1.5 rounded-full border border-indigo-500/40 text-xs font-mono font-medium shadow-lg backdrop-blur-md active:scale-95 transition"
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
