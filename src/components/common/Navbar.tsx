import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Sparkles, 
  Sun, 
  Moon, 
  Key, 
  CheckCircle2, 
  X,
  Maximize,
  Minimize
} from 'lucide-react';
import { getStoredGeminiKey, setStoredGeminiKey } from '../../ai/geminiRAG';
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
  isDarkMode,
  onToggleTheme,
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
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [keySavedMessage, setKeySavedMessage] = useState(false);

  useEffect(() => {
    if (showKeyModal) {
      document.body.style.overflow = 'hidden';
      setApiKeyInput(getStoredGeminiKey());
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showKeyModal]);

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

  const handleSaveKey = () => {
    setStoredGeminiKey(apiKeyInput.trim());
    setKeySavedMessage(true);
    setTimeout(() => {
      setKeySavedMessage(false);
      setShowKeyModal(false);
    }, 1200);
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
        
        {/* 1st: AI Copilot Button */}
        <button
          onClick={onOpenChatbot}
          className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all active:scale-95 border border-blue-400/30"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
          <span>AI Copilot</span>
        </button>

        {/* 2nd: API Key Settings Button */}
        <button
          onClick={() => setShowKeyModal(true)}
          className="p-2 rounded-xl bg-[#151c2e] hover:bg-[#1f2d4a] text-amber-400 hover:text-amber-300 border border-amber-500/30 transition-all shadow-sm"
          title="Configure Gemini API Key"
        >
          <Key className="w-4 h-4 text-amber-400" />
        </button>

        {/* 3rd: Theme Toggle Button */}
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-xl bg-[#151c2e] hover:bg-[#1f2d4a] text-slate-300 hover:text-white border border-[#222d46] transition-all"
          title={isDarkMode ? "Switch to Light Theme" : "Switch to Dark Theme"}
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-400" />}
        </button>

        {/* 4th: Full Screen Toggle Button */}
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

      {/* Gemini Key Config Modal */}
      {showKeyModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 backdrop-blur-lg p-4 overflow-hidden">
          <div className="glass-panel p-6 rounded-2xl max-w-md w-full border border-slate-700 shadow-2xl relative bg-slate-900/95 my-auto animate-scale-in">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-100">Google Gemini API Key</h3>
                  <p className="text-xs text-slate-400">Enable AI conversational insights</p>
                </div>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Enter your Gemini API key to ask questions directly about your uploaded sales dataset.
            </p>

            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 mb-4 font-mono font-medium"
            />

            {keySavedMessage && (
              <div className="flex items-center space-x-2 text-xs text-emerald-400 font-semibold mb-4">
                <CheckCircle2 className="w-4 h-4" />
                <span>API Key saved!</span>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowKeyModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
              <button
                onClick={handleSaveKey}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
              >
                Save Key
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </header>
  );
};

export default Navbar;
