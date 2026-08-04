import React, { useState, useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  PlayCircle,
  Clock,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  FolderKanban,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Download,
  CheckCircle2,
  DollarSign,
  X,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  Info,
  Edit,
  Trash2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { ProjectRecord, ProjectFilterState } from '../../types/project';
import {
  INITIAL_SAMPLE_PROJECTS,
  DEFAULT_PROJECT_SHEET_URL,
  fetchProjectSheetData,
  filterProjectRecords,
  calculateProjectKPIs
} from '../../engine/projectSheetsService';

const initialProjectFilters: ProjectFilterState = {
  searchQuery: '',
  status: 'All',
  timelineStatus: 'All',
  budgetStatus: 'All',
  projectType: 'All',
  customer: 'All'
};

interface ProjectDashboardProps {
  onOpenExportModal?: () => void;
}

export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ onOpenExportModal }) => {
  const [sheetUrl, setSheetUrl] = useState<string>(() => {
    return localStorage.getItem('project_dashboard_sheet_url') || DEFAULT_PROJECT_SHEET_URL;
  });

  const [projects, setProjects] = useState<ProjectRecord[]>(INITIAL_SAMPLE_PROJECTS);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(new Date());
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string }>({
    type: 'info',
    text: 'Sync connected to Google Sheet.'
  });

  const [filters, setFilters] = useState<ProjectFilterState>(initialProjectFilters);
  const [sortField, setSortField] = useState<keyof ProjectRecord>('sNo');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: keyof ProjectRecord) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Modals state
  const [selectedProject, setSelectedProject] = useState<ProjectRecord | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);

  // Add/Edit Project Form State
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    customerName: '',
    projectName: '',
    status: 'Running' as ProjectRecord['status'],
    projectType: 'CCTV',
    startDate: '1 August',
    plannedEndDate: '30 August',
    actualEndDate: '30 August',
    plannedBudget: 100000,
    actualCost: 95000
  });

  // Fetch Live Google Sheet Data
  const handleSyncData = async (urlToFetch = sheetUrl) => {
    setIsSyncing(true);
    setSyncStatusMsg({ type: 'info', text: 'Fetching latest project data from Google Sheet...' });
    try {
      const res = await fetchProjectSheetData(urlToFetch);
      if (res.status === 'success') {
        setProjects(res.records);
        setLastSyncedAt(new Date());
        setSyncStatusMsg({ type: 'success', text: res.message });
      } else {
        setSyncStatusMsg({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      console.error("Error fetching project sheet:", err);
      setSyncStatusMsg({ type: 'error', text: err?.message || 'Network error connecting to sheet.' });
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    handleSyncData();
  }, []);

  const handleSaveSheetUrl = () => {
    localStorage.setItem('project_dashboard_sheet_url', sheetUrl);
    handleSyncData(sheetUrl);
    setIsConfigOpen(false);
  };

  // Filtered project list
  const filteredProjects = useMemo(() => {
    const list = filterProjectRecords(projects, filters);

    // Sorting
    return [...list].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'string') aVal = (aVal as string).toLowerCase();
      if (typeof bVal === 'string') bVal = (bVal as string).toLowerCase();

      if (aVal! < bVal!) return sortOrder === 'asc' ? -1 : 1;
      if (aVal! > bVal!) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [projects, filters, sortField, sortOrder]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    return calculateProjectKPIs(filteredProjects);
  }, [filteredProjects]);

  // Dynamic filter dropdown lists
  const projectTypes = useMemo(() => {
    const set = new Set(projects.map(p => p.projectType));
    return Array.from(set).filter(Boolean);
  }, [projects]);

  const customerList = useMemo(() => {
    const set = new Set(projects.map(p => p.customerName));
    return Array.from(set).filter(Boolean);
  }, [projects]);

  // Format currency in Lakhs or Indian Rupees
  const formatCurrency = (amount: number): string => {
    if (Math.abs(amount) >= 100000) {
      return `₹${(amount / 100000).toFixed(2)} L`;
    }
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  // Handle Add/Edit project submit
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const variance = formData.actualCost - formData.plannedBudget;
    const variancePct = formData.plannedBudget > 0 ? (variance / formData.plannedBudget) * 100 : 0;
    const budgetStatus: ProjectRecord['budgetStatus'] =
      variance > 0 ? 'Over Budget' : variance < 0 ? 'Under Budget' : 'On Budget';

    // Simple timeline heuristic
    const timelineStatus: ProjectRecord['timelineStatus'] =
      formData.status === 'Completed' && formData.actualEndDate > formData.plannedEndDate
        ? 'Delayed'
        : 'On Time';

    if (editingProjectId) {
      setProjects(prev =>
        prev.map(p =>
          p.id === editingProjectId
            ? {
                ...p,
                ...formData,
                budgetVariance: variance,
                budgetVariancePct: Math.round(variancePct * 100) / 100,
                budgetStatus,
                timelineStatus
              }
            : p
        )
      );
    } else {
      const newProj: ProjectRecord = {
        id: `proj-custom-${Date.now()}`,
        sNo: projects.length + 1,
        ...formData,
        budgetVariance: variance,
        budgetVariancePct: Math.round(variancePct * 100) / 100,
        budgetStatus,
        timelineStatus,
        delayDays: timelineStatus === 'Delayed' ? 7 : 0
      };
      setProjects(prev => [newProj, ...prev]);
    }

    setIsAddModalOpen(false);
    setEditingProjectId(null);
    setFormData({
      customerName: '',
      projectName: '',
      status: 'Running',
      projectType: 'CCTV',
      startDate: '1 August',
      plannedEndDate: '30 August',
      actualEndDate: '30 August',
      plannedBudget: 100000,
      actualCost: 95000
    });
  };

  const handleDeleteProject = (id: string) => {
    if (confirm('Are you sure you want to delete this project?')) {
      setProjects(prev => prev.filter(p => p.id !== id));
      if (selectedProject?.id === id) setSelectedProject(null);
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredProjects.map(p => ({
      'S. No': p.sNo,
      'Customer Name': p.customerName,
      'Project Name': p.projectName,
      'Status': p.status,
      'Project Type': p.projectType,
      'Start Date': p.startDate,
      'Planned End Date': p.plannedEndDate,
      'Actual End Date': p.actualEndDate,
      'Timeline Status': p.timelineStatus,
      'Planned Budget (₹)': p.plannedBudget,
      'Actual Cost (₹)': p.actualCost,
      'Budget Variance (₹)': p.budgetVariance,
      'Budget Status': p.budgetStatus
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Projects');
    XLSX.writeFile(workbook, `Project_Dashboard_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // -------------------------------------------------------------
  // ECharts Configurations
  // -------------------------------------------------------------

  // 1. Planned Budget vs Actual Cost Chart
  const budgetVsCostChartOption = useMemo(() => {
    const names = filteredProjects.slice(0, 10).map(p => p.customerName.length > 12 ? p.customerName.slice(0, 10) + '...' : p.customerName);
    const plannedData = filteredProjects.slice(0, 10).map(p => p.plannedBudget / 100000);
    const actualData = filteredProjects.slice(0, 10).map(p => p.actualCost / 100000);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params: any) => {
          let res = `<div class="font-bold border-b border-slate-700 pb-1 mb-1">${params[0].axisValue}</div>`;
          params.forEach((item: any) => {
            res += `<div class="flex items-center justify-between gap-4 text-xs">
              <span style="color:${item.color}">● ${item.seriesName}:</span>
              <span class="font-mono font-bold">₹${Number(item.value).toFixed(2)} Lakhs</span>
            </div>`;
          });
          return res;
        }
      },
      legend: {
        top: '2%',
        right: '2%',
        textStyle: { color: '#94a3b8', fontSize: 11 }
      },
      grid: { top: '18%', left: '3%', right: '4%', bottom: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        data: names.length > 0 ? names : ['No Projects'],
        axisLabel: { color: '#94a3b8', fontSize: 10, rotate: 15 },
        axisLine: { lineStyle: { color: '#334155' } }
      },
      yAxis: {
        type: 'value',
        name: '₹ Lakhs',
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
        splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } }
      },
      series: [
        {
          name: 'Planned Budget',
          type: 'bar',
          barGap: '10%',
          data: plannedData.length > 0 ? plannedData : [0],
          itemStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: '#3b82f6' }, { offset: 1, color: '#1d4ed8' }]
            },
            borderRadius: [4, 4, 0, 0]
          }
        },
        {
          name: 'Actual Cost',
          type: 'bar',
          data: actualData.length > 0 ? actualData : [0],
          itemStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: '#f43f5e' }, { offset: 1, color: '#be123c' }]
            },
            borderRadius: [4, 4, 0, 0]
          }
        }
      ]
    };
  }, [filteredProjects]);

  // 2. Timeline Health Donut Chart
  const timelineHealthChartOption = useMemo(() => {
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: '{b}: <strong class="text-white">{c} Projects ({d}%)</strong>'
      },
      legend: { bottom: '2%', left: 'center', textStyle: { color: '#94a3b8', fontSize: 11 } },
      series: [
        {
          name: 'Timeline Health',
          type: 'pie',
          radius: ['55%', '80%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 8, borderColor: '#0f172a', borderWidth: 3 },
          label: {
            show: true,
            position: 'center',
            formatter: `{val|${kpis.totalProjects}}\n{sub|PROJECTS}`,
            rich: {
              val: { fontSize: 24, fontWeight: 'bold', color: '#ffffff', lineHeight: 30 },
              sub: { fontSize: 10, color: '#94a3b8', lineHeight: 14 }
            }
          },
          data: [
            {
              value: kpis.onTimeProjects,
              name: 'On Time Projects',
              itemStyle: { color: '#10b981' }
            },
            {
              value: kpis.delayedProjects,
              name: 'Delayed Projects',
              itemStyle: { color: '#f43f5e' }
            }
          ]
        }
      ]
    };
  }, [kpis]);

  // 3. Budget Status Breakdown Donut Chart
  const budgetStatusChartOption = useMemo(() => {
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: '{b}: <strong class="text-white">{c} Projects ({d}%)</strong>'
      },
      legend: { bottom: '2%', left: 'center', textStyle: { color: '#94a3b8', fontSize: 11 } },
      series: [
        {
          name: 'Budget Health',
          type: 'pie',
          radius: ['55%', '80%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 8, borderColor: '#0f172a', borderWidth: 3 },
          label: {
            show: true,
            position: 'center',
            formatter: `{val|${kpis.underBudgetProjects + kpis.onBudgetProjects}}\n{sub|UNDER / ON BUDGET}`,
            rich: {
              val: { fontSize: 22, fontWeight: 'bold', color: '#34d399', lineHeight: 28 },
              sub: { fontSize: 9, color: '#94a3b8', lineHeight: 14 }
            }
          },
          data: [
            {
              value: kpis.underBudgetProjects,
              name: 'Under Budget',
              itemStyle: { color: '#10b981' }
            },
            {
              value: kpis.onBudgetProjects,
              name: 'On Budget',
              itemStyle: { color: '#3b82f6' }
            },
            {
              value: kpis.overBudgetProjects,
              name: 'Over Budget',
              itemStyle: { color: '#f43f5e' }
            }
          ]
        }
      ]
    };
  }, [kpis]);

  return (
    <div className="space-y-6 pb-12 animate-fade-in text-slate-100">
      
      {/* 1. Header & Live Sync Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-[#0f172a] via-[#141e33] to-[#0f172a] p-5 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <FolderKanban className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-black tracking-tight text-white">Project Performance Dashboard</h2>
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                GOOGLE SHEET LIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time monitoring of project delivery timelines, budget variances & operational health metrics.
            </p>
          </div>
        </div>

        {/* Sync Status & Action Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => handleSyncData()}
            disabled={isSyncing}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs shadow-md shadow-blue-600/30 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Sheet'}</span>
          </button>

          <button
            onClick={() => setIsConfigOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-[#1e293b] hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
            title="Configure Google Sheet Link"
          >
            <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sheet URL</span>
          </button>

          <button
            onClick={() => onOpenExportModal ? onOpenExportModal() : handleExportExcel()}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#1e293b] hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all shadow-sm"
            title="Open Reports & Export Center"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Reports & Export</span>
          </button>

          <button
            onClick={() => {
              setEditingProjectId(null);
              setIsAddModalOpen(true);
            }}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Project</span>
          </button>
        </div>
      </div>

      {/* Sync Status Alert Banner */}
      {syncStatusMsg && (
        <div className={`px-4 py-2.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
          syncStatusMsg.type === 'error'
            ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            : syncStatusMsg.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
            : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
        }`}>
          <div className="flex items-center space-x-2">
            {syncStatusMsg.type === 'error' ? (
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{syncStatusMsg.text}</span>
          </div>
          {lastSyncedAt && (
            <span className="text-[10px] text-slate-400 font-mono">
              Last synced: {lastSyncedAt.toLocaleTimeString()}
            </span>
          )}
        </div>
      )}

      {/* 2. THE 5 MANDATORY HIGHLIGHTED KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Metric 1: Projects Running */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md p-4 rounded-2xl border border-cyan-500/30 relative overflow-hidden shadow-lg group hover:border-cyan-400/60 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl group-hover:bg-cyan-500/20 transition-all" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">Projects Running</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <PlayCircle className="w-4 h-4 animate-spin-slow" />
            </div>
          </div>
          <div className="text-3xl font-black text-white font-mono">{kpis.projectsRunning}</div>
          <div className="flex items-center space-x-1.5 mt-2 text-[11px] text-cyan-400/90 font-medium">
            <span>Active in execution phase</span>
          </div>
        </div>

        {/* Metric 2: On Time Projects */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md p-4 rounded-2xl border border-emerald-500/30 relative overflow-hidden shadow-lg group hover:border-emerald-400/60 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">On Time Projects</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white font-mono">{kpis.onTimeProjects}</div>
          <div className="flex items-center space-x-1.5 mt-2 text-[11px] text-emerald-400 font-semibold">
            <span>{kpis.onTimeRatePct}% Schedule Compliance</span>
          </div>
        </div>

        {/* Metric 3: Delayed Projects */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md p-4 rounded-2xl border border-rose-500/30 relative overflow-hidden shadow-lg group hover:border-rose-400/60 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-xl group-hover:bg-rose-500/20 transition-all" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-300">Delayed Projects</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-rose-400 font-mono">{kpis.delayedProjects}</div>
          <div className="flex items-center space-x-1.5 mt-2 text-[11px] text-rose-400 font-semibold">
            <span>{kpis.delayedProjects > 0 ? 'Requires schedule intervention' : 'Zero delays reported'}</span>
          </div>
        </div>

        {/* Metric 4: Under Budget Projects */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md p-4 rounded-2xl border border-teal-500/30 relative overflow-hidden shadow-lg group hover:border-teal-400/60 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/10 rounded-full blur-xl group-hover:bg-teal-500/20 transition-all" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-300">Under Budget</span>
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white font-mono">{kpis.underBudgetProjects}</div>
          <div className="flex items-center space-x-1.5 mt-2 text-[11px] text-teal-400 font-semibold">
            <span>{kpis.underBudgetRatePct}% Cost Saving Efficiency</span>
          </div>
        </div>

        {/* Metric 5: Over Budget Projects */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md p-4 rounded-2xl border border-amber-500/30 relative overflow-hidden shadow-lg group hover:border-amber-400/60 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition-all" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">Over Budget</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-400 font-mono">{kpis.overBudgetProjects}</div>
          <div className="flex items-center space-x-1.5 mt-2 text-[11px] text-amber-400 font-semibold">
            <span>Cost Variance: {formatCurrency(kpis.netBudgetVariance)}</span>
          </div>
        </div>

      </div>

      {/* 3. SEARCH BAR AND ADVANCED FILTER CONTROLS */}
      <div className="bg-[#0f172a] p-4 rounded-2xl border border-slate-800 shadow-xl space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Search Input Bar */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.searchQuery}
              onChange={e => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
              placeholder="Search by project name, customer name, type, status..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-[#172033] border border-slate-700 text-slate-100 placeholder-slate-400 text-xs focus:outline-none focus:border-blue-500 transition-all"
            />
            {filters.searchQuery && (
              <button
                onClick={() => setFilters(prev => ({ ...prev, searchQuery: '' }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Clear All Filters */}
          <button
            onClick={() => setFilters(initialProjectFilters)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all shrink-0 flex items-center space-x-1.5"
          >
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            <span>Reset Filters</span>
          </button>
        </div>

        {/* Selector Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-2 border-t border-slate-800/80">
          
          {/* Filter 1: Status */}
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-400 mb-1 block">Project Status</label>
            <select
              value={filters.status}
              onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#172033] border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Statuses</option>
              <option value="Running">Running</option>
              <option value="Completed">Completed</option>
              <option value="Delayed">Delayed</option>
              <option value="On Hold">On Hold</option>
              <option value="Planning">Planning</option>
            </select>
          </div>

          {/* Filter 2: Timeline Status */}
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-400 mb-1 block">Timeline Health</label>
            <select
              value={filters.timelineStatus}
              onChange={e => setFilters(prev => ({ ...prev, timelineStatus: e.target.value }))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#172033] border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Timelines</option>
              <option value="On Time">On Time</option>
              <option value="Delayed">Delayed</option>
            </select>
          </div>

          {/* Filter 3: Budget Status */}
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-400 mb-1 block">Budget Health</label>
            <select
              value={filters.budgetStatus}
              onChange={e => setFilters(prev => ({ ...prev, budgetStatus: e.target.value }))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#172033] border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Budgets</option>
              <option value="Under Budget">Under Budget</option>
              <option value="On Budget">On Budget</option>
              <option value="Over Budget">Over Budget</option>
            </select>
          </div>

          {/* Filter 4: Project Type */}
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-400 mb-1 block">Project Type</label>
            <select
              value={filters.projectType}
              onChange={e => setFilters(prev => ({ ...prev, projectType: e.target.value }))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#172033] border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Types</option>
              {projectTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Filter 5: Customer Selector */}
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-400 mb-1 block">Customer</label>
            <select
              value={filters.customer}
              onChange={e => setFilters(prev => ({ ...prev, customer: e.target.value }))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#172033] border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Customers</option>
              {customerList.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* 4. VISUAL ANALYTICS CHARTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart 1: Planned vs Actual Cost per Project */}
        <div className="lg:col-span-2 bg-[#0f172a] p-5 rounded-2xl border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-cyan-400" />
              <span>Budget vs Actual Cost Comparison (in ₹ Lakhs)</span>
            </h3>
            <span className="text-xs text-slate-400">Top 10 Projects</span>
          </div>
          <div className="h-[280px]">
            <ReactECharts option={budgetVsCostChartOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

        {/* Chart 2: Timeline Health Donut Breakdown */}
        <div className="bg-[#0f172a] p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Delivery Timeline Health</span>
            </h3>
          </div>
          <div className="h-[230px]">
            <ReactECharts option={timelineHealthChartOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

        {/* Chart 3: Budget Status Breakdown */}
        <div className="bg-[#0f172a] p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span>Budget Health Breakdown</span>
            </h3>
          </div>
          <div className="h-[230px]">
            <ReactECharts option={budgetStatusChartOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

      </div>

      {/* 5. INTERACTIVE PROJECT DATA TABLE */}
      <div className="bg-[#0f172a] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        
        {/* Table Header Controls */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3 bg-[#131b2e]">
          <div className="flex items-center space-x-3">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <FolderKanban className="w-4 h-4 text-indigo-400" />
              <span>Projects Master Registry</span>
            </h3>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
              {filteredProjects.length} Projects
            </span>
          </div>

          <div className="text-xs text-slate-400 flex items-center space-x-4">
            <span>Total Planned: <strong className="text-white">{formatCurrency(kpis.totalPlannedBudget)}</strong></span>
            <span>Total Actual: <strong className="text-white">{formatCurrency(kpis.totalActualCost)}</strong></span>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#090e1a] text-slate-400 text-[11px] uppercase tracking-wider font-extrabold border-b border-slate-800 select-none">
                <th onClick={() => handleSort('sNo')} className="py-3 px-4 cursor-pointer hover:text-white">S.No</th>
                <th onClick={() => handleSort('customerName')} className="py-3 px-4 cursor-pointer hover:text-white">Customer Name</th>
                <th onClick={() => handleSort('projectName')} className="py-3 px-4 cursor-pointer hover:text-white">Project Name</th>
                <th onClick={() => handleSort('projectType')} className="py-3 px-4 cursor-pointer hover:text-white">Type</th>
                <th onClick={() => handleSort('status')} className="py-3 px-4 cursor-pointer hover:text-white">Status</th>
                <th onClick={() => handleSort('startDate')} className="py-3 px-4 cursor-pointer hover:text-white">Start Date</th>
                <th onClick={() => handleSort('plannedEndDate')} className="py-3 px-4 cursor-pointer hover:text-white">Planned End</th>
                <th onClick={() => handleSort('actualEndDate')} className="py-3 px-4 cursor-pointer hover:text-white">Actual End</th>
                <th onClick={() => handleSort('timelineStatus')} className="py-3 px-4 cursor-pointer hover:text-white">Timeline</th>
                <th onClick={() => handleSort('plannedBudget')} className="py-3 px-4 text-right cursor-pointer hover:text-white">Planned Budget</th>
                <th onClick={() => handleSort('actualCost')} className="py-3 px-4 text-right cursor-pointer hover:text-white">Actual Cost</th>
                <th onClick={() => handleSort('budgetVariance')} className="py-3 px-4 text-right cursor-pointer hover:text-white">Variance</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-xs">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400">
                    <Info className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                    <p className="font-semibold text-sm">No projects match the selected filters.</p>
                    <button
                      onClick={() => setFilters(initialProjectFilters)}
                      className="mt-3 px-3 py-1.5 text-xs bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500 transition-all"
                    >
                      Clear Search & Filters
                    </button>
                  </td>
                </tr>
              ) : (
                filteredProjects.map((p) => {
                  const isOver = p.budgetStatus === 'Over Budget';
                  const isUnder = p.budgetStatus === 'Under Budget';

                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedProject(p)}
                      className="hover:bg-[#151e33] transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-400">{p.sNo}</td>
                      
                      <td className="py-3.5 px-4 font-bold text-white group-hover:text-cyan-300 transition-colors">
                        {p.customerName}
                      </td>

                      <td className="py-3.5 px-4 text-slate-200 font-semibold">{p.projectName}</td>

                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                          {p.projectType}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          p.status === 'Completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : p.status === 'Running'
                            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                            : p.status === 'Delayed'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            p.status === 'Completed' ? 'bg-emerald-400' : p.status === 'Running' ? 'bg-cyan-400 animate-ping' : 'bg-rose-400'
                          }`} />
                          <span>{p.status}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">{p.startDate}</td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">{p.plannedEndDate}</td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">{p.actualEndDate}</td>

                      {/* Timeline Health */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          p.timelineStatus === 'On Time'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}>
                          {p.timelineStatus === 'On Time' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          <span>{p.timelineStatus}</span>
                        </span>
                      </td>

                      {/* Planned Budget */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-300">
                        ₹{p.plannedBudget.toLocaleString('en-IN')}
                      </td>

                      {/* Actual Cost */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                        ₹{p.actualCost.toLocaleString('en-IN')}
                      </td>

                      {/* Budget Variance */}
                      <td className="py-3.5 px-4 text-right">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold font-mono border ${
                          isOver
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : isUnder
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {p.budgetVariance > 0 ? `+₹${p.budgetVariance.toLocaleString('en-IN')}` : p.budgetVariance < 0 ? `-₹${Math.abs(p.budgetVariance).toLocaleString('en-IN')}` : '0'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => {
                              setEditingProjectId(p.id);
                              setFormData({
                                customerName: p.customerName,
                                projectName: p.projectName,
                                status: p.status,
                                projectType: p.projectType,
                                startDate: p.startDate,
                                plannedEndDate: p.plannedEndDate,
                                actualEndDate: p.actualEndDate,
                                plannedBudget: p.plannedBudget,
                                actualCost: p.actualCost
                              });
                              setIsAddModalOpen(true);
                            }}
                            className="p-1 rounded bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white transition-all"
                            title="Edit Project"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProject(p.id)}
                            className="p-1 rounded bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white transition-all"
                            title="Delete Project"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: PROJECT DETAIL OVERVIEW DIALOG */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto animate-fade-in">
          <div className="bg-[#0f172a] p-6 rounded-2xl border border-slate-700 max-w-lg w-full shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-extrabold text-cyan-400 uppercase tracking-widest">PROJECT DETAILS</span>
                <h3 className="text-lg font-black text-white">{selectedProject.projectName}</h3>
                <p className="text-xs text-slate-400">{selectedProject.customerName}</p>
              </div>
              <button
                onClick={() => setSelectedProject(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#172033] border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Status</span>
                  <div className="font-bold text-white mt-0.5">{selectedProject.status}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Type</span>
                  <div className="font-bold text-cyan-300 mt-0.5">{selectedProject.projectType}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Timeline Health</span>
                  <div className="font-bold text-emerald-400 mt-0.5">{selectedProject.timelineStatus}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Budget Status</span>
                  <div className="font-bold text-amber-400 mt-0.5">{selectedProject.budgetStatus}</div>
                </div>
              </div>

              <div className="space-y-2 p-3 rounded-xl bg-[#172033] border border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-400">Start Date:</span>
                  <span className="font-mono text-white font-bold">{selectedProject.startDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Planned End Date:</span>
                  <span className="font-mono text-white font-bold">{selectedProject.plannedEndDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Actual End Date:</span>
                  <span className="font-mono text-white font-bold">{selectedProject.actualEndDate}</span>
                </div>
              </div>

              <div className="space-y-2 p-3 rounded-xl bg-[#172033] border border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-400">Planned Budget:</span>
                  <span className="font-mono font-bold text-white">₹{selectedProject.plannedBudget.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Actual Cost:</span>
                  <span className="font-mono font-bold text-white">₹{selectedProject.actualCost.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-700">
                  <span className="text-slate-300 font-bold">Budget Variance:</span>
                  <span className={`font-mono font-black ${selectedProject.budgetVariance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {selectedProject.budgetVariance > 0 ? `+₹${selectedProject.budgetVariance.toLocaleString('en-IN')}` : `₹${selectedProject.budgetVariance.toLocaleString('en-IN')}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedProject(null)}
                className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-500 transition-all"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT PROJECT DIALOG */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto animate-fade-in">
          <div className="bg-[#0f172a] p-6 rounded-2xl border border-slate-700 max-w-md w-full shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">
                {editingProjectId ? 'Edit Project Details' : 'Add New Project'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Customer Name</label>
                <input
                  type="text"
                  required
                  value={formData.customerName}
                  onChange={e => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                  placeholder="e.g. Amar Ujala"
                  className="w-full px-3 py-2 rounded-xl bg-[#172033] border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={formData.projectName}
                  onChange={e => setFormData(prev => ({ ...prev, projectName: e.target.value }))}
                  placeholder="e.g. CCTV INSTALLATION"
                  className="w-full px-3 py-2 rounded-xl bg-[#172033] border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#172033] border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Running">Running</option>
                    <option value="Completed">Completed</option>
                    <option value="Delayed">Delayed</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Planning">Planning</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Project Type</label>
                  <input
                    type="text"
                    required
                    value={formData.projectType}
                    onChange={e => setFormData(prev => ({ ...prev, projectType: e.target.value }))}
                    placeholder="e.g. CCTV, Networking"
                    className="w-full px-3 py-2 rounded-xl bg-[#172033] border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Start Date</label>
                  <input
                    type="text"
                    value={formData.startDate}
                    onChange={e => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-[#172033] border border-slate-700 text-white text-[11px]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Planned End</label>
                  <input
                    type="text"
                    value={formData.plannedEndDate}
                    onChange={e => setFormData(prev => ({ ...prev, plannedEndDate: e.target.value }))}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-[#172033] border border-slate-700 text-white text-[11px]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Actual End</label>
                  <input
                    type="text"
                    value={formData.actualEndDate}
                    onChange={e => setFormData(prev => ({ ...prev, actualEndDate: e.target.value }))}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-[#172033] border border-slate-700 text-white text-[11px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Planned Budget (₹)</label>
                  <input
                    type="number"
                    value={formData.plannedBudget}
                    onChange={e => setFormData(prev => ({ ...prev, plannedBudget: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#172033] border border-slate-700 text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Actual Cost (₹)</label>
                  <input
                    type="number"
                    value={formData.actualCost}
                    onChange={e => setFormData(prev => ({ ...prev, actualCost: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#172033] border border-slate-700 text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md"
                >
                  {editingProjectId ? 'Save Changes' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: GOOGLE SHEET LINK CONFIGURATION DIALOG */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto animate-fade-in">
          <div className="bg-[#0f172a] p-6 rounded-2xl border border-slate-700 max-w-lg w-full shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <ExternalLink className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Google Sheet Connection URL</h3>
              </div>
              <button
                onClick={() => setIsConfigOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-3 leading-relaxed">
              Paste the public link to your Google Sheet containing Project records.
            </p>

            <input
              type="text"
              value={sheetUrl}
              onChange={e => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#172033] border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-blue-500 mb-4"
            />

            <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
              <button
                onClick={() => setIsConfigOpen(false)}
                className="px-4 py-2 text-slate-400 hover:text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSheetUrl}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md"
              >
                Save & Connect Sheet
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProjectDashboard;
