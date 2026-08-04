import React, { useState } from 'react';
import { 
  RefreshCw, 
  Settings, 
  ExternalLink, 
  Eye, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  ShieldCheck, 
  FileSpreadsheet, 
  Save,
  X
} from 'lucide-react';
import type { DealRecord, UploadValidationReport } from '../../types/sales';
import type { SheetFetchStatus } from '../../engine/googleSheetsService';
import type { GoogleSheetsConfig } from '../../config/sheetsConfig';

interface GoogleSheetsSyncSectionProps {
  config: GoogleSheetsConfig;
  statuses: {
    won: SheetFetchStatus;
    lost: SheetFetchStatus;
    progress: SheetFetchStatus;
  };
  wonRecords: DealRecord[];
  lostRecords: DealRecord[];
  progressRecords: DealRecord[];
  uploadReport: UploadValidationReport | null;
  lastSyncedAt: Date | null;
  isSyncing: boolean;
  onRefresh: () => void;
  onSaveConfig: (newConfig: GoogleSheetsConfig) => void;
  isInSidebar?: boolean;
}

export const GoogleSheetsSyncSection: React.FC<GoogleSheetsSyncSectionProps> = ({
  config,
  statuses,
  wonRecords,
  lostRecords,
  progressRecords,
  uploadReport,
  lastSyncedAt,
  isSyncing,
  onRefresh,
  onSaveConfig,
  isInSidebar = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewTab, setPreviewTab] = useState<'won' | 'lost' | 'progress'>('won');

  // Modal edit form state
  const [editWonUrl, setEditWonUrl] = useState(config.wonDealsUrl);
  const [editLostUrl, setEditLostUrl] = useState(config.lostDealsUrl);
  const [editProgressUrl, setEditProgressUrl] = useState(config.inProgressDealsUrl);
  const [editRefreshSec, setEditRefreshSec] = useState(config.autoRefreshSeconds || 60);

  const handleOpenConfigModal = () => {
    setEditWonUrl(config.wonDealsUrl);
    setEditLostUrl(config.lostDealsUrl);
    setEditProgressUrl(config.inProgressDealsUrl);
    setEditRefreshSec(config.autoRefreshSeconds || 60);
    setShowConfigModal(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig({
      wonDealsUrl: editWonUrl.trim(),
      lostDealsUrl: editLostUrl.trim(),
      inProgressDealsUrl: editProgressUrl.trim(),
      autoRefreshSeconds: Number(editRefreshSec) || 60
    });
    setShowConfigModal(false);
  };

  const formattedLastSync = lastSyncedAt 
    ? lastSyncedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Never';

  const hasPermissionError = 
    statuses.won.status === 'permission_error' ||
    statuses.lost.status === 'permission_error' ||
    statuses.progress.status === 'permission_error';

  return (
    <div className={`w-full glass-panel rounded-2xl border border-[var(--border-color)] shadow-xl overflow-hidden transition-all bg-[var(--bg-secondary)]/90 backdrop-blur-xl ${
      isInSidebar ? 'mb-2 text-xs' : 'mb-6'
    }`}>
      {/* 1-Line Header Bar */}
      <div className={`${isInSidebar ? 'p-3 flex-col space-y-3' : 'p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4'}`}>
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div className="overflow-hidden">
            <div className="flex items-center space-x-2">
              <h2 className="text-xs font-bold text-[var(--text-primary)] tracking-tight truncate">
                Live Google Sheets Stream
              </h2>
            </div>
            <p className="text-[10px] text-[var(--text-secondary)] font-mono flex flex-wrap items-center gap-1.5 mt-0.5">
              <span>Last: <strong className="text-[var(--text-primary)]">{formattedLastSync}</strong></span>
              <span className="text-[var(--text-muted)]">•</span>
              <span>Won: <strong className="text-emerald-400">{wonRecords.length}</strong></span>
              <span>|</span>
              <span>Lost: <strong className="text-rose-400">{lostRecords.length}</strong></span>
              <span>|</span>
              <span>Pipe: <strong className="text-blue-400">{progressRecords.length}</strong></span>
            </p>
          </div>
        </div>

        <div className={`flex items-center ${isInSidebar ? 'w-full justify-between gap-1.5' : 'space-x-2.5 shrink-0'}`}>
          <button
            onClick={onRefresh}
            disabled={isSyncing}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 text-[11px] font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 flex-1 justify-center"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing' : 'Sync Now'}</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] border border-[var(--border-color)] text-[11px] font-semibold transition-all"
            title="Manage Sheets Configuration"
          >
            <Settings className="w-3 h-3 text-amber-400" />
            <span>{isExpanded ? 'Hide' : 'Manage'}</span>
          </button>

          {uploadReport && (
            <button
              onClick={() => setShowPreviewModal(true)}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] border border-[var(--border-color)] text-[11px] font-semibold transition-all"
              title="Inspect Raw Sheet Stream Data"
            >
              <Eye className="w-3 h-3 text-cyan-400" />
              <span>Inspect</span>
            </button>
          )}
        </div>
      </div>

      {/* Expanded Content View */}
      {isExpanded && (
        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-primary)]/60 animate-fade-in space-y-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] pb-1">
            <span>Live Stream Details & Direct Links</span>
            <button
              onClick={handleOpenConfigModal}
              className="text-amber-400 hover:underline font-bold text-xs flex items-center gap-1"
            >
              <Settings className="w-3 h-3" />
              <span>Configure URLs</span>
            </button>
          </div>

          {/* Permission Alert Banner if 401 occurs */}
          {hasPermissionError && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start space-x-3">
              <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-bold text-amber-200">Google Sheet Access Permission Notice</h4>
                <p className="mt-0.5 text-[11px] leading-relaxed text-amber-300/90">
                  One or more Google Sheets are private. To enable automatic live sync, open each Google Sheet, click <strong className="text-amber-100">Share</strong> (top-right), and set General Access to <strong className="text-amber-100 font-bold">"Anyone with the link can view"</strong>.
                </p>
              </div>
            </div>
          )}

          {/* 3 Live Google Sheet Stream Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SheetStatusCard
              title="1. Won Deals Sheet"
              url={config.wonDealsUrl}
              status={statuses.won}
              recordCount={wonRecords.length}
              accentColor="emerald"
              badgeText="Income & Revenue"
              isSyncing={isSyncing}
            />

            <SheetStatusCard
              title="2. Lost Deals Sheet"
              url={config.lostDealsUrl}
              status={statuses.lost}
              recordCount={lostRecords.length}
              accentColor="rose"
              badgeText="Loss Reasons"
              isSyncing={isSyncing}
            />

            <SheetStatusCard
              title="3. In Progress Deals Sheet"
              url={config.inProgressDealsUrl}
              status={statuses.progress}
              recordCount={progressRecords.length}
              accentColor="blue"
              badgeText="Pipeline Stages"
              isSyncing={isSyncing}
            />
          </div>
        </div>
      )}

      {/* Configure URLs Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 md:p-6 overflow-y-auto animate-fade-in">
          <div className="glass-panel p-5 md:p-6 rounded-2xl max-w-xl w-full border border-slate-700 shadow-2xl relative max-h-[92vh] flex flex-col my-auto">
            <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-100">Configure Google Sheet Backend URLs</h3>
                  <p className="text-xs text-slate-400">Edit sheet URLs anytime to point to new datasets</p>
                </div>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="flex-1 overflow-y-auto space-y-3.5 text-xs pr-1 py-1">
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  1. Deal Won Sheet URL:
                </label>
                <input
                  type="text"
                  value={editWonUrl}
                  onChange={(e) => setEditWonUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  2. Deal Lost Sheet URL:
                </label>
                <input
                  type="text"
                  value={editLostUrl}
                  onChange={(e) => setEditLostUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  3. In Progress Deals Sheet URL:
                </label>
                <input
                  type="text"
                  value={editProgressUrl}
                  onChange={(e) => setEditProgressUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Auto-Refresh Interval (seconds):
                </label>
                <input
                  type="number"
                  min={10}
                  max={3600}
                  value={editRefreshSec}
                  onChange={(e) => setEditRefreshSec(Number(e.target.value))}
                  className="w-32 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-mono text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3 shrink-0 mt-4">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-500/20"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Sheet URLs</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Data Quality & Audit Inspector Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 md:p-6 overflow-y-auto animate-fade-in">
          <div className="glass-panel p-5 md:p-6 rounded-2xl max-w-5xl w-full border border-slate-700 shadow-2xl max-h-[92vh] flex flex-col my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Live Google Sheets Audit Inspector</h3>
                  <p className="text-xs text-slate-400">Inspecting auto-mapped headers and clean records from live stream</p>
                </div>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 text-xs font-semibold"
              >
                Close Inspector
              </button>
            </div>

            <div className="flex space-x-2 my-4">
              <button
                onClick={() => setPreviewTab('won')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  previewTab === 'won' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-800/80 text-slate-300'
                }`}
              >
                Won Deals ({wonRecords.length})
              </button>
              <button
                onClick={() => setPreviewTab('lost')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  previewTab === 'lost' ? 'bg-rose-600 text-white shadow-md' : 'bg-slate-800/80 text-slate-300'
                }`}
              >
                Lost Deals ({lostRecords.length})
              </button>
              <button
                onClick={() => setPreviewTab('progress')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  previewTab === 'progress' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800/80 text-slate-300'
                }`}
              >
                In Progress Deals ({progressRecords.length})
              </button>
            </div>

            <div className="flex-1 overflow-auto rounded-xl border border-slate-800 bg-slate-950/80 p-2">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-semibold sticky top-0">
                  <tr>
                    <th className="p-2.5">Deal ID</th>
                    <th className="p-2.5">Customer</th>
                    <th className="p-2.5">Gross Revenue</th>
                    <th className="p-2.5">GST (18%)</th>
                    <th className="p-2.5">Net Revenue</th>
                    <th className="p-2.5">Sales Rep</th>
                    <th className="p-2.5">Industry</th>
                    <th className="p-2.5">Solution</th>
                    <th className="p-2.5">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {(previewTab === 'won' ? wonRecords : previewTab === 'lost' ? lostRecords : progressRecords).slice(0, 50).map((r, i) => (
                    <tr key={i} className="hover:bg-slate-900/50">
                      <td className="p-2.5 font-mono text-blue-400">{r.id}</td>
                      <td className="p-2.5 text-slate-100">{r.customer}</td>
                      <td className="p-2.5">₹{r.grossRevenue.toLocaleString('en-IN')}</td>
                      <td className="p-2.5 text-amber-400">₹{r.gstAmount.toLocaleString('en-IN')}</td>
                      <td className="p-2.5 text-emerald-400 font-bold">₹{r.netRevenue.toLocaleString('en-IN')}</td>
                      <td className="p-2.5">{r.salesRep}</td>
                      <td className="p-2.5">{r.industry}</td>
                      <td className="p-2.5">{r.solution}</td>
                      <td className="p-2.5">{r.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface SheetStatusCardProps {
  title: string;
  url: string;
  status: SheetFetchStatus;
  recordCount: number;
  accentColor: 'emerald' | 'rose' | 'blue';
  badgeText: string;
  isSyncing: boolean;
}

const SheetStatusCard: React.FC<SheetStatusCardProps> = ({
  title,
  url,
  status,
  recordCount,
  accentColor,
  badgeText,
  isSyncing
}) => {
  const colorStyles = {
    emerald: {
      border: 'border-emerald-500/30 bg-emerald-500/5',
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      text: 'text-emerald-400'
    },
    rose: {
      border: 'border-rose-500/30 bg-rose-500/5',
      badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      text: 'text-rose-400'
    },
    blue: {
      border: 'border-blue-500/30 bg-blue-500/5',
      badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      text: 'text-blue-400'
    }
  }[accentColor];

  const isPermissionError = status?.status === 'permission_error';

  return (
    <div className={`p-4 rounded-xl border transition-all ${colorStyles.border}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-extrabold text-slate-200">{title}</span>
        <span className={`px-2 py-0.5 text-[10px] font-semibold border rounded-md ${colorStyles.badge}`}>
          {badgeText}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="overflow-hidden pr-2">
          {isSyncing ? (
            <div className="flex items-center space-x-2 text-xs text-blue-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Syncing with Google...</span>
            </div>
          ) : isPermissionError ? (
            <div className="flex items-center space-x-1.5 text-xs text-amber-400 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Permission Alert (Private)</span>
            </div>
          ) : status?.status === 'success' && recordCount > 0 ? (
            <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{recordCount} Records Connected</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 text-xs text-slate-400">
              <FileSpreadsheet className="w-4 h-4 shrink-0 text-slate-500" />
              <span>0 records loaded</span>
            </div>
          )}

          <p className="text-[10px] text-slate-500 truncate mt-1 font-mono">
            {url}
          </p>
        </div>

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors shrink-0"
          title="Open Google Sheet in new tab"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
};
