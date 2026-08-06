import React, { useState } from 'react';
import { Database, RefreshCw, CheckCircle2, AlertCircle, ShieldCheck, Link2, Users } from 'lucide-react';
import type { BitrixConfig } from '../../config/bitrixConfig';
import type { BitrixSyncResult } from '../../engine/bitrixService';

interface BitrixSyncSectionProps {
  config: BitrixConfig;
  syncResult: BitrixSyncResult | null;
  isSyncing: boolean;
  onRefreshBitrix: () => void;
  onSaveConfig: (newConfig: BitrixConfig) => void;
}

export const BitrixSyncSection: React.FC<BitrixSyncSectionProps> = ({
  config,
  syncResult,
  isSyncing,
  onRefreshBitrix,
  onSaveConfig
}) => {
  const [webhookUrl, setWebhookUrl] = useState(config.webhookBaseUrl);
  const [isEditing, setIsEditing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanBase = webhookUrl.trim().endsWith('/') ? webhookUrl.trim() : `${webhookUrl.trim()}/`;
    onSaveConfig({
      ...config,
      webhookBaseUrl: cleanBase,
      dealsWebhookUrl: `${cleanBase}crm.deal.list.json?SELECT%5B%5D=*&SELECT%5B%5D=UF_*`,
      leadsWebhookUrl: `${cleanBase}crm.lead.list.json?SELECT%5B%5D=*&SELECT%5B%5D=UF_*`
    });
    setIsEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    onRefreshBitrix();
  };

  return (
    <div className="glass-panel p-6 rounded-2xl border border-blue-500/30 bg-slate-900/90 shadow-2xl space-y-6">
      {/* Section Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-black text-white tracking-tight">Bitrix24 CRM REST Webhooks (Deals & Leads)</h2>
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-md">
                100% Direct Data Pipeline
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Streams deals (`crm.deal.list`) and leads (`crm.lead.list`) with full custom fields & attachments directly from Bitrix24.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onRefreshBitrix}
            disabled={isSyncing}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-blue-600/30 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Fetching Bitrix...' : 'Sync Bitrix Deals & Leads'}</span>
          </button>
        </div>
      </div>

      {/* Connection Details & Editing */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Link2 className="w-4 h-4 text-blue-400" />
            <span>Bitrix24 REST Webhook Base URL</span>
          </label>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
            >
              Edit Webhook URL
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(false)}
              className="text-xs text-slate-400 hover:text-slate-300 font-semibold"
            >
              Cancel
            </button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleSave} className="flex gap-2">
            <input
              type="text"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://compton.bitrix24.in/rest/212/ml282niaoub4hrkz/"
              className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all"
            >
              Save & Sync
            </button>
          </form>
        ) : (
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 truncate">
            {config.webhookBaseUrl}
          </div>
        )}

        {saveSuccess && (
          <p className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" /> Webhook URL saved successfully!
          </p>
        )}
      </div>

      {/* Sync Status Cards */}
      {syncResult && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Total Deals</span>
            <div className="text-xl font-black text-white flex items-center justify-between">
              <span>{syncResult.totalFetchedDeals.toLocaleString('en-IN')}</span>
              <ShieldCheck className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-[10px] text-slate-500">From `crm.deal.list`</span>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Bitrix Leads</span>
            <div className="text-xl font-black text-cyan-400 flex items-center justify-between">
              <span>{syncResult.totalFetchedLeads.toLocaleString('en-IN')}</span>
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="text-[10px] text-cyan-400/80 font-mono">From `crm.lead.list`</span>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Bitrix Won Deals</span>
            <div className="text-xl font-black text-emerald-400 flex items-center justify-between">
              <span>{syncResult.won.length.toLocaleString('en-IN')}</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-[10px] text-emerald-400/80 font-mono">Stage: WON</span>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Bitrix Lost Deals</span>
            <div className="text-xl font-black text-rose-400 flex items-center justify-between">
              <span>{syncResult.lost.length.toLocaleString('en-IN')}</span>
              <AlertCircle className="w-4 h-4 text-rose-400" />
            </div>
            <span className="text-[10px] text-rose-400/80 font-mono">Stage: LOSE</span>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase">In Progress Pipeline</span>
            <div className="text-xl font-black text-amber-400 flex items-center justify-between">
              <span>{syncResult.progress.length.toLocaleString('en-IN')}</span>
              <RefreshCw className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-[10px] text-amber-400/80 font-mono">Active Opportunities</span>
          </div>
        </div>
      )}
    </div>
  );
};
