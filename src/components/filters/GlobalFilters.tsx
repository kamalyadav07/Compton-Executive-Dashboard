import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  RotateCcw, 
  Search, 
  User, 
  Briefcase, 
  Layers, 
  Globe, 
  Sliders,
  Calendar,
  Clock,
  Building2,
  X
} from 'lucide-react';
import type { GlobalFilterState, DealRecord } from '../../types/sales';

interface GlobalFiltersProps {
  filters: GlobalFilterState;
  onFilterChange: (newFilters: GlobalFilterState) => void;
  onResetFilters: () => void;
  allRecords: DealRecord[];
}

export const GlobalFilters: React.FC<GlobalFiltersProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  allRecords
}) => {
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const ALLOWED_REPS = ['Ashok Kumar', 'Jitesh Chander', 'Rohit Yadav', 'Sandeep Vahi', 'Taniya Negi', 'Tausif Ahmad'];
  const salesReps = useMemo(() => {
    const set = new Set(allRecords.map(r => r.salesRep));
    return ALLOWED_REPS.filter(r => set.has(r) || true);
  }, [allRecords]);
  const industries = useMemo(() => Array.from(new Set(allRecords.map(r => r.industry))).filter(Boolean).sort(), [allRecords]);
  const solutions = useMemo(() => Array.from(new Set(allRecords.map(r => r.solution))).filter(Boolean).sort(), [allRecords]);
  const leadSources = useMemo(() => Array.from(new Set(allRecords.map(r => r.leadSource))).filter(Boolean).sort(), [allRecords]);
  const stages = useMemo(() => Array.from(new Set(allRecords.map(r => r.stage))).filter(Boolean).sort(), [allRecords]);

  // Extract unique company & customer names with deal counts for suggestions
  const companySuggestionsMap = useMemo(() => {
    const map = new Map<string, number>();
    allRecords.forEach(r => {
      const name = r.customer?.trim();
      if (name) {
        map.set(name, (map.get(name) || 0) + 1);
      }
    });
    return map;
  }, [allRecords]);

  const uniqueCompanies = useMemo(() => {
    return Array.from(companySuggestionsMap.keys()).sort();
  }, [companySuggestionsMap]);

  // Filter matching suggestions based on search text
  const filteredSuggestions = useMemo(() => {
    if (!filters.customerQuery.trim()) return [];
    const q = filters.customerQuery.toLowerCase().trim();
    return uniqueCompanies.filter(c => c.toLowerCase().includes(q)).slice(0, 8);
  }, [filters.customerQuery, uniqueCompanies]);

  // Click outside listener to close suggestion list
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSuggestionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to parse Month-Year strings into timestamp for chronological sorting
  const monthMap: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };

  const getMonthYearTime = (str: string): number => {
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

  // Dynamic Real-Time Month & Year calculation
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth();

  const fullMonthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const shortMonthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const currentShortMonthStr = `${shortMonthNames[currentMonthIdx]} ${currentYear}`;

  const allMonthSet = new Set([currentShortMonthStr, ...allRecords.map(r => r.monthYear)]);
  const uniqueMonths = Array.from(allMonthSet)
    .filter(Boolean)
    .sort((a, b) => getMonthYearTime(b) - getMonthYearTime(a));

  const allYearSet = new Set([String(currentYear), ...allRecords.map(r => String(r.year))]);
  const uniqueYears = Array.from(allYearSet)
    .filter(Boolean)
    .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));

  // Current Month
  const thisMonthName = `${fullMonthNames[currentMonthIdx]} ${currentYear}`;
  const thisMonthStart = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}-01`;
  const lastDayThisMonth = new Date(currentYear, currentMonthIdx + 1, 0).getDate();
  const thisMonthEnd = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}-${String(lastDayThisMonth).padStart(2, '0')}`;

  // Previous Month
  const lastMonthDate = new Date(currentYear, currentMonthIdx - 1, 1);
  const lastMonthYear = lastMonthDate.getFullYear();
  const lastMonthIdx = lastMonthDate.getMonth();
  const lastMonthName = `${fullMonthNames[lastMonthIdx]} ${lastMonthYear}`;
  const lastMonthStart = `${lastMonthYear}-${String(lastMonthIdx + 1).padStart(2, '0')}-01`;
  const lastDayLastMonth = new Date(lastMonthYear, lastMonthIdx + 1, 0).getDate();
  const lastMonthEnd = `${lastMonthYear}-${String(lastMonthIdx + 1).padStart(2, '0')}-${String(lastDayLastMonth).padStart(2, '0')}`;

  // Current Year
  const thisYearStart = `${currentYear}-01-01`;
  const thisYearEnd = `${currentYear}-12-31`;

  const handleFieldChange = (key: keyof GlobalFilterState, value: any) => {
    onFilterChange({
      ...filters,
      [key]: value
    });
  };

  // Dynamic Quick Date Preset Handlers
  const setQuickDatePreset = (preset: 'this_month' | 'last_month' | 'this_year' | 'all') => {
    if (preset === 'this_month') {
      onFilterChange({ 
        ...filters, 
        startDate: thisMonthStart, 
        endDate: thisMonthEnd, 
        selectedMonth: 'All', 
        selectedYear: 'All' 
      });
    } else if (preset === 'last_month') {
      onFilterChange({ 
        ...filters, 
        startDate: lastMonthStart, 
        endDate: lastMonthEnd, 
        selectedMonth: 'All', 
        selectedYear: 'All' 
      });
    } else if (preset === 'this_year') {
      onFilterChange({ 
        ...filters, 
        startDate: thisYearStart, 
        endDate: thisYearEnd, 
        selectedMonth: 'All', 
        selectedYear: 'All' 
      });
    } else {
      onFilterChange({ 
        ...filters, 
        startDate: '', 
        endDate: '', 
        selectedMonth: 'All', 
        selectedYear: 'All',
        selectedQuarter: 'All' 
      });
    }
  };

  const isThisMonthActive = filters.startDate === thisMonthStart && filters.endDate === thisMonthEnd;
  const isLastMonthActive = filters.startDate === lastMonthStart && filters.endDate === lastMonthEnd;
  const isYearActive = filters.startDate === thisYearStart && filters.endDate === thisYearEnd;
  const isAllTimeActive = !filters.startDate && !filters.endDate && filters.selectedMonth === 'All' && filters.selectedYear === 'All';

  const hasActiveFilters = 
    !isAllTimeActive ||
    filters.salesRep !== 'All' ||
    filters.industry !== 'All' ||
    filters.solution !== 'All' ||
    filters.leadSource !== 'All' ||
    filters.pipelineStage !== 'All' ||
    filters.customerQuery !== '';

  return (
    <div className="w-full glass-panel p-5 md:p-6 rounded-2xl border border-[var(--border-color)] shadow-lg mb-8 space-y-5">
      
      {/* Row 1: Search Bar & Preset Quick Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[var(--border-color)]">
        
        {/* Account / Customer Search Input with Autocomplete Suggestions */}
        <div ref={searchContainerRef} className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5 z-10" />
          <input
            type="text"
            value={filters.customerQuery}
            onChange={(e) => {
              handleFieldChange('customerQuery', e.target.value);
              setIsSuggestionsOpen(true);
            }}
            onFocus={() => setIsSuggestionsOpen(true)}
            placeholder="Search accounts, deal names, or companies..."
            className="w-full pl-9 pr-9 py-2 rounded-xl bg-[var(--bg-muted)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-blue-500 text-xs font-medium shadow-inner"
          />
          {filters.customerQuery && (
            <button
              onClick={() => {
                handleFieldChange('customerQuery', '');
                setIsSuggestionsOpen(false);
              }}
              className="absolute right-3 top-2.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors z-10"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Floating Autocomplete Suggestions List */}
          {isSuggestionsOpen && filteredSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 glass-panel border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-2xl rounded-xl overflow-hidden animate-fade-in max-h-64 overflow-y-auto">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-subtle)] bg-[var(--bg-muted)] flex items-center justify-between">
                <span>Matching Accounts & Companies</span>
                <span className="font-mono text-[9px]">{filteredSuggestions.length} found</span>
              </div>
              <div className="py-1">
                {filteredSuggestions.map((companyName) => {
                  const dealCount = companySuggestionsMap.get(companyName) || 0;
                  return (
                    <button
                      key={companyName}
                      type="button"
                      onClick={() => {
                        handleFieldChange('customerQuery', companyName);
                        setIsSuggestionsOpen(false);
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs hover:bg-[var(--bg-card-hover)] transition-colors flex items-center justify-between group"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0 group-hover:scale-110 transition-transform" />
                        <span className="font-semibold text-[var(--text-primary)] group-hover:text-blue-400 transition-colors truncate">
                          {companyName}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0 ml-2">
                        {dealCount} {dealCount === 1 ? 'deal' : 'deals'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Quick Date Range Preset Buttons */}
        <div className="flex items-center space-x-2 shrink-0">
          <span className="text-[11px] text-[var(--text-secondary)] font-semibold flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-emerald-400" /> Presets:
          </span>

          <button
            onClick={() => setQuickDatePreset('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              isAllTimeActive ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 border border-blue-400/40' : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)]'
            }`}
          >
            All Time
          </button>

          <button
            onClick={() => setQuickDatePreset('this_month')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              isThisMonthActive ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 border border-blue-400/40' : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)]'
            }`}
            title={`Filter deals for ${thisMonthName}`}
          >
            {thisMonthName}
          </button>

          <button
            onClick={() => setQuickDatePreset('last_month')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              isLastMonthActive ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 border border-blue-400/40' : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)]'
            }`}
            title={`Filter deals for ${lastMonthName}`}
          >
            {lastMonthName}
          </button>

          <button
            onClick={() => setQuickDatePreset('this_year')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              isYearActive ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 border border-blue-400/40' : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)]'
            }`}
          >
            Year {currentYear}
          </button>

          {hasActiveFilters && (
            <button
              onClick={onResetFilters}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all active:scale-95 ml-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Custom Date Selector & Period Selectors */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <Calendar className="w-3.5 h-3.5" /> Date Range & Period Filters
          </span>
          <span className="text-[var(--text-muted)] font-mono text-[10px] font-normal">Filter by custom start/end dates or specific month</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          {/* Custom Start Date */}
          <div>
            <label className="block text-[10px] font-semibold text-[var(--text-secondary)] mb-1">
              Start Date (From):
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFieldChange('startDate', e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-muted)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500 font-mono text-xs"
            />
          </div>

          {/* Custom End Date */}
          <div>
            <label className="block text-[10px] font-semibold text-[var(--text-secondary)] mb-1">
              End Date (To):
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFieldChange('endDate', e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-muted)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500 font-mono text-xs"
            />
          </div>

          {/* Specific Month Selector */}
          <div>
            <label className="block text-[10px] font-semibold text-[var(--text-secondary)] mb-1">
              Specific Month:
            </label>
            <select
              value={filters.selectedMonth}
              onChange={(e) => handleFieldChange('selectedMonth', e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-muted)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500 text-xs font-semibold"
            >
              <option value="All">All Months</option>
              {uniqueMonths.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Specific Year Selector */}
          <div>
            <label className="block text-[10px] font-semibold text-[var(--text-secondary)] mb-1">
              Specific Year:
            </label>
            <select
              value={filters.selectedYear}
              onChange={(e) => handleFieldChange('selectedYear', e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-muted)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500 text-xs font-semibold"
            >
              <option value="All">All Years</option>
              {uniqueYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Row 3: Business Dimension Dropdown Filters */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs pt-2 border-t border-[var(--border-color)]">
        
        {/* Sales Owner */}
        <div>
          <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1 flex items-center gap-1">
            <User className="w-3 h-3 text-indigo-400" /> Sales Owner
          </label>
          <select
            value={filters.salesRep}
            onChange={(e) => handleFieldChange('salesRep', e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-muted)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500 text-xs font-medium"
          >
            <option value="All">All Sales Reps</option>
            {salesReps.map(rep => (
              <option key={rep} value={rep}>{rep}</option>
            ))}
          </select>
        </div>

        {/* Industry Sector */}
        <div>
          <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1 flex items-center gap-1">
            <Briefcase className="w-3 h-3 text-emerald-400" /> Industry Sector
          </label>
          <select
            value={filters.industry}
            onChange={(e) => handleFieldChange('industry', e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-muted)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500 text-xs font-medium"
          >
            <option value="All">All Industries</option>
            {industries.map(ind => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>
        </div>

        {/* Solution Package */}
        <div>
          <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1 flex items-center gap-1">
            <Layers className="w-3 h-3 text-purple-400" /> Solution Package
          </label>
          <select
            value={filters.solution}
            onChange={(e) => handleFieldChange('solution', e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-muted)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500 text-xs font-medium"
          >
            <option value="All">All Solutions</option>
            {solutions.map(sol => (
              <option key={sol} value={sol}>{sol}</option>
            ))}
          </select>
        </div>

        {/* Lead Source */}
        <div>
          <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1 flex items-center gap-1">
            <Globe className="w-3 h-3 text-amber-400" /> Lead Source
          </label>
          <select
            value={filters.leadSource}
            onChange={(e) => handleFieldChange('leadSource', e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-muted)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500 text-xs font-medium"
          >
            <option value="All">All Lead Sources</option>
            {leadSources.map(src => (
              <option key={src} value={src}>{src}</option>
            ))}
          </select>
        </div>

        {/* Pipeline Stage */}
        <div>
          <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1 flex items-center gap-1">
            <Sliders className="w-3 h-3 text-rose-400" /> Pipeline Stage
          </label>
          <select
            value={filters.pipelineStage}
            onChange={(e) => handleFieldChange('pipelineStage', e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-muted)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500 text-xs font-medium"
          >
            <option value="All">All Stages</option>
            {stages.map(stg => (
              <option key={stg} value={stg}>{stg}</option>
            ))}
          </select>
        </div>

      </div>
    </div>
  );
};
