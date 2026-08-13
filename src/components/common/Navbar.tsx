import React, { useState, useEffect } from 'react';
import { 
  Maximize,
  Minimize
} from 'lucide-react';
import type { GlobalFilterState, DealRecord } from '../../types/sales';
import { ExecutiveHeaderSearchBar } from './ExecutiveHeaderSearchBar';
import { OperationalHeaderSearchBar } from './OperationalHeaderSearchBar';
import { ProjectHeaderSearchBar } from './ProjectHeaderSearchBar';
import type { ProjectFilterState, ProjectRecord } from '../../types/project';

interface NavbarProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onOpenChatbot: () => void;
  hasData: boolean;
  activeDashboardId?: string;
  filters?: GlobalFilterState;
  onFilterChange?: (newFilters: GlobalFilterState) => void;
  onResetFilters?: () => void;
  allRecords?: DealRecord[];
  opSearchQuery?: string;
  onOpSearchQueryChange?: (q: string) => void;
  opDateFilter?: string;
  onOpDateFilterChange?: (d: string) => void;
  opStartDate?: string;
  onOpStartDateChange?: (d: string) => void;
  opEndDate?: string;
  onOpEndDateChange?: (d: string) => void;
  opTableFilter?: 'All' | 'Billed' | 'Unbilled';
  onOpTableFilterChange?: (s: 'All' | 'Billed' | 'Unbilled') => void;
  opRepFilter?: string;
  onOpRepFilterChange?: (r: string) => void;
  opSourceFilter?: string;
  onOpSourceFilterChange?: (s: string) => void;
  opCompanyFilter?: string;
  onOpCompanyFilterChange?: (c: string) => void;
  onResetOpFilters?: () => void;
  projectFilters?: ProjectFilterState;
  onProjectFilterChange?: (newFilters: ProjectFilterState) => void;
  onResetProjectFilters?: () => void;
  allProjects?: ProjectRecord[];
}

export const Navbar: React.FC<NavbarProps> = ({
  isDarkMode: _isDarkMode,
  onToggleTheme: _onToggleTheme,
  onOpenChatbot,
  activeDashboardId,
  filters,
  onFilterChange,
  onResetFilters,
  allRecords = [],
  opSearchQuery,
  onOpSearchQueryChange,
  opDateFilter,
  onOpDateFilterChange,
  opStartDate,
  onOpStartDateChange,
  opEndDate,
  onOpEndDateChange,
  opTableFilter,
  onOpTableFilterChange,
  opRepFilter,
  onOpRepFilterChange,
  opSourceFilter,
  onOpSourceFilterChange,
  opCompanyFilter,
  onOpCompanyFilterChange,
  onResetOpFilters,
  projectFilters,
  onProjectFilterChange,
  onResetProjectFilters,
  allProjects = []
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <header className="h-16 w-full border-b border-[#1b2539] bg-[#0c1222] px-4 md:px-6 flex items-center justify-between gap-4 z-40 shrink-0 select-none">
      
      {/* 1. Left: Compton Dashboard Header Title */}
      <div className="flex items-center space-x-3 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-white/95 p-1 shadow-md flex items-center justify-center overflow-hidden border border-slate-700/50 hover:scale-105 transition-transform duration-200">
          <img src="/compton-logo.png" alt="Compton Logo" className="w-full h-full object-contain rounded" />
        </div>
        <h1 className="text-sm md:text-base font-black tracking-tight text-white hidden sm:block">
          Compton Dashboard
        </h1>
      </div>

      {/* 2. Center: Executive Search Bar (for Deal Dashboard) or Operational Search Bar (for Sales Dashboard) */}
      {activeDashboardId === 'deal' && filters && onFilterChange && onResetFilters && (
        <div className="flex-1 max-w-2xl px-2">
          <ExecutiveHeaderSearchBar
            filters={filters}
            onFilterChange={onFilterChange}
            onResetFilters={onResetFilters}
            allRecords={allRecords}
          />
        </div>
      )}

      {activeDashboardId === 'sales' && opSearchQuery !== undefined && (
        <div className="flex-1 max-w-2xl px-2">
          <OperationalHeaderSearchBar
            searchQuery={opSearchQuery}
            onSearchQueryChange={onOpSearchQueryChange || (() => {})}
            dateFilter={opDateFilter || 'All Dates'}
            onDateFilterChange={onOpDateFilterChange || (() => {})}
            startDate={opStartDate || ''}
            onStartDateChange={onOpStartDateChange || (() => {})}
            endDate={opEndDate || ''}
            onEndDateChange={onOpEndDateChange || (() => {})}
            tableFilter={opTableFilter || 'All'}
            onTableFilterChange={onOpTableFilterChange || (() => {})}
            repFilter={opRepFilter || 'All'}
            onRepFilterChange={onOpRepFilterChange || (() => {})}
            sourceFilter={opSourceFilter || 'All'}
            onSourceFilterChange={onOpSourceFilterChange || (() => {})}
            companyFilter={opCompanyFilter || 'All'}
            onCompanyFilterChange={onOpCompanyFilterChange || (() => {})}
            onResetFilters={onResetOpFilters || (() => {})}
            allRecords={allRecords}
          />
        </div>
      )}

      {activeDashboardId === 'project' && projectFilters && onProjectFilterChange && onResetProjectFilters && (
        <div className="flex-1 max-w-2xl px-2">
          <ProjectHeaderSearchBar
            filters={projectFilters}
            onFilterChange={onProjectFilterChange}
            onResetFilters={onResetProjectFilters}
            allProjects={allProjects}
          />
        </div>
      )}

      {/* 3. Right Action Group */}
      <div className="flex items-center space-x-2 md:space-x-3">
        
        {/* 1st: Assistant Button */}
        <button
          onClick={onOpenChatbot}
          className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all active:scale-95 border border-blue-400/30"
        >
          <span>Your Assistant</span>
        </button>



        {/* 3rd: Full Screen Toggle Button */}
        <button
          onClick={toggleFullscreen}
          className="p-2 rounded-xl bg-[#151c2e] hover:bg-[#1f2d4a] text-slate-300 hover:text-white border border-[#222d46] relative transition-all"
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          {isFullscreen ? (
            <Minimize className="w-4 h-4 text-cyan-400" />
          ) : (
            <Maximize className="w-4 h-4 text-slate-300" />
          )}
        </button>
      </div>

    </header>
  );
};

export default Navbar;
