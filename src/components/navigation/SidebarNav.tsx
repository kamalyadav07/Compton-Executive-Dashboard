import React, { useState } from 'react';
import { 
  Briefcase, 
  TrendingUp, 
  FolderKanban, 
  Headphones, 
  FileText,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Rocket,
  ShieldCheck,
  LineChart,
  Trophy
} from 'lucide-react';
import { DASHBOARDS } from '../../dashboards/dashboardRegistry';

interface SidebarNavProps {
  activeDashboardId: string;
  onSelectDashboard: (id: string) => void;
  isSyncing?: boolean;
  onOpenAIDealAnalysis?: () => void;
  onOpenExportModal?: () => void;
}

const getDashboardIcon = (iconName: string, isActive: boolean) => {
  const iconClass = `w-4.5 h-4.5 transition-transform duration-200 group-hover:scale-110 ${
    isActive ? 'text-white' : 'text-slate-400 group-hover:text-cyan-300'
  }`;

  switch (iconName) {
    case 'Briefcase':
      return <Briefcase className={iconClass} />;
    case 'TrendingUp':
      return <TrendingUp className={iconClass} />;
    case 'FolderKanban':
      return <FolderKanban className={iconClass} />;
    case 'Headphones':
      return <Headphones className={iconClass} />;
    case 'LineChart':
      return <LineChart className={iconClass} />;
    case 'Trophy':
      return <Trophy className={iconClass} />;
    default:
      return <Briefcase className={iconClass} />;
  }
};

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeDashboardId,
  onSelectDashboard,
  isSyncing = false,
  onOpenAIDealAnalysis,
  onOpenExportModal
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside 
      className={`h-full flex flex-col shrink-0 transition-all duration-300 ease-in-out border-r border-[#1b2539] bg-[#090e1a]/95 backdrop-blur-xl text-slate-100 select-none relative z-30 shadow-2xl ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Sidebar Top Header Controls */}
      <div className={`p-3.5 border-b border-[#1b2539] flex items-center justify-between overflow-hidden bg-[#0c1324] ${
        isCollapsed ? 'justify-center px-2' : ''
      }`}>
        {!isCollapsed && (
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-1">
            WORKSPACES
          </span>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`p-1.5 rounded-xl hover:bg-[#182238] text-slate-400 hover:text-white transition-all shrink-0 active:scale-95 ${
            isCollapsed ? 'mx-auto' : 'ml-auto'
          }`}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4 text-cyan-400" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Navigation List */}
      <div className={`flex-1 overflow-y-auto py-3 space-y-4 custom-scrollbar ${
        isCollapsed ? 'px-2' : 'px-3'
      }`}>

        {/* SECTION 1: CORE DASHBOARDS */}
        <div>
          {!isCollapsed ? (
            <div className="px-2 pb-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center justify-between">
              <span>Analytics Dashboards</span>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/80 animate-ping" />
            </div>
          ) : (
            <div className="w-full border-t border-slate-800/80 my-1" />
          )}

          <div className="space-y-1.5">
            {DASHBOARDS.map((dash) => {
              const isActive = activeDashboardId === dash.id;

              return (
                <button
                  key={dash.id}
                  onClick={() => onSelectDashboard(dash.id)}
                  className={`w-full flex items-center transition-all duration-200 text-xs group cursor-pointer relative overflow-hidden ${
                    isCollapsed 
                      ? 'justify-center h-10 px-0 rounded-xl' 
                      : 'justify-between px-3 py-2.5 rounded-xl'
                  } ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold shadow-lg shadow-blue-600/25 border border-blue-400/30'
                      : 'text-slate-300 hover:bg-[#131b2e] hover:text-white border border-transparent'
                  }`}
                  title={dash.name}
                >
                  {/* Left Active Glow Bar (Expanded mode only) */}
                  {isActive && !isCollapsed && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-cyan-400 shadow-[0_0_8px_#38bdf8]" />
                  )}

                  <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3 overflow-hidden'}`}>
                    <div className="shrink-0 flex items-center justify-center">
                      {getDashboardIcon(dash.iconName, isActive)}
                    </div>
                    {!isCollapsed && (
                      <span className="font-bold text-xs whitespace-nowrap tracking-wide">
                        {dash.name}
                      </span>
                    )}
                  </div>

                  {!isCollapsed && (
                    <div className="shrink-0 ml-1.5">
                      {dash.badge && (
                        <span className={`px-2 py-0.5 text-[9px] font-mono font-extrabold rounded-md tracking-wider inline-flex items-center space-x-1 ${
                          isActive
                            ? 'bg-white/20 text-white border border-white/20'
                            : dash.badge === 'LIVE'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {dash.badge === 'LIVE' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block mr-1" />
                          )}
                          <span>{dash.badge}</span>
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* SECTION 2: INTELLIGENCE & TOOLS */}
        <div>
          {!isCollapsed ? (
            <div className="px-2 pb-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Intelligence & Data
            </div>
          ) : (
            <div className="w-full border-t border-slate-800/80 my-1" />
          )}

          <div className="space-y-1.5">
            {/* AI Deal Analysis Button */}
            {onOpenAIDealAnalysis && (
              <button
                onClick={onOpenAIDealAnalysis}
                className={`w-full flex items-center transition-all duration-200 text-xs font-semibold group cursor-pointer border border-transparent hover:border-slate-800 text-slate-300 hover:bg-[#131b2e] hover:text-white ${
                  isCollapsed 
                    ? 'justify-center h-10 px-0 rounded-xl' 
                    : 'justify-between px-3 py-2.5 rounded-xl'
                }`}
                title="AI Deal Analysis"
              >
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3 overflow-hidden'}`}>
                  <Rocket className="w-4.5 h-4.5 text-cyan-400 shrink-0 animate-bounce" />
                  {!isCollapsed && <span className="font-bold text-xs whitespace-nowrap">AI Deal Analysis</span>}
                </div>
                {!isCollapsed && (
                  <span className="px-2 py-0.5 text-[9px] font-mono font-extrabold rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0 ml-1.5">
                    AI
                  </span>
                )}
              </button>
            )}

            {/* Reports & Export Item */}
            <button
              onClick={onOpenExportModal}
              className={`w-full flex items-center transition-all duration-200 text-xs font-semibold group cursor-pointer border border-transparent hover:border-slate-800 text-slate-300 hover:bg-[#131b2e] hover:text-white ${
                isCollapsed 
                  ? 'justify-center h-10 px-0 rounded-xl' 
                  : 'space-x-3 px-3 py-2.5 rounded-xl'
              }`}
              title="Reports & Export"
            >
              <FileText className="w-4.5 h-4.5 text-slate-400 group-hover:text-cyan-300 shrink-0 transition-colors" />
              {!isCollapsed && <span className="font-bold text-xs whitespace-nowrap">Reports & Export</span>}
            </button>

            {/* DATA & SYNC BUTTON */}
            <button
              onClick={() => onSelectDashboard('data-sync')}
              className={`w-full flex items-center transition-all duration-200 text-xs font-semibold group cursor-pointer relative overflow-hidden ${
                isCollapsed 
                  ? 'justify-center h-10 px-0 rounded-xl' 
                  : 'justify-between px-3 py-2.5 rounded-xl'
              } ${
                activeDashboardId === 'data-sync'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold shadow-lg shadow-blue-600/25 border border-blue-400/30'
                  : 'text-slate-300 hover:bg-[#131b2e] hover:text-white border border-transparent'
              }`}
              title="Data & Sync Control Center"
            >
              {activeDashboardId === 'data-sync' && !isCollapsed && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-cyan-400 shadow-[0_0_8px_#38bdf8]" />
              )}

              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3 overflow-hidden'}`}>
                <RefreshCw className={`w-4.5 h-4.5 text-cyan-400 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
                {!isCollapsed && <span className="font-bold text-xs whitespace-nowrap">Data & Sync</span>}
              </div>
              {!isCollapsed && (
                <span className="px-2 py-0.5 text-[9px] font-mono font-extrabold rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0 ml-1.5 inline-flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>LIVE</span>
                </span>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Sidebar Footer Status Pill */}
      {!isCollapsed ? (
        <div className="p-3 border-t border-[#1b2539] bg-[#0c1324] text-[10px] text-slate-400 flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="truncate">
            <span className="font-bold text-slate-300 block leading-tight">System Operational</span>
            <span className="text-[9px] text-slate-500 font-mono">Google Sheets Synced</span>
          </div>
        </div>
      ) : (
        <div className="p-3 border-t border-[#1b2539] bg-[#0c1324] flex items-center justify-center">
          <span title="System Operational">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          </span>
        </div>
      )}
    </aside>
  );
};

export default SidebarNav;
