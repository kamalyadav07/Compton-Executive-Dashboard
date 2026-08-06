import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Calendar, Package, User, Building2, RotateCcw, Share2 } from 'lucide-react';

interface OperationalHeaderSearchBarProps {
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  dateFilter: string;
  onDateFilterChange: (d: string) => void;
  startDate?: string;
  onStartDateChange?: (d: string) => void;
  endDate?: string;
  onEndDateChange?: (d: string) => void;
  tableFilter: 'All' | 'Billed' | 'Unbilled';
  onTableFilterChange: (s: 'All' | 'Billed' | 'Unbilled') => void;
  repFilter: string;
  onRepFilterChange: (r: string) => void;
  sourceFilter?: string;
  onSourceFilterChange?: (s: string) => void;
  companyFilter?: string;
  onCompanyFilterChange?: (c: string) => void;
  onResetFilters: () => void;
  allRecords?: any[];
}

export const OperationalHeaderSearchBar: React.FC<OperationalHeaderSearchBarProps> = ({
  searchQuery,
  onSearchQueryChange,
  dateFilter,
  onDateFilterChange,
  startDate = '',
  onStartDateChange = () => { },
  endDate = '',
  onEndDateChange = () => { },
  tableFilter,
  onTableFilterChange,
  repFilter,
  onRepFilterChange,
  sourceFilter = 'All',
  onSourceFilterChange = () => { },
  companyFilter = 'All',
  onCompanyFilterChange = () => { },
  onResetFilters,
  allRecords = []
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Company Search State
  const [companySearchText, setCompanySearchText] = useState('');
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsCompanyDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setIsCompanyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Chronological month-year sorting helper
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

  const monthYearList = useMemo(() => {
    const set = new Set<string>();
    const defaults = [
      'Jul 2026', 'Jun 2026', 'May 2026', 'Apr 2026', 'Mar 2026', 'Feb 2026', 'Jan 2026',
      'Dec 2025', 'Nov 2025', 'Oct 2025', 'Sep 2025', 'Aug 2025', 'Jul 2025', 'Jun 2025'
    ];
    defaults.forEach(m => set.add(m));

    allRecords.forEach(r => {
      if (r.monthYear) set.add(r.monthYear);
    });

    return Array.from(set).filter(Boolean).sort((a, b) => getMonthYearTime(b) - getMonthYearTime(a));
  }, [allRecords]);

  // Extract unique lead sources from records
  const leadSources = useMemo(() => {
    const set = new Set<string>();
    allRecords.forEach(r => {
      if (r.leadSource) set.add(r.leadSource);
      if (r.source) set.add(r.source);
    });
    const defaultSources = ['Bitrix24 CRM', 'Direct Call', 'Website', 'Referral', 'Cold Call', 'Partner', 'Email Campaign'];
    defaultSources.forEach(s => set.add(s));
    return Array.from(set).filter(Boolean).sort();
  }, [allRecords]);

  // Extract unique company/customer names from records
  const companyList = useMemo(() => {
    const set = new Set<string>();
    allRecords.forEach(r => {
      if (r.customer) set.add(r.customer);
      if (r.customerName) set.add(r.customerName);
      if (r.company) set.add(r.company);
    });
    return Array.from(set).filter(Boolean).sort();
  }, [allRecords]);

  // Filtered company suggestions for company search input
  const filteredCompanySuggestions = useMemo(() => {
    if (!companySearchText.trim()) return companyList.slice(0, 8);
    const q = companySearchText.toLowerCase();
    return companyList.filter(c => c.toLowerCase().includes(q)).slice(0, 10);
  }, [companySearchText, companyList]);

  const hasActiveFilters =
    searchQuery !== '' ||
    dateFilter !== 'All Dates' ||
    startDate !== '' ||
    endDate !== '' ||
    tableFilter !== 'All' ||
    repFilter !== 'All' ||
    sourceFilter !== 'All' ||
    companyFilter !== 'All';

  return (
    <div ref={containerRef} className="relative w-full max-w-xl lg:max-w-2xl mx-auto z-50">
      
      {/* Top Header Search Input Bar */}
      <div
        onClick={() => setIsOpen(true)}
        className={`w-full flex items-center gap-2 px-3.5 py-1.5 rounded-xl border transition-all cursor-text text-xs bg-[#0c1322] shadow-inner ${
          isOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-[#202d46] hover:border-slate-600'
        }`}
      >
        {/* Active Filter Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {companyFilter !== 'All' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-600/30 text-rose-300 border border-rose-500/40 text-[11px] font-semibold">
              <span>Account: {companyFilter}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); onCompanyFilterChange('All'); setCompanySearchText(''); }} className="hover:text-white"><X className="w-3 h-3" /></button>
            </span>
          )}
          {repFilter !== 'All' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-[11px] font-semibold">
              <span>Rep: {repFilter}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); onRepFilterChange('All'); }} className="hover:text-white"><X className="w-3 h-3" /></button>
            </span>
          )}
          {tableFilter !== 'All' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-600/30 text-purple-300 border border-purple-500/40 text-[11px] font-semibold">
              <span>Status: {tableFilter}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); onTableFilterChange('All'); }} className="hover:text-white"><X className="w-3 h-3" /></button>
            </span>
          )}
          {sourceFilter !== 'All' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-[11px] font-semibold">
              <span>Source: {sourceFilter}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); onSourceFilterChange('All'); }} className="hover:text-white"><X className="w-3 h-3" /></button>
            </span>
          )}
          {dateFilter !== 'All Dates' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold">
              <span>Date: {dateFilter}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); onDateFilterChange('All Dates'); }} className="hover:text-white"><X className="w-3 h-3" /></button>
            </span>
          )}
          {startDate && endDate && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-600/30 text-teal-300 border border-teal-500/40 text-[11px] font-semibold">
              <span>{startDate} to {endDate}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); onStartDateChange(''); onEndDateChange(''); }} className="hover:text-white"><X className="w-3 h-3" /></button>
            </span>
          )}
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            onSearchQueryChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={hasActiveFilters ? "" : "Filter and search deals, reps, accounts..."}
          className="flex-1 bg-transparent text-slate-100 placeholder-slate-400 focus:outline-none min-w-[120px] text-xs font-medium py-1"
        />

        <div className="flex items-center space-x-1.5 shrink-0 ml-auto text-slate-400">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onResetFilters();
                setCompanySearchText('');
              }}
              className="p-1 text-slate-400 hover:text-white transition-colors"
              title="Reset all filters"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <Search className="w-4 h-4 text-slate-400" />
        </div>
      </div>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2.5 rounded-2xl border border-[#233352] bg-[#0c1427]/98 backdrop-blur-xl shadow-[0_30px_70px_-15px_rgba(0,0,0,0.95)] overflow-hidden z-[150] animate-fade-in text-slate-100 p-5 space-y-4">
          
          {/* TOP SECTION: Company Search Bar (Replaces old header title) */}
          <div className="relative space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 tracking-wide flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-rose-400" /> Account or Customer Name
              </label>
              <button 
                type="button" 
                onClick={() => setIsOpen(false)} 
                className="text-slate-400 hover:text-white p-1 transition-colors"
                title="Close filter panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={companyFilter !== 'All' ? companyFilter : companySearchText}
                onChange={e => {
                  setCompanySearchText(e.target.value);
                  if (companyFilter !== 'All') onCompanyFilterChange('All');
                  onSearchQueryChange(e.target.value);
                  setIsCompanyDropdownOpen(true);
                }}
                onFocus={() => setIsCompanyDropdownOpen(true)}
                placeholder="Type customer or deal name to search and select..."
                className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-[#141e33] border border-[#243454] text-slate-100 text-xs md:text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all font-semibold shadow-inner"
              />

              {(companyFilter !== 'All' || companySearchText) && (
                <button
                  type="button"
                  onClick={() => {
                    onCompanyFilterChange('All');
                    setCompanySearchText('');
                    onSearchQueryChange('');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Autocomplete Company Suggestions Dropdown */}
            {isCompanyDropdownOpen && filteredCompanySuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-[#131b2e] border border-slate-700 rounded-xl shadow-2xl z-[160] max-h-48 overflow-y-auto custom-scrollbar p-1.5">
                <div
                  onClick={() => {
                    onCompanyFilterChange('All');
                    setCompanySearchText('');
                    setIsCompanyDropdownOpen(false);
                  }}
                  className="px-3 py-2 text-xs text-slate-400 hover:bg-blue-600/20 hover:text-blue-300 rounded-lg cursor-pointer font-bold"
                >
                  All Companies
                </div>
                {filteredCompanySuggestions.map(comp => (
                  <div
                    key={comp}
                    onClick={() => {
                      onCompanyFilterChange(comp);
                      setCompanySearchText('');
                      setIsCompanyDropdownOpen(false);
                    }}
                    className={`px-3 py-2 text-xs rounded-lg cursor-pointer transition-colors ${
                      companyFilter === comp
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {comp}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SELECTORS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            {/* Responsible Person */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <User className="w-4 h-4 text-indigo-400" /> Responsible person (Sales Owner)
              </label>
              <select
                value={repFilter}
                onChange={e => onRepFilterChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#141e33] border border-[#243454] text-slate-100 text-xs md:text-sm focus:outline-none focus:border-blue-500 font-semibold cursor-pointer"
              >
                <option value="All">All Sales Reps</option>
                <option value="Jitesh Chander">Jitesh Chander</option>
                <option value="Sandeep Vahi">Sandeep Vahi</option>
                <option value="Rohit Yadav">Rohit Yadav</option>
                <option value="Taniya Negi">Taniya Negi</option>
                <option value="Tausif Ahmad">Tausif Ahmad</option>
                <option value="Ashok Kumar">Ashok Kumar</option>
              </select>
            </div>

            {/* Billing Status */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-purple-400" /> Billing Status
              </label>
              <select
                value={tableFilter}
                onChange={e => onTableFilterChange(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#141e33] border border-[#243454] text-slate-100 text-xs md:text-sm focus:outline-none focus:border-blue-500 font-semibold cursor-pointer"
              >
                <option value="All">All Billing Statuses</option>
                <option value="Billed">Billed</option>
                <option value="Unbilled">Unbilled</option>
              </select>
            </div>
          </div>

          {/* Lead Source */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Share2 className="w-4 h-4 text-cyan-400" /> Lead Source
            </label>
            <select
              value={sourceFilter}
              onChange={e => onSourceFilterChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#141e33] border border-[#243454] text-slate-100 text-xs md:text-sm focus:outline-none focus:border-blue-500 font-semibold cursor-pointer"
            >
              <option value="All">All Lead Sources</option>
              {leadSources.map(src => (
                <option key={src} value={src}>{src}</option>
              ))}
            </select>
          </div>

          {/* DATE PERIOD SECTION */}
          <div className="pt-2 border-t border-[#1a263d] space-y-2">
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-400" /> CREATED / UPDATED DATE PERIOD
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Start Date */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block">Start Date</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => {
                    onStartDateChange(e.target.value);
                    onDateFilterChange('Custom Range');
                  }}
                  className="w-full px-2.5 py-2 rounded-xl bg-[#141e33] border border-[#243454] text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              {/* End Date */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block">End Date</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => {
                    onEndDateChange(e.target.value);
                    onDateFilterChange('Custom Range');
                  }}
                  className="w-full px-2.5 py-2 rounded-xl bg-[#141e33] border border-[#243454] text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              {/* Month & Year Combined Selector */}
              <div className="space-y-1 sm:col-span-2">
                <span className="text-[10px] text-slate-400 font-bold block">Specific Month & Year</span>
                <select
                  value={dateFilter}
                  onChange={e => onDateFilterChange(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-[#141e33] border border-[#243454] text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-semibold cursor-pointer"
                >
                  <option value="All Dates">All Months & Years</option>
                  <optgroup label="Single Month & Year">
                    {monthYearList.map(my => (
                      <option key={my} value={my}>{my}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Whole Year">
                    <option value="2026">Year 2026</option>
                    <option value="2025">Year 2025</option>
                    <option value="2024">Year 2024</option>
                  </optgroup>
                </select>
              </div>
            </div>
          </div>

          {/* BOTTOM ACTION BAR */}
          <div className="pt-3 border-t border-[#1a263d] flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onResetFilters();
                onStartDateChange('');
                onEndDateChange('');
                setCompanySearchText('');
              }}
              className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs font-semibold transition-colors py-2 px-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-6 py-2.5 rounded-xl bg-[#1d6bf3] hover:bg-blue-600 text-white text-xs md:text-sm font-bold shadow-lg shadow-blue-500/25 active:scale-95 transition-all flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              <span>Apply Search</span>
            </button>
          </div>

        </div>
      )}
    </div>
  );
};
