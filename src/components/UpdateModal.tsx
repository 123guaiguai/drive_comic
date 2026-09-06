import React from 'react';
import { Download, Sparkles, X, Zap, ExternalLink } from 'lucide-react';
import { UpdateInfo } from '../services/updater';

interface UpdateModalProps {
  isOpen: boolean;
  updateInfo: UpdateInfo | null;
  onClose: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  updateInfo,
  onClose
}) => {
  if (!isOpen || !updateInfo || !updateInfo.hasUpdate) return null;

  const handleDownload = (url?: string) => {
    const target = url || updateInfo.mirrorUrl || updateInfo.downloadUrl;
    if (target) {
      window.open(target, '_system');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#18181d] border border-indigo-500/40 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header illustration */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-white/80 transition"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-bold">发现新版本 v{updateInfo.latestVersion}</h3>
          <p className="text-xs text-indigo-200 mt-1">
            当前版本 v{updateInfo.currentVersion}，新版已就绪！
          </p>
        </div>

        {/* Release Notes */}
        <div className="p-5 space-y-4 max-h-64 overflow-y-auto">
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              更新内容
            </h4>
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-3 text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
              {updateInfo.releaseNotes}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 bg-gray-900/50 border-t border-gray-800 flex flex-col gap-2">
          {updateInfo.mirrorUrl ? (
            <button
              onClick={() => handleDownload(updateInfo.mirrorUrl)}
              className="w-full py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>国内高速通道下载 (推荐)</span>
            </button>
          ) : null}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-gray-200 hover:bg-gray-800/80 transition"
            >
              暂不更新
            </button>
            <button
              onClick={() => handleDownload(updateInfo.downloadUrl)}
              className="flex-1 py-2 rounded-xl text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>GitHub 官方下载</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
