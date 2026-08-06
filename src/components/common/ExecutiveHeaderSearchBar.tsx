import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Search, 
  X, 
  RotateCcw, 
  User, 
  Briefcase, 
  Layers, 
  Globe, 
  Sliders, 
  Calendar
} from 'lucide-react';
import type { GlobalFilterState, DealRecord } from '../../types/sales';

interface ExecutiveHeaderSearchBarProps {
  filters: GlobalFilterState;
  onFilterChange: (newFilters: GlobalFilterState) => void;
  onResetFilters: () => void;
  allRecords: DealRecord[];
}

export const ExecutiveHeaderSearchBar: React.FC<ExecutiveHeaderSearchBarProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  allRecords
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside or Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Filter options lists
  const ALLOWED_REPS = ['Ashok Kumar', 'Jitesh Chander', 'Rohit Yadav', 'Sandeep Vahi', 'Taniya Negi', 'Tausif Ahmad'];
  const salesReps = useMemo(() => {
    const set = new Set(allRecords.map(r => r.salesRep));
    return ALLOWED_REPS.filter(r => set.has(r) || true);
  }, [allRecords]);
  const industries = useMemo(() => Array.from(new Set(allRecords.map(r => r.industry))).filter(Boolean).sort(), [allRecords]);
  const solutions = useMemo(() => Array.from(new Set(allRecords.map(r => r.solution))).filter(Boolean).sort(), [allRecords]);
  const leadSources = useMemo(() => Array.from(new Set(allRecords.map(r => r.leadSource))).filter(Boolean).sort(), [allRecords]);
  const stages = useMemo(() => Array.from(new Set(allRecords.map(r => r.stage))).filter(Boolean).sort(), [allRecords]);

  // Autocomplete matching companies
  const companySuggestions = useMemo(() => {
    if (!filters.customerQuery.trim()) return [];
    const q = filters.customerQuery.toLowerCase().trim();
    const set = new Set<string>();
    allRecords.forEach(r => {
      if (r.customer && r.customer.toLowerCase().includes(q)) {
        set.add(r.customer);
      }
    });
    return Array.from(set).slice(0, 5);
  }, [filters.customerQuery, allRecords]);

  // Month & Year calculations
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth();
  const shortMonthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentShortMonthStr = `${shortMonthNames[currentMonthIdx]} ${currentYear}`;

  // Helper to parse Month-Year strings into timestamp for chronological sorting
  const monthMap: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };

  const getMonthYearTime = (str: string): number => {
    if (!str) return 0;
    const parts = str.trim().split(/\s+/);
    if (parts.length >= 2) {
      const mStr = parts[0].toLowerCase().substring(0, 3);
      const yNum = parseInt(parts[1], 10);
      const mNum = monthMap[mStr] !== undefined ? monthMap[mStr] : 0;
      if (!isNaN(yNum)) {
        return new Date(yNum, mNum, 1).getTime();
      }
    }
    return 0;
  };

  const allMonthSet = new Set([currentShortMonthStr, ...allRecords.map(r => r.monthYear)]);
  const uniqueMonths = Array.from(allMonthSet)
    .filter(Boolean)
    .sort((a, b) => getMonthYearTime(b) - getMonthYearTime(a));

  const allYearSet = new Set([String(currentYear), ...allRecords.map(r => String(r.year))]);
  const uniqueYears = Array.from(allYearSet)
    .filter(Boolean)
    .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));

  const handleFieldChange = (key: keyof GlobalFilterState, value: any) => {
    onFilterChange({
      ...filters,
      [key]: value
    });
  };

  // Build Active Filter Chips (Matching Image 2)
  const activeChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove: () => void }> = [];

    if (filters.salesRep !== 'All') {
      chips.push({
        id: 'salesRep',
        label: `Responsible: ${filters.salesRep}`,
        onRemove: () => handleFieldChange('salesRep', 'All')
      });
    }

    if (filters.pipelineStage !== 'All') {
      chips.push({
        id: 'pipelineStage',
        label: `Stage: ${filters.pipelineStage}`,
        onRemove: () => handleFieldChange('pipelineStage', 'All')
      });
    }

    if (filters.industry !== 'All') {
      chips.push({
        id: 'industry',
        label: `Industry: ${filters.industry}`,
        onRemove: () => handleFieldChange('industry', 'All')
      });
    }

    if (filters.solution !== 'All') {
      chips.push({
        id: 'solution',
        label: `Solution: ${filters.solution}`,
        onRemove: () => handleFieldChange('solution', 'All')
      });
    }

    if (filters.leadSource !== 'All') {
      chips.push({
        id: 'leadSource',
        label: `Source: ${filters.leadSource}`,
        onRemove: () => handleFieldChange('leadSource', 'All')
      });
    }

    if (filters.selectedMonth !== 'All') {
      chips.push({
        id: 'selectedMonth',
        label: `Month: ${filters.selectedMonth}`,
        onRemove: () => handleFieldChange('selectedMonth', 'All')
      });
    }

    if (filters.selectedYear !== 'All') {
      chips.push({
        id: 'selectedYear',
        label: `Year: ${filters.selectedYear}`,
        onRemove: () => handleFieldChange('selectedYear', 'All')
      });
    }

    if (filters.startDate || filters.endDate) {
      chips.push({
        id: 'dateRange',
        label: `Date: ${filters.startDate || 'Any'} to ${filters.endDate || 'Any'}`,
        onRemove: () => onFilterChange({ ...filters, startDate: '', endDate: '' })
      });
    }

    if (filters.minDealValue > 0) {
      chips.push({
        id: 'minDealValue',
        label: `Min: ₹${(filters.minDealValue / 100000).toFixed(0)}L`,
        onRemove: () => handleFieldChange('minDealValue', 0)
      });
    }

    return chips;
  }, [filters]);

  const hasAnyFilterOrQuery = activeChips.length > 0 || !!filters.customerQuery;

  return (
    <div ref={containerRef} className="relative w-full max-w-xl lg:max-w-2xl mx-auto z-50">
      
      {/* Smart Search Bar Input Box (Matching Image 2) */}
      <div 
        onClick={() => setIsOpen(true)}
        className={`w-full flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all cursor-text text-xs bg-[#131b2e] ${
          isOpen 
            ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-lg shadow-blue-500/10' 
            : 'border-[#23314d] hover:border-slate-600'
        }`}
      >
        {/* Render Active Filter Chips inside Search Bar Input */}
        <div className="flex items-center gap-1.5 flex-wrap max-h-12 overflow-hidden">
          {activeChips.slice(0, 2).map(chip => (
            <span 
              key={chip.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-600/30 text-blue-300 border border-blue-500/40 text-[11px] font-semibold animate-fade-in"
            >
              <span>{chip.label}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  chip.onRemove();
                }}
                className="hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {activeChips.length > 2 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-600/30 text-purple-300 border border-purple-500/40 text-[11px] font-bold">
              and more {activeChips.length - 2}
            </span>
          )}
        </div>

        {/* Free Text Input Field */}
        <input
          type="text"
          value={filters.customerQuery}
          onChange={(e) => {
            handleFieldChange('customerQuery', e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={activeChips.length === 0 ? "Filter and search deals, reps, accounts..." : "search..."}
          className="flex-1 bg-transparent text-slate-100 placeholder-slate-400 focus:outline-none min-w-[120px] text-xs font-medium"
        />

        {/* Action Controls inside Search Bar */}
        <div className="flex items-center space-x-1 shrink-0 ml-auto text-slate-400">
          <Search className="w-4 h-4 text-slate-400" />

          {hasAnyFilterOrQuery && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onResetFilters();
              }}
              className="p-1 hover:text-white transition-colors"
              title="Clear all filters & search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 glass-panel rounded-2xl border border-slate-700 bg-[#0f172a]/98 shadow-2xl overflow-hidden z-[120] animate-fade-in text-xs">
          
          {/* Full Selectors & Filter Fields Form */}
          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
            
            {/* Field 1: Search Query */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Account or Customer Name
              </label>
              <input
                type="text"
                value={filters.customerQuery}
                onChange={(e) => handleFieldChange('customerQuery', e.target.value)}
                placeholder="Type customer or deal name..."
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
              />

              {/* Suggestions */}
              {companySuggestions.length > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-500">Suggestions:</span>
                  {companySuggestions.map(comp => (
                    <button
                      key={comp}
                      type="button"
                      onClick={() => handleFieldChange('customerQuery', comp)}
                      className="px-2 py-0.5 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[10px] font-semibold border border-blue-500/20"
                    >
                      {comp}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Field 2: Sales Representative / Responsible Person */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-indigo-400" /> Responsible person (Sales Owner)
                </label>
                <select
                  value={filters.salesRep}
                  onChange={(e) => handleFieldChange('salesRep', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500 text-xs font-semibold"
                >
                  <option value="All">All Sales Reps</option>
                  {salesReps.map(rep => (
                    <option key={rep} value={rep}>{rep}</option>
                  ))}
                </select>
              </div>

              {/* Pipeline Stage */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-rose-400" /> Deal Stage / Group
                </label>
                <select
                  value={filters.pipelineStage}
                  onChange={(e) => handleFieldChange('pipelineStage', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500 text-xs font-semibold"
                >
                  <option value="All">All Stages</option>
                  {stages.map(stg => (
                    <option key={stg} value={stg}>{stg}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Industry & Solution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-emerald-400" /> Industry Sector
                </label>
                <select
                  value={filters.industry}
                  onChange={(e) => handleFieldChange('industry', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500 text-xs font-semibold"
                >
                  <option value="All">All Industries</option>
                  {industries.map(ind => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-purple-400" /> Solution Package
                </label>
                <select
                  value={filters.solution}
                  onChange={(e) => handleFieldChange('solution', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500 text-xs font-semibold"
                >
                  <option value="All">All Solutions</option>
                  {solutions.map(sol => (
                    <option key={sol} value={sol}>{sol}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Lead Source */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-amber-400" /> Lead Source
              </label>
              <select
                value={filters.leadSource}
                onChange={(e) => handleFieldChange('leadSource', e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500 text-xs font-semibold"
              >
                <option value="All">All Lead Sources</option>
                {leadSources.map(src => (
                  <option key={src} value={src}>{src}</option>
                ))}
              </select>
            </div>

            {/* Date Filters Section */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" /> Created / Updated Date Period
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">Start Date</span>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleFieldChange('startDate', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">End Date</span>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => handleFieldChange('endDate', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">Specific Month</span>
                  <select
                    value={filters.selectedMonth}
                    onChange={(e) => handleFieldChange('selectedMonth', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs font-semibold"
                  >
                    <option value="All">Any Month</option>
                    {uniqueMonths.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">Specific Year</span>
                  <select
                    value={filters.selectedYear}
                    onChange={(e) => handleFieldChange('selectedYear', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs font-semibold"
                  >
                    <option value="All">Any Year</option>
                    {uniqueYears.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Bottom Action Footer (Matching Image 1 Search & Reset buttons) */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onResetFilters}
                className="flex items-center space-x-1.5 text-slate-400 hover:text-white transition-colors text-xs font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all flex items-center space-x-2"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Apply Search</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default ExecutiveHeaderSearchBar;
