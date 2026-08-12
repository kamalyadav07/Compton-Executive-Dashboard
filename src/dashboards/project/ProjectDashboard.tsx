import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import ReactECharts from 'echarts-for-react';
import {
  PlayCircle,
  Clock,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  FolderKanban,
  Plus,
  CheckCircle2,
  DollarSign,
  X,
  Sparkles,
  Info,
  Edit,
  Trash2,
  Eye,
  ArrowUpDown
} from 'lucide-react';
import type { ProjectRecord, ProjectFilterState } from '../../types/project';
import {
  INITIAL_SAMPLE_PROJECTS,
  DEFAULT_PROJECT_SHEET_URL,
  fetchProjectSheetData,
  filterProjectRecords,
  calculateProjectKPIs
} from '../../engine/projectSheetsService';
import { scanPortfolioForOverspendRisk, type ProjectHealthSignal } from '../../engine/projectHealthEngine';

const initialProjectFilters: ProjectFilterState = {
  searchQuery: '',
  dateFilter: 'All Dates',
  status: 'All',
  timelineStatus: 'All',
  budgetStatus: 'All',
  projectType: 'All',
  customer: 'All'
};

interface ProjectDashboardProps {
  onOpenExportModal?: () => void;
  filters?: ProjectFilterState;
  onFilterChange?: (newFilters: ProjectFilterState) => void;
  onResetFilters?: () => void;
}

