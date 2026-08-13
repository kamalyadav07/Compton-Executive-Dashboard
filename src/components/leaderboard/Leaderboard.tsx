import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Trophy, 
  Medal, 
  Award, 
  Crown, 
  FileSpreadsheet, 
  Search, 
  X, 
  Download, 
  ExternalLink,
  Building2,
  Calendar,
  Layers,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { DealRecord, KPIMetrics, SalesRepMetric } from '../../types/sales';
import { INDIVIDUAL_REP_MONTHLY_TARGETS } from '../../config/salesTargets';

interface LeaderboardProps {
  records: DealRecord[];
  kpis: KPIMetrics;
}

const formatVal = (val: number): string => {
  if (val >= 10000000) {
    return `₹${(val / 10000000).toFixed(2)} Cr`;
  } else if (val >= 100000) {
    return `₹${(val / 100000).toFixed(2)} L`;
  }
  return `₹${val.toLocaleString('en-IN')}`;
};

export const Leaderboard: React.FC<LeaderboardProps> = ({ records, kpis }) => {
  const wonDeals = records.filter(r => r.type === 'won');
  const lostDeals = records.filter(r => r.type === 'lost');
  const progressDeals = records.filter(r => r.type === 'in_progress');

  const [selectedRep, setSelectedRep] = useState<SalesRepMetric | null>(null);
  const [modalSearch, setModalSearch] = useState<string>('');
  const [modalStageTab, setModalStageTab] = useState<'all' | 'won' | 'lost' | 'in_progress'>('all');

  useEffect(() => {
    if (selectedRep) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedRep]);

  const repNames = Array.from(new Set(records.map(r => r.salesRep))).filter(Boolean);

  const defaultAvatars: Record<string, string> = {
    'Vikram Mehta': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    'Ananya Sharma': 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
    'Rahul Verma': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    'Priya Nair': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    'Rohan Deshmukh': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    'Neha Kapoor': 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
    'Amitabh Sen': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'
  };

  const repMetrics: SalesRepMetric[] = repNames.map(name => {
    const repWon = wonDeals.filter(r => r.salesRep === name);
    const repLost = lostDeals.filter(r => r.salesRep === name);
    const repProgress = progressDeals.filter(r => r.salesRep === name);

    const netRevenue = repWon.reduce((acc, r) => acc + r.netRevenue, 0);
    const grossRevenue = repWon.reduce((acc, r) => acc + r.grossRevenue, 0);
    const lostGrossRevenue = repLost.reduce((acc, r) => acc + r.grossRevenue, 0);
    const closedGrossRevenue = grossRevenue + lostGrossRevenue;

    const wonCount = repWon.length;
    const lostCount = repLost.length;

    const pipelineValue = repProgress.reduce((acc, r) => acc + r.netRevenue, 0);
    const wonNetValues = repWon.map(r => r.netRevenue).sort((a, b) => a - b);
    const avgDealSize = wonCount > 0 ? Math.round(netRevenue / wonCount) : 0;
    const largestDeal = wonNetValues.length > 0 ? wonNetValues[wonNetValues.length - 1] : 0;

    const winRatePct = closedGrossRevenue > 0 ? Math.round((grossRevenue / closedGrossRevenue) * 1000) / 10 : 0;
    const lossRatePct = closedGrossRevenue > 0 ? Math.round((lostGrossRevenue / closedGrossRevenue) * 1000) / 10 : 0;

    const contributionPct = kpis.totalNetRevenue > 0 
      ? Math.round((netRevenue / kpis.totalNetRevenue) * 1000) / 10 
      : 0;

    const uniqueMonths = Array.from(new Set(records.map(r => r.monthYear))).filter(Boolean);
    const monthMultiplier = Math.max(1, uniqueMonths.length);

    const repBaseTarget = INDIVIDUAL_REP_MONTHLY_TARGETS[name] || 550000;
    const repTarget = repBaseTarget * monthMultiplier;
    const targetPct = repTarget > 0 ? Math.round((netRevenue / repTarget) * 1000) / 10 : 0;

    return {
      rank: 0,
      name,
      avatar: defaultAvatars[name] || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      grossRevenue,
      netRevenue,
      wonCount,
      lostCount,
      pipelineValue,
      avgDealSize,
      largestDeal,
      revenueGrowthPct: 14.8,
      contributionPct,
      targetPct,
      winRatePct,
      lossRatePct,
      medal: null
    };
  });

  repMetrics.sort((a, b) => b.netRevenue - a.netRevenue);

  repMetrics.forEach((r, idx) => {
    r.rank = idx + 1;
    if (idx === 0) r.medal = 'gold';
    else if (idx === 1) r.medal = 'silver';
    else if (idx === 2) r.medal = 'bronze';
  });

  // Filter all deals for selected rep in modal
  const selectedRepAllDeals = selectedRep 
    ? records.filter(r => r.salesRep === selectedRep.name)
    : [];

  const stageFilteredDeals = selectedRepAllDeals.filter(r => {
    if (modalStageTab === 'all') return true;
    return r.type === modalStageTab;
  });

  const modalFilteredDeals = stageFilteredDeals.filter(r => {
    if (!modalSearch) return true;
    const q = modalSearch.toLowerCase();
    return (
      r.id.toLowerCase().includes(q) ||
      r.customer.toLowerCase().includes(q) ||
      r.solution.toLowerCase().includes(q) ||
      r.industry.toLowerCase().includes(q) ||
      r.leadSource.toLowerCase().includes(q) ||
      r.stage.toLowerCase().includes(q) ||
      String(r.rawRecord?.['Deal Name'] || '').toLowerCase().includes(q)
    );
  });

  const exportRepExcel = (rep: SalesRepMetric) => {
    const deals = modalFilteredDeals.length > 0 ? modalFilteredDeals : stageFilteredDeals;
    const exportRows = deals.map(r => {
      const isWon = r.type === 'won';
      const grossRev = r.grossRevenue || r.netRevenue;
      const gstVal = isWon ? Math.round((grossRev - r.netRevenue) * 100) / 100 : 0;
      return {
        'Deal ID': r.id,
        'Deal Stage': r.stage,
        'Status Type': isWon ? 'WON' : r.type === 'lost' ? 'LOST' : 'IN PIPELINE',
        'Company / Client': r.customer,
        'Responsible Person': r.salesRep,
        'Deal Name / Opportunity': r.rawRecord?.TITLE || r.rawRecord?.['Deal Name'] || `${r.customer} - ${r.solution}`,
        'Lead Source': r.leadSource,
        'Gross Revenue (₹)': grossRev,
        'GST 18% (₹)': gstVal,
        'Net Revenue (₹)': r.netRevenue,
        'Industry': r.industry,
        'Solution Type': r.solution,
        'Created Date': r.rawRecord?.['Created'] || r.date,
        'Lost Reason': r.lostReason || 'N/A'
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(wb, ws, `${rep.name} Deals`);
    XLSX.writeFile(wb, `${rep.name}_${modalStageTab.toUpperCase()}_Deals.xlsx`);
  };

  return (
    <div className="w-full glass-panel p-5 rounded-2xl border border-slate-800/90 shadow-xl mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-extrabold text-slate-100 tracking-tight">
              Sales Team Leaderboard
            </h3>
          </div>
        </div>

        {topPerformerBanner(repMetrics[0])}
      </div>

      <div className="w-full overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/60">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
            <tr>
              <th className="p-3">Rank</th>
              <th className="p-3">Sales Representative</th>
              <th className="p-3">Total Revenue (Income)</th>
              <th className="p-3">Won / Lost</th>
              <th className="p-3">Win Rate %</th>
              <th className="p-3">Active Pipeline</th>
              <th className="p-3">Avg Deal Size</th>
              <th className="p-3">Largest Deal</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {repMetrics.map((rep) => (
              <tr 
                key={rep.name} 
                onClick={() => { setSelectedRep(rep); setModalSearch(''); setModalStageTab('all'); }}
                className="hover:bg-slate-800/80 transition-colors cursor-pointer group"
              >
                <td className="p-3 font-bold">
                  {rep.medal === 'gold' && (
                    <span className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 w-fit">
                      <Crown className="w-3.5 h-3.5" />
                      <span>#1 Gold</span>
                    </span>
                  )}
                  {rep.medal === 'silver' && (
                    <span className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-400/20 text-slate-300 border border-slate-400/40 w-fit">
                      <Medal className="w-3.5 h-3.5" />
                      <span>#2 Silver</span>
                    </span>
                  )}
                  {rep.medal === 'bronze' && (
                    <span className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-amber-700/20 text-amber-500 border border-amber-700/40 w-fit">
                      <Award className="w-3.5 h-3.5" />
                      <span>#3 Bronze</span>
                    </span>
                  )}
                  {!rep.medal && <span className="text-slate-500 font-mono pl-3">#{rep.rank}</span>}
                </td>

                <td className="p-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center text-cyan-300 font-bold text-xs font-mono shrink-0 shadow-inner group-hover:border-blue-500 transition-colors">
                      {rep.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <span className="font-bold text-slate-100 group-hover:text-blue-400 transition-colors flex items-center gap-1">
                        {rep.name}
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400" />
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">Click to view deals</span>
                    </div>
                  </div>
                </td>

                <td className="p-3 font-extrabold text-emerald-400 font-mono text-sm">
                  {formatVal(rep.netRevenue)}
                </td>

                <td className="p-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-emerald-400 font-bold">{rep.wonCount} Won</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-rose-400">{rep.lostCount} Lost</span>
                  </div>
                </td>

                <td className="p-3 font-bold">
                  <span className={`px-2 py-0.5 rounded-md text-[11px] ${
                    rep.winRatePct >= 65 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {rep.winRatePct}%
                  </span>
                </td>

                <td className="p-3 text-blue-400 font-mono font-semibold">
                  {formatVal(rep.pipelineValue)}
                </td>

                <td className="p-3 font-mono text-slate-300">
                  {formatVal(rep.avgDealSize)}
                </td>

                <td className="p-3 font-mono text-amber-400 font-bold">
                  {formatVal(rep.largestDeal)}
                </td>

                <td className="p-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRep(rep);
                      setModalSearch('');
                      setModalStageTab('all');
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 text-[11px] font-bold transition-all shadow-sm active:scale-95 whitespace-nowrap"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>View Rep Deals</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rep Deals Excel Data Modal (SUPPORTING ALL DEALS & STAGE FILTERING) */}
      {selectedRep && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 backdrop-blur-lg p-3 md:p-6 overflow-hidden">
          <div className="glass-panel p-5 md:p-6 rounded-2xl max-w-7xl w-full max-h-[92vh] flex flex-col border border-slate-700/80 shadow-2xl relative overflow-hidden bg-slate-900/95 my-auto">
            
            {/* Modal Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-blue-500/50 flex items-center justify-center text-blue-400 font-black text-sm font-mono shrink-0 shadow-md">
                  {selectedRep.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-extrabold text-slate-100">
                      {selectedRep.name} — Deal Worksheet
                    </h3>
                    <span className="px-2.5 py-0.5 text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-md">
                      {selectedRepAllDeals.length} Total Assigned Deals
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 flex flex-wrap items-center gap-3 mt-1">
                    <span>Won Revenue: <strong className="text-emerald-400 font-mono">{formatVal(selectedRep.netRevenue)}</strong></span>
                    <span>•</span>
                    <span>Pipeline: <strong className="text-blue-400 font-mono">{formatVal(selectedRep.pipelineValue)}</strong></span>
                    <span>•</span>
                    <span>Win Rate: <strong className="text-amber-400">{selectedRep.winRatePct}%</strong></span>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => exportRepExcel(selectedRep)}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 active:scale-95 whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Excel (.xlsx)</span>
                </button>

                <button
                  onClick={() => setSelectedRep(null)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Stage Selector Tabs & Search */}
            <div className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/60">
              {/* Stage Filter Buttons */}
              <div className="flex items-center space-x-2 overflow-x-auto scrollbar-none">
                <button
                  onClick={() => setModalStageTab('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    modalStageTab === 'all' ? 'bg-blue-600 text-white shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>All Deals ({selectedRepAllDeals.length})</span>
                </button>

                <button
                  onClick={() => setModalStageTab('won')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    modalStageTab === 'won' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Won Deals ({selectedRep.wonCount})</span>
                </button>

                <button
                  onClick={() => setModalStageTab('lost')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    modalStageTab === 'lost' ? 'bg-rose-600 text-white shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Lost Deals ({selectedRep.lostCount})</span>
                </button>

                <button
                  onClick={() => setModalStageTab('in_progress')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    modalStageTab === 'in_progress' ? 'bg-cyan-600 text-white shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>In Progress ({selectedRepAllDeals.filter(r => r.type === 'in_progress').length})</span>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative flex-1 max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Search deals by ID, company, stage..."
                  className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-y-auto overflow-x-auto my-3 rounded-xl border border-slate-800 bg-slate-950/90 shadow-inner">
              <table className="w-full text-left text-xs text-slate-300 border-collapse min-w-[1100px]">
                <thead className="bg-slate-900 sticky top-0 z-10 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3.5 whitespace-nowrap min-w-[90px]">Deal ID</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[120px]">Status / Stage</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[180px]">Company / Client</th>
                    <th className="p-3.5 min-w-[300px]">Deal Name / Opportunity</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[130px]">Income / Value (₹)</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[120px]">Lead Source</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[130px]">Industry</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[170px]">Solution Type</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[110px]">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-medium">
                  {modalFilteredDeals.length > 0 ? (
                    modalFilteredDeals.map((deal) => {
                      const fullDealName = deal.rawRecord?.['Deal Name'] || `${deal.customer} - ${deal.solution}`;
                      return (
                        <tr key={deal.id} className="hover:bg-slate-900/90 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-blue-400 whitespace-nowrap">{deal.id}</td>
                          
                          <td className="p-3.5 whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                              deal.type === 'won' 
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                                : deal.type === 'lost' 
                                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                            }`}>
                              {deal.stage}
                            </span>
                          </td>

                          <td className="p-3.5 font-bold text-slate-100">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                              <span>{deal.customer}</span>
                            </div>
                          </td>

                          <td className="p-3.5 text-slate-200 font-normal leading-relaxed whitespace-normal break-words max-w-md">
                            {fullDealName}
                          </td>

                          <td className="p-3.5 font-extrabold text-emerald-400 font-mono text-xs whitespace-nowrap">
                            ₹{deal.netRevenue.toLocaleString('en-IN')}
                          </td>

                          <td className="p-3.5 whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-800 text-slate-200 border border-slate-700 whitespace-nowrap inline-block">
                              {deal.leadSource}
                            </span>
                          </td>

                          <td className="p-3.5 text-slate-300 whitespace-nowrap">{deal.industry}</td>

                          <td className="p-3.5 whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 whitespace-nowrap inline-block">
                              {deal.solution}
                            </span>
                          </td>

                          <td className="p-3.5 text-slate-400 font-mono whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              <span>{deal.date}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">
                        No deals matching current stage filter tab "{modalStageTab}" and search "{modalSearch}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer Summary */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs">
              <div className="flex items-center space-x-4">
                <span className="text-slate-400">Filtered Deals: <strong className="text-slate-100">{modalFilteredDeals.length}</strong></span>
                <span className="text-slate-400">Total Value: <strong className="text-emerald-400 font-mono font-bold">₹{modalFilteredDeals.reduce((a, b) => a + b.netRevenue, 0).toLocaleString('en-IN')}</strong></span>
              </div>
              <button
                onClick={() => setSelectedRep(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-colors w-fit"
              >
                Close Worksheet
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const topPerformerBanner = (topRep?: SalesRepMetric) => {
  if (!topRep) return null;
  return (
    <div className="flex items-center space-x-3 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-yellow-500/10 border border-amber-500/30 text-xs">
      <Crown className="w-4 h-4 text-amber-400" />
      <span className="text-slate-300 font-medium">
        Top Sales Rep: <strong className="text-amber-400 font-bold">{topRep.name}</strong>
      </span>
      <span className="text-slate-600">•</span>
      <span className="font-mono text-emerald-400 font-extrabold">
        {formatVal(topRep.netRevenue)}
      </span>
    </div>
  );
};
