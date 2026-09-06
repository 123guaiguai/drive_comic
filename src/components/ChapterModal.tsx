import React, { useState, useMemo } from 'react';
import { X, Search, ArrowDownUp, BookOpen, CheckCircle2, Play } from 'lucide-react';

export interface ChapterItemData {
  id: string;
  name: string;
  path: string;
}

interface ChapterModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  chapters: ChapterItemData[];
  currentChapterId?: string;
  onSelectChapter: (chapter: ChapterItemData) => void;
}

export const ChapterModal: React.FC<ChapterModalProps> = ({
  isOpen,
  onClose,
  title,
  chapters,
  currentChapterId,
  onSelectChapter
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAscending, setIsAscending] = useState(true);

  const filteredChapters = useMemo(() => {
    let list = [...chapters];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (!isAscending) {
      list.reverse();
    }
    return list;
  }, [chapters, searchQuery, isAscending]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#18181d] border border-gray-800 sm:rounded-2xl rounded-t-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/80 bg-[#1f1f25]">
          <div className="min-w-0 pr-3">
            <h2 className="text-base font-bold text-gray-100 truncate flex items-center gap-2">
              <span>{title}</span>
            </h2>
            <p className="text-xs text-indigo-300 mt-0.5 font-mono">
              完整章节目录 · 共 {chapters.length} 话
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition flex-shrink-0"
            title="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter / Sort bar */}
        <div className="px-4 py-2.5 border-b border-gray-800/60 bg-gray-900/40 flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜索话数/关键词..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-800/90 border border-gray-700/70 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            onClick={() => setIsAscending(!isAscending)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800/80 hover:bg-gray-700 text-gray-300 border border-gray-700/60 text-xs font-medium transition active:scale-95 flex-shrink-0"
          >
            <ArrowDownUp className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isAscending ? '正序 (1-N)' : '倒序 (N-1)'}</span>
          </button>
        </div>

        {/* Chapter Grid / List */}
        <div className="p-4 overflow-y-auto flex-1 overscroll-contain">
          {filteredChapters.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-xs">
              {searchQuery ? '未搜索到匹配章节' : '暂无可用章节'}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filteredChapters.map((chap) => {
                const isCurrent = currentChapterId === chap.id;

                return (
                  <button
                    key={chap.id}
                    onClick={() => {
                      onSelectChapter(chap);
                      onClose();
                    }}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between group active:scale-98 ${
                      isCurrent
                        ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500/50'
                        : 'bg-gray-900/60 border-gray-800/80 hover:border-gray-700 text-gray-300 hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1 w-full mb-1">
                      <span className="text-xs font-semibold truncate leading-tight group-hover:text-indigo-300 transition">
                        {chap.name}
                      </span>
                      {isCurrent ? (
                        <span className="flex-shrink-0 w-2 h-2 rounded-full bg-indigo-400 ring-4 ring-indigo-500/20" />
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-gray-500 mt-2">
                      {isCurrent ? (
                        <span className="text-indigo-300 font-medium flex items-center gap-1">
                          <BookOpen className="w-3 h-3" /> 正在阅读
                        </span>
                      ) : (
                        <span className="group-hover:text-gray-400 transition flex items-center gap-1">
                          <Play className="w-2.5 h-2.5" /> 点击阅读
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
