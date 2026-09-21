import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Search, 
  Building2, 
  Calendar, 
  FileSpreadsheet,
  Edit3,
  Check,
  RotateCcw,
  Plus,
  Trash2,
  AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { DealRecord, KPIMetrics } from '../../types/sales';
import { 
  getTargets, 
  saveCustomTargets, 
  resetCustomTargets 
} from '../../config/salesTargets';
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

  // Target Customization State
  const [activeTargets, setActiveTargets] = useState(() => getTargets());
  const [isEditingTargets, setIsEditingTargets] = useState<boolean>(false);
  const [editMonthlyCr, setEditMonthlyCr] = useState<string>('1.60');
  const [editYearlyCr, setEditYearlyCr] = useState<string>('20.00');
  const [editReps, setEditReps] = useState<{ id: string; name: string; targetLakhs: string }[]>([]);
  const [newRepName, setNewRepName] = useState<string>('');
  const [newRepTargetLakhs, setNewRepTargetLakhs] = useState<string>('10.0');
  const [showAddRep, setShowAddRep] = useState<boolean>(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    const handleTargetsUpdated = (e: any) => {
      const updated = e.detail || getTargets();
      setActiveTargets({ ...updated });
    };
    window.addEventListener('salesTargetsUpdated', handleTargetsUpdated);
    return () => window.removeEventListener('salesTargetsUpdated', handleTargetsUpdated);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setSearchTerm('');
      setActiveSubTab(metricKey === 'winRate' ? 'won' : metricKey === 'lossRate' ? 'lost' : 'all');
      setSortField('salesRep');
      setSortDirection('asc');
      setActiveTargets(getTargets());
      setIsEditingTargets(false);
      setValidationError(null);
      setSaveToast(null);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, metricKey]);

  const handleStartEditing = () => {
    const current = getTargets();
    setActiveTargets(current);
    setEditMonthlyCr((current.monthlyTarget / 10000000).toFixed(2));
    setEditYearlyCr((current.yearlyTarget / 10000000).toFixed(2));
    const repEntries = Object.entries(current.repTargets || current.repMonthlyTargets || {}).map(([name, val], i) => ({
      id: `rep-${i}-${name}`,
      name,
      targetLakhs: (val / 100000).toFixed(1)
    }));
    setEditReps(repEntries);
    setValidationError(null);
    setShowAddRep(false);
    setIsEditingTargets(true);
  };

  const handleCancelEditing = () => {
    setIsEditingTargets(false);
    setValidationError(null);
    setShowAddRep(false);
  };

  const handleUpdateRepTarget = (id: string, newLakhs: string) => {
    setEditReps(prev => prev.map(r => r.id === id ? { ...r, targetLakhs: newLakhs } : r));
  };

  const handleRemoveRep = (id: string) => {
    if (editReps.length <= 1) {
      setValidationError('You must have at least one sales representative on the roster.');
      return;
    }
    setEditReps(prev => prev.filter(r => r.id !== id));
  };

  const handleAddRep = () => {
    const trimmed = newRepName.trim();
    if (!trimmed) {
      setValidationError('Please enter a representative name.');
      return;
    }
    const exists = editReps.some(r => r.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setValidationError(`"${trimmed}" is already on the target list.`);
      return;
    }
    const valLakhs = parseFloat(newRepTargetLakhs);
    if (isNaN(valLakhs) || valLakhs <= 0) {
      setValidationError('Please enter a positive monthly target in Lakhs.');
      return;
    }
    setEditReps(prev => [...prev, {
      id: `rep-${Date.now()}-${trimmed}`,
      name: trimmed,
      targetLakhs: valLakhs.toFixed(1)
    }]);
    setNewRepName('');
    setNewRepTargetLakhs('10.0');
    setShowAddRep(false);
    setValidationError(null);
  };

  const handleSaveTargets = async () => {
    setValidationError(null);
    const monthlyNum = parseFloat(editMonthlyCr);
    const yearlyNum = parseFloat(editYearlyCr);

    if (isNaN(monthlyNum) || monthlyNum <= 0) {
      setValidationError('Please enter a valid positive Monthly Target in Crores.');
      return;
    }
    if (isNaN(yearlyNum) || yearlyNum <= 0) {
      setValidationError('Please enter a valid positive Yearly Target in Crores.');
      return;
    }
    if (editReps.length === 0) {
      setValidationError('Please keep at least one sales representative in the target list.');
      return;
    }

    const repMap: Record<string, number> = {};
    for (const rep of editReps) {
      const trimmed = rep.name.trim();
      if (!trimmed) {
        setValidationError('All sales representatives must have a valid name.');
        return;
      }
      const valLakhs = parseFloat(rep.targetLakhs);
      if (isNaN(valLakhs) || valLakhs < 0) {
        setValidationError(`Invalid target for ${trimmed}. Must be a valid number.`);
        return;
      }
      repMap[trimmed] = Math.round(valLakhs * 100000);
    }

    try {
      setIsSaving(true);
      await saveCustomTargets({
        monthlyTarget: Math.round(monthlyNum * 10000000),
        yearlyTarget: Math.round(yearlyNum * 10000000),
        repTargets: repMap
      });
      setActiveTargets(getTargets());
      setIsEditingTargets(false);
      setSaveToast('✓ Targets updated successfully across dashboard!');
      setTimeout(() => setSaveToast(null), 4500);
    } catch (err: any) {
      setValidationError(err.message || 'Failed to save targets.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!window.confirm('Reset all monthly, yearly, and sales rep targets to factory defaults?')) {
      return;
    }
    try {
      setIsSaving(true);
      await resetCustomTargets();
      const def = getTargets();
      setActiveTargets(def);
      setEditMonthlyCr((def.monthlyTarget / 10000000).toFixed(2));
      setEditYearlyCr((def.yearlyTarget / 10000000).toFixed(2));
      const repEntries = Object.entries(def.repTargets).map(([name, val], i) => ({
        id: `rep-${i}-${name}`,
        name,
        targetLakhs: (val / 100000).toFixed(1)
      }));
      setEditReps(repEntries);
      setIsEditingTargets(false);
      setSaveToast('✓ Reverted to default company targets.');
      setTimeout(() => setSaveToast(null), 4500);
    } catch (err: any) {
      setValidationError(err.message || 'Failed to reset targets.');
    } finally {
      setIsSaving(false);
    }
  };

  const availableRepsFromDeals = useMemo(() => {
    const pool = allRecords.length > 0 ? allRecords : records;
    const existing = new Set(editReps.map(r => r.name.toLowerCase()));
    const unique = Array.from(new Set(pool.map(d => (d.salesRep || '').trim()).filter(Boolean)));
    return unique.filter(name => !existing.has(name.toLowerCase()));
  }, [allRecords, records, editReps]);

  const totalRepMonthlyValue = useMemo(() => {
    const list = Object.values(activeTargets.repTargets || activeTargets.repMonthlyTargets || {});
    return list.reduce((a, b) => a + b, 0);
  }, [activeTargets]);

  const viewAllocationPct = activeTargets.monthlyTarget > 0
    ? Math.round((totalRepMonthlyValue / activeTargets.monthlyTarget) * 100)
    : 0;

  const calculatedTotalRepMonthlyValue = useMemo(() => {
    return editReps.reduce((acc, r) => {
      const num = parseFloat(r.targetLakhs);
      return acc + (isNaN(num) ? 0 : num * 100000);
    }, 0);
  }, [editReps]);

  const calculatedMonthlyTargetVal = (parseFloat(editMonthlyCr) || 0) * 10000000;
  const editAllocationPct = calculatedMonthlyTargetVal > 0 
    ? Math.round((calculatedTotalRepMonthlyValue / calculatedMonthlyTargetVal) * 100) 
    : 0;

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
      'Deal Cycle (Days)': typeof d.salesCycleDays === 'number' ? `${d.salesCycleDays} Days` : 'N/A',
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
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {isTargetCard ? (isEditingTargets ? 'Customization Mode' : 'Data Breakdown') : 'Data Breakdown'}
                </span>
                {isTargetCard && activeTargets.isCustomized && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Custom Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {isTargetCard && isEditingTargets 
                  ? 'Set and customize company benchmarks and representative quotas' 
                  : subtitle}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5">
            {!isTargetCard && (
              <button
                onClick={handleExportToExcel}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white font-medium text-xs shadow transition-all active:scale-95"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export to Excel</span>
              </button>
            )}

            {isTargetCard && (
              <>
                {!isEditingTargets ? (
                  <button
                    onClick={handleStartEditing}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-600/20 transition-all active:scale-95 border border-blue-400/30"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Targets</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleCancelEditing}
                      disabled={isSaving}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs transition-colors border border-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveTargets}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/20 transition-all active:scale-95 border border-emerald-400/30"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isSaving ? 'Saving...' : 'Save Targets'}</span>
                    </button>
                  </>
                )}
              </>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Target Info View (For Target cards) */}
        {isTargetCard ? (
          <div className="space-y-4 py-3 overflow-y-auto pr-1 custom-scrollbar">
            {saveToast && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs animate-fade-in">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-medium">{saveToast}</span>
                </div>
                <button onClick={() => setSaveToast(null)} className="text-emerald-400/70 hover:text-emerald-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {validationError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs animate-fade-in">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {!isEditingTargets ? (
              /* VIEW MODE */
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 1: Company Benchmarks View */}
                  <div className="glass-panel p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <h5 className="text-xs font-semibold text-slate-200">Company Benchmarks</h5>
                        <button
                          onClick={handleStartEditing}
                          className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors font-medium px-2 py-0.5 rounded hover:bg-blue-500/10"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      </div>
                      <div className="space-y-2 text-xs pt-3">
                        <div className="flex justify-between items-center py-1.5 border-b border-slate-800/80">
                          <div>
                            <span className="text-slate-400">Monthly Target (Default):</span>
                            <span className="text-[10px] text-slate-500 block font-mono">
                              ₹{activeTargets.monthlyTarget.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <strong className="text-indigo-400 font-mono text-sm">
                            ₹{(activeTargets.monthlyTarget / 10000000).toFixed(2)} Cr / month
                          </strong>
                        </div>
                        <div className="flex justify-between items-center py-1.5 border-b border-slate-800/80">
                          <div>
                            <span className="text-slate-400">Yearly Target (FY Apr–Mar):</span>
                            <span className="text-[10px] text-slate-500 block font-mono">
                              ₹{activeTargets.yearlyTarget.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <strong className="text-purple-400 font-mono text-sm">
                            ₹{(activeTargets.yearlyTarget / 10000000).toFixed(2)} Cr / FY
                          </strong>
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 italic pt-2">
                      These benchmarks govern top-level gauge arcs, progress indicators, and quarterly performance targets across the executive dashboard.
                    </p>
                  </div>

                  {/* Card 2: Individual Sales Rep Targets View */}
                  <div className="glass-panel p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div className="flex items-center gap-2">
                          <h5 className="text-xs font-semibold text-slate-200">Individual Sales Rep Monthly Targets</h5>
                          <span className="text-[10px] text-slate-500 font-mono">
                            ({Object.keys(activeTargets.repTargets || {}).length} reps)
                          </span>
                        </div>
                        <button
                          onClick={handleStartEditing}
                          className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors font-medium px-2 py-0.5 rounded hover:bg-blue-500/10"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      </div>

                      <div className="space-y-1.5 text-xs pt-2 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                        {Object.entries(activeTargets.repTargets || activeTargets.repMonthlyTargets || {}).map(([rep, target]) => (
                          <div key={rep} className="flex justify-between items-center py-1 border-b border-slate-800/60">
                            <div>
                              <span className="text-slate-300 font-medium block">{rep}</span>
                              <span className="text-[10px] text-slate-500 font-mono">₹{target.toLocaleString('en-IN')}</span>
                            </div>
                            <strong className="text-emerald-400 font-mono">
                              ₹{(target / 100000).toFixed(1)} Lakhs
                            </strong>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* View mode allocation bar */}
                    <div className="pt-2 border-t border-slate-800/80 space-y-1">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400">Total Rep Quotas:</span>
                        <span className="font-mono text-slate-200 font-semibold">
                          ₹{(totalRepMonthlyValue / 10000000).toFixed(2)} Cr / month ({viewAllocationPct}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            viewAllocationPct === 100 ? 'bg-emerald-400' : viewAllocationPct > 100 ? 'bg-amber-400' : 'bg-blue-400'
                          }`}
                          style={{ width: `${Math.min(100, viewAllocationPct)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer note & Reset action if customized */}
                {activeTargets.isCustomized && (
                  <div className="flex flex-col sm:flex-row items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800 gap-2">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>Currently using custom target benchmarks. All dashboard gauges and KPIs are active with these values.</span>
                    </div>
                    <button
                      onClick={handleResetDefaults}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-300 text-xs font-medium transition-colors border border-slate-800"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset to Factory Defaults</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* EDIT MODE */
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column: Company Benchmarks Editor */}
                  <div className="glass-panel p-4 rounded-xl border border-slate-800 bg-slate-950/70 space-y-4">
                    <div>
                      <h5 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Company Benchmarks</h5>
                      <p className="text-[11px] text-slate-400 mt-0.5">Customize company-wide monthly and fiscal year targets</p>
                    </div>

                    <div className="space-y-3">
                      {/* Monthly Target Field */}
                      <div>
                        <label className="text-xs font-medium text-slate-300 block mb-1">
                          Monthly Target (Default)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs text-slate-500 font-mono">₹</span>
                          <input
                            type="number"
                            step="0.05"
                            min="0.1"
                            value={editMonthlyCr}
                            onChange={e => setEditMonthlyCr(e.target.value)}
                            className="w-full pl-7 pr-24 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm font-mono font-bold text-indigo-300 focus:outline-none focus:border-indigo-500 transition-colors"
                          />
                          <span className="absolute right-3 top-2 text-xs font-semibold text-indigo-400">
                            Cr / month
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] mt-1">
                          <span className="text-slate-500">Full Amount:</span>
                          <span className="font-mono text-indigo-400 font-medium">
                            ₹{Math.round((parseFloat(editMonthlyCr) || 0) * 10000000).toLocaleString('en-IN')}
                          </span>
                        </div>

                        {/* Quick Presets */}
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-[10px] text-slate-500">Presets:</span>
                          {['1.50', '1.60', '1.80', '2.00'].map(val => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setEditMonthlyCr(val)}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                                editMonthlyCr === val
                                  ? 'bg-indigo-600 text-white font-bold'
                                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                              }`}
                            >
                              ₹{val} Cr
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Yearly Target Field */}
                      <div className="pt-2 border-t border-slate-800">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-slate-300 block">
                            Yearly Target (FY Apr–Mar)
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const m = parseFloat(editMonthlyCr) || 1.6;
                              setEditYearlyCr((m * 12.5).toFixed(2));
                            }}
                            className="text-[10px] text-purple-400 hover:text-purple-300 underline font-medium"
                          >
                            Auto: 12.5× Monthly
                          </button>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs text-slate-500 font-mono">₹</span>
                          <input
                            type="number"
                            step="0.5"
                            min="1"
                            value={editYearlyCr}
                            onChange={e => setEditYearlyCr(e.target.value)}
                            className="w-full pl-7 pr-20 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm font-mono font-bold text-purple-300 focus:outline-none focus:border-purple-500 transition-colors"
                          />
                          <span className="absolute right-3 top-2 text-xs font-semibold text-purple-400">
                            Cr / FY
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] mt-1">
                          <span className="text-slate-500">Full Amount:</span>
                          <span className="font-mono text-purple-400 font-medium">
                            ₹{Math.round((parseFloat(editYearlyCr) || 0) * 10000000).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Individual Sales Rep Targets Editor */}
                  <div className="glass-panel p-4 rounded-xl border border-slate-800 bg-slate-950/70 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                        <div>
                          <h5 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Individual Sales Reps</h5>
                          <p className="text-[11px] text-slate-400 mt-0.5">Assign monthly quotas per representative</p>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          {editReps.length} Reps
                        </span>
                      </div>

                      {/* Rep List */}
                      <div className="space-y-2 pt-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                        {editReps.map(rep => (
                          <div
                            key={rep.id}
                            className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all"
                          >
                            <div className="flex-1 min-w-0">
                              <input
                                type="text"
                                value={rep.name}
                                onChange={e => {
                                  const val = e.target.value;
                                  setEditReps(prev => prev.map(r => r.id === rep.id ? { ...r, name: val } : r));
                                }}
                                placeholder="Rep Name"
                                className="w-full bg-transparent text-xs font-semibold text-slate-200 border-none focus:outline-none focus:text-white"
                              />
                              <span className="text-[10px] text-slate-500 font-mono block">
                                ₹{Math.round((parseFloat(rep.targetLakhs) || 0) * 100000).toLocaleString('en-IN')}
                              </span>
                            </div>

                            <div className="relative w-28 shrink-0">
                              <span className="absolute left-2 top-1.5 text-xs text-slate-500 font-mono">₹</span>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={rep.targetLakhs}
                                onChange={e => handleUpdateRepTarget(rep.id, e.target.value)}
                                className="w-full pl-5 pr-9 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500 text-right"
                              />
                              <span className="absolute right-2 top-1.5 text-[10px] font-semibold text-slate-400">L</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveRep(rep.id)}
                              title="Remove Representative"
                              className="p-1 text-slate-500 hover:text-rose-400 transition-colors rounded hover:bg-rose-500/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Add Rep Form / Trigger */}
                      <div className="mt-2.5">
                        {!showAddRep ? (
                          <button
                            type="button"
                            onClick={() => setShowAddRep(true)}
                            className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg border border-dashed border-slate-700 hover:border-blue-500/60 bg-slate-900/40 hover:bg-blue-500/10 text-xs font-medium text-slate-300 hover:text-blue-400 transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Sales Representative</span>
                          </button>
                        ) : (
                          <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-700 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-200">New Sales Representative</span>
                              <button onClick={() => setShowAddRep(false)} className="text-slate-400 hover:text-white">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-slate-400 block mb-0.5">Name</label>
                                <input
                                  type="text"
                                  list="deal-reps-list"
                                  value={newRepName}
                                  onChange={e => setNewRepName(e.target.value)}
                                  placeholder="e.g. Rahul Sharma"
                                  className="w-full px-2.5 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-blue-500"
                                />
                                {availableRepsFromDeals.length > 0 && (
                                  <datalist id="deal-reps-list">
                                    {availableRepsFromDeals.map(name => (
                                      <option key={name} value={name} />
                                    ))}
                                  </datalist>
                                )}
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-400 block mb-0.5">Monthly Target (Lakhs)</label>
                                <div className="relative">
                                  <span className="absolute left-2.5 top-1 text-xs text-slate-500 font-mono">₹</span>
                                  <input
                                    type="number"
                                    step="0.5"
                                    min="0.1"
                                    value={newRepTargetLakhs}
                                    onChange={e => setNewRepTargetLakhs(e.target.value)}
                                    className="w-full pl-6 pr-10 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500"
                                  />
                                  <span className="absolute right-2.5 top-1 text-[10px] font-semibold text-slate-400">L</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setShowAddRep(false)}
                                className="px-2.5 py-1 rounded text-xs text-slate-400 hover:text-white"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleAddRep}
                                className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors"
                              >
                                Add Rep
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quota Allocation Bar */}
                    <div className="pt-2 border-t border-slate-800 space-y-1">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-slate-400">Allocated Rep Quotas:</span>
                        <span className="font-mono text-slate-200">
                          ₹{(calculatedTotalRepMonthlyValue / 10000000).toFixed(2)} Cr / ₹{(calculatedMonthlyTargetVal / 10000000).toFixed(2)} Cr
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            editAllocationPct === 100
                              ? 'bg-emerald-500'
                              : editAllocationPct > 100
                                ? 'bg-amber-500'
                                : 'bg-blue-500'
                          }`}
                          style={{ width: `${Math.min(100, editAllocationPct)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>{editAllocationPct}% covered</span>
                        <span>
                          {editAllocationPct === 100
                            ? 'Exact 100% Match'
                            : editAllocationPct > 100
                              ? `+₹{((calculatedTotalRepMonthlyValue - calculatedMonthlyTargetVal) / 100000).toFixed(1)}L over`
                              : `₹{((calculatedMonthlyTargetVal - calculatedTotalRepMonthlyValue) / 100000).toFixed(1)}L gap`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions Toolbar in Edit Mode */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <button
                    type="button"
                    onClick={handleResetDefaults}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-300 text-xs font-medium transition-colors border border-slate-800"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset to Factory Defaults</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCancelEditing}
                      disabled={isSaving}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors border border-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveTargets}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all active:scale-95 border border-emerald-500/30"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isSaving ? 'Saving...' : 'Save Targets'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Top Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
              <div className="glass-panel p-3 rounded-xl border border-slate-800 bg-slate-950/60">
                <span className="text-xs font-medium text-slate-400 block">Total Deals Count</span>
                <span className="text-lg font-bold text-blue-400 font-mono">{searchFilteredDeals.length} Deals</span>
              </div>
              <div className="glass-panel p-3 rounded-xl border border-slate-800 bg-slate-950/60">
                <span className="text-xs font-medium text-slate-400 block">Total Value</span>
                <span className="text-lg font-bold text-emerald-400 font-mono">₹{totalNetRevenueSum.toLocaleString('en-IN')}</span>
              </div>
              <div className="glass-panel p-3 rounded-xl border border-slate-800 bg-slate-950/60">
                <span className="text-xs font-medium text-slate-400 block">Average Deal Value</span>
                <span className="text-lg font-bold text-indigo-400 font-mono">
                  ₹{searchFilteredDeals.length > 0 ? Math.round(totalNetRevenueSum / searchFilteredDeals.length).toLocaleString('en-IN') : 0}
                </span>
              </div>
            </div>

            {/* Controls Bar: Sub-tabs (if winRate) & Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              {metricKey === 'winRate' ? (
                <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-950 border border-slate-800">
                  <button
                    onClick={() => setActiveSubTab('all')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      activeSubTab === 'all' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Closed ({primaryDeals.length})
                  </button>
                  <button
                    onClick={() => setActiveSubTab('won')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      activeSubTab === 'won' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Won ({primaryDeals.filter(r => r.type === 'won').length})
                  </button>
                  <button
                    onClick={() => setActiveSubTab('lost')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      activeSubTab === 'lost' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Lost ({primaryDeals.filter(r => r.type === 'lost').length})
                  </button>
                </div>
              ) : (
                <div className="text-xs text-slate-400 font-normal">
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
                  className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-y-auto overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/90 custom-scrollbar">
              <table className="w-full text-left text-xs text-slate-300 border-collapse min-w-[1100px]">
                <thead className="bg-slate-900 sticky top-0 z-10 text-slate-400 text-xs font-semibold border-b border-slate-800">
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
                      <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-blue-400 font-semibold">
                        <span>Sales Rep</span>
                        <span className="text-[10px] font-mono text-blue-400 font-bold bg-blue-500/20 px-1.5 py-0.5 rounded border border-blue-500/30">
                          {sortField === 'salesRep' ? (sortDirection === 'asc' ? '▲ A-Z' : '▼ Z-A') : '↕'}
                        </span>
                      </div>
                    </th>
                    <th className="p-3 whitespace-nowrap min-w-[120px]">Lead Source</th>
                    <th className="p-3 whitespace-nowrap min-w-[140px]">Solution</th>
                    <th className="p-3 whitespace-nowrap min-w-[110px]">Close Date</th>
                    <th className="p-3 whitespace-nowrap min-w-[110px]">Deal Cycle</th>
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
                            {typeof deal.salesCycleDays === 'number' ? `${deal.salesCycleDays} Days` : 'N/A'}
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
