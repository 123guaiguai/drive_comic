import React, { useState, useEffect } from 'react';
import {
  Folder,
  Image as ImageIcon,
  ChevronRight,
  RefreshCw,
  Search,
  BookPlus,
  Play,
  ArrowLeft,
  AlertCircle,
  HardDrive,
  BookMarked
} from 'lucide-react';
import { CloudAccount, DriveItem, ComicBook } from '../types/comic';
import { DriveManager } from '../services/driveManager';
import { isImageFile } from '../services/naturalSort';

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface ExplorerProps {
  activeAccount: CloudAccount | null;
  onOpenAccountModal: () => void;
  onReadFolder: (folder: { id: string; name: string; path: string }, allItems?: DriveItem[]) => void;
  onAddToBookshelf: (book: ComicBook) => void;
  bookshelfBookIds: string[];
}

export const Explorer: React.FC<ExplorerProps> = ({
  activeAccount,
  onOpenAccountModal,
  onReadFolder,
  onAddToBookshelf,
  bookshelfBookIds
}) => {
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: activeAccount?.type === 'quark' ? '0' : '/', name: '根目录' }
  ]);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const currentFolder = breadcrumbs[breadcrumbs.length - 1];

  // Whenever activeAccount changes, reset breadcrumbs
  useEffect(() => {
    if (activeAccount) {
      const rootId = activeAccount.type === 'quark' ? '0' : '/';
      setBreadcrumbs([{ id: rootId, name: '根目录' }]);
    }
  }, [activeAccount?.id, activeAccount?.type]);

  // Load folder contents
  const loadFolder = async (folderId: string) => {
    if (!activeAccount) return;
    setLoading(true);
    setError(null);

    try {
      const res = await DriveManager.listFolder(folderId);
      setItems(res.items);
    } catch (e: any) {
      setError(e.message || '加载目录失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeAccount && currentFolder) {
      loadFolder(currentFolder.id);
    }
  }, [currentFolder.id, activeAccount?.id]);

  const handleEnterFolder = (item: DriveItem) => {
    setSearchQuery('');
    const folderTarget = item.path || item.id;
    setBreadcrumbs((prev) => [...prev, { id: folderTarget, name: item.name }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    setSearchQuery('');
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
  };

  const handleGoBack = () => {
    if (breadcrumbs.length > 1) {
      setSearchQuery('');
      setBreadcrumbs((prev) => prev.slice(0, prev.length - 1));
    }
  };

  // Check how many images exist in current folder
  const currentImages = items.filter((it) => !it.isDir && isImageFile(it.name));
  const currentFolders = items.filter((it) => it.isDir);

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!activeAccount) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
          <HardDrive className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-gray-200">未连接网盘账号</h3>
        <p className="text-sm text-gray-400 mt-2 mb-6">
          请先添加或选择你的百度网盘、夸克网盘或 WebDAV 账号。
        </p>
        <button
          onClick={onOpenAccountModal}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 transition active:scale-95"
        >
          <span>立即添加网盘</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-3 flex flex-col min-h-[calc(100vh-120px)]">
      {/* Top Bar: Breadcrumbs & Actions */}
      <div className="bg-[#18181d] border border-gray-800 rounded-xl p-2.5 mb-3 shadow-sm">
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 text-xs">
          <div className="flex items-center gap-1 min-w-0 flex-shrink">
            {breadcrumbs.length > 1 && (
              <button
                onClick={handleGoBack}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 mr-1 flex-shrink-0"
                title="返回上一级"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            {breadcrumbs.map((b, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={b.id + idx}>
                  {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />}
                  <button
                    onClick={() => handleBreadcrumbClick(idx)}
                    disabled={isLast}
                    className={`truncate max-w-[120px] px-1.5 py-0.5 rounded transition ${
                      isLast
                        ? 'font-bold text-indigo-400 cursor-default'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                    }`}
                  >
                    {b.name}
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          <button
            onClick={() => loadFolder(currentFolder.id)}
            disabled={loading}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition flex-shrink-0"
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-800/60">
          <div className="flex-1 relative">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜索当前目录内容..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* If current folder contains images, offer "Read Current Folder" button */}
          {currentImages.length > 0 && (
            <button
              onClick={() =>
                onReadFolder(
                  { id: currentFolder.id, name: currentFolder.name, path: currentFolder.id },
                  items
                )
              }
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md transition active:scale-95 flex-shrink-0"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>阅读本章 ({currentImages.length}P)</span>
            </button>
          )}

          {/* Quick Add current folder to Bookshelf */}
          {breadcrumbs.length > 1 && (
            <button
              onClick={() => {
                const isSaved = bookshelfBookIds.includes(currentFolder.id);
                if (!isSaved) {
                  const firstImg = currentImages[0]?.thumbnail || undefined;
                  onAddToBookshelf({
                    id: currentFolder.id,
                    title: currentFolder.name,
                    driveType: activeAccount.type,
                    path: currentFolder.id,
                    coverUrl: firstImg
                  });
                }
              }}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 border transition flex-shrink-0 ${
                bookshelfBookIds.includes(currentFolder.id)
                  ? 'bg-indigo-950/40 text-indigo-300 border-indigo-500/40'
                  : 'bg-gray-800/80 text-gray-300 border-gray-700/60 hover:text-white hover:bg-gray-700'
              }`}
              title="将当前文件夹加入书架"
            >
              {bookshelfBookIds.includes(currentFolder.id) ? (
                <>
                  <BookMarked className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">已在书架</span>
                </>
              ) : (
                <>
                  <BookPlus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">加入书架</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-3 mb-3 flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadFolder(currentFolder.id)}
            className="underline hover:text-white"
          >
            重试
          </button>
        </div>
      )}

      {/* Items List */}
      <div className="flex-1 bg-[#18181d] border border-gray-800 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-gray-400">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
            <p className="text-sm">正在加载网盘内容...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center text-gray-500 text-sm">
            {searchQuery ? '未找到匹配项' : '当前文件夹为空'}
          </div>
        ) : (
          <div className="divide-y divide-gray-800/60">
            {filteredItems.map((item) => {
              const isSaved = bookshelfBookIds.includes(item.id);

              if (item.isDir) {
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-3.5 py-3 hover:bg-gray-800/40 transition group"
                  >
                    <div
                      onClick={() => handleEnterFolder(item)}
                      className="flex-1 flex items-center gap-3 min-w-0 cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-500/20 transition">
                        <Folder className="w-5 h-5 fill-indigo-500/30 text-indigo-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-200 group-hover:text-indigo-400 transition truncate">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-gray-500">文件夹</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pl-2">
                      {/* Quick Add Folder to Bookshelf */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isSaved) {
                            onAddToBookshelf({
                              id: item.id,
                              title: item.name,
                              driveType: activeAccount.type,
                              path: item.id
                            });
                          }
                        }}
                        className={`p-1.5 rounded-lg text-xs transition ${
                          isSaved
                            ? 'text-indigo-400'
                            : 'text-gray-500 hover:text-indigo-300 hover:bg-gray-800'
                        }`}
                        title={isSaved ? '已在书架' : '加入书架'}
                      >
                        {isSaved ? (
                          <BookMarked className="w-4 h-4 text-indigo-400" />
                        ) : (
                          <BookPlus className="w-4 h-4" />
                        )}
                      </button>

                      <ChevronRight
                        onClick={() => handleEnterFolder(item)}
                        className="w-4 h-4 text-gray-600 group-hover:text-gray-400 cursor-pointer transition"
                      />
                    </div>
                  </div>
                );
              }

              // Image or other file
              const isImg = isImageFile(item.name);
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-3.5 py-2.5 hover:bg-gray-800/30 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-gray-800 text-gray-400 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : isImg ? (
                        <ImageIcon className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <div className="text-[10px] uppercase font-mono text-gray-500">
                          {item.name.split('.').pop() || 'FILE'}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-300 truncate">{item.name}</p>
                      <p className="text-[10px] text-gray-500">
                        {item.size ? `${(item.size / 1024).toFixed(1)} KB` : '图片文件'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
