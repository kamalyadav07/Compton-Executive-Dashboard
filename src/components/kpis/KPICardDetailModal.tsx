import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Search, 
  Building2, 
  Calendar, 
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { DealRecord, KPIMetrics } from '../../types/sales';
import { INDIVIDUAL_REP_MONTHLY_TARGETS, COMPANY_MONTHLY_TARGET, COMPANY_YEARLY_TARGET } from '../../config/salesTargets';
import { getFYBounds } from '../../engine/salesProjectionEngine';

export interface KPICardDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  metricKey: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  kpis: KPIMetrics;
  records: DealRecord[];
  allRecords?: DealRecord[];
}

export const KPICardDetailModal: React.FC<KPICardDetailModalProps> = ({
  isOpen,
  onClose,
  metricKey,
  title,
  subtitle,
  icon,
  kpis: _kpis,
  records,
  allRecords = []
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'won' | 'lost' | 'in_progress'>('all');
  const [sortField, setSortField] = useState<'salesRep' | 'none'>('salesRep');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setSearchTerm('');
      setActiveSubTab(metricKey === 'winRate' ? 'won' : metricKey === 'lossRate' ? 'lost' : 'all');
      setSortField('salesRep');
      setSortDirection('asc');
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, metricKey]);

  if (!isOpen) return null;

  const toggleSalesSort = () => {
    if (sortField !== 'salesRep') {
      setSortField('salesRep');
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      setSortField('none');
    }
  };

  // Filter records according to the clicked metric card
  const getUnderlyingDeals = (): { primaryDeals: DealRecord[]; comparisonDeals?: DealRecord[]; isTargetCard?: boolean } => {
    switch (metricKey) {
      case 'yearlyTarget':
      case 'monthlyTarget':
        return { primaryDeals: [], isTargetCard: true };

      case 'totalDealsInPipeline':
      case 'pipelineValue':
        return { primaryDeals: records.filter(r => r.type === 'in_progress') };

      case 'yearlyAchievement': {
        const fy = getFYBounds();
        const pool = allRecords.length > 0 ? allRecords : records;
        const fyWon = pool.filter(r => {
          if (r.type !== 'won') return false;
          const d = new Date(r.rawRecord?.CLOSEDATE || r.rawRecord?.DATE_MODIFY || r.date);
          return !isNaN(d.getTime()) && d >= fy.start && d <= fy.end;
        });
        return { primaryDeals: fyWon };
      }

      case 'monthlyAchievement':
      case 'revenueRemaining':
        return { primaryDeals: records.filter(r => r.type === 'won') };

      case 'revenueGrowth': {
        const currentWon = records.filter(r => r.type === 'won');
        return { primaryDeals: currentWon };
      }

      case 'avgSalesCycle':
        return { primaryDeals: records.filter(r => r.type === 'won') };

      case 'winRate':
        return { primaryDeals: records.filter(r => r.type === 'won' || r.type === 'lost') };

      case 'lossRate':
        return { primaryDeals: records.filter(r => r.type === 'lost') };

      default:
        return { primaryDeals: records };
    }
  };

  const { primaryDeals, isTargetCard } = getUnderlyingDeals();

  // Apply tab filters if active (e.g. for Win Rate)
  let tabFilteredDeals = primaryDeals;
  if (activeSubTab !== 'all') {
    tabFilteredDeals = primaryDeals.filter(r => r.type === activeSubTab);
  }

  // Apply quick search term filter
  const searchFilteredDeals = tabFilteredDeals.filter(d => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const dealName = (d.rawRecord?.['Deal Name'] || `${d.customer} - ${d.solution}`).toLowerCase();
    return (
      d.id.toLowerCase().includes(q) ||
      d.customer.toLowerCase().includes(q) ||
      d.salesRep.toLowerCase().includes(q) ||
      d.stage.toLowerCase().includes(q) ||
      d.solution.toLowerCase().includes(q) ||
      d.leadSource.toLowerCase().includes(q) ||
      dealName.includes(q)
    );
  });

  // Apply sorting by Sales Rep
  const finalDeals = [...searchFilteredDeals].sort((a, b) => {
    if (sortField === 'salesRep') {
      const repA = (a.salesRep || '').toLowerCase();
      const repB = (b.salesRep || '').toLowerCase();
      const cmp = repA.localeCompare(repB);
      return sortDirection === 'asc' ? cmp : -cmp;
    }
    return 0;
  });

  const totalNetRevenueSum = finalDeals.reduce((sum, r) => sum + r.netRevenue, 0);

  // Excel Export Handler
  const handleExportToExcel = () => {
    if (isTargetCard) return;

    let dealsToExport = finalDeals;

    if (metricKey === 'winRate') {
      if (activeSubTab === 'lost') {
        dealsToExport = finalDeals.filter(d => d.type === 'lost');
      } else {
        dealsToExport = finalDeals.filter(d => d.type === 'won');
      }
    } else if (metricKey === 'lossRate') {
      dealsToExport = finalDeals.filter(d => d.type === 'lost');
    }

    const exportRows = dealsToExport.map(d => ({
      'Deal ID': d.id,
      'Type / Status': d.type === 'won' ? 'Won' : d.type === 'lost' ? 'Lost' : 'In Progress',
      'Stage': d.stage,
      'Customer / Client': d.customer,
      'Deal Name': d.rawRecord?.TITLE || d.rawRecord?.['Deal Name'] || `${d.customer} - ${d.solution}`,
      'Total Value (₹)': d.netRevenue,
      'Gross Revenue (₹)': d.grossRevenue,
      'Sales Rep': d.salesRep,
      'Industry': d.industry,
      'Solution': d.solution,
      'Lead Source': d.leadSource,
      'Close / Deal Date': d.date,
      'Sales Cycle (Days)': d.salesCycleDays || 'N/A',
      'Lost Reason': d.lostReason || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'KPI Deal Breakdown');
    const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(workbook, `${safeTitle}_Deals_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-lg overflow-hidden">
      <div className="glass-panel w-full max-w-5xl rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col my-auto animate-scale-in">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 shadow-inner">
              {icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-100">{title}</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase tracking-wider">
                  Data Breakdown
                </span>
              </div>
              <p className="text-xs text-slate-400">{subtitle}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {!isTargetCard && (
              <button
                onClick={handleExportToExcel}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all active:scale-95"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export to Excel</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Target Info View (For Target cards) */}
        {isTargetCard ? (
          <div className="space-y-4 py-4 overflow-y-auto">


            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-panel p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3">
                <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Company Benchmarks</h5>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Monthly Target (Default):</span>
                    <strong className="text-indigo-400 font-mono">₹{(COMPANY_MONTHLY_TARGET / 10000000).toFixed(2)} Cr / month</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Yearly Target (FY Apr–Mar):</span>
                    <strong className="text-purple-400 font-mono">₹{(COMPANY_YEARLY_TARGET / 10000000).toFixed(2)} Cr / FY</strong>
                  </div>
                </div>
              </div>

              <div className="glass-panel p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3">
                <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Individual Sales Rep Monthly Targets</h5>
                <div className="space-y-1.5 text-xs">
                  {Object.entries(INDIVIDUAL_REP_MONTHLY_TARGETS).map(([rep, target]) => (
                    <div key={rep} className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-300 font-medium">{rep}</span>
                      <strong className="text-emerald-400 font-mono">₹{(target / 100000).toFixed(1)} Lakhs</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Top Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
              <div className="glass-panel p-3 rounded-xl border border-slate-800 bg-slate-950/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Deals Count</span>
                <span className="text-lg font-extrabold text-blue-400 font-mono">{searchFilteredDeals.length} Deals</span>
              </div>
              <div className="glass-panel p-3 rounded-xl border border-slate-800 bg-slate-950/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Value</span>
                <span className="text-lg font-extrabold text-emerald-400 font-mono">₹{totalNetRevenueSum.toLocaleString('en-IN')}</span>
              </div>
              <div className="glass-panel p-3 rounded-xl border border-slate-800 bg-slate-950/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg Deal Value</span>
                <span className="text-lg font-extrabold text-indigo-400 font-mono">
                  ₹{searchFilteredDeals.length > 0 ? Math.round(totalNetRevenueSum / searchFilteredDeals.length).toLocaleString('en-IN') : 0}
                </span>
              </div>
            </div>

            {/* Controls Bar: Sub-tabs (if winRate) & Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              {metricKey === 'winRate' ? (
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
                  <button
                    onClick={() => setActiveSubTab('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeSubTab === 'all' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Closed ({primaryDeals.length})
                  </button>
                  <button
                    onClick={() => setActiveSubTab('won')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeSubTab === 'won' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Won ({primaryDeals.filter(r => r.type === 'won').length})
                  </button>
                  <button
                    onClick={() => setActiveSubTab('lost')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeSubTab === 'lost' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Lost ({primaryDeals.filter(r => r.type === 'lost').length})
                  </button>
                </div>
              ) : (
                <div className="text-xs text-slate-400 font-medium">
                  Showing <strong className="text-slate-200">{searchFilteredDeals.length}</strong> matching deal records
                </div>
              )}

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search deal ID, customer, rep, stage..."
                  className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-y-auto overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/90 custom-scrollbar">
              <table className="w-full text-left text-xs text-slate-300 border-collapse min-w-[1100px]">
                <thead className="bg-slate-900 sticky top-0 z-10 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3 whitespace-nowrap min-w-[90px]">Deal ID</th>
                    <th className="p-3 whitespace-nowrap min-w-[120px]">Status / Stage</th>
                    <th className="p-3 whitespace-nowrap min-w-[180px]">Customer / Client</th>
                    <th className="p-3 min-w-[260px]">Opportunity Title</th>
                    <th className="p-3 whitespace-nowrap min-w-[130px]">Total Value (₹)</th>
                    <th 
                      onClick={toggleSalesSort}
                      className="p-3 whitespace-nowrap min-w-[150px] cursor-pointer hover:bg-slate-800/80 transition-colors group select-none"
                      title="Click to sort by Sales Rep"
                    >
                      <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-blue-400 font-bold">
                        <span>Sales Rep</span>
                        <span className="text-[10px] font-mono text-blue-400 font-black bg-blue-500/20 px-1.5 py-0.5 rounded border border-blue-500/30">
                          {sortField === 'salesRep' ? (sortDirection === 'asc' ? '▲ A-Z' : '▼ Z-A') : '↕'}
                        </span>
                      </div>
                    </th>
                    <th className="p-3 whitespace-nowrap min-w-[120px]">Lead Source</th>
                    <th className="p-3 whitespace-nowrap min-w-[140px]">Solution</th>
                    <th className="p-3 whitespace-nowrap min-w-[110px]">Close Date</th>
                    <th className="p-3 whitespace-nowrap min-w-[110px]">Sales Cycle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-medium">
                  {finalDeals.length > 0 ? (
                    finalDeals.map((deal) => {
                      const fullDealName = deal.rawRecord?.['Deal Name'] || `${deal.customer} - ${deal.solution}`;
                      return (
                        <tr key={deal.id} className="hover:bg-slate-900/90 transition-colors">
                          <td className="p-3 font-mono font-bold text-blue-400 whitespace-nowrap">{deal.id}</td>
                          
                          <td className="p-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              deal.type === 'won' 
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                                : deal.type === 'lost' 
                                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                            }`}>
                              {deal.stage}
                            </span>
                          </td>

                          <td className="p-3 font-bold text-slate-100">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span>{deal.customer}</span>
                            </div>
                          </td>

                          <td className="p-3 text-slate-200 font-normal leading-relaxed whitespace-normal break-words max-w-xs">
                            {fullDealName}
                          </td>

                          <td className="p-3 font-extrabold text-emerald-400 font-mono text-xs whitespace-nowrap">
                            ₹{deal.netRevenue.toLocaleString('en-IN')}
                          </td>

                          <td className="p-3 text-slate-200 whitespace-nowrap font-semibold">
                            {deal.salesRep}
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 inline-block">
                              {deal.leadSource}
                            </span>
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 inline-block">
                              {deal.solution}
                            </span>
                          </td>

                          <td className="p-3 text-slate-400 font-mono whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              <span>{deal.date}</span>
                            </div>
                          </td>

                          <td className="p-3 text-slate-300 font-mono whitespace-nowrap">
                            {deal.salesCycleDays ? `${deal.salesCycleDays} Days` : 'N/A'}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-500">
                        No deals match the search term "{searchTerm}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer Summary */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs shrink-0">
              <div className="flex items-center gap-4 text-slate-400">
                <span>Showing: <strong className="text-slate-100">{searchFilteredDeals.length}</strong> deals</span>
                <span>Total Value: <strong className="text-emerald-400 font-mono font-bold">₹{totalNetRevenueSum.toLocaleString('en-IN')}</strong></span>
              </div>
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-colors"
              >
                Close Window
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};
