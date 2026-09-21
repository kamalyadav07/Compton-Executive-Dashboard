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
  ShieldCheck,
  LineChart,
  Trophy
} from 'lucide-react';
import { DASHBOARDS } from '../../dashboards/dashboardRegistry';

interface SidebarNavProps {
  activeDashboardId: string;
  onSelectDashboard: (id: string) => void;
  isSyncing?: boolean;
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
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
            Workspaces
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
            <div className="px-2 pb-2 text-xs font-semibold text-slate-400 flex items-center justify-between">
              <span>Dashboards</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>
          ) : (
            <div className="w-full border-t border-slate-800/80 my-1" />
          )}

          <div className="space-y-1">
            {DASHBOARDS.map((dash) => {
              const isActive = activeDashboardId === dash.id;

              return (
                <button
                  key={dash.id}
                  onClick={() => onSelectDashboard(dash.id)}
                  className={`w-full flex items-center transition-all duration-150 text-xs group cursor-pointer relative overflow-hidden ${
                    isCollapsed 
                      ? 'justify-center h-10 px-0 rounded-xl' 
                      : 'justify-between px-3 py-2.5 rounded-xl'
                  } ${
                    isActive
                      ? 'bg-blue-500/15 text-blue-300 font-semibold border border-blue-500/30 shadow-xs'
                      : 'text-slate-300 hover:bg-[#131b2e] hover:text-white border border-transparent'
                  }`}
                  title={dash.name}
                >
                  {/* Left Active Accent Bar */}
                  {isActive && !isCollapsed && (
                    <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-blue-500" />
                  )}

                  <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3 overflow-hidden'}`}>
                    <div className="shrink-0 flex items-center justify-center">
                      {getDashboardIcon(dash.iconName, isActive)}
                    </div>
                    {!isCollapsed && (
                      <span className="font-medium text-xs whitespace-nowrap">
                        {dash.name}
                      </span>
                    )}
                  </div>

                  {!isCollapsed && (
                    <div className="shrink-0 ml-1.5">
                      {dash.badge && (
                        <span className={`px-2 py-0.5 text-[10px] font-medium rounded-md inline-flex items-center space-x-1 ${
                          isActive
                            ? 'bg-blue-500/20 text-blue-200 border border-blue-400/30'
                            : dash.badge === 'LIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {dash.badge === 'LIVE' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block mr-1" />
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
            <div className="px-2 pb-2 text-xs font-semibold text-slate-400">
              Tools & Data
            </div>
          ) : (
            <div className="w-full border-t border-slate-800/80 my-1" />
          )}

          <div className="space-y-1">
            {/* Reports & Export Item */}
            <button
              onClick={onOpenExportModal}
              className={`w-full flex items-center transition-all duration-150 text-xs font-medium group cursor-pointer border border-transparent hover:border-slate-800 text-slate-300 hover:bg-[#131b2e] hover:text-white ${
                isCollapsed 
                  ? 'justify-center h-10 px-0 rounded-xl' 
                  : 'space-x-3 px-3 py-2.5 rounded-xl'
              }`}
              title="Reports & Export"
            >
              <FileText className="w-4.5 h-4.5 text-slate-400 group-hover:text-blue-300 shrink-0 transition-colors" />
              {!isCollapsed && <span className="font-medium text-xs whitespace-nowrap">Reports & Export</span>}
            </button>

            {/* DATA & SYNC BUTTON */}
            <button
              onClick={() => onSelectDashboard('data-sync')}
              className={`w-full flex items-center transition-all duration-150 text-xs font-medium group cursor-pointer relative overflow-hidden ${
                isCollapsed 
                  ? 'justify-center h-10 px-0 rounded-xl' 
                  : 'justify-between px-3 py-2.5 rounded-xl'
              } ${
                activeDashboardId === 'data-sync'
                  ? 'bg-blue-500/15 text-blue-300 font-semibold border border-blue-500/30 shadow-xs'
                  : 'text-slate-300 hover:bg-[#131b2e] hover:text-white border border-transparent'
              }`}
              title="Data & Sync Control Center"
            >
              {activeDashboardId === 'data-sync' && !isCollapsed && (
                <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-blue-500" />
              )}

              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3 overflow-hidden'}`}>
                <RefreshCw className={`w-4.5 h-4.5 text-blue-400 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
                {!isCollapsed && <span className="font-medium text-xs whitespace-nowrap">Data & Sync</span>}
              </div>
              {!isCollapsed && (
                <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 shrink-0 ml-1.5 inline-flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>LIVE</span>
                </span>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Sidebar Footer Status Pill */}
      {!isCollapsed ? (
        <div className="p-3 border-t border-[#1b2539] bg-[#0c1324] text-xs text-slate-400 flex items-center space-x-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="truncate">
            <span className="font-medium text-slate-200 block leading-tight text-xs">System Operational</span>
            <span className="text-[11px] text-slate-400">All data streams synced</span>
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