export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({
  onOpenExportModal: _onOpenExportModal,
  filters: propFilters,
  onFilterChange: propOnFilterChange,
  onResetFilters: _propOnResetFilters
}) => {
  const [sheetUrl, _setSheetUrl] = useState<string>(() => {
    const saved = localStorage.getItem('project_dashboard_sheet_url');
    if (saved && saved.includes('1-HRp_m7bQkFUifOEV8wI8Yn2OpAMJtOnu6mH-lxUbfU')) {
      const correctUrl = DEFAULT_PROJECT_SHEET_URL || 'https://docs.google.com/spreadsheets/d/1-iXdZ3bhvsE-xQs5xplb9xG0L-sOVTnMMYNdfXrFJUQ/edit?gid=0#gid=0';
      localStorage.setItem('project_dashboard_sheet_url', correctUrl);
      return correctUrl;
    }
    return saved || DEFAULT_PROJECT_SHEET_URL;
  });

  const [projects, setProjects] = useState<ProjectRecord[]>(INITIAL_SAMPLE_PROJECTS);
  const [_isSyncing, setIsSyncing] = useState<boolean>(false);
  const [_lastSyncedAt, setLastSyncedAt] = useState<Date | null>(new Date());
  const [_syncStatusMsg, setSyncStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string }>({
    type: 'info',
    text: 'Sync connected to Google Sheet.'
  });

  const [localFilters, setLocalFilters] = useState<ProjectFilterState>(initialProjectFilters);
  const filters = propFilters || localFilters;
  const setFilters = (newVal: ProjectFilterState | ((prev: ProjectFilterState) => ProjectFilterState)) => {
    const updated = typeof newVal === 'function' ? newVal(filters) : newVal;
    if (propOnFilterChange) propOnFilterChange(updated);
    else setLocalFilters(updated);
  };
  const [sortField, setSortField] = useState<keyof ProjectRecord>('sNo');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  // Tracks which at-risk project IDs the user has already dismissed from the banner
  const [dismissedOverspendIds, setDismissedOverspendIds] = useState<Set<string>>(new Set());

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

  const isAnyProjectModalOpen = Boolean(selectedProject || isAddModalOpen);

  useEffect(() => {
    if (isAnyProjectModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isAnyProjectModalOpen]);

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

  // Filtered project list
  const filteredProjects = useMemo(() => {
    const list = filterProjectRecords(projects, filters);

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
  const isAllStatusFilter = filters.status === 'All';
  const kpis = useMemo(() => {
    return calculateProjectKPIs(filteredProjects, isAllStatusFilter);
  }, [filteredProjects, isAllStatusFilter]);

  // EVM Early-Warning: scan ALL running projects (not the filtered view) so the
  // banner fires even when the user has filtered to a subset of the portfolio.
  const overspendSignals: ProjectHealthSignal[] = useMemo(() => {
    return scanPortfolioForOverspendRisk(projects);
  }, [projects]);

  // Format currency helper
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

  const handleEditClick = (p: ProjectRecord) => {
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
  };

  const handleDeleteClick = (id: string) => {
    if (window.confirm("Are you sure you want to remove this project record?")) {
      setProjects(prev => prev.filter(p => p.id !== id));
      if (selectedProject?.id === id) setSelectedProject(null);
    }
  };

  // -------------------------------------------------------------
  // Balanced Executive ECharts Configurations
  // -------------------------------------------------------------

  // 1. Planned Budget vs Actual Cost Chart (Refined Vertical Bar)
  const budgetVsCostChartOption = useMemo(() => {
    const topProjects = filteredProjects.slice(0, 10);
    const names = topProjects.map(p => p.customerName);
    const plannedData = topProjects.map(p => p.plannedBudget / 100000);
    const actualData = topProjects.map(p => p.actualCost / 100000);

    const maxVal = Math.max(...plannedData, ...actualData, 0.5);
    const yMax = Math.ceil(maxVal * 1.15 * 10) / 10;

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params: any) => {
          let res = `<div class="font-bold border-b border-slate-700 pb-1 mb-1 text-slate-200">${params[0].axisValue}</div>`;
          params.forEach((item: any) => {
            res += `<div class="flex items-center justify-between gap-4 text-xs mt-1">
              <span style="color:${item.color}">● ${item.seriesName}:</span>
              <span class="font-mono font-bold">₹${Number(item.value).toFixed(2)} Lakhs</span>
            </div>`;
          });
          return res;
        }
      },
      legend: {
        top: '0%',
        right: '2%',
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }
      },
      grid: { top: '15%', left: '3%', right: '3%', bottom: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        data: names.length > 0 ? names : ['No Projects'],
        axisLabel: { color: '#cbd5e1', fontSize: 11, fontWeight: 'bold' },
        axisLine: { lineStyle: { color: '#334155' } }
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: yMax,
        name: '₹ Lakhs',
        nameTextStyle: { color: '#94a3b8', fontSize: 10 },
        axisLabel: { color: '#94a3b8', fontSize: 10, formatter: '₹{value}L' },
        splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } }
      },
      series: [
        {
          name: 'Planned Budget',
          type: 'bar',
          barMaxWidth: 28,
          barGap: '20%',
          data: plannedData.length > 0 ? plannedData : [0],
          label: {
            show: true,
            position: 'top',
            formatter: (params: any) => `₹${Number(params.value).toFixed(1)}L`,
            fontSize: 9,
            fontWeight: 'bold',
            color: '#38bdf8'
          },
          itemStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: '#38bdf8' }, { offset: 1, color: '#1d4ed8' }]
            },
            borderRadius: [6, 6, 0, 0]
          }
        },
        {
          name: 'Actual Cost',
          type: 'bar',
          barMaxWidth: 28,
          data: actualData.length > 0 ? actualData : [0],
          label: {
            show: true,
            position: 'top',
            formatter: (params: any) => `₹${Number(params.value).toFixed(1)}L`,
            fontSize: 9,
            fontWeight: 'bold',
            color: '#fb7185'
          },
          itemStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: '#fb7185' }, { offset: 1, color: '#e11d48' }]
            },
            borderRadius: [6, 6, 0, 0]
          }
        }
      ]
    };
  }, [filteredProjects]);

  // 2. Project Type Breakdown Chart (Count of Projects by Category like CCTV, Networking, etc.)
  const projectTypeChartOption = useMemo(() => {
    const typeCounts: Record<string, { count: number; totalBudget: number }> = {};

    filteredProjects.forEach(p => {
      const type = p.projectType || 'Other';
      if (!typeCounts[type]) {
        typeCounts[type] = { count: 0, totalBudget: 0 };
      }
      typeCounts[type].count += 1;
      typeCounts[type].totalBudget += (p.plannedBudget || p.actualCost || 0);
    });

    const categories = Object.keys(typeCounts);
    const counts = categories.map(cat => typeCounts[cat].count);

    const colors = [
      { start: '#38bdf8', end: '#0284c7' }, // Cyan / Sky blue
      { start: '#818cf8', end: '#4f46e5' }, // Indigo
      { start: '#c084fc', end: '#9333ea' }, // Purple
      { start: '#f472b6', end: '#db2777' }, // Pink
      { start: '#fb923c', end: '#ea580c' }, // Orange
      { start: '#34d399', end: '#059669' }, // Emerald
      { start: '#facc15', end: '#ca8a04' }, // Yellow
      { start: '#a7f3d0', end: '#10b981' }  // Mint
    ];

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params: any) => {
          const item = params[0];
          const idx = item.dataIndex;
          const catName = categories[idx] || item.axisValue;
          const count = typeCounts[catName]?.count || 0;
          const budget = typeCounts[catName]?.totalBudget || 0;
          const budgetFormatted = budget >= 100000 
            ? `₹${(budget / 100000).toFixed(2)} Lakhs` 
            : `₹${budget.toLocaleString('en-IN')}`;

          return `<div class="font-bold border-b border-slate-700 pb-1 mb-1 text-cyan-300">${catName}</div>
            <div class="flex items-center justify-between gap-4 text-xs mt-1">
              <span class="text-slate-300">Total Projects:</span>
              <span class="font-mono font-bold text-white">${count} Project${count > 1 ? 's' : ''}</span>
            </div>
            <div class="flex items-center justify-between gap-4 text-xs mt-1">
              <span class="text-slate-300">Total Value:</span>
              <span class="font-mono font-bold text-emerald-400">${budgetFormatted}</span>
            </div>`;
        }
      },
      grid: { top: 32, left: 20, right: 20, bottom: 20, containLabel: true },
      xAxis: {
        type: 'category',
        data: categories.length > 0 ? categories : ['No Projects'],
        axisLabel: { 
          color: '#e2e8f0', 
          fontSize: 12, 
          fontWeight: 'bold',
          interval: 0,
          rotate: categories.length > 6 ? 15 : 0
        },
        axisLine: { lineStyle: { color: '#334155' } }
      },
      yAxis: {
        type: 'value',
        name: 'Projects',
        nameGap: 10,
        nameTextStyle: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold', align: 'left' },
        minInterval: 1,
        axisLabel: { color: '#94a3b8', fontSize: 11, fontWeight: 'medium' },
        splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } }
      },
      series: [
        {
          name: 'Projects',
          type: 'bar',
          barMaxWidth: 38,
          data: counts.map((cnt, idx) => {
            const colorPair = colors[idx % colors.length];
            return {
              value: cnt,
              label: {
                show: true,
                position: 'top',
                formatter: '{c}',
                fontSize: 12,
                fontWeight: 'bold',
                color: '#f8fafc'
              },
              itemStyle: {
                color: {
                  type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                  colorStops: [
                    { offset: 0, color: colorPair.start },
                    { offset: 1, color: colorPair.end }
                  ]
                },
                borderRadius: [6, 6, 0, 0]
              }
            };
          })
        }
      ]
    };
  }, [filteredProjects]);

  // 3. Timeline Health Donut Chart
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
      legend: { bottom: '0%', left: 'center', textStyle: { color: '#94a3b8', fontSize: 11 } },
      series: [
        {
          name: 'Timeline Health',
          type: 'pie',
          radius: ['52%', '78%'],
          center: ['50%', '42%'],
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
              value: kpis.portfolioOnTimeProjects,
              name: 'On Time Projects',
              itemStyle: { color: '#10b981' }
            },
            {
              value: kpis.portfolioDelayedProjects,
              name: 'Delayed Projects',
              itemStyle: { color: '#f43f5e' }
            }
          ]
        }
      ]
    };
  }, [kpis]);

  // 4. Budget Status Breakdown Donut Chart
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
      legend: { bottom: '0%', left: 'center', textStyle: { color: '#94a3b8', fontSize: 11 } },
      series: [
        {
          name: 'Budget Health',
          type: 'pie',
          radius: ['52%', '78%'],
          center: ['50%', '42%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 8, borderColor: '#0f172a', borderWidth: 3 },
          label: {
            show: true,
            position: 'center',
            formatter: `{val|${kpis.portfolioUnderBudgetProjects + kpis.portfolioOnBudgetProjects}}\n{sub|ON/UNDER BUDGET}`,
            rich: {
              val: { fontSize: 22, fontWeight: 'bold', color: '#34d399', lineHeight: 28 },
              sub: { fontSize: 9, color: '#94a3b8', lineHeight: 14 }
            }
          },
          data: [
            {
              value: kpis.portfolioUnderBudgetProjects,
              name: 'Under Budget',
              itemStyle: { color: '#10b981' }
            },
            {
              value: kpis.portfolioOnBudgetProjects,
              name: 'On Budget',
              itemStyle: { color: '#3b82f6' }
            },
            {
              value: kpis.portfolioOverBudgetProjects,
              name: 'Over Budget',
              itemStyle: { color: '#f43f5e' }
            }
          ]
        }
      ]
    };
  }, [kpis]);

  return (
    <div className="space-y-6 pb-12 animate-fade-in text-slate-100 max-w-[1600px] mx-auto py-2">

      {/* ── EVM EARLY-WARNING BANNER (additive, layered above the existing budget status cards) ── */}
      {overspendSignals
        .filter(sig => sig.shouldTriggerPopup && !dismissedOverspendIds.has(sig.projectId))
        .map(sig => {
          const isCritical = sig.riskLevel === 'Critical Overspend Forecast';
          return (
            <div
              key={sig.projectId}
              className={`animate-fade-in relative rounded-2xl border px-5 py-4 shadow-xl backdrop-blur-md flex items-start gap-4 ${
                isCritical
                  ? 'bg-rose-950/60 border-rose-500/50 shadow-rose-900/30'
                  : 'bg-amber-950/60 border-amber-500/50 shadow-amber-900/30'
              }`}
            >
              {/* Icon */}
              <div className={`shrink-0 mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center border ${
                isCritical
                  ? 'bg-rose-500/20 border-rose-500/30 text-rose-400'
                  : 'bg-amber-500/20 border-amber-500/30 text-amber-400'
              }`}>
                <AlertTriangle className="w-5 h-5" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Badge row */}
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${
                    isCritical
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}>
                    ⚡ {sig.riskLevel}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 font-bold">
                    Spend pace: <strong className={isCritical ? 'text-rose-300' : 'text-amber-300'}>
                      {sig.spendPaceRatio.toFixed(2)}×
                    </strong> planned rate
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Forecast final cost: <strong className="text-white">₹{sig.forecastFinalCost.toLocaleString('en-IN')}</strong>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Overrun: <strong className={isCritical ? 'text-rose-300' : 'text-amber-300'}>
                      +₹{sig.forecastOverrunAmount.toLocaleString('en-IN')} ({sig.forecastOverrunPct}%)
                    </strong>
                  </span>
                </div>
                {/* Pre-written EVM message from the engine */}
                <p className="text-xs text-slate-300 leading-relaxed">{sig.message}</p>
              </div>

              {/* Dismiss button */}
              <button
                onClick={() => setDismissedOverspendIds(prev => new Set([...prev, sig.projectId]))}
                className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
                title="Dismiss this warning"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })
      }
      {/* 2. EXECUTIVE COMPOUND KPI METRIC CARDS (3 SEPARATE GROUPED BOXES) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* GROUP 1: TOTAL PROJECT SUMMARY CARD (Running | Completed) */}
        <div className="lg:col-span-4 bg-[#0f172a]/95 backdrop-blur-md p-5 rounded-2xl border border-blue-500/30 relative overflow-hidden shadow-xl flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-28 h-28 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
          
          {/* Card Header */}
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800/80">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                <FolderKanban className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-white tracking-wide uppercase">Total Project</h3>
                <p className="text-[10px] text-slate-400 font-mono">Portfolio status</p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
              {kpis.totalProjects} Total
            </span>
          </div>

          {/* Sub-cards Grid: Running vs Completed */}
          <div className="grid grid-cols-2 gap-3">
            {/* Running Sub-Card */}
            <div className="bg-[#172033]/90 p-3.5 rounded-xl border border-cyan-500/30 relative overflow-hidden group hover:border-cyan-400/60 transition-all shadow-inner">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">Running</span>
                <PlayCircle className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
              </div>
              <div className="text-2xl font-black text-white font-mono">{kpis.projectsRunning}</div>
              <div className="text-[10px] text-cyan-400/90 font-medium mt-1 truncate">Active execution</div>
            </div>

            {/* Completed Sub-Card */}
            <div className="bg-[#172033]/90 p-3.5 rounded-xl border border-emerald-500/30 relative overflow-hidden group hover:border-emerald-400/60 transition-all shadow-inner">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Completed</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-white font-mono">{kpis.totalProjects - kpis.projectsRunning}</div>
              <div className="text-[10px] text-emerald-400/90 font-medium mt-1 truncate">Delivered</div>
            </div>
          </div>
        </div>

        {/* GROUP 2: RUNNING PROJECTS SCHEDULE CARD (Delayed | Ontime) */}
        <div className="lg:col-span-4 bg-[#0f172a]/95 backdrop-blur-md p-5 rounded-2xl border border-cyan-500/30 relative overflow-hidden shadow-xl flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-28 h-28 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
          
          {/* Card Header */}
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800/80">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                <PlayCircle className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-white tracking-wide uppercase">Running Projects</h3>
                <p className="text-[10px] text-slate-400 font-mono">Timeline schedule</p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {kpis.projectsRunning} Running
            </span>
          </div>

          {/* Breakdown Cards Grid: Delayed vs Ontime */}
          <div className="grid grid-cols-2 gap-3">
            
            {/* Delayed (X) */}
            <div className="bg-[#172033]/90 p-3.5 rounded-xl border border-rose-500/30 relative overflow-hidden group hover:border-rose-400/60 transition-all shadow-inner">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300">Delayed</span>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <div className="text-2xl font-black text-rose-400 font-mono">{kpis.delayedProjects}</div>
              <div className="text-[10px] text-rose-400/90 font-medium mt-1 truncate">Intervention needed</div>
            </div>

            {/* On Time (Y) */}
            <div className="bg-[#172033]/90 p-3.5 rounded-xl border border-emerald-500/30 relative overflow-hidden group hover:border-emerald-400/60 transition-all shadow-inner">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Ontime</span>
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-white font-mono">{kpis.onTimeProjects}</div>
              <div className="text-[10px] text-emerald-400/90 font-medium mt-1 truncate">{kpis.onTimeRatePct}% Compliance</div>
            </div>

          </div>
        </div>

        {/* GROUP 3: BUDGET STATUS CARD (Under Budget | Over Budget) */}
        <div className="lg:col-span-4 bg-[#0f172a]/95 backdrop-blur-md p-5 rounded-2xl border border-teal-500/30 relative overflow-hidden shadow-xl flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-28 h-28 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />
          
          {/* Card Header */}
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800/80">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
                <TrendingDown className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-white tracking-wide uppercase">Budget Status</h3>
                <p className="text-[10px] text-slate-400 font-mono">Cost health analysis</p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
              Budget Health
            </span>
          </div>

          {/* Breakdown Cards Grid: Under Budget vs Over Budget */}
          <div className="grid grid-cols-2 gap-3">
            
            {/* Under Budget (Z) */}
            <div className="bg-[#172033]/90 p-3.5 rounded-xl border border-teal-500/30 relative overflow-hidden group hover:border-teal-400/60 transition-all shadow-inner">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-300">Under Budget</span>
                <TrendingDown className="w-3.5 h-3.5 text-teal-400" />
              </div>
              <div className="text-2xl font-black text-white font-mono">{kpis.underBudgetProjects}</div>
              <div className="text-[10px] text-teal-400/90 font-medium mt-1 truncate">{kpis.underBudgetRatePct}% Cost Saving</div>
            </div>

            {/* Over Budget */}
            <div className="bg-[#172033]/90 p-3.5 rounded-xl border border-amber-500/30 relative overflow-hidden group hover:border-amber-400/60 transition-all shadow-inner">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">Over Budget</span>
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-amber-400 font-mono">{kpis.overBudgetProjects}</div>
              <div className="text-[10px] text-amber-400/90 font-medium mt-1 truncate">Variance: {formatCurrency(kpis.netBudgetVariance)}</div>
            </div>

          </div>
        </div>

      </div>

      {/* 3. SYMMETRICAL 2x2 BALANCED VISUAL ANALYTICS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Planned vs Actual Cost per Project */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800 shadow-xl space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-cyan-400" />
              <span>Planned Budget vs Actual Cost (in ₹ Lakhs)</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-400 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700">
              Top 10 Projects
            </span>
          </div>
          <div className="h-[220px] w-full">
            <ReactECharts option={budgetVsCostChartOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

        {/* Chart 2: Project Type Breakdown (CCTV, Networking, etc.) */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800 shadow-xl space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <FolderKanban className="w-4 h-4 text-cyan-400" />
              <span>Projects by Project Type</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-400 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700">
              Type Breakdown
            </span>
          </div>
          <div className="h-[220px] w-full">
            <ReactECharts option={projectTypeChartOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

        {/* Chart 3: Delivery Timeline Health */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800 shadow-xl space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Delivery Timeline Health Compliance</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-400 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700">
              Schedule Health
            </span>
          </div>
          <div className="h-[220px] w-full">
            <ReactECharts option={timelineHealthChartOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

        {/* Chart 4: Budget Health Breakdown */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800 shadow-xl space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Budget Health Breakdown</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-400 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700">
              Cost Compliance
            </span>
          </div>
          <div className="h-[220px] w-full">
            <ReactECharts option={budgetStatusChartOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

      </div>

      {/* 4. INTERACTIVE PROJECTS MASTER REGISTRY TABLE */}
      <div className="bg-[#0f172a]/95 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
        
        {/* Table Header Controls Toolbar */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between flex-wrap gap-4 bg-[#111827]">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-extrabold text-white">Projects Master Registry</h3>
                <span className="px-2.5 py-0.5 text-[10px] font-mono font-extrabold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {filteredProjects.length} Projects
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4 text-xs">
            <div className="hidden md:flex items-center space-x-3 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 font-mono">
              <span className="text-slate-400 text-[11px]">Budget: <strong className="text-slate-200">{formatCurrency(kpis.totalPlannedBudget)}</strong></span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 text-[11px]">Spent: <strong className="text-white">{formatCurrency(kpis.totalActualCost)}</strong></span>
              <span className="text-slate-600">•</span>
              <span className={`text-[11px] font-bold ${kpis.netBudgetVariance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {kpis.netBudgetVariance > 0 ? `+${formatCurrency(kpis.netBudgetVariance)} Over` : 'Under Budget'}
              </span>
            </div>

            <button
              onClick={() => {
                setEditingProjectId(null);
                setIsAddModalOpen(true);
              }}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-blue-600/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Project</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0b1329] text-slate-400 text-[11px] uppercase tracking-wider font-extrabold border-b border-slate-800 select-none sticky top-0 z-10">
                <th onClick={() => handleSort('sNo')} className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors">
                  <div className="flex items-center space-x-1">
                    <span>S.No</span>
                    <ArrowUpDown className={`w-3 h-3 ${sortField === 'sNo' ? 'text-blue-400 opacity-100' : 'opacity-40'}`} />
                  </div>
                </th>
                <th onClick={() => handleSort('customerName')} className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors">
                  <div className="flex items-center space-x-1">
                    <span>Customer Name</span>
                    <ArrowUpDown className={`w-3 h-3 ${sortField === 'customerName' ? 'text-blue-400 opacity-100' : 'opacity-40'}`} />
                  </div>
                </th>
                <th onClick={() => handleSort('projectName')} className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors">
                  <div className="flex items-center space-x-1">
                    <span>Project Name</span>
                    <ArrowUpDown className={`w-3 h-3 ${sortField === 'projectName' ? 'text-blue-400 opacity-100' : 'opacity-40'}`} />
                  </div>
                </th>
                <th onClick={() => handleSort('projectType')} className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors">Type</th>
                <th onClick={() => handleSort('status')} className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors">Status</th>
                <th onClick={() => handleSort('startDate')} className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors">Start Date</th>
                <th onClick={() => handleSort('plannedEndDate')} className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors">Planned End</th>
                <th onClick={() => handleSort('actualEndDate')} className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors">Actual End</th>
                <th onClick={() => handleSort('timelineStatus')} className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors">Timeline</th>
                <th onClick={() => handleSort('plannedBudget')} className="py-3.5 px-4 text-right cursor-pointer hover:text-white transition-colors">Planned Budget</th>
                <th onClick={() => handleSort('actualCost')} className="py-3.5 px-4 text-right cursor-pointer hover:text-white transition-colors">Actual Spent</th>
                <th onClick={() => handleSort('budgetVariance')} className="py-3.5 px-4 text-right cursor-pointer hover:text-white transition-colors">Variance</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-14 text-center text-slate-400">
                    <Info className="w-8 h-8 text-slate-500 mx-auto mb-2.5 animate-pulse" />
                    <p className="font-bold text-sm text-slate-200">No project records match the active criteria.</p>
                    <p className="text-xs text-slate-500 mt-1 mb-3">Try clearing search inputs or adjusting status filters.</p>
                    <button
                      onClick={() => setFilters(initialProjectFilters)}
                      className="px-4 py-2 text-xs bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition-all shadow-md"
                    >
                      Reset All Filters
                    </button>
                  </td>
                </tr>
              ) : (
                filteredProjects.map((p) => {
                  const isOver = p.budgetStatus === 'Over Budget';
                  const isUnder = p.budgetStatus === 'Under Budget';
                  const customerInitials = p.customerName ? p.customerName.slice(0, 2).toUpperCase() : 'PR';

                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedProject(p)}
                      className="hover:bg-slate-800/50 transition-all cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-400">
                        #{p.sNo}
                      </td>
                      
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-300 font-extrabold flex items-center justify-center text-[10px] border border-blue-500/30 shrink-0 font-mono">
                            {customerInitials}
                          </div>
                          <span className="font-bold text-white group-hover:text-cyan-300 transition-colors">
                            {p.customerName}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-200 font-semibold">{p.projectName}</td>

                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 text-[10px] font-extrabold rounded-lg bg-slate-800 text-cyan-300 border border-slate-700">
                          {p.projectType}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 text-[10px] font-extrabold rounded-full border inline-flex items-center ${
                          p.status === 'Completed'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : p.status === 'Running'
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                            : p.status === 'Delayed'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}>
                          {p.status === 'Running' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping inline-block mr-1.5" />
                          )}
                          {p.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">{p.startDate}</td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">{p.plannedEndDate}</td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">{p.actualEndDate}</td>

                      <td className="py-3.5 px-4">
                        {p.timelineStatus === 'Delayed' ? (
                          <span className="px-2.5 py-1 text-[10px] font-extrabold rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 inline-flex items-center space-x-1">
                            <AlertTriangle className="w-3 h-3 text-rose-400" />
                            <span>Delayed ({p.delayDays}d)</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-[10px] font-extrabold rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 inline-flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>On Time</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-300">
                        {formatCurrency(p.plannedBudget)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                        {formatCurrency(p.actualCost)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-black">
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] ${
                          isOver
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : isUnder
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}>
                          {p.budgetVariance > 0 ? `+${formatCurrency(p.budgetVariance)}` : formatCurrency(p.budgetVariance)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center space-x-1" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedProject(p)}
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleEditClick(p)}
                          className="p-1.5 text-slate-400 hover:text-cyan-400 rounded-lg hover:bg-slate-800 transition-all"
                          title="Edit Project"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(p.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-all"
                          title="Delete Project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Bar */}
        <div className="px-4 py-3 bg-[#111827] border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono">
            Showing <strong className="text-white">{filteredProjects.length}</strong> of <strong className="text-white">{projects.length}</strong> total project records
          </span>
        </div>

      </div>

      {/* MODAL 1: VIEW DETAILED PROJECT MODAL */}
      {selectedProject && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 backdrop-blur-lg p-4 overflow-hidden">
          <div className="glass-panel p-6 rounded-2xl border border-slate-700/80 max-w-lg w-full shadow-2xl space-y-4 relative bg-slate-900/95 my-auto animate-scale-in">
            <button
              onClick={() => setSelectedProject(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 transition-all border border-slate-700"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold font-mono border border-cyan-500/30">
                #{selectedProject.sNo}
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">{selectedProject.customerName}</h3>
                <p className="text-xs text-slate-400 font-medium">{selectedProject.projectName}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Project Type</span>
                <span className="font-bold text-cyan-300">{selectedProject.projectType}</span>
              </div>
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Execution Status</span>
                <span className="font-bold text-white px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 inline-block">
                  {selectedProject.status}
                </span>
              </div>
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Planned Schedule</span>
                <span className="font-mono text-slate-300 text-[11px]">{selectedProject.startDate} → {selectedProject.plannedEndDate}</span>
              </div>
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Timeline Health</span>
                <span className={`font-bold ${selectedProject.timelineStatus === 'Delayed' ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {selectedProject.timelineStatus} ({selectedProject.delayDays}d delay)
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-950/90 rounded-xl border border-slate-800 space-y-2 text-xs">
              <h4 className="font-bold text-white border-b border-slate-800 pb-1.5 flex items-center justify-between">
                <span>Budget Variance Breakdown</span>
                <span className="text-[10px] font-mono text-slate-400 font-normal">Currency in INR (₹)</span>
              </h4>
              <div className="space-y-2 pt-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Planned Budget:</span>
                  <span className="font-mono font-bold text-slate-200">₹{selectedProject.plannedBudget.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Actual Spent Cost:</span>
                  <span className="font-mono font-bold text-white">₹{selectedProject.actualCost.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-800">
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
                className="px-5 py-2.5 bg-blue-600 text-white font-extrabold text-xs rounded-xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 2: ADD / EDIT PROJECT DIALOG */}
      {isAddModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 backdrop-blur-lg p-4 overflow-hidden">
          <div className="glass-panel p-6 rounded-2xl border border-slate-700/80 max-w-md w-full shadow-2xl relative bg-slate-900/95 my-auto animate-scale-in">
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    {editingProjectId ? 'Edit Project Details' : 'Add New Project'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Configure customer, schedule & budget specs</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-300 tracking-wider block mb-1">Customer Name</label>
                <input
                  type="text"
                  required
                  value={formData.customerName}
                  onChange={e => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                  placeholder="e.g. Amar Ujala"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-medium transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-300 tracking-wider block mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={formData.projectName}
                  onChange={e => setFormData(prev => ({ ...prev, projectName: e.target.value }))}
                  placeholder="e.g. CCTV INSTALLATION"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-medium transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-300 tracking-wider block mb-1">Project Type</label>
                  <input
                    type="text"
                    required
                    value={formData.projectType}
                    onChange={e => setFormData(prev => ({ ...prev, projectType: e.target.value }))}
                    placeholder="e.g. CCTV"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-300 tracking-wider block mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as ProjectRecord['status'] }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-blue-500 font-medium"
                  >
                    <option value="Running">Running</option>
                    <option value="Completed">Completed</option>
                    <option value="Delayed">Delayed</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-300 tracking-wider block mb-1">Start Date</label>
                  <input
                    type="text"
                    value={formData.startDate}
                    onChange={e => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-300 tracking-wider block mb-1">Planned End</label>
                  <input
                    type="text"
                    value={formData.plannedEndDate}
                    onChange={e => setFormData(prev => ({ ...prev, plannedEndDate: e.target.value }))}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-300 tracking-wider block mb-1">Actual End</label>
                  <input
                    type="text"
                    value={formData.actualEndDate}
                    onChange={e => setFormData(prev => ({ ...prev, actualEndDate: e.target.value }))}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-300 tracking-wider block mb-1">Planned Budget (₹)</label>
                  <input
                    type="number"
                    required
                    value={formData.plannedBudget}
                    onChange={e => setFormData(prev => ({ ...prev, plannedBudget: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-300 tracking-wider block mb-1">Actual Spent (₹)</label>
                  <input
                    type="number"
                    required
                    value={formData.actualCost}
                    onChange={e => setFormData(prev => ({ ...prev, actualCost: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Live Variance Calculation Preview */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400 font-sans font-semibold">Live Variance Preview:</span>
                <span className={`font-black ${formData.actualCost - formData.plannedBudget > 0 ? 'text-rose-400' : formData.actualCost - formData.plannedBudget < 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {formData.actualCost - formData.plannedBudget > 0 
                    ? `+₹${(formData.actualCost - formData.plannedBudget).toLocaleString('en-IN')} (Over Budget)` 
                    : formData.actualCost - formData.plannedBudget < 0 
                    ? `₹${(formData.actualCost - formData.plannedBudget).toLocaleString('en-IN')} (Under Budget)` 
                    : '₹0 (On Budget)'}
                </span>
              </div>

              <div className="pt-3 flex justify-end space-x-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-lg shadow-blue-600/25 active:scale-95 transition-all"
                >
                  {editingProjectId ? 'Save Changes' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
