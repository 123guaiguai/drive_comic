import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, Plus, Trash2, HelpCircle, HardDrive, RefreshCw, ArrowUpCircle, Info } from 'lucide-react';
import { CloudAccount, CloudDriveType } from '../types/comic';
import { BaiduService } from '../services/baiduService';
import { QuarkService } from '../services/quarkService';
import { WebDavService } from '../services/webdavService';
import { UpdateService, CURRENT_VERSION, UpdateInfo } from '../services/updater';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: CloudAccount[];
  activeAccount: CloudAccount | null;
  onSaveAccount: (account: CloudAccount) => void;
  onSelectAccount: (account: CloudAccount) => void;
  onDeleteAccount: (id: string) => void;
  onOpenUpdateModal?: (info: UpdateInfo) => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  accounts,
  activeAccount,
  onSaveAccount,
  onSelectAccount,
  onDeleteAccount,
  onOpenUpdateModal
}) => {
  const [selectedType, setSelectedType] = useState<CloudDriveType>('quark');
  const [accountName, setAccountName] = useState('');
  
  // Quark
  const [quarkCookie, setQuarkCookie] = useState('');
  
  // Baidu
  const [baiduCookie, setBaiduCookie] = useState('');
  const [baiduToken, setBaiduToken] = useState('');
  const [baiduMode, setBaiduMode] = useState<'cookie' | 'token'>('cookie');

  // WebDAV
  const [webdavUrl, setWebdavUrl] = useState('');
  const [webdavUser, setWebdavUser] = useState('');
  const [webdavPass, setWebdavPass] = useState('');

  // Status & Testing
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // Version update check state
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<{
    type: 'idle' | 'latest' | 'error';
    message?: string;
  }>({ type: 'idle' });

  const handleManualCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateStatus({ type: 'idle' });
    try {
      const info = await UpdateService.checkUpdate();
      if (info.hasUpdate) {
        if (onOpenUpdateModal) {
          onOpenUpdateModal(info);
        }
      } else {
        if (info.error) {
          setUpdateStatus({
            type: 'error',
            message: `检查失败: ${info.error}`
          });
        } else {
          setUpdateStatus({
            type: 'latest',
            message: `当前已是最新版本 (v${CURRENT_VERSION})`
          });
        }
      }
    } catch (e: any) {
      setUpdateStatus({
        type: 'error',
        message: e.message || '网络连接超时，请检查网络或开启代理'
      });
    } finally {
      setCheckingUpdate(false);
    }
  };

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      if (selectedType === 'quark') {
        if (!quarkCookie.trim()) {
          setTestResult({ success: false, message: '请先粘贴夸克网盘 Cookie' });
          return;
        }
        const service = new QuarkService(quarkCookie);
        const res = await service.testConnection();
        setTestResult(res);
      } else if (selectedType === 'baidu') {
        if (baiduMode === 'cookie' && !baiduCookie.trim()) {
          setTestResult({ success: false, message: '请先粘贴百度网盘 Cookie' });
          return;
        }
        if (baiduMode === 'token' && !baiduToken.trim()) {
          setTestResult({ success: false, message: '请先粘贴百度网盘 Access Token' });
          return;
        }
        const service = new BaiduService(
          baiduMode === 'cookie' ? baiduCookie : '',
          baiduMode === 'token' ? baiduToken : undefined
        );
        const res = await service.testConnection();
        setTestResult(res);
      } else if (selectedType === 'webdav') {
        if (!webdavUrl.trim()) {
          setTestResult({ success: false, message: '请输入 WebDAV 服务器地址' });
          return;
        }
        const service = new WebDavService(webdavUrl, webdavUser, webdavPass);
        const res = await service.testConnection();
        setTestResult(res);
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || '连接测试异常' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    const defaultName =
      selectedType === 'quark'
        ? '我的夸克网盘'
        : selectedType === 'baidu'
        ? '我的百度网盘'
        : '我的 WebDAV';

    const newAccount: CloudAccount = {
      id: Date.now().toString(),
      name: accountName.trim() || defaultName,
      type: selectedType,
      quarkCookie: selectedType === 'quark' ? quarkCookie.trim() : undefined,
      baiduCookie: selectedType === 'baidu' && baiduMode === 'cookie' ? baiduCookie.trim() : undefined,
      baiduAccessToken: selectedType === 'baidu' && baiduMode === 'token' ? baiduToken.trim() : undefined,
      webdavUrl: selectedType === 'webdav' ? webdavUrl.trim() : undefined,
      webdavUsername: selectedType === 'webdav' ? webdavUser.trim() : undefined,
      webdavPassword: selectedType === 'webdav' ? webdavPass.trim() : undefined,
      isActive: true,
      lastChecked: Date.now()
    };

    onSaveAccount(newAccount);
    // Reset form
    setAccountName('');
    setQuarkCookie('');
    setBaiduCookie('');
    setBaiduToken('');
    setTestResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#18181c] border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 bg-[#1f1f25]">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-gray-100">网盘账号管理</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Saved Accounts List */}
          {accounts.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                已保存网盘
              </h3>
              <div className="space-y-2">
                {accounts.map((acc) => {
                  const isCur = activeAccount?.id === acc.id;
                  return (
                    <div
                      key={acc.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition ${
                        isCur
                          ? 'bg-indigo-950/40 border-indigo-500/50'
                          : 'bg-gray-800/40 border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <button
                        onClick={() => onSelectAccount(acc)}
                        className="flex-1 flex items-center gap-3 text-left"
                      >
                        <div
                          className={`w-3 h-3 rounded-full ${
                            isCur ? 'bg-indigo-400 ring-4 ring-indigo-500/20' : 'bg-gray-600'
                          }`}
                        />
                        <div>
                          <p className="text-sm font-semibold text-gray-200">{acc.name}</p>
                          <p className="text-xs text-gray-400">
                            {acc.type === 'quark'
                              ? '夸克网盘'
                              : acc.type === 'baidu'
                              ? '百度网盘'
                              : 'WebDAV / AList'}
                          </p>
                        </div>
                      </button>

                      <button
                        onClick={() => onDeleteAccount(acc.id)}
                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                        title="删除账号"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add New Account Form */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-indigo-400" /> 添加网盘账号
              </h3>
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>配置帮助</span>
              </button>
            </div>

            {/* Help box */}
            {showHelp && (
              <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-lg p-3 text-xs text-gray-300 space-y-2 leading-relaxed">
                <p className="font-semibold text-indigo-300">💡 凭据获取简易说明：</p>
                <p>
                  <strong>夸克网盘</strong>：手机或电脑浏览器访问{' '}
                  <code className="text-indigo-200 bg-gray-800 px-1 py-0.5 rounded">pan.quark.cn</code> 登录账号，在浏览器控制台或抓包工具中复制 Cookie，粘贴到下方即可。
                </p>
                <p>
                  <strong>百度网盘</strong>：支持网页 Cookie（包含 BDUSS/STOKEN）或百度网盘开放平台颁发的 Access Token。
                </p>
                <p>
                  <strong>WebDAV / AList</strong>：如果你正在使用 AList 挂载网盘，直接选择 WebDAV 填入 AList 的 WebDAV 地址即可零门槛挂载夸克与百度！
                </p>
              </div>
            )}

            {/* Type selector */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedType('quark');
                  setTestResult(null);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-medium border transition ${
                  selectedType === 'quark'
                    ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                    : 'bg-gray-800/60 border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                夸克网盘
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedType('baidu');
                  setTestResult(null);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-medium border transition ${
                  selectedType === 'baidu'
                    ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                    : 'bg-gray-800/60 border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                百度网盘
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedType('webdav');
                  setTestResult(null);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-medium border transition ${
                  selectedType === 'webdav'
                    ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                    : 'bg-gray-800/60 border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                WebDAV (AList)
              </button>
            </div>

            {/* Account Name input */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">账号备注名称（可选）</label>
              <input
                type="text"
                placeholder={selectedType === 'quark' ? '我的夸克网盘' : selectedType === 'baidu' ? '我的百度网盘' : '我的 AList / WebDAV'}
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="w-full bg-gray-800/80 border border-gray-700/80 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Specific Type Inputs */}
            {selectedType === 'quark' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  夸克网盘 Cookie <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="例如: _UP_A4A_11_=...; __pus=...; ctoken=..."
                  value={quarkCookie}
                  onChange={(e) => setQuarkCookie(e.target.value)}
                  className="w-full bg-gray-800/80 border border-gray-700/80 rounded-lg p-2.5 text-xs text-gray-100 font-mono placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {selectedType === 'baidu' && (
              <div className="space-y-3">
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="radio"
                      checked={baiduMode === 'cookie'}
                      onChange={() => setBaiduMode('cookie')}
                      className="accent-indigo-500"
                    />
                    <span>网页 Cookie (BDUSS)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="radio"
                      checked={baiduMode === 'token'}
                      onChange={() => setBaiduMode('token')}
                      className="accent-indigo-500"
                    />
                    <span>Access Token</span>
                  </label>
                </div>

                {baiduMode === 'cookie' ? (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      百度网盘 Cookie (包含 BDUSS/STOKEN) <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      rows={3}
                      placeholder="例如: BDUSS=xxxxxx; STOKEN=xxxxxx;"
                      value={baiduCookie}
                      onChange={(e) => setBaiduCookie(e.target.value)}
                      className="w-full bg-gray-800/80 border border-gray-700/80 rounded-lg p-2.5 text-xs text-gray-100 font-mono placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      百度网盘开放平台 Access Token <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="输入 access_token 字符串"
                      value={baiduToken}
                      onChange={(e) => setBaiduToken(e.target.value)}
                      className="w-full bg-gray-800/80 border border-gray-700/80 rounded-lg px-3 py-2 text-sm text-gray-100 font-mono placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>
            )}

            {selectedType === 'webdav' && (
              <div className="space-y-2.5">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    WebDAV 地址 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="例如: http://192.168.1.100:5244/dav"
                    value={webdavUrl}
                    onChange={(e) => setWebdavUrl(e.target.value)}
                    className="w-full bg-gray-800/80 border border-gray-700/80 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">用户名（可选）</label>
                    <input
                      type="text"
                      placeholder="admin"
                      value={webdavUser}
                      onChange={(e) => setWebdavUser(e.target.value)}
                      className="w-full bg-gray-800/80 border border-gray-700/80 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">密码（可选）</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={webdavPass}
                      onChange={(e) => setWebdavPass(e.target.value)}
                      className="w-full bg-gray-800/80 border border-gray-700/80 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Test result message */}
            {testResult && (
              <div
                className={`p-3 rounded-lg flex items-center gap-2 text-xs ${
                  testResult.success
                    ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-950/40 text-rose-300 border border-rose-500/30'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="flex-1 flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 py-2.5 rounded-xl text-xs font-semibold border border-gray-700 transition disabled:opacity-50"
              >
                {testing ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                ) : null}
                <span>测试连接</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-xs font-semibold transition active:scale-95 shadow-lg shadow-indigo-600/30"
              >
                保存并连接
              </button>
            </div>
          </div>

          {/* App Version & Update Card */}
          <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-semibold text-gray-300">软件版本</span>
                <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-mono">
                  v{CURRENT_VERSION}
                </span>
              </div>
              <button
                type="button"
                onClick={handleManualCheckUpdate}
                disabled={checkingUpdate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-xs font-medium transition disabled:opacity-50 active:scale-95"
              >
                {checkingUpdate ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                ) : (
                  <ArrowUpCircle className="w-3.5 h-3.5" />
                )}
                <span>{checkingUpdate ? '正在检查...' : '检查更新'}</span>
              </button>
            </div>

            {updateStatus.type !== 'idle' && (
              <div
                className={`p-2.5 rounded-lg flex items-center gap-2 text-xs animate-fade-in ${
                  updateStatus.type === 'latest'
                    ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-950/40 text-rose-300 border border-rose-500/30'
                }`}
              >
                {updateStatus.type === 'latest' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                )}
                <span>{updateStatus.message}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
