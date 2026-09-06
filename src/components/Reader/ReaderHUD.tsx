import React from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Settings,
  Sun,
  Moon,
  Sparkles,
  Columns,
  Rows,
  List
} from 'lucide-react';
import { ReadingMode, ReaderSettings } from '../../types/comic';

interface ReaderHUDProps {
  showHUD: boolean;
  title: string;
  chapterTitle: string;
  currentPage: number;
  totalPages: number;
  settings: ReaderSettings;
  hasPrevChapter: boolean;
  hasNextChapter: boolean;
  onPrevChapter: () => void;
  onNextChapter: () => void;
  onPageChange: (page: number) => void;
  onSettingsChange: (newSettings: Partial<ReaderSettings>) => void;
  onCloseReader: () => void;
  onToggleHUD: () => void;
  onOpenChapterModal?: () => void;
  allChaptersCount?: number;
  currentChapterIndex?: number;
}

export const ReaderHUD: React.FC<ReaderHUDProps> = ({
  showHUD,
  title,
  chapterTitle,
  currentPage,
  totalPages,
  settings,
  hasPrevChapter,
  hasNextChapter,
  onPrevChapter,
  onNextChapter,
  onPageChange,
  onSettingsChange,
  onCloseReader,
  onToggleHUD,
  onOpenChapterModal,
  allChaptersCount,
  currentChapterIndex
}) => {
  const [showSettingsDrawer, setShowSettingsDrawer] = React.useState(false);

  if (!showHUD) {
    // When HUD is hidden, show a subtle floating page number badge in bottom right corner
    return (
      <div className="fixed bottom-3 right-3 z-30 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-md text-gray-300 text-[11px] font-mono px-2 py-0.5 rounded-full border border-white/10 shadow-sm">
          {currentPage} / {totalPages || 1}
        </div>
      </div>
    );
  }

  const bgOptions = [
    { color: '#000000', label: '纯黑' },
    { color: '#121214', label: '深灰' },
    { color: '#1c1917', label: '护眼' },
    { color: '#f8fafc', label: '明亮' }
  ];

  return (
    <div
      onClick={onToggleHUD}
      className="fixed inset-0 z-40 select-none pointer-events-auto bg-black/15 transition-opacity"
    >
      {/* Top Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/90 via-black/70 to-transparent pt-3 pb-8 px-4 pointer-events-auto transition-transform duration-200"
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onCloseReader}
              className="p-2 -ml-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition active:scale-95"
              title="退出阅读"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white truncate">{title}</h2>
              <p className="text-xs text-indigo-300 truncate">{chapterTitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onOpenChapterModal && (
              <button
                onClick={onOpenChapterModal}
                className="p-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition flex items-center gap-1.5 text-xs font-medium"
                title="章节目录"
              >
                <List className="w-5 h-5 text-indigo-400" />
                <span className="hidden sm:inline">选集</span>
              </button>
            )}

            <button
              onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
              className="p-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition"
              title="阅读设置"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Settings Drawer Modal */}
      {showSettingsDrawer && (
        <div
          onClick={() => setShowSettingsDrawer(false)}
          className="absolute inset-0 bg-black/50 pointer-events-auto flex items-end justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#1a1a20] border-t border-gray-800 rounded-t-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl"
          >
            <h3 className="text-sm font-bold text-gray-200">阅读偏好设置</h3>

            {/* Reading Mode */}
            <div>
              <label className="block text-xs text-gray-400 mb-2">阅读模式</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => onSettingsChange({ mode: 'webtoon' })}
                  className={`py-2 px-3 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 transition ${
                    settings.mode === 'webtoon'
                      ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                      : 'bg-gray-800/80 border-gray-700 text-gray-400'
                  }`}
                >
                  <Rows className="w-3.5 h-3.5" />
                  <span>条漫 (卷轴)</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSettingsChange({ mode: 'right-to-left' })}
                  className={`py-2 px-3 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 transition ${
                    settings.mode === 'right-to-left'
                      ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                      : 'bg-gray-800/80 border-gray-700 text-gray-400'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>日漫 (右翻)</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSettingsChange({ mode: 'left-to-right' })}
                  className={`py-2 px-3 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 transition ${
                    settings.mode === 'left-to-right'
                      ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                      : 'bg-gray-800/80 border-gray-700 text-gray-400'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5 scale-x-[-1]" />
                  <span>普通 (左翻)</span>
                </button>
              </div>
            </div>

            {/* Background Color */}
            <div>
              <label className="block text-xs text-gray-400 mb-2">背景色彩</label>
              <div className="grid grid-cols-4 gap-2">
                {bgOptions.map((opt) => (
                  <button
                    key={opt.color}
                    type="button"
                    onClick={() => onSettingsChange({ backgroundColor: opt.color })}
                    className={`py-2 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 transition ${
                      settings.backgroundColor === opt.color
                        ? 'border-indigo-500 ring-2 ring-indigo-500/30 text-white'
                        : 'border-gray-800 text-gray-400'
                    }`}
                    style={{ backgroundColor: opt.color }}
                  >
                    <span
                      className={`text-xs ${
                        opt.color === '#f8fafc' ? 'text-gray-900 font-bold' : 'text-gray-300'
                      }`}
                    >
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Keep Awake */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-800">
              <span className="text-xs text-gray-300">阅读时屏幕常亮</span>
              <button
                type="button"
                onClick={() => onSettingsChange({ keepAwake: !settings.keepAwake })}
                className={`w-11 h-6 rounded-full transition relative ${
                  settings.keepAwake ? 'bg-indigo-600' : 'bg-gray-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition transform absolute top-1 ${
                    settings.keepAwake ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/85 to-transparent pb-6 pt-6 px-4 pointer-events-auto"
      >
        <div className="max-w-xl mx-auto space-y-3">
          {/* Page slider */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-gray-300 min-w-[28px] text-right">
              {currentPage}
            </span>
            <input
              type="range"
              min={1}
              max={totalPages || 1}
              value={currentPage}
              onChange={(e) => onPageChange(parseInt(e.target.value, 10))}
              className="flex-1 accent-indigo-500 cursor-pointer h-1.5 bg-gray-700 rounded-lg appearance-none"
            />
            <span className="text-xs font-mono text-gray-400 min-w-[28px]">
              {totalPages || 1}
            </span>
          </div>

          {/* Controls: Prev Chapter, Chapter Drawer, Mode switch, Next Chapter */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              onClick={onPrevChapter}
              disabled={!hasPrevChapter}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 disabled:pointer-events-none transition active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>上一话</span>
            </button>

            {onOpenChapterModal && (
              <button
                onClick={onOpenChapterModal}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 transition active:scale-95"
                title="完整章节目录"
              >
                <List className="w-3.5 h-3.5" />
                <span>
                  选集 {allChaptersCount && allChaptersCount > 1 ? `(${currentChapterIndex !== undefined ? currentChapterIndex + 1 : 1}/${allChaptersCount})` : ''}
                </span>
              </button>
            )}

            {/* Quick reading mode toggle */}
            <button
              onClick={() => {
                const modes: ReadingMode[] = ['webtoon', 'right-to-left', 'left-to-right'];
                const nextMode = modes[(modes.indexOf(settings.mode) + 1) % modes.length];
                onSettingsChange({ mode: nextMode });
              }}
              className="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition"
            >
              {settings.mode === 'webtoon' && '条漫'}
              {settings.mode === 'right-to-left' && '日漫'}
              {settings.mode === 'left-to-right' && '普通'}
            </button>

            <button
              onClick={onNextChapter}
              disabled={!hasNextChapter}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 disabled:pointer-events-none transition active:scale-95"
            >
              <span>下一话</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
