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
  Rocket
} from 'lucide-react';
import { DASHBOARDS } from '../../dashboards/dashboardRegistry';

interface SidebarNavProps {
  activeDashboardId: string;
  onSelectDashboard: (id: string) => void;
  isSyncing?: boolean;
  onOpenAIDealAnalysis?: () => void;
  onOpenExportModal?: () => void;
}

const getDashboardIcon = (iconName: string) => {
  switch (iconName) {
    case 'Briefcase':
      return <Briefcase className="w-4 h-4" />;
    case 'TrendingUp':
      return <TrendingUp className="w-4 h-4" />;
    case 'FolderKanban':
      return <FolderKanban className="w-4 h-4" />;
    case 'Headphones':
      return <Headphones className="w-4 h-4" />;
    default:
      return <Briefcase className="w-4 h-4" />;
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
      className={`h-full flex flex-col shrink-0 transition-all duration-300 ease-in-out border-r border-[#1b2539] bg-[#0c1222] text-slate-100 select-none relative z-30 ${
        isCollapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Sidebar Top Header & Collapse Button */}
      <div className="p-2.5 border-b border-[#1b2539] flex items-center justify-between overflow-hidden">
        {!isCollapsed && (
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-1">
            WORKSPACES
          </span>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded-lg hover:bg-[#182238] text-slate-400 hover:text-white transition-all shrink-0 ml-auto"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Navigation List */}
      <div className="flex-1 overflow-y-auto px-2 py-2.5 space-y-2 custom-scrollbar">

        {/* Navigation Items */}
        <div className="space-y-1">
          {DASHBOARDS.map((dash) => {
            const isActive = activeDashboardId === dash.id;

            return (
              <button
                key={dash.id}
                onClick={() => onSelectDashboard(dash.id)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition-all duration-150 text-xs group cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                    : 'text-slate-300 hover:bg-[#151d30] hover:text-white'
                }`}
                title={isCollapsed ? dash.name : undefined}
              >
                <div className="flex items-center space-x-2.5 overflow-hidden">
                  <div className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>
                    {getDashboardIcon(dash.iconName)}
                  </div>
                  {!isCollapsed && (
                    <span className="font-semibold text-xs truncate">
                      {dash.id === 'deal' ? 'Executive Overview' : dash.name}
                    </span>
                  )}
                </div>

                {!isCollapsed && (
                  <div className="shrink-0 ml-1">
                    {dash.badge && (
                      <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md tracking-wider ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-[#182238] text-slate-400'
                      }`}>
                        {dash.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}


          {/* AI Deal Analysis Button */}
          {onOpenAIDealAnalysis && (
            <button
              onClick={onOpenAIDealAnalysis}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-slate-300 hover:bg-[#151d30] hover:text-white transition-all duration-150 text-xs font-semibold group"
              title="Open AI Deal Analysis"
            >
              <div className="flex items-center space-x-2.5 overflow-hidden">
                <Rocket className="w-4 h-4 text-cyan-400 shrink-0 animate-pulse" />
                {!isCollapsed && <span className="font-semibold text-xs truncate">AI Deal Analysis</span>}
              </div>
              {!isCollapsed && (
                <span className="px-1.5 py-0.5 text-[9px] font-extrabold rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0 ml-1">
                  AI
                </span>
              )}
            </button>
          )}

          {/* Reports & Export Item */}
          <button
            onClick={onOpenExportModal}
            className="w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-xl text-slate-300 hover:bg-[#151d30] hover:text-white transition-all duration-150 text-xs font-semibold group cursor-pointer"
            title="Open Reports & Export"
          >
            <FileText className="w-4 h-4 text-slate-400 group-hover:text-white shrink-0" />
            {!isCollapsed && <span className="font-semibold text-xs truncate">Reports & Export</span>}
          </button>

          {/* DATA & SYNC BUTTON (Opens Dedicated Data & Sync Screen View) */}
          <button
            onClick={() => onSelectDashboard('data-sync')}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition-all duration-150 text-xs font-semibold ${
              activeDashboardId === 'data-sync'
                ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                : 'text-slate-300 hover:bg-[#151d30] hover:text-white'
            }`}
            title="Open Data & Sync Control Center Screen"
          >
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <RefreshCw className={`w-4 h-4 text-cyan-400 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
              {!isCollapsed && <span className="font-semibold text-xs truncate">Data & Sync</span>}
            </div>
            {!isCollapsed && (
              <span className="px-1.5 py-0.5 text-[9px] font-extrabold rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0 ml-1">
                LIVE
              </span>
            )}
          </button>
        </div>

      </div>
    </aside>
  );
};

export default SidebarNav;
