import React from 'react';
import { 
  Database, 
  RefreshCw, 
  ShieldCheck, 
  CheckCircle2, 
  FileSpreadsheet, 
  Zap,
  Activity
} from 'lucide-react';
import type { DealRecord, UploadValidationReport } from '../../types/sales';
import type { SheetFetchStatus } from '../../engine/googleSheetsService';
import type { GoogleSheetsConfig } from '../../config/sheetsConfig';
import { GoogleSheetsSyncSection } from '../../components/sheets/GoogleSheetsSyncSection';

interface DataSyncScreenProps {
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
}

export const DataSyncScreen: React.FC<DataSyncScreenProps> = ({
  config,
  statuses,
  wonRecords,
  lostRecords,
  progressRecords,
  uploadReport,
  lastSyncedAt,
  isSyncing,
  onRefresh,
  onSaveConfig
}) => {
  const totalRecords = wonRecords.length + lostRecords.length + progressRecords.length;

  return (
    <div className="space-y-6 animate-fade-in max-w-[1400px] mx-auto py-2">
      {/* Screen Title & Header */}
      <div className="glass-panel p-6 rounded-2xl border border-[var(--border-color)] bg-[#0f172a]/90 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
                Data & Sync Control Center
              </h1>
              <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-md flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Stream Active
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Manage Google Sheets connections, backend stream intervals, data quality audit & real-time sync.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onRefresh}
            disabled={isSyncing}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-lg shadow-blue-600/30 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing Streams...' : 'Sync All Streams Now'}</span>
          </button>
        </div>
      </div>

      {/* Sync Metrics Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-slate-800 bg-slate-900/80 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Streamed Records</span>
          <div className="text-2xl font-black text-white flex items-center justify-between">
            <span>{totalRecords.toLocaleString('en-IN')}</span>
            <FileSpreadsheet className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-[10px] text-emerald-400 font-semibold">100% Ingested into Pipeline</p>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800 bg-slate-900/80 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Won Deals Sheet</span>
          <div className="text-2xl font-black text-emerald-400 flex items-center justify-between">
            <span>{wonRecords.length.toLocaleString('en-IN')}</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-[10px] text-slate-400 font-mono">Revenue & Closed Accounts</p>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800 bg-slate-900/80 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Lost Deals Sheet</span>
          <div className="text-2xl font-black text-rose-400 flex items-center justify-between">
            <span>{lostRecords.length.toLocaleString('en-IN')}</span>
            <Activity className="w-5 h-5 text-rose-400" />
          </div>
          <p className="text-[10px] text-slate-400 font-mono">Loss Analysis & Disqualified</p>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800 bg-slate-900/80 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">In Progress Sheet</span>
          <div className="text-2xl font-black text-cyan-400 flex items-center justify-between">
            <span>{progressRecords.length.toLocaleString('en-IN')}</span>
            <Zap className="w-5 h-5 text-cyan-400" />
          </div>
          <p className="text-[10px] text-slate-400 font-mono">Active Pipeline Opportunities</p>
        </div>
      </div>

      {/* Main Full-Width Google Sheets Sync Component */}
      <div className="glass-panel rounded-2xl border border-slate-800 p-2 shadow-2xl bg-slate-950/70">
        <GoogleSheetsSyncSection
          config={config}
          statuses={statuses}
          wonRecords={wonRecords}
          lostRecords={lostRecords}
          progressRecords={progressRecords}
          uploadReport={uploadReport}
          lastSyncedAt={lastSyncedAt}
          isSyncing={isSyncing}
          onRefresh={onRefresh}
          onSaveConfig={onSaveConfig}
          isInSidebar={false}
        />
      </div>

      {/* Event Pipeline Architecture Info Card */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/80 space-y-3">
        <div className="flex items-center space-x-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">Event-Driven Data Pipeline Status</h3>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Google Sheets raw records pass through a 10-Stage Event-Driven Data Platform architecture including Schema Normalization, GST Deductions, Automated Deduplication, Metric Recalculation, and Real-time Broadcasting to all active dashboard views.
        </p>
        <div className="flex items-center space-x-4 text-xs font-mono text-cyan-400 pt-1">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            Auto-Sync Interval: {config.autoRefreshSeconds || 60} seconds
          </span>
          <span>•</span>
          <span>Data Quality Index (DQI): 100%</span>
        </div>
      </div>
    </div>
  );
};

export default DataSyncScreen;
