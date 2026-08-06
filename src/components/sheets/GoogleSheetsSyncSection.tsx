import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  RefreshCw, 
  Settings, 
  ExternalLink, 
  Lock, 
  FileSpreadsheet, 
  Save,
  X
} from 'lucide-react';
import type { SheetFetchStatus } from '../../engine/googleSheetsService';
import type { GoogleSheetsConfig } from '../../config/sheetsConfig';

interface GoogleSheetsSyncSectionProps {
  config: GoogleSheetsConfig;
  status: SheetFetchStatus;
  projectsCount: number;
  lastSyncedAt: Date | null;
  isSyncing: boolean;
  onRefresh: () => void;
  onSaveConfig: (newConfig: GoogleSheetsConfig) => void;
  isInSidebar?: boolean;
}

export const GoogleSheetsSyncSection: React.FC<GoogleSheetsSyncSectionProps> = ({
  config,
  status,
  projectsCount,
  lastSyncedAt,
  isSyncing,
  onRefresh,
  onSaveConfig,
  isInSidebar = false
}) => {
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editProjectsUrl, setEditProjectsUrl] = useState(config.projectsSheetUrl);

  useEffect(() => {
    if (showConfigModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showConfigModal]);
  const [editRefreshSec, setEditRefreshSec] = useState(config.autoRefreshSeconds || 60);

  const handleOpenConfigModal = () => {
    setEditProjectsUrl(config.projectsSheetUrl);
    setEditRefreshSec(config.autoRefreshSeconds || 60);
    setShowConfigModal(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig({
      projectsSheetUrl: editProjectsUrl.trim(),
      autoRefreshSeconds: Number(editRefreshSec) || 60
    });
    setShowConfigModal(false);
  };

  const formattedLastSync = lastSyncedAt 
    ? lastSyncedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Never';

  const hasPermissionError = status.status === 'permission_error';

  return (
    <div className={`w-full glass-panel rounded-2xl border border-[var(--border-color)] shadow-xl overflow-hidden transition-all bg-[var(--bg-secondary)]/90 backdrop-blur-xl ${
      isInSidebar ? 'mb-2 text-xs' : 'mb-6'
    }`}>
      {/* Header Bar */}
      <div className={`${isInSidebar ? 'p-3 flex-col space-y-3' : 'p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4'}`}>
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-white tracking-tight truncate">Projects Sheet (Google Sheets)</h3>
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-md">
                Project Dashboard Only
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate mt-0.5">
              Exclusively dedicated to Project Dashboard tracking. (Deals & Leads sync via Bitrix24).
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={onRefresh}
            disabled={isSyncing}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Projects Sheet'}</span>
          </button>

          <button
            onClick={handleOpenConfigModal}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700"
            title="Configure Project Sheet URL"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Permission Warning Alert */}
      {hasPermissionError && (
        <div className="mx-4 mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3 text-amber-400 text-xs">
          <div className="flex items-center space-x-2">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Project Sheet is Private. Please set Google Sheet sharing settings to "Anyone with link can view".</span>
          </div>
          <button
            onClick={handleOpenConfigModal}
            className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 font-bold rounded-lg transition-all"
          >
            Fix URL
          </button>
        </div>
      )}

      {/* Connection Info */}
      <div className="px-4 py-3 bg-slate-950/60 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
        <div className="flex items-center space-x-4">
          <span className="flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${status.status === 'success' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="font-semibold text-slate-300">{projectsCount} Projects Loaded</span>
          </span>
          <span>•</span>
          <span>Last Synced: <strong className="text-slate-300">{formattedLastSync}</strong></span>
        </div>

        {config.projectsSheetUrl && (
          <a
            href={config.projectsSheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
          >
            <span>Open Google Sheet</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* Configuration Modal */}
      {showConfigModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-lg overflow-hidden">
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl space-y-5 my-auto animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Project Dashboard Google Sheet Settings</h3>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Project Dashboard Sheet URL</label>
                <input
                  type="url"
                  required
                  value={editProjectsUrl}
                  onChange={(e) => setEditProjectsUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/your_sheet_id/edit"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
                <p className="text-[10px] text-slate-400">Ensure access is set to "Anyone with link can view".</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Auto Refresh Interval (Seconds)</label>
                <input
                  type="number"
                  min="15"
                  max="3600"
                  value={editRefreshSec}
                  onChange={(e) => setEditRefreshSec(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
