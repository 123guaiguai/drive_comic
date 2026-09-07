import React from 'react';
import { BookMarked, Play, Trash2, Folder, Sparkles, HardDrive, FileText } from 'lucide-react';
import { ComicBook } from '../types/comic';
import { isPdfFile } from '../services/naturalSort';

interface BookshelfProps {
  books: ComicBook[];
  onOpenBook: (book: ComicBook) => void;
  onExploreBookFolder: (book: ComicBook) => void;
  onRemoveBook: (bookId: string) => void;
  onNavigateToExplorer: () => void;
}

export const Bookshelf: React.FC<BookshelfProps> = ({
  books,
  onOpenBook,
  onExploreBookFolder,
  onRemoveBook,
  onNavigateToExplorer
}) => {
  if (books.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4">
          <BookMarked className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-gray-200">书架暂无漫画</h3>
        <p className="text-sm text-gray-400 mt-2 mb-6">
          连接你的百度、夸克或 WebDAV 网盘，在网盘目录中将喜欢的漫画文件夹或 PDF 一键加入书架，随时继续阅读。
        </p>
        <button
          onClick={onNavigateToExplorer}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 transition active:scale-95"
        >
          <Sparkles className="w-4 h-4" />
          <span>去网盘浏览漫画</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
          <span>我的收藏</span>
          <span className="text-xs font-normal text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">
            {books.length} 部
          </span>
        </h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {books.map((book) => {
          const isPdf = book.isPdf || isPdfFile(book.title) || isPdfFile(book.path);
          const hasProgress = book.lastReadChapterTitle && book.lastReadPageIndex !== undefined;

          return (
            <div
              key={book.id}
              className="group bg-[#1a1a1f] border border-gray-800/80 hover:border-indigo-500/40 rounded-2xl overflow-hidden shadow-lg flex flex-col transition duration-200"
            >
              {/* Cover area */}
              <div
                onClick={() => onOpenBook(book)}
                className="relative aspect-[3/4] bg-gray-900 overflow-hidden cursor-pointer flex items-center justify-center"
              >
                {book.coverUrl ? (
                  <img
                    src={book.coverUrl}
                    alt={book.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 text-center">
                    {isPdf ? (
                      <FileText className="w-10 h-10 text-rose-400/60 mb-2" />
                    ) : (
                      <Folder className="w-10 h-10 text-indigo-400/50 mb-2" />
                    )}
                    <span className="text-xs text-gray-400 line-clamp-2">{book.title}</span>
                  </div>
                )}

                {/* Drive & PDF badge */}
                <div className="absolute top-2 left-2 flex items-center gap-1">
                  <span className="text-[10px] bg-black/60 backdrop-blur-md text-gray-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <HardDrive className="w-2.5 h-2.5 text-indigo-400" />
                    {book.driveType === 'quark' ? '夸克' : book.driveType === 'baidu' ? '百度' : 'WebDAV'}
                  </span>
                  {isPdf && (
                    <span className="text-[10px] bg-rose-600/80 backdrop-blur-md text-white font-mono px-1 py-0.5 rounded">
                      PDF
                    </span>
                  )}
                </div>

                {/* Hover / Play Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <div className="w-11 h-11 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg transform translate-y-2 group-hover:translate-y-0 transition">
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </div>
                </div>
              </div>

              {/* Info area */}
              <div className="p-3 flex-1 flex flex-col justify-between">
                <div>
                  <h3
                    onClick={() => onOpenBook(book)}
                    className="text-sm font-semibold text-gray-200 line-clamp-1 cursor-pointer hover:text-indigo-400 transition"
                    title={book.title}
                  >
                    {book.title}
                  </h3>

                  {hasProgress ? (
                    <p className="text-[11px] text-indigo-400 mt-1 line-clamp-1 font-medium">
                      读至: {book.lastReadChapterTitle} (第{book.lastReadPageIndex}页)
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-500 mt-1">尚未阅读</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-800/60">
                  {!isPdf ? (
                    <button
                      onClick={() => onExploreBookFolder(book)}
                      className="text-[11px] text-gray-400 hover:text-gray-200 flex items-center gap-1 transition"
                      title="浏览章节目录"
                    >
                      <Folder className="w-3.5 h-3.5" />
                      <span>选集</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-rose-400/80 font-mono">
                      PDF 漫画单行本
                    </span>
                  )}

                  <button
                    onClick={() => onRemoveBook(book.id)}
                    className="text-gray-500 hover:text-red-400 p-1 rounded transition"
                    title="从书架移除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
