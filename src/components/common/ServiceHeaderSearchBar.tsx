import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Search, 
  X, 
  Calendar, 
  UserCheck, 
  Building2, 
  RotateCcw, 
  Check, 
  ChevronDown,
  Filter
} from 'lucide-react';

export interface EngineerOption {
  user_id?: number;
  name: string;
  specialization?: string;
  level?: string;
}

export interface CompanyOption {
  company_id?: number;
  company_name: string;
  total_tickets?: number;
}

export interface ServiceHeaderSearchBarProps {
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  dateFilter: string;
  onDateFilterChange: (d: string) => void;
  startDate?: string;
  onStartDateChange?: (d: string) => void;
  endDate?: string;
  onEndDateChange?: (d: string) => void;
  engineerFilter: string;
  onEngineerFilterChange: (e: string) => void;
  companyFilter: string;
  onCompanyFilterChange: (c: string) => void;
  onResetFilters: () => void;
  engineers?: EngineerOption[];
  companies?: CompanyOption[];
}

export const ServiceHeaderSearchBar: React.FC<ServiceHeaderSearchBarProps> = ({
  searchQuery,
  onSearchQueryChange,
  dateFilter,
  onDateFilterChange,
  startDate = '',
  onStartDateChange = () => {},
  endDate = '',
  onEndDateChange = () => {},
  engineerFilter,
  onEngineerFilterChange,
  companyFilter,
  onCompanyFilterChange,
  onResetFilters,
  engineers = [],
  companies = []
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Search inside company dropdown
  const [companySearchText, setCompanySearchText] = useState('');
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);

  // Close on outside click or ESC
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

  // Dynamic Month calculations (auto-updates when next month rolls over)
  const { thisMonthLabel, lastMonthLabel, nextMonthLabel, monthOptions } = useMemo(() => {
    const now = new Date();
    const currM = now.toLocaleString('default', { month: 'short' });
    const currY = now.getFullYear();
    const thisMonthLabel = `This Month (${currM} ${currY})`;

    const lastMDate = new Date(currY, now.getMonth() - 1, 1);
    const lastMLabel = `Last Month (${lastMDate.toLocaleString('default', { month: 'short' })} ${lastMDate.getFullYear()})`;

    const nextMDate = new Date(currY, now.getMonth() + 1, 1);
    const nextMLabel = `Next Month (${nextMDate.toLocaleString('default', { month: 'short' })} ${nextMDate.getFullYear()})`;

    const mList: string[] = [];
    for (let offset = -5; offset <= 3; offset++) {
      const d = new Date(currY, now.getMonth() + offset, 1);
      mList.push(`${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`);
    }

    return {
      thisMonthLabel,
      lastMonthLabel: lastMLabel,
      nextMonthLabel: nextMLabel,
      monthOptions: mList
    };
  }, []);

  // Preset Date Options
  const dateOptions = useMemo(() => [
    { id: 'month', label: thisMonthLabel },
    { id: 'last_month', label: lastMonthLabel },
    { id: 'next_month', label: nextMonthLabel },
    { id: '15days', label: 'Last 15 Days' },
    { id: '30days', label: 'Last 30 Days' },
    { id: 'all', label: 'All Time' }
  ], [thisMonthLabel, lastMonthLabel, nextMonthLabel]);

  // Default Engineers if not yet loaded from DB
  const defaultEngineers: EngineerOption[] = [
    { user_id: 445, name: 'Kunal Grover', specialization: 'Server, Cloud', level: 'Level 3' },
    { user_id: 467, name: 'Praveen Singh', specialization: 'Hardware, Laptop', level: 'Level 1' },
    { user_id: 387, name: 'Shyam', specialization: 'CCTV, VC Mic', level: 'Level 1' },
    { user_id: 489, name: 'Saif Ali Khan', specialization: 'Firewall, Storage', level: 'Level 2' }
  ];

  const displayEngineers: EngineerOption[] = useMemo(() => {
    if (engineers && engineers.length > 0) {
      return engineers;
    }
    return defaultEngineers;
  }, [engineers]);

  // Default Companies if not yet loaded
  const defaultCompanies: CompanyOption[] = [
    { company_id: 225, company_name: 'Capri Global Capital Limited', total_tickets: 184 },
    { company_id: 226, company_name: 'Compton Enterprise', total_tickets: 95 },
    { company_id: 227, company_name: 'FinTech Logistics Ltd', total_tickets: 62 },
    { company_id: 228, company_name: 'Apex Infrastructure', total_tickets: 48 },
    { company_id: 229, company_name: 'Nexus Technologies', total_tickets: 35 }
  ];

  const displayCompanies: CompanyOption[] = useMemo(() => {
    if (companies && companies.length > 0) {
      return companies;
    }
    return defaultCompanies;
  }, [companies]);

  // Filtered Company Suggestions
  const filteredCompanies = useMemo(() => {
    if (!companySearchText.trim()) return displayCompanies;
    const q = companySearchText.toLowerCase();
    return displayCompanies.filter(c => c.company_name.toLowerCase().includes(q));
  }, [companySearchText, displayCompanies]);

  const hasActiveFilters = 
    searchQuery !== '' ||
    (dateFilter !== 'month' && dateFilter !== 'all') ||
    startDate !== '' ||
    endDate !== '' ||
    engineerFilter !== 'All' ||
    companyFilter !== 'All';

  const getDateFilterLabel = (id: string) => {
    const found = dateOptions.find(o => o.id === id);
    return found ? found.label : id;
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xl lg:max-w-2xl mx-auto z-50">
      {/* Top Header Search Input Bar */}
      <div
        onClick={() => setIsOpen(true)}
        className={`w-full flex items-center gap-2 px-3.5 py-1.5 rounded-xl border transition-all cursor-text text-xs bg-[#0c1322] shadow-inner ${
          isOpen ? 'border-teal-500 ring-2 ring-teal-500/20' : 'border-[#202d46] hover:border-slate-600'
        }`}
      >
        {/* Active Filter Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {companyFilter !== 'All' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-600/30 text-rose-300 border border-rose-500/40 text-[11px] font-semibold">
              <Building2 className="w-3 h-3 text-rose-400" />
              <span>{companyFilter}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCompanyFilterChange('All');
                  setCompanySearchText('');
                }}
                className="hover:text-white ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {engineerFilter !== 'All' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-[11px] font-semibold">
              <UserCheck className="w-3 h-3 text-indigo-400" />
              <span>{engineerFilter}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEngineerFilterChange('All');
                }}
                className="hover:text-white ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {dateFilter && dateFilter !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold">
              <Calendar className="w-3 h-3 text-emerald-400" />
              <span>{getDateFilterLabel(dateFilter)}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDateFilterChange('all');
                }}
                className="hover:text-white ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {startDate && endDate && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-600/30 text-teal-300 border border-teal-500/40 text-[11px] font-semibold">
              <Calendar className="w-3 h-3 text-teal-400" />
              <span>{startDate} to {endDate}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartDateChange('');
                  onEndDateChange('');
                }}
                className="hover:text-white ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
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
          placeholder={hasActiveFilters ? "" : "Search tickets, engineers, client companies..."}
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
          
          {/* Header & Close */}
          <div className="flex items-center justify-between border-b border-[#1e2a44] pb-3">
            <div className="flex items-center space-x-2 text-teal-400 font-bold text-xs">
              <Filter className="w-4 h-4" />
              <span>Service Telemetry & Ticket Filters</span>
            </div>
            <button 
              type="button" 
              onClick={() => setIsOpen(false)} 
              className="text-slate-400 hover:text-white p-1 transition-colors"
              title="Close filter panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 1. SELECT COMPANY FILTER */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-200 tracking-wide flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-rose-400" /> Select Company Filter
              </span>
              {companyFilter !== 'All' && (
                <button
                  type="button"
                  onClick={() => {
                    onCompanyFilterChange('All');
                    setCompanySearchText('');
                  }}
                  className="text-[11px] text-rose-400 hover:underline font-normal"
                >
                  Clear company
                </button>
              )}
            </label>

            <div className="relative">
              <div 
                onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#141e33] border border-[#243454] text-xs font-semibold cursor-pointer hover:border-slate-500 transition-colors"
              >
                <div className="flex items-center space-x-2 truncate">
                  <span className={companyFilter === 'All' ? 'text-slate-400' : 'text-rose-300'}>
                    {companyFilter === 'All' ? 'All Client Companies' : companyFilter}
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              </div>

              {isCompanyDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 rounded-xl bg-[#0e1628] border border-[#293b5e] shadow-2xl p-2 z-50 max-h-56 overflow-y-auto space-y-1">
                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={companySearchText}
                      onChange={(e) => setCompanySearchText(e.target.value)}
                      placeholder="Search company name..."
                      className="w-full pl-8 pr-2 py-1.5 rounded-lg bg-[#18233c] border border-slate-700 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-rose-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onCompanyFilterChange('All');
                      setIsCompanyDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                      companyFilter === 'All' ? 'bg-rose-500/20 text-rose-300 font-bold' : 'text-slate-300 hover:bg-[#1a2642]'
                    }`}
                  >
                    <span>All Companies</span>
                    {companyFilter === 'All' && <Check className="w-3.5 h-3.5 text-rose-400" />}
                  </button>

                  {filteredCompanies.map((c, idx) => (
                    <button
                      key={c.company_id || idx}
                      type="button"
                      onClick={() => {
                        onCompanyFilterChange(c.company_name);
                        setIsCompanyDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                        companyFilter === c.company_name ? 'bg-rose-500/20 text-rose-300 font-bold' : 'text-slate-300 hover:bg-[#1a2642]'
                      }`}
                    >
                      <span className="truncate">{c.company_name}</span>
                      {companyFilter === c.company_name && <Check className="w-3.5 h-3.5 text-rose-400 shrink-0 ml-1" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2. ACTIVE ENGINEER FILTER */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 tracking-wide flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-indigo-400" /> Active Engineer Filter
              </label>
              {engineerFilter !== 'All' && (
                <button
                  type="button"
                  onClick={() => onEngineerFilterChange('All')}
                  className="text-[11px] text-indigo-400 hover:underline font-normal"
                >
                  Clear engineer
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onEngineerFilterChange('All')}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all text-left ${
                  engineerFilter === 'All'
                    ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/60 shadow-sm'
                    : 'bg-[#141e33] text-slate-300 border-[#243454] hover:border-slate-500'
                }`}
              >
                <span>All Engineers</span>
                {engineerFilter === 'All' && <Check className="w-3.5 h-3.5 text-indigo-400" />}
              </button>

              {displayEngineers.slice(0, 5).map((eng, idx) => (
                <button
                  key={eng.user_id || idx}
                  type="button"
                  onClick={() => onEngineerFilterChange(eng.name)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all text-left truncate ${
                    engineerFilter === eng.name
                      ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/60 shadow-sm'
                      : 'bg-[#141e33] text-slate-300 border-[#243454] hover:border-slate-500'
                  }`}
                  title={`${eng.name} (${eng.specialization || eng.level || 'Engineer'})`}
                >
                  <span className="truncate">{eng.name}</span>
                  {engineerFilter === eng.name && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 ml-1" />}
                </button>
              ))}
            </div>
          </div>

          {/* 3. DATE FILTER */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 tracking-wide flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-400" /> Date Filter
              </label>
              {dateFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => onDateFilterChange('all')}
                  className="text-[11px] text-emerald-400 hover:underline font-normal"
                >
                  Reset to All Time
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {dateOptions.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onDateFilterChange(opt.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all ${
                    dateFilter === opt.id
                      ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/60 shadow-sm'
                      : 'bg-[#141e33] text-slate-300 border-[#243454] hover:border-slate-500'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {dateFilter === opt.id && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1" />}
                </button>
              ))}
            </div>

            {/* Select Specific Month dropdown */}
            <div className="mt-2 pt-2 border-t border-[#1e2a44] flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400 shrink-0 font-medium">Specific Month:</span>
              <select
                value={monthOptions.includes(dateFilter) ? dateFilter : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    onDateFilterChange(e.target.value);
                  }
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#141e33] border border-[#243454] text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-medium"
              >
                <option value="" disabled>Select Month &amp; Year...</option>
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Date Range Picker Inputs */}
            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-[#1e2a44]">
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">From Date:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => onStartDateChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#141e33] border border-[#243454] text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">To Date:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => onEndDateChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#141e33] border border-[#243454] text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons: Reset & Apply */}
          <div className="pt-3 border-t border-[#1e2a44] flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onResetFilters();
                setCompanySearchText('');
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-[#141e33] hover:bg-[#1a2742] border border-[#243454] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All Filters</span>
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-md shadow-teal-500/20 transition-all active:scale-95"
            >
              Done
            </button>
          </div>

        </div>
      )}
    </div>
  );
};

export default ServiceHeaderSearchBar;
