import React from 'react';
import { BookOpen, FolderTree, History, Cloud, Settings, HardDrive } from 'lucide-react';
import { CloudAccount } from '../types/comic';

interface NavbarProps {
  currentTab: 'bookshelf' | 'explorer' | 'history';
  onTabChange: (tab: 'bookshelf' | 'explorer' | 'history') => void;
  activeAccount: CloudAccount | null;
  onOpenAccountModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  activeAccount,
  onOpenAccountModal
}) => {
  const getDriveBadge = () => {
    if (!activeAccount) {
      return (
        <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
          <Cloud className="w-3 h-3" /> 未连接网盘
        </span>
      );
    }
    const nameMap = {
      quark: '夸克网盘',
      baidu: '百度网盘',
      webdav: 'WebDAV'
    };
    return (
      <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium">
        <HardDrive className="w-3 h-3 text-indigo-400" />
        {nameMap[activeAccount.type]}
      </span>
    );
  };

  return (
    <header className="sticky top-0 z-40 bg-[#16161a]/95 backdrop-blur-md border-b border-gray-800/80 px-4 py-3 select-none">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {/* App Title & Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-100 flex items-center gap-1.5 leading-none">
              漫阅云盘
            </h1>
            <div className="mt-1 flex items-center">{getDriveBadge()}</div>
          </div>
        </div>

        {/* Account / Settings Button */}
        <button
          onClick={onOpenAccountModal}
          className="flex items-center gap-1.5 bg-gray-800/80 hover:bg-gray-700/80 text-gray-300 hover:text-white px-3 py-1.5 rounded-xl border border-gray-700/50 text-xs font-medium transition active:scale-95 shadow-sm"
        >
          <Settings className="w-4 h-4 text-gray-400" />
          <span>网盘设置</span>
        </button>
      </div>

      {/* Tabs */}
      <nav className="max-w-4xl mx-auto flex items-center gap-2 mt-3 pt-1 border-t border-gray-800/50">
        <button
          onClick={() => onTabChange('bookshelf')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition ${
            currentTab === 'bookshelf'
              ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>书架</span>
        </button>

        <button
          onClick={() => onTabChange('explorer')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition ${
            currentTab === 'explorer'
              ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
          }`}
        >
          <FolderTree className="w-4 h-4" />
          <span>网盘目录</span>
        </button>

        <button
          onClick={() => onTabChange('history')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition ${
            currentTab === 'history'
              ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
          }`}
        >
          <History className="w-4 h-4" />
          <span>历史</span>
        </button>
      </nav>
    </header>
  );
};
