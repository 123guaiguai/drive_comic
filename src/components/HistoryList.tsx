import React from 'react';
import { History, Trash2, ArrowRight, BookOpen, HardDrive } from 'lucide-react';
import { ReadHistoryItem } from '../types/comic';

interface HistoryListProps {
  history: ReadHistoryItem[];
  onOpenHistory: (item: ReadHistoryItem) => void;
  onClearHistory: () => void;
  onNavigateToExplorer: () => void;
}

export const HistoryList: React.FC<HistoryListProps> = ({
  history,
  onOpenHistory,
  onClearHistory,
  onNavigateToExplorer
}) => {
  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60000);
    if (min < 1) return '刚刚';
    if (min < 60) return `${min} 分钟前`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    return `${days} 天前`;
  };

  if (history.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-800/60 text-gray-500 flex items-center justify-center mx-auto mb-4">
          <History className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-gray-200">暂无阅读历史</h3>
        <p className="text-sm text-gray-400 mt-2 mb-6">
          您阅读过的漫画与章节进度将自动保存在这里，随时继续。
        </p>
        <button
          onClick={onNavigateToExplorer}
          className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-semibold px-5 py-2.5 rounded-xl transition"
        >
          <BookOpen className="w-4 h-4" />
          <span>前往阅读</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
          <span>阅读历史</span>
          <span className="text-xs text-gray-500">({history.length})</span>
        </h2>
        <button
          onClick={onClearHistory}
          className="text-xs text-gray-400 hover:text-red-400 flex items-center gap-1 transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>清空历史</span>
        </button>
      </div>

      <div className="space-y-2.5">
        {history.map((item, idx) => (
          <div
            key={`${item.comicId}-${item.chapterId}-${idx}`}
            onClick={() => onOpenHistory(item)}
            className="flex items-center justify-between p-3.5 bg-[#1a1a1f] hover:bg-[#202026] border border-gray-800/80 hover:border-indigo-500/30 rounded-xl cursor-pointer transition group"
          >
            <div className="flex items-center gap-3 min-w-0">
              {item.coverUrl ? (
                <img
                  src={item.coverUrl}
                  alt={item.comicTitle}
                  referrerPolicy="no-referrer"
                  className="w-12 h-16 object-cover rounded-lg bg-gray-900 flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-16 rounded-lg bg-gray-800 flex items-center justify-center text-gray-500 flex-shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
              )}

              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-gray-200 group-hover:text-indigo-400 transition truncate">
                  {item.comicTitle}
                </h4>
                <p className="text-xs text-indigo-300/90 font-medium mt-0.5 truncate">
                  {item.chapterTitle}
                </p>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
                  <span>
                    进度: 第 {item.pageIndex} / {item.totalPages} 页
                  </span>
                  <span>•</span>
                  <span>{formatTime(item.timestamp)}</span>
                  <span>•</span>
                  <span className="flex items-center gap-0.5">
                    <HardDrive className="w-2.5 h-2.5" />
                    {item.driveType === 'quark' ? '夸克' : item.driveType === 'baidu' ? '百度' : 'WebDAV'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pl-3">
              <div className="w-8 h-8 rounded-full bg-gray-800 group-hover:bg-indigo-600 text-gray-400 group-hover:text-white flex items-center justify-center transition">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
