import React, { useState, useMemo } from 'react';
import {
  Flame,
  Search,
  FileSpreadsheet,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Clock,
  Building2,
  MessageSquare,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { BurningTicket } from '../../engine/serviceService';

export interface BurningTicketsTableProps {
  tickets: BurningTicket[];
  loading?: boolean;
  onInspectTicket?: (ticket: BurningTicket) => void;
  onRefresh?: () => void;
}

type FilterTab = 'all' | 'escalated' | 'high' | 'overdue';

export const BurningTicketsTable: React.FC<BurningTicketsTableProps> = ({
  tickets = [],
  loading = false,
  onInspectTicket
}) => {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTicketId, setExpandedTicketId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const pageSize = 10;

  // Strictly exclude tickets that are on hold, in observation, or resolved
  const activeBurningTickets = useMemo(() => {
    return tickets.filter(t => {
      const s = (t.status || '').toLowerCase().trim();
      return s !== 'hold' && s !== 'observation' && s !== 'resolved';
    });
  }, [tickets]);

  // Compute counts for filter tabs
  const tabCounts = useMemo(() => {
    const total = activeBurningTickets.length;
    const escalated = activeBurningTickets.filter(t => t.is_escalated).length;
    const high = activeBurningTickets.filter(t => t.severity?.toLowerCase() === 'high' || t.is_high_priority).length;
    const overdue = activeBurningTickets.filter(t => (Number(t.elapsed_hours) >= (Number(t.estimated_time) || 48)) || t.is_overdue).length;
    return { total, escalated, high, overdue };
  }, [activeBurningTickets]);

  // Filter tickets by active tab and search query
  const filteredTickets = useMemo(() => {
    let result = activeBurningTickets;

    if (activeTab === 'escalated') {
      result = result.filter(t => t.is_escalated);
    } else if (activeTab === 'high') {
      result = result.filter(t => t.severity?.toLowerCase() === 'high' || t.is_high_priority);
    } else if (activeTab === 'overdue') {
      result = result.filter(t => (Number(t.elapsed_hours) >= (Number(t.estimated_time) || 48)) || t.is_overdue);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(t => {
        const matchId = String(t.id).includes(q);
        const matchCompany = t.company_name?.toLowerCase().includes(q);
        const matchEngineer = t.engineer_name?.toLowerCase().includes(q);
        const matchIssue = t.issue_category?.toLowerCase().includes(q) || t.issue_type?.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        const matchComment = t.last_comment?.toLowerCase().includes(q);
        return matchId || matchCompany || matchEngineer || matchIssue || matchDesc || matchComment;
      });
    }

    return result;
  }, [tickets, activeTab, searchQuery]);

  // Reset pagination on filter change
  const totalPages = Math.ceil(filteredTickets.length / pageSize) || 1;
  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTickets.slice(start, start + pageSize);
  }, [filteredTickets, currentPage, pageSize]);

  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  // Excel export
  const handleExportExcel = () => {
    setIsExporting(true);
    try {
      const exportData = filteredTickets.map((t, idx) => ({
        '#': idx + 1,
        'Ticket ID': `#T-${t.id}`,
        'Client Company': t.company_name || 'Compton Client',
        'Contact Email': t.contact_email || 'N/A',
        'Contact Phone': t.contact_number || 'N/A',
        'Assigned Engineer': t.engineer_name || 'Unassigned',
        'Engineer Level': (t.engineer_level || 'Level 1').toUpperCase(),
        'Issue Category': t.issue_category || t.issue_type || 'General IT Support',
        'Status': (t.status || 'in_progress').toUpperCase().replace('_', ' '),
        'Severity': (t.severity || 'high').toUpperCase(),
        'Escalated': t.is_escalated ? 'YES' : 'NO',
        'Estimated SLA (Hours)': Number(t.estimated_time) || 48,
        'Actual Elapsed (Hours)': Number(t.elapsed_hours) || 0,
        'Overdue Delta (Hours)': Number(t.overdue_hours) > 0 ? `+${t.overdue_hours}h OVER` : 'On Track',
        'Days Inactive': `${Number(t.days_without_update).toFixed(1)} days`,
        'Last Comment Date': t.last_comment_at || 'N/A',
        'Latest Comment': t.last_comment || 'No comment recorded',
        'Created Date': t.created_at || 'N/A',
        'Incident Description': t.description || 'N/A'
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Auto-set dynamic column widths with generous allocation for Incident Description and Comments
      if (exportData.length > 0) {
        const colKeys = Object.keys(exportData[0]);
        ws['!cols'] = colKeys.map(key => {
          if (key === 'Incident Description') return { wch: 75 };
          if (key === 'Latest Comment') return { wch: 50 };
          if (key === 'Client Company') return { wch: 30 };
          if (key === 'Contact Email') return { wch: 26 };
          if (key === 'Assigned Engineer') return { wch: 22 };
          if (key === 'Issue Category') return { wch: 25 };
          if (key === '#') return { wch: 6 };
          if (key === 'Ticket ID') return { wch: 14 };
          if (key === 'Status' || key === 'Severity' || key === 'Escalated') return { wch: 15 };
          if (key.includes('Date')) return { wch: 20 };
          return { wch: Math.max(key.length + 4, 16) };
        });

        // Set cell alignment & wrapText on all cells so long descriptions & comments do not get cropped
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
        for (let R = range.s.r; R <= range.e.r; ++R) {
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const addr = XLSX.utils.encode_cell({ r: R, c: C });
            if (!ws[addr]) continue;
            if (R === 0) {
              ws[addr].s = {
                font: { bold: true },
                alignment: { vertical: 'center', horizontal: 'center', wrapText: true }
              };
            } else {
              ws[addr].s = {
                alignment: { vertical: 'top', wrapText: true }
              };
            }
          }
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Burning Tickets');
      XLSX.writeFile(wb, `Compton_Burning_Tickets_${new Date().toISOString().slice(0, 10)}.xlsx`, { cellStyles: true });
    } finally {
      setIsExporting(false);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedTicketId(prev => (prev === id ? null : id));
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0c101b] shadow-xl overflow-hidden text-slate-100">
      {/* HEADER BAR */}
      <div className="p-5 sm:p-6 border-b border-slate-800/80 bg-gradient-to-r from-[#121624] via-[#0d121f] to-[#0c101b]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            {/* Clean, human refined flame badge */}
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0">
              <Flame className="w-5 h-5 text-rose-400" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Burning Tickets
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 font-mono text-xs font-semibold">
                  {activeBurningTickets.length} active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Active service incidents flagged by high priority, client escalation, or overdue SLA with communication blackout.
              </p>
            </div>
          </div>

          {/* CONTROLS: SEARCH & EXCEL */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search ticket #, client, engineer..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-900/90 border border-slate-700/60 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting || filteredTickets.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isExporting ? 'Exporting...' : 'Export Excel'}</span>
            </button>
          </div>
        </div>

        {/* METRICS SUMMARY STRIP & FILTER TABS */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Quick Filter Tabs */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
            <button
              type="button"
              onClick={() => handleTabChange('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              All Burning <span className="text-[11px] font-mono ml-1 opacity-70">({tabCounts.total})</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('escalated')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'escalated'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Escalated <span className="text-[11px] font-mono ml-1 text-amber-400">({tabCounts.escalated})</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('high')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'high'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              High Priority <span className="text-[11px] font-mono ml-1 text-rose-400">({tabCounts.high})</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('overdue')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'overdue'
                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Overdue SLA <span className="text-[11px] font-mono ml-1 text-orange-400">({tabCounts.overdue})</span>
            </button>
          </div>

          {/* Human telemetry summary tags */}
          <div className="flex items-center space-x-3 text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              <span>{tabCounts.escalated} Escalations</span>
            </span>
            <span className="text-slate-700">•</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
              <span>{tabCounts.high} High Severity</span>
            </span>
            <span className="text-slate-700">•</span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-orange-400" />
              <span>{tabCounts.overdue} SLA Breached</span>
            </span>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-[#090d16] text-slate-400 font-medium">
              <th className="py-3 px-4 w-28">Ticket</th>
              <th className="py-3 px-4">Client & Scope</th>
              <th className="py-3 px-4">Assigned Engineer</th>
              <th className="py-3 px-4">SLA Timeline</th>
              <th className="py-3 px-4">Last Activity</th>
              <th className="py-3 px-4">Burning Triggers</th>
              <th className="py-3 px-4 text-right w-24">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs">Loading burning tickets...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedTickets.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle className="w-6 h-6 text-slate-500" />
                    <span className="text-sm font-medium text-slate-300">No burning tickets match your current filter</span>
                    <span className="text-xs text-slate-500">Try selecting another tab or clearing your search.</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedTickets.map(t => {
                const isExpanded = expandedTicketId === t.id;
                const estHours = Number(t.estimated_time) || 48;
                const elapsedHours = Number(t.elapsed_hours) || 0;
                const overdueHours = Number(t.overdue_hours) || 0;
                const isOverdue = elapsedHours >= estHours || overdueHours > 0;
                const daysInactive = Number(t.days_without_update) || 0;

                return (
                  <React.Fragment key={t.id}>
                    <tr
                      className={`hover:bg-slate-800/30 transition-colors cursor-pointer ${
                        isExpanded ? 'bg-slate-800/40' : ''
                      }`}
                      onClick={() => toggleExpand(t.id)}
                    >
                      {/* TICKET ID */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-200 flex items-center gap-1.5">
                          {t.is_escalated && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Escalated ticket" />
                          )}
                          <span>#T-{t.id}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {t.created_at ? t.created_at.slice(5, 16) : 'N/A'}
                        </div>
                      </td>

                      {/* CLIENT & SCOPE */}
                      <td className="py-3 px-4 max-w-[240px]">
                        <div className="font-medium text-white truncate flex items-center gap-1.5">
                          <Building2 className="w-3 h-3 text-slate-500 flex-shrink-0" />
                          <span className="truncate">{t.company_name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-slate-400 truncate">
                            {t.issue_category || t.issue_type || 'General IT Support'}
                          </span>
                          {t.description && (
                            <span className="text-[10px] text-slate-500 truncate" title={t.description}>
                              • {t.description}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* ASSIGNED ENGINEER */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center font-bold text-[10px]">
                            {t.engineer_name ? t.engineer_name.charAt(0).toUpperCase() : '?'}
                          </div>
                          <div>
                            <div className="font-medium text-slate-200 text-xs">
                              {t.engineer_name || 'Unassigned'}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono uppercase">
                              {t.engineer_level || 'Level 1'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* SLA TIMELINE */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <span className="text-slate-400">{estHours}h SLA</span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-300">{elapsedHours}h elapsed</span>
                        </div>
                        <div className="mt-0.5">
                          {isOverdue ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-rose-400">
                              <Clock className="w-2.5 h-2.5" />
                              {overdueHours > 0 ? `+${overdueHours}h overdue` : 'over SLA limit'}
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-emerald-400">
                              Within SLA
                            </span>
                          )}
                        </div>
                      </td>

                      {/* LAST ACTIVITY */}
                      <td className="py-3 px-4 max-w-[200px]">
                        <div className="text-[11px] font-mono text-slate-300 flex items-center gap-1">
                          {daysInactive >= 2 ? (
                            <span className="text-amber-400 font-medium">
                              {daysInactive.toFixed(1)} days inactive
                            </span>
                          ) : (
                            <span className="text-slate-400">
                              {daysInactive > 0 ? `${daysInactive.toFixed(1)}d ago` : 'Active today'}
                            </span>
                          )}
                        </div>
                        {t.last_comment ? (
                          <div
                            className="text-[10px] text-slate-500 truncate mt-0.5 italic flex items-center gap-1"
                            title={t.last_comment}
                          >
                            <MessageSquare className="w-2.5 h-2.5 flex-shrink-0 text-slate-600" />
                            <span className="truncate">"{t.last_comment}"</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-600 mt-0.5">No comments recorded</div>
                        )}
                      </td>

                      {/* BURNING TRIGGERS */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {t.is_escalated && (
                            <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-semibold flex items-center gap-1">
                              <ShieldAlert className="w-2.5 h-2.5 text-amber-400" />
                              Escalated
                            </span>
                          )}
                          {(t.severity?.toLowerCase() === 'high' || t.is_high_priority) && (
                            <span className="px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[10px] font-semibold">
                              High Priority
                            </span>
                          )}
                          {isOverdue && daysInactive >= 2 && (
                            <span className="px-2 py-0.5 rounded bg-orange-500/15 border border-orange-500/30 text-orange-300 text-[10px] font-semibold">
                              Overdue &gt;2d
                            </span>
                          )}
                        </div>
                      </td>

                      {/* ACTIONS */}
                      <td className="py-3 px-4 whitespace-nowrap text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {onInspectTicket && (
                            <button
                              type="button"
                              onClick={() => onInspectTicket(t)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 hover:text-cyan-200 text-[11px] font-medium transition-colors flex items-center gap-1"
                              title="Inspect ticket register and details"
                            >
                              <span>Inspect</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleExpand(t.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                            title={isExpanded ? 'Collapse row' : 'Expand row'}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* EXPANDED ACCORDION DRAWER */}
                    {isExpanded && (
                      <tr className="bg-[#090d16] border-b border-slate-800/80">
                        <td colSpan={7} className="p-4 sm:p-5">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            {/* Panel 1: Problem Narrative */}
                            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                              <div className="text-[11px] font-mono uppercase text-slate-400 font-semibold mb-1">
                                Incident Description
                              </div>
                              <p className="text-slate-200 text-xs leading-relaxed whitespace-pre-wrap">
                                {t.description || 'No detailed problem description submitted.'}
                              </p>
                              <div className="mt-3 pt-2 border-t border-slate-800 text-[10px] text-slate-500 font-mono flex justify-between">
                                <span>Device: {t.device_model || 'Service Unit'}</span>
                                <span>Warranty: {t.warranty || 'Under AMC'}</span>
                              </div>
                            </div>

                            {/* Panel 2: Latest Update / Comment */}
                            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                              <div className="text-[11px] font-mono uppercase text-slate-400 font-semibold mb-1">
                                Latest Remark / Audit Note
                              </div>
                              {t.last_comment ? (
                                <p className="text-slate-200 text-xs italic leading-relaxed">
                                  "{t.last_comment}"
                                </p>
                              ) : (
                                <p className="text-slate-500 italic text-xs">
                                  No remarks currently logged on this ticket.
                                </p>
                              )}
                              <div className="mt-3 pt-2 border-t border-slate-800 text-[10px] text-slate-500 font-mono">
                                Logged: {t.last_comment_at || 'Never'} ({daysInactive.toFixed(1)} days ago)
                              </div>
                            </div>

                            {/* Panel 3: SLA & Contacts */}
                            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
                              <div className="space-y-1.5 font-mono text-[11px]">
                                <div className="text-[11px] uppercase text-slate-400 font-semibold mb-1">
                                  SLA Breakdown
                                </div>
                                <div className="flex justify-between text-slate-400">
                                  <span>Target SLA:</span>
                                  <span className="text-white font-medium">{estHours} hours</span>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                  <span>Time Elapsed:</span>
                                  <span className="text-white font-medium">{elapsedHours} hours</span>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                  <span>Overdue Delta:</span>
                                  <span className={overdueHours > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                                    {overdueHours > 0 ? `+${overdueHours} hours` : 'Within limits'}
                                  </span>
                                </div>
                              </div>

                              <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
                                <span className="text-[11px] text-slate-400 font-mono">
                                  {t.contact_number || t.contact_email || 'No contact specified'}
                                </span>
                                {onInspectTicket && (
                                  <button
                                    type="button"
                                    onClick={() => onInspectTicket(t)}
                                    className="text-cyan-400 hover:text-cyan-300 font-medium text-xs flex items-center gap-1"
                                  >
                                    <span>Full Details</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* FOOTER & PAGINATION */}
      <div className="p-4 border-t border-slate-800 bg-[#090d16] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
        <div>
          Showing{' '}
          <span className="font-mono font-medium text-slate-200">
            {filteredTickets.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
          </span>
          {' '}-{' '}
          <span className="font-mono font-medium text-slate-200">
            {Math.min(currentPage * pageSize, filteredTickets.length)}
          </span>
          {' '}of{' '}
          <span className="font-mono font-medium text-slate-200">{filteredTickets.length}</span> tickets
        </div>

        {totalPages > 1 && (
          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              title="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
              <button
                key={pageNum}
                type="button"
                onClick={() => setCurrentPage(pageNum)}
                className={`w-7 h-7 rounded-lg text-xs font-mono font-medium transition-colors ${
                  currentPage === pageNum
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {pageNum}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              title="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
