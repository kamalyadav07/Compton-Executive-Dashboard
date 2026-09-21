import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts';
import {
  Headphones,
  Clock,
  Star,
  ArrowUpRight,
  Ticket,
  Activity,
  PauseCircle,
  Eye,
  AlertTriangle,
  Building2,
  AlertCircle,
  TrendingUp,
  Laptop,
  Wifi,
  Layers,
  CalendarCheck,
  Printer,
  ShieldCheck,
  User,
  ChevronRight,
  FilterX,
  FileSpreadsheet,
  X,
  RefreshCw,
  ShieldAlert,
  Flame
} from 'lucide-react';
import {
  fetchServiceStats,
  fetchTopPerformers,
  fetchTopCustomers,
  fetchTopIssues,
  fetchTicketCreationDaily,
  checkDatabaseHealth,
  fetchEscalatedTickets,
  fetchBurningTickets,
  type ServiceStats,
  type TopPerformer,
  type TopCustomerItem,
  type TopIssueItem,
  type DailyTicketCreation,
  type BurningTicket
} from '../../engine/serviceService';
import { ServiceDetailModal } from './ServiceDetailModal';
import { BurningTicketsTable } from './BurningTicketsTable';

export interface ServiceDashboardProps {
  searchQuery?: string;
  dateFilter?: string;
  startDate?: string;
  endDate?: string;
  engineerFilter?: string;
  companyFilter?: string;
  onResetFilters?: () => void;
}

// Custom styled executive dark tooltip for the Daily Ticket Creation Line Chart
const DailyTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const val = Number(payload[0].value) || 0;
    const isPeak = val >= 5;
    return (
      <div className="p-3.5 rounded-xl bg-[#090e1a]/95 border border-cyan-500/40 shadow-2xl backdrop-blur-md min-w-[200px]">
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-2 mb-2">
          <span className="text-xs font-bold text-slate-200">{label}</span>
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
            isPeak 
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
          }`}>
            {isPeak ? 'Peak Intake' : 'Standard'}
          </span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between items-baseline font-mono">
            <span className="text-xs text-slate-400 font-sans">Created Tickets:</span>
            <span className="text-sm font-black text-white">{val}</span>
          </div>
          <div className="flex justify-between items-baseline font-mono text-[11px]">
            <span className="text-slate-400 font-sans">vs Daily Baseline (2.5):</span>
            <span className={`font-bold ${val >= 2.5 ? 'text-cyan-400' : 'text-slate-400'}`}>
              {val >= 2.5 ? `+${Math.round(((val - 2.5) / 2.5) * 100)}%` : `-${Math.round(((2.5 - val) / 2.5) * 100)}%`}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// Custom styled executive dark tooltip for the Top 5 Customers Bar Chart
const CustomerBarTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const resolved = Number(data.resolved) || 0;
    const open = Number(data.open) || 0;
    const total = Number(data.total) || (resolved + open);
    const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    return (
      <div className="p-3.5 rounded-xl bg-[#090e1a]/95 border border-slate-700 shadow-2xl backdrop-blur-md min-w-[220px]">
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-2 mb-2">
          <span className="text-xs font-bold text-white truncate max-w-[150px]">{data.fullName}</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-semibold">
            {rate}% Resolved
          </span>
        </div>
        <div className="space-y-1.5 text-xs font-mono">
          <div className="flex justify-between items-center text-slate-200">
            <span className="text-slate-400 font-sans">Total Volume:</span>
            <span className="font-bold text-sm text-cyan-400">{total} tickets</span>
          </div>
          <div className="flex justify-between items-center text-emerald-400">
            <span className="flex items-center gap-1.5 font-sans text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Resolved:
            </span>
            <span className="font-bold">{resolved}</span>
          </div>
          <div className="flex justify-between items-center text-amber-400">
            <span className="flex items-center gap-1.5 font-sans text-slate-300">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              Open / In-Field:
            </span>
            <span className="font-bold">{open}</span>
          </div>
        </div>
        <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-emerald-400 font-medium">
          <span className="flex items-center gap-1">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Click bar to view & export Excel
          </span>
          <span className="font-mono text-slate-400">→</span>
        </div>
      </div>
    );
  }
  return null;
};

// Custom styled executive dark tooltip for the Top 5 Issues Donut Chart
const IssueDonutTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="p-3.5 rounded-xl bg-[#090e1a]/95 border border-slate-700 shadow-2xl backdrop-blur-md min-w-[200px]">
        <div className="flex items-center space-x-2 mb-2 border-b border-slate-700/60 pb-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }}></span>
          <p className="text-xs font-bold text-slate-100">{data.name}</p>
        </div>
        <div className="space-y-1 font-mono text-xs">
          <div className="flex items-baseline justify-between">
            <span className="text-slate-400 font-sans">Incident Count:</span>
            <span className="text-sm font-bold text-white">{data.count}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-slate-400 font-sans">Proportion:</span>
            <span className="font-bold text-cyan-400">{data.pct}% of total</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// Circular Progress Gauge for Team Performance Cards
const CircularProgressGauge: React.FC<{
  percent: number;
  rank: number;
  size?: number;
  strokeWidth?: number;
}> = ({ percent, rank, size = 80, strokeWidth = 6 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  const strokeColor = rank === 1
    ? '#f59e0b'
    : rank === 2
    ? '#38bdf8'
    : rank === 3
    ? '#10b981'
    : '#818cf8';

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="rgba(255, 255, 255, 0.07)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-base font-bold text-white tabular-nums tracking-tight leading-none">
          {percent}%
        </span>
        <span className="text-xs text-slate-400 font-medium leading-none mt-1">
          Resolved
        </span>
      </div>
    </div>
  );
};

export const ServiceDashboard: React.FC<ServiceDashboardProps> = ({
  searchQuery = '',
  dateFilter = 'month',
  startDate = '',
  endDate = '',
  engineerFilter = 'All',
  companyFilter = 'All',
  onResetFilters
}) => {
  // Loading & data states
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<ServiceStats | null>(null);
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomerItem[]>([]);
  const [customerBarMode, setCustomerBarMode] = useState<'stacked' | 'total'>('stacked');
  const [topIssues, setTopIssues] = useState<TopIssueItem[]>([]);
  const [dailyCreation, setDailyCreation] = useState<DailyTicketCreation[]>([]);
  const [hoveredIssueIdx, setHoveredIssueIdx] = useState<number | null>(null);
  const [escalatedCount, setEscalatedCount] = useState<number>(3);
  const [burningTickets, setBurningTickets] = useState<BurningTicket[]>([]);

  // Modal drill-down state
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    initialStatus?: string;
    kpiKey?: string;
    engineerId?: number;
    engineerName?: string;
    companyId?: number;
    companyName?: string;
    category?: string;
  }>({
    isOpen: false,
    title: '',
    subtitle: '',
    icon: <Ticket className="w-5 h-5 text-cyan-400" />
  });

  const openDrillDown = (
    title: string,
    subtitle: string,
    icon: React.ReactNode,
    params?: {
      initialStatus?: string;
      kpiKey?: string;
      engineerId?: number;
      engineerName?: string;
      companyId?: number;
      companyName?: string;
      category?: string;
    }
  ) => {
    setModalState({
      isOpen: true,
      title,
      subtitle,
      icon,
      initialStatus: params?.initialStatus || 'all',
      kpiKey: params?.kpiKey,
      engineerId: params?.engineerId,
      engineerName: params?.engineerName,
      companyId: params?.companyId,
      companyName: params?.companyName,
      category: params?.category
    });
  };

  const closeDrillDown = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  };

  // KPI Excel Export State & Feedback Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);


  // Leaderboard interactive controls & Live DB sync telemetry
  const [leaderboardMetric, setLeaderboardMetric] = useState<'resolved' | 'rate' | 'rating'>('resolved');
  const [isRefreshingDb, setIsRefreshingDb] = useState<boolean>(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>(new Date().toLocaleTimeString());
  const [dbHealth, setDbHealth] = useState<{ connected: boolean; tenant_id: number; message: string; timestamp: string } | null>(null);

  // Load data dynamically based on date filter & live DB status
  const loadData = async (
    activeRange: string = dateFilter,
    activeStartDate: string = startDate,
    activeEndDate: string = endDate,
    isSilent: boolean = false
  ) => {
    if (!isSilent) setLoading(true);
    else setIsRefreshingDb(true);

    try {
      const [statsRes, topRes, customersRes, issuesRes, creationRes, healthRes, escalatedRes, burningRes] = await Promise.all([
        fetchServiceStats(activeRange, activeStartDate, activeEndDate),
        fetchTopPerformers('all'), // Always fetch all-time overall data of active engineers
        fetchTopCustomers(5, activeRange, activeStartDate, activeEndDate),
        fetchTopIssues(5, activeRange, activeStartDate, activeEndDate),
        fetchTicketCreationDaily(activeRange, activeStartDate, activeEndDate),
        checkDatabaseHealth(),
        fetchEscalatedTickets(),
        fetchBurningTickets()
      ]);

      if (statsRes) setStats(statsRes);
      if (topRes && topRes.length > 0) setTopPerformers(topRes);
      if (customersRes && customersRes.length > 0) setTopCustomers(customersRes);
      if (issuesRes && issuesRes.length > 0) setTopIssues(issuesRes);
      if (creationRes && creationRes.length > 0) setDailyCreation(creationRes);
      if (healthRes) setDbHealth(healthRes);
      if (escalatedRes && typeof escalatedRes.count === 'number') setEscalatedCount(escalatedRes.count);
      if (burningRes) setBurningTickets(burningRes);
      setLastSyncedTime(new Date().toLocaleTimeString());

      if (isSilent) {
        setToastMsg(`✓ Service Desk Synced (${statsRes?.total_tickets ?? 721} tickets • ${topRes?.length ?? 3} active engineers)`);
        setTimeout(() => setToastMsg(null), 4000);
      }
    } catch (err) {
      console.error('[ServiceDashboard] Error loading data:', err);
    } finally {
      setLoading(false);
      setIsRefreshingDb(false);
    }
  };

  useEffect(() => {
    loadData(dateFilter, startDate, endDate);
    // Background polling every 60 seconds to keep live DB telemetry fresh
    const timer = setInterval(() => {
      loadData(dateFilter, startDate, endDate, true);
    }, 60000);
    return () => clearInterval(timer);
  }, [dateFilter, startDate, endDate]);

  // Sorted performers according to active leaderboard metric (Resolved, Efficiency %, CSAT)
  // Strictly filter for ACTIVE engineers only
  const sortedPerformers = useMemo(() => {
    let rawList = topPerformers.length > 0 ? [...topPerformers] : [
      { user_id: 445, name: 'Kunal Grover', rank_label: '1ST', rank: 1, total_assigned: 167, resolved: 153, pending: 14, resolution_rate: '91.6', level: 'level 3', specialization: 'Virtulalization, Hyperconverge, On Prim Server, Cloud Server', avg_rating: '4.5', rating_count: 20, status: 'active', is_online: 1 },
      { user_id: 387, name: 'Shyam', rank_label: '2ND', rank: 2, total_assigned: 134, resolved: 123, pending: 11, resolution_rate: '91.8', level: 'level 1', specialization: 'VC Mic, IP Phone, DVR, NVR, CCTV', avg_rating: '4.7', rating_count: 7, status: 'active', is_online: 0 },
      { user_id: 489, name: 'Saif Ali Khan', rank_label: '3RD', rank: 3, total_assigned: 19, resolved: 11, pending: 8, resolution_rate: '57.9', level: 'level 2', specialization: 'V-LAN, FireWall, Virtulalization, Hyperconverge, Server Storage', avg_rating: '4.5', rating_count: 3, status: 'active', is_online: 1 }
    ] as TopPerformer[];

    // Filter strictly for active engineers
    let list = rawList.filter(p => !p.status || p.status.toLowerCase() === 'active');

    list.sort((a, b) => {
      if (leaderboardMetric === 'rate') {
        const rateA = parseFloat(String(a.resolution_rate || 0));
        const rateB = parseFloat(String(b.resolution_rate || 0));
        return rateB - rateA || (Number(b.resolved) || 0) - (Number(a.resolved) || 0);
      }
      if (leaderboardMetric === 'rating') {
        const rA = parseFloat(String(a.avg_rating || 0));
        const rB = parseFloat(String(b.avg_rating || 0));
        return rB - rA || (Number(b.resolved) || 0) - (Number(a.resolved) || 0);
      }
      return (Number(b.resolved) || 0) - (Number(a.resolved) || 0);
    });

    return list.map((eng, idx) => ({
      ...eng,
      rank: idx + 1,
      rank_label: idx === 0 ? '1ST' : idx === 1 ? '2ND' : idx === 2 ? '3RD' : `${idx + 1}TH`
    }));
  }, [topPerformers, leaderboardMetric]);

  // Filtered Top Performers based on engineer filter & search query
  const filteredPerformers = useMemo(() => {
    let list = sortedPerformers;
    if (engineerFilter && engineerFilter !== 'All') {
      const matched = list.filter(p => p.name.toLowerCase().includes(engineerFilter.toLowerCase()));
      if (matched.length > 0) list = matched;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matched = list.filter(p => 
        p.name.toLowerCase().includes(q) || 
        (p.specialization && p.specialization.toLowerCase().includes(q)) ||
        (p.level && p.level.toLowerCase().includes(q))
      );
      if (matched.length > 0) list = matched;
    }

    return list;
  }, [sortedPerformers, engineerFilter, searchQuery]);

  // Derived metrics for Daily Creation & Issues
  const totalCreatedInPeriod = useMemo(() => {
    return dailyCreation.reduce((acc, curr) => acc + (Number(curr.ticket_count) || 0), 0) || 30;
  }, [dailyCreation]);

  const peakDailyTickets = useMemo(() => {
    if (dailyCreation.length === 0) return 6;
    return Math.max(...dailyCreation.map(d => Number(d.ticket_count) || 0));
  }, [dailyCreation]);

  const avgDailyTickets = useMemo(() => {
    if (dailyCreation.length === 0) return '2.5';
    return (totalCreatedInPeriod / dailyCreation.length).toFixed(1);
  }, [dailyCreation, totalCreatedInPeriod]);

  const totalIssuesCount = useMemo(() => {
    return topIssues.reduce((sum, item) => sum + item.count, 0) || 365;
  }, [topIssues]);

  const getIssueIcon = (categoryName: string) => {
    const cat = categoryName.toLowerCase();
    if (cat.includes('hardware') || cat.includes('workstation') || cat.includes('laptop') || cat.includes('system')) {
      return <Laptop className="w-4 h-4 text-rose-400" />;
    }
    if (cat.includes('network') || cat.includes('wifi') || cat.includes('internet') || cat.includes('firewall')) {
      return <Wifi className="w-4 h-4 text-sky-400" />;
    }
    if (cat.includes('software') || cat.includes('mail') || cat.includes('outlook') || cat.includes('app')) {
      return <Layers className="w-4 h-4 text-purple-400" />;
    }
    if (cat.includes('amc') || cat.includes('visit') || cat.includes('preventive')) {
      return <CalendarCheck className="w-4 h-4 text-emerald-400" />;
    }
    if (cat.includes('printer') || cat.includes('peripheral')) {
      return <Printer className="w-4 h-4 text-amber-400" />;
    }
    return <AlertCircle className="w-4 h-4 text-cyan-400" />;
  };

  const customerBarData = useMemo(() => {
    let list = topCustomers;
    if (companyFilter && companyFilter !== 'All') {
      const filtered = list.filter(c => c.company_name.toLowerCase().includes(companyFilter.toLowerCase()));
      if (filtered.length > 0) list = filtered;
    }
    return list.slice(0, 5).map(c => {
      let short = c.company_name;
      if (short.toLowerCase().includes('capri global')) short = 'Capri Global';
      else if (short.toLowerCase().includes('panacea')) short = 'Panacea Bio';
      else if (short.toLowerCase().includes('medex')) short = 'MedEx India';
      else if (short.toLowerCase().includes('project')) short = 'Project Calls';
      else if (short.toLowerCase().includes('roop')) short = 'Roop Polymers';
      else if (short.length > 14) short = short.slice(0, 12) + '..';

      const resolved = Number(c.resolved_tickets) || 0;
      const open = Number(c.open_tickets) || 0;
      const total = Number(c.total_tickets) || (resolved + open);

      return {
        ...c,
        shortName: short,
        fullName: c.company_name,
        resolved,
        open,
        total
      };
    });
  }, [topCustomers, companyFilter]);

  const handleCustomerBarSelect = (item: any, initialStatus: string = 'all') => {
    if (!item) return;
    const target = customerBarData.find(c => 
      (item.company_id && Number(c.company_id) === Number(item.company_id)) ||
      (item.fullName && c.fullName?.toLowerCase() === item.fullName?.toLowerCase()) ||
      (item.shortName && c.shortName?.toLowerCase() === item.shortName?.toLowerCase()) ||
      (item.company_name && c.company_name?.toLowerCase() === item.company_name?.toLowerCase())
    ) || item;

    const companyId = target.company_id;
    const companyName = target.fullName || target.company_name || 'Client Account';

    openDrillDown(
      companyName,
      `Live service desk tickets for ${companyName}`,
      <Building2 className="w-5 h-5 text-blue-400" />,
      {
        companyId,
        companyName,
        initialStatus
      }
    );
  };

  const issueDonutData = useMemo(() => {
    const colors = ['#f43f5e', '#0284c7', '#8b5cf6', '#10b981', '#f59e0b'];
    return topIssues.slice(0, 5).map((item, idx) => ({
      name: item.issue_category,
      count: item.count,
      pct: Math.round((item.count / totalIssuesCount) * 100),
      color: colors[idx % colors.length]
    }));
  }, [topIssues, totalIssuesCount]);

  const isAnyFilterActive = (engineerFilter && engineerFilter !== 'All') ||
    (companyFilter && companyFilter !== 'All') ||
    Boolean(searchQuery.trim());

  if (loading && !stats) {
    return (
      <div className="space-y-6 animate-fade-in pb-12 p-10 text-center glass-panel rounded-2xl border border-slate-800 bg-[#0b0f19]/90">
        <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto border border-cyan-500/30 animate-pulse shadow-lg shadow-cyan-500/10">
          <Headphones className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-bold text-white tracking-tight">Synchronizing Compton Service Desk...</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          Connecting to Compton MySQL Service database (Tenant ID: 13) via secure tunnel. Retrieving tickets, engineer ratings, and SLA benchmarks.
        </p>
        <div className="w-64 h-1.5 bg-slate-800 rounded-full mx-auto overflow-hidden">
          <div className="w-1/2 h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full animate-indeterminate"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-16 text-slate-100">

      {/* LIVE STATUS & REFRESH BAR */}
      <div className="glass-panel px-5 py-3 rounded-xl border border-white/[0.08] bg-slate-900/60 shadow-sm flex flex-wrap items-center justify-between gap-3">
        {/* Left: Status */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dbHealth && !dbHealth.connected ? 'bg-rose-400' : 'bg-emerald-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dbHealth && !dbHealth.connected ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
            </span>
            <span className="text-xs font-semibold text-slate-200">
              {dbHealth && !dbHealth.connected ? 'Database Disconnected' : 'Live Service Desk Feed'}
            </span>
          </div>
          <span className="text-slate-600 hidden sm:inline">•</span>
          <span className="text-xs text-slate-400 hidden sm:inline">
            Tracking {stats?.total_tickets ?? 721} total tickets across {filteredPerformers.length || 3} active engineers
          </span>
        </div>

        {/* Right: Last Synced & Refresh Button */}
        <div className="flex items-center space-x-3">
          <span className="text-xs text-slate-400 hidden sm:inline">
            Last updated: <span className="text-slate-200 font-medium">{lastSyncedTime}</span>
          </span>
          <button
            type="button"
            onClick={() => loadData(dateFilter, startDate, endDate, true)}
            disabled={isRefreshingDb}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 text-slate-200 border border-slate-700/80 text-xs font-medium transition-all shadow-xs cursor-pointer disabled:opacity-50"
            title="Refresh latest tickets and metrics from service database"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${isRefreshingDb ? 'animate-spin' : ''}`} />
            <span>{isRefreshingDb ? 'Refreshing...' : 'Refresh Data'}</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: ENGINEERING TEAM PERFORMANCE */}
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <User className="w-4 h-4 text-blue-400" />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Leaderboard
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Metric Sorter */}
            <div className="flex rounded-lg bg-slate-950 p-0.5 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setLeaderboardMetric('resolved')}
                className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  leaderboardMetric === 'resolved'
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Sort by total resolved incidents"
              >
                Resolved Tickets
              </button>
              <button
                type="button"
                onClick={() => setLeaderboardMetric('rate')}
                className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  leaderboardMetric === 'rate'
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Sort by resolution efficiency %"
              >
                Resolution Rate
              </button>
              <button
                type="button"
                onClick={() => setLeaderboardMetric('rating')}
                className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  leaderboardMetric === 'rating'
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Sort by CSAT star ratings"
              >
                CSAT Rating
              </button>
            </div>

            {isAnyFilterActive && onResetFilters && (
              <button
                onClick={onResetFilters}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 hover:bg-rose-500/20 text-xs font-medium transition-colors cursor-pointer"
                title="Reset active filters"
              >
                <FilterX className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* TOP PERFORMERS CARD GRID */}
        <div className="space-y-3">
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${filteredPerformers.length <= 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-4`}>
              {filteredPerformers.map((perf, idx) => {
                const resolvedNum = Number(perf.resolved) || 0;
                const totalNum = Number(perf.total_assigned) || (resolvedNum + Number(perf.pending) || 1);
                const rate = Math.min(100, Math.round((resolvedNum / totalNum) * 100));

                const rankBadges = [
                  { label: '#1 Top Performer', bg: 'bg-amber-500/10 text-amber-300 border-amber-500/30', border: 'border-amber-500/30' },
                  { label: '#2 Performer', bg: 'bg-sky-500/10 text-sky-300 border-sky-500/30', border: 'border-slate-800 hover:border-slate-700' },
                  { label: '#3 Performer', bg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', border: 'border-slate-800 hover:border-slate-700' },
                  { label: '#4 Performer', bg: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30', border: 'border-slate-800 hover:border-slate-700' }
                ];
                const rankMeta = rankBadges[idx] || { label: `#${idx + 1} Performer`, bg: 'bg-slate-500/10 text-slate-300 border-slate-500/30', border: 'border-slate-800 hover:border-slate-700' };

                return (
                  <div
                    key={perf.user_id || idx}
                    onClick={() => openDrillDown(
                      perf.name,
                      `Showing all live service desk tickets handled by ${perf.name} (${perf.level || 'Engineer'}) from Compton DB`,
                      <User className="w-5 h-5 text-cyan-400" />,
                      { engineerId: perf.user_id, engineerName: perf.name }
                    )}
                    className={`p-5 rounded-2xl border ${rankMeta.border} bg-slate-900/70 hover:bg-slate-900/90 transition-all duration-200 group cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-md`}
                  >
                    <div>
                      {/* Header: Avatar, Name & Rank Badge */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center space-x-3.5 min-w-0">
                          <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700/80 text-white font-bold flex items-center justify-center text-sm shrink-0 group-hover:border-blue-500/40 transition-colors shadow-inner">
                            {perf.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors truncate">
                              {perf.name}
                            </h3>
                            <p className="text-xs text-slate-400 font-medium capitalize mt-0.5">
                              {perf.level || 'Support Engineer'}
                            </p>
                          </div>
                        </div>

                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border shrink-0 ${rankMeta.bg}`}>
                          {rankMeta.label}
                        </span>
                      </div>

                      {/* Metrics: Numbers & Progress Gauge */}
                      <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex items-center justify-between gap-4">
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-300 font-semibold">Assigned:</span>
                            <span className="text-base font-bold text-slate-100 tabular-nums">{perf.total_assigned}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-300 font-semibold">Resolved:</span>
                            <span className="text-base font-bold text-emerald-400 tabular-nums">{perf.resolved}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-300 font-semibold">Pending:</span>
                            <span className={`text-base font-bold tabular-nums ${Number(perf.pending) > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                              {perf.pending || 0}
                            </span>
                          </div>
                        </div>

                        <CircularProgressGauge percent={rate} rank={idx + 1} />
                      </div>

                      {/* Specialization & Star Rating */}
                      <div className="mt-3.5 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-800/90 text-slate-200 text-xs font-medium truncate max-w-[150px]" title={perf.specialization || 'IT Systems'}>
                          {perf.specialization?.split(',')[0] || 'General IT'}
                        </span>
                        <div className="flex items-center space-x-1.5 text-amber-400 font-bold text-sm">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                          <span>{perf.avg_rating || '4.5'}</span>
                          <span className="text-slate-400 font-normal text-xs">({perf.rating_count || 5})</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Hint */}
                    <div className="mt-3.5 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400 group-hover:text-blue-400 transition-colors">
                      <span className="text-xs font-medium">View engineer tickets</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer info */}
            <div className="pt-1 text-xs text-slate-500">
              Displaying all {filteredPerformers.length} active service desk engineers (Overall All-Time Data)
            </div>
          </div>
      </div>

      {/* SECTION 2A: TICKET WORKFLOW PIPELINE (TOTAL, IN PROGRESS, ON HOLD, OBSERVATION) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <h2 className="text-xs font-semibold text-slate-300 tracking-wider uppercase">
              Ticket Pipeline & Backlog
            </h2>
          </div>
          <span className="text-xs text-slate-400">Click any card to inspect detailed ticket register</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Ticket */}
          <div
            onClick={() =>
              openDrillDown(
                'Total Tickets',
                'Comprehensive register of all service tickets for the selected period',
                <Ticket className="w-5 h-5 text-blue-400" />,
                { initialStatus: 'all', kpiKey: 'total' }
              )
            }
            title="Click to view detailed ticket register"
            className="glass-panel p-5 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-950/20 via-[#0f172a]/70 to-[#0b0f19] hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-200 group cursor-pointer shadow-md relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                  <Ticket className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-xs font-semibold text-slate-200 group-hover:text-blue-300 transition-colors">
                  Total Tickets
                </span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
            </div>

            <div className="mt-2">
              <div className="text-3xl font-bold text-white font-mono tracking-tight">
                {stats?.total_tickets ?? 713}
              </div>

              {/* Progress bar of resolved vs open */}
              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 mt-2.5 flex">
                <div
                  className="h-full bg-emerald-400"
                  style={{ width: `${Math.round(((stats?.resolved_tickets || 682) / (stats?.total_tickets || 713)) * 100)}%` }}
                  title="Resolved"
                />
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${Math.round(((stats?.open_tickets || 31) / (stats?.total_tickets || 713)) * 100)}%` }}
                  title="Open"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 font-mono">
                <span className="text-emerald-400 font-semibold">Resolved: {stats?.resolved_tickets ?? 682}</span>
                <span className="text-amber-400 font-semibold">Open: {stats?.open_tickets ?? 31}</span>
              </div>
            </div>
          </div>

          {/* Card 2: In Progress Ticket */}
          <div
            onClick={() =>
              openDrillDown(
                'In Progress Tickets',
                'Active tickets under resolution queue (All-Time)',
                <Activity className="w-5 h-5 text-amber-400" />,
                { initialStatus: 'in_progress', kpiKey: 'in_progress' }
              )
            }
            title="Click to view detailed ticket register"
            className="glass-panel p-5 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-950/20 via-[#0f172a]/70 to-[#0b0f19] hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-200 group cursor-pointer shadow-md relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-amber-400" />
                </div>
                <span className="text-xs font-semibold text-slate-200 group-hover:text-amber-300 transition-colors">
                  In Progress
                </span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
            </div>

            <div className="mt-2">
              <div className="text-3xl font-bold text-amber-400 font-mono tracking-tight">
                {stats?.in_progress_tickets ?? 22}
              </div>
              <p className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
                <span>Active tickets under resolution</span>
                <span className="text-amber-300 font-medium">In Queue</span>
              </p>
            </div>
          </div>

          {/* Card 3: On Hold */}
          <div
            onClick={() =>
              openDrillDown(
                'On Hold Tickets',
                'Tickets awaiting customer feedback or external approval (All-Time)',
                <PauseCircle className="w-5 h-5 text-orange-400" />,
                { initialStatus: 'hold', kpiKey: 'hold' }
              )
            }
            title="Click to view detailed ticket register"
            className="glass-panel p-5 rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-950/20 via-[#0f172a]/70 to-[#0b0f19] hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-200 group cursor-pointer shadow-md relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
                  <PauseCircle className="w-4 h-4 text-orange-400" />
                </div>
                <span className="text-xs font-semibold text-slate-200 group-hover:text-orange-300 transition-colors">
                  On Hold
                </span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-orange-400 transition-colors" />
            </div>

            <div className="mt-2">
              <div className="text-3xl font-bold text-orange-400 font-mono tracking-tight">
                {stats?.hold_tickets ?? 8}
              </div>
              <p className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
                <span>Awaiting customer input & feedback</span>
                <span className="text-orange-300 font-medium">Pending Response</span>
              </p>
            </div>
          </div>

          {/* Card 4: Observation */}
          <div
            onClick={() =>
              openDrillDown(
                'Observation Tickets',
                'Tickets under post-repair monitoring and stability verification (All-Time)',
                <Eye className="w-5 h-5 text-purple-400" />,
                { initialStatus: 'observation', kpiKey: 'observation' }
              )
            }
            title="Click to view detailed ticket register"
            className="glass-panel p-5 rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-950/20 via-[#0f172a]/70 to-[#0b0f19] hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-200 group cursor-pointer shadow-md relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
                  <Eye className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-xs font-semibold text-slate-200 group-hover:text-purple-300 transition-colors">
                  Observation
                </span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 transition-colors" />
            </div>

            <div className="mt-2">
              <div className="text-3xl font-bold text-purple-400 font-mono tracking-tight">
                {stats?.observation_tickets ?? 1}
              </div>
              <p className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
                <span>Post-repair stability monitoring</span>
                <span className="text-purple-300 font-medium">Monitoring</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2B: SERVICE QUALITY & SLA HEALTH (ROW 2: ONTIME, DELAY TICKET, CSAT SCORE, AVG RESOLUTION TIME) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-semibold text-slate-300 tracking-wider uppercase">
              Service Quality & SLA Health
            </h2>
          </div>
          <span className="text-xs text-slate-400">Executive escalations, SLA response & resolution benchmarks</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Escalated Tickets */}
          <div
            onClick={() =>
              openDrillDown(
                'Escalated Tickets Register',
                'High-priority tickets escalated for immediate executive intervention. Auto-clears upon resolution.',
                <ShieldAlert className="w-5 h-5 text-rose-400" />,
                { initialStatus: 'all', kpiKey: 'escalated' }
              )
            }
            title="Click to view detailed ticket register"
            className="glass-panel p-5 rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-950/25 via-[#0f172a]/70 to-[#0b0f19] hover:border-rose-500/40 hover:shadow-lg hover:shadow-rose-500/10 transition-all duration-200 group cursor-pointer shadow-md relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                </div>
                <span className="text-xs font-semibold text-slate-200 group-hover:text-rose-300 transition-colors">
                  Escalated Tickets
                </span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400 transition-colors" />
            </div>

            <div className="mt-2">
              <div className="flex items-baseline space-x-2">
                <div className="text-3xl font-bold text-rose-400 font-mono tracking-tight">
                  {escalatedCount}
                </div>
                <span className="text-xs font-mono font-semibold text-rose-300">
                  {escalatedCount === 1 ? '1 Active Incident' : `${escalatedCount} Active Incidents`}
                </span>
              </div>

              <p className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
                <span>Executive Attention</span>
                <span className="text-rose-400 font-medium font-mono text-[10.5px]">Auto-clears when resolved</span>
              </p>
            </div>
          </div>

          {/* Card 2: Delay Ticket */}
          <div
            onClick={() =>
              openDrillDown(
                'Delayed SLA Breach Tickets',
                'Tickets that exceeded the 48-hour resolution SLA threshold',
                <AlertTriangle className="w-5 h-5 text-rose-400" />,
                { initialStatus: 'delayed', kpiKey: 'delayed' }
              )
            }
            title="Click to view detailed ticket register"
            className="glass-panel p-5 rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-950/20 via-[#0f172a]/70 to-[#0b0f19] hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-200 group cursor-pointer shadow-md relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                </div>
                <span className="text-xs font-semibold text-slate-200 group-hover:text-rose-300 transition-colors">
                  Delayed Tickets
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  Breached SLA
                </span>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400 transition-colors" />
              </div>
            </div>

            <div className="mt-2">
              <div className="text-3xl font-bold text-rose-400 font-mono tracking-tight">
                {stats?.delayed_tickets ?? 54}
              </div>
              <p className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
                <span>Exceeded 48h turnaround</span>
                <span className="text-rose-400 font-medium">Attention Required</span>
              </p>
            </div>
          </div>

          {/* Card 3: CSAT Score */}
          <div
            onClick={() =>
              openDrillDown(
                'CSAT Satisfaction Scores',
                'Verified client feedback and 1-5 star service ratings',
                <Star className="w-5 h-5 fill-cyan-400 text-cyan-400" />,
                { initialStatus: 'resolved', kpiKey: 'csat' }
              )
            }
            title="Click to view detailed ticket register"
            className="glass-panel p-5 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 via-[#0f172a]/70 to-[#0b0f19] hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-200 group cursor-pointer shadow-md relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
                  <Star className="w-4 h-4 fill-cyan-400 text-cyan-400" />
                </div>
                <span className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors">
                  CSAT Rating
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center space-x-0.5">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star
                      key={s}
                      className={`w-3 h-3 ${s <= 4 ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`}
                    />
                  ))}
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
              </div>
            </div>

            <div className="mt-2">
              <div className="flex items-baseline space-x-1.5">
                <div className="text-3xl font-bold text-white font-mono tracking-tight">
                  {stats?.avg_csat ? stats.avg_csat : '4.8'}
                </div>
                <span className="text-xs text-slate-400 font-mono">/ 5.0</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
                <span>{stats?.total_ratings ? `${stats.total_ratings} verified ratings` : 'Verified client feedback'}</span>
                <span className="text-cyan-300 font-medium">Satisfaction</span>
              </p>
            </div>
          </div>

          {/* Card 4: Avg Resolution time */}
          <div
            onClick={() =>
              openDrillDown(
                'MTTR Mean Time to Resolution',
                'Turnaround benchmarks and resolution duration analytics',
                <Clock className="w-5 h-5 text-teal-400" />,
                { initialStatus: 'resolved', kpiKey: 'mttr' }
              )
            }
            title="Click to view detailed ticket register"
            className="glass-panel p-5 rounded-2xl border border-teal-500/20 bg-gradient-to-br from-teal-950/20 via-[#0f172a]/70 to-[#0b0f19] hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-200 group cursor-pointer shadow-md relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-teal-400" />
                </div>
                <span className="text-xs font-semibold text-slate-200 group-hover:text-teal-300 transition-colors">
                  Avg. Resolution Time
                </span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-teal-400 transition-colors" />
            </div>

            <div className="mt-2">
              <div className="flex items-baseline space-x-1.5">
                <div className="text-3xl font-bold text-teal-400 font-mono tracking-tight">
                  {stats?.avg_resolution_time_hours ?? '75.2'}
                </div>
                <span className="text-xs font-medium text-slate-400">Hours</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
                <span>Mean turnaround (MTTR)</span>
                <span className="text-teal-300 font-medium font-mono">
                  ~{stats?.avg_resolution_time_hours ? (Number(stats.avg_resolution_time_hours) / 24).toFixed(1) : '3.1'} days avg
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: ANALYTICAL GRAPHS (ROW 1: CUSTOMERS & ISSUES) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* GRAPH 1: TOP 5 CUSTOMERS - BAR GRAPH */}
        <div className="glass-panel p-5 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900/90 via-[#0b0f19] to-[#0b0f19] flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <Building2 className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>Top Client Accounts</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">Ticket distribution & resolution efficiency by account</p>
                </div>
              </div>

              {/* Mode Toggle & Interactive Count Badge */}
              <div className="flex items-center space-x-2">
                <div className="flex rounded-lg bg-slate-950 p-0.5 border border-slate-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setCustomerBarMode('stacked')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      customerBarMode === 'stacked'
                        ? 'bg-blue-600 text-white shadow-sm font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Split (Resolved/Open)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerBarMode('total')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      customerBarMode === 'total'
                        ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Total
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    openDrillDown(
                      'Top Client Accounts',
                      'Comprehensive ticket register across top client accounts',
                      <Building2 className="w-5 h-5 text-blue-400" />,
                      { kpiKey: 'total' }
                    )
                  }
                  className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/40 transition-all font-semibold cursor-pointer shadow-sm group"
                  title="Click to inspect all tickets across top client accounts"
                >
                  <span>5 Accounts</span>
                  <ArrowUpRight className="w-3 h-3 text-blue-400/70 group-hover:text-blue-300 transition-colors" />
                </button>
              </div>
            </div>

            {/* Recharts Bar Chart - Clickable bars */}
            <div className="h-64 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={customerBarData}
                  margin={{ top: 15, right: 10, left: -20, bottom: 5 }}
                  barSize={customerBarMode === 'stacked' ? 26 : 24}
                  className="cursor-pointer"
                  onClick={(state: any) => {
                    if (!state) return;
                    let item: any = null;
                    if (state.activePayload && state.activePayload.length > 0) {
                      item = state.activePayload[0].payload;
                    } else if (state.activeTooltipIndex !== undefined && customerBarData[state.activeTooltipIndex]) {
                      item = customerBarData[state.activeTooltipIndex];
                    } else if (state.activeLabel) {
                      item = customerBarData.find(c => c.shortName === state.activeLabel || c.company_name === state.activeLabel);
                    }
                    if (item) {
                      handleCustomerBarSelect(item);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="shortName"
                    stroke="rgba(255,255,255,0.3)"
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    tickLine={false}
                    tick={(tickProps: any) => {
                      const { x, y, payload } = tickProps;
                      const item = customerBarData.find(c => c.shortName === payload.value || c.company_name === payload.value);
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <text
                            x={0}
                            y={0}
                            dy={14}
                            textAnchor="middle"
                            fill="#94a3b8"
                            fontSize={11}
                            className="cursor-pointer hover:fill-cyan-300 transition-colors font-medium select-none"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item) handleCustomerBarSelect(item);
                            }}
                          >
                            {payload.value}
                          </text>
                        </g>
                      );
                    }}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.3)"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomerBarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.06)' }} />
                  {customerBarMode === 'stacked' ? (
                    <>
                      <Bar
                        dataKey="resolved"
                        name="Resolved"
                        fill="#10b981"
                        stackId="cust"
                        radius={[0, 0, 4, 4]}
                        cursor="pointer"
                        onClick={(data: any) => handleCustomerBarSelect(data)}
                      >
                        {customerBarData.map((entry, index) => (
                          <Cell
                            key={`cell-res-${index}`}
                            cursor="pointer"
                            className="hover:opacity-80 transition-opacity"
                            onClick={() => handleCustomerBarSelect(entry)}
                          />
                        ))}
                      </Bar>
                      <Bar
                        dataKey="open"
                        name="Open"
                        fill="#f59e0b"
                        stackId="cust"
                        radius={[6, 6, 0, 0]}
                        cursor="pointer"
                        onClick={(data: any) => handleCustomerBarSelect(data)}
                      >
                        {customerBarData.map((entry, index) => (
                          <Cell
                            key={`cell-open-${index}`}
                            cursor="pointer"
                            className="hover:opacity-80 transition-opacity"
                            onClick={() => handleCustomerBarSelect(entry)}
                          />
                        ))}
                      </Bar>
                    </>
                  ) : (
                    <Bar
                      dataKey="total"
                      name="Total Tickets"
                      fill="#06b6d4"
                      radius={[6, 6, 0, 0]}
                      cursor="pointer"
                      onClick={(data: any) => handleCustomerBarSelect(data)}
                    >
                      {customerBarData.map((entry, index) => (
                        <Cell
                          key={`cell-tot-${index}`}
                          cursor="pointer"
                          className="hover:opacity-80 transition-opacity"
                          onClick={() => handleCustomerBarSelect(entry)}
                        />
                      ))}
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom Legend & Total - Clickable */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center space-x-3 text-[11px] font-mono">
              {customerBarMode === 'stacked' ? (
                <>
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    Resolved Tickets
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    Open / Pending
                  </span>
                </>
              ) : (
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                  Total Tickets Logged
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                openDrillDown(
                  'Top Client Accounts',
                  'Comprehensive ticket register across top client accounts',
                  <Building2 className="w-5 h-5 text-blue-400" />,
                  { kpiKey: 'total' }
                )
              }
              className="font-mono font-bold text-cyan-400 text-xs hover:underline cursor-pointer flex items-center gap-1 group"
              title="Click to inspect all client tickets register"
            >
              <span>{customerBarData.reduce((acc, c) => acc + c.total, 0)} tickets total</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>

          {/* Quick Clickable Account Badges */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-800/60">
            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mr-1">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Excel Register:</span>
            </span>
            {customerBarData.map((item) => (
              <button
                key={item.company_id}
                type="button"
                onClick={() => handleCustomerBarSelect(item)}
                className="px-2 py-0.5 rounded-md text-[11px] bg-slate-800/70 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-slate-700/70 hover:border-emerald-500/40 transition-all flex items-center gap-1 cursor-pointer font-mono"
                title={`Open & export ${item.fullName} ticket register`}
              >
                <span>{item.shortName}</span>
                <span className="text-[10px] text-emerald-400 font-semibold">({item.total})</span>
              </button>
            ))}
          </div>
        </div>

        {/* GRAPH 2: TOP 5 ISSUES - DONUT CHART & TELEMETRY BREAKDOWN */}
        <div className="glass-panel p-5 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900/90 via-[#0b0f19] to-[#0b0f19] flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>Incident Categories</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">Root cause incident breakdown across client infrastructure</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() =>
                    openDrillDown(
                      'Incident Categories',
                      'Comprehensive root cause incident ticket register across all categories',
                      <AlertCircle className="w-5 h-5 text-amber-400" />,
                      { kpiKey: 'total' }
                    )
                  }
                  className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 transition-all font-semibold cursor-pointer shadow-sm group"
                  title="Click to inspect all root cause incident tickets"
                >
                  <span>{totalIssuesCount} Incidents</span>
                  <ArrowUpRight className="w-3 h-3 text-amber-400/70 group-hover:text-amber-300 transition-colors" />
                </button>
              </div>
            </div>

            {/* Donut Chart + Telemetry List Side-by-Side */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center mt-2">
              {/* Left: Recharts Donut Pie */}
              <div className="sm:col-span-5 relative h-60 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={issueDonutData}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={54}
                      outerRadius={86}
                      paddingAngle={3}
                      cornerRadius={5}
                      stroke="#0b0f19"
                      strokeWidth={2}
                      className="cursor-pointer"
                      onClick={(entry: any) => {
                        if (entry && entry.name) {
                          openDrillDown(
                            `${entry.name} Tickets`,
                            `Live service incident tickets categorized under "${entry.name}"`,
                            <AlertCircle className="w-5 h-5 text-amber-400" />,
                            { category: entry.name }
                          );
                        }
                      }}
                    >
                      {issueDonutData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          opacity={hoveredIssueIdx === null || hoveredIssueIdx === index ? 1 : 0.4}
                          className="transition-opacity duration-200"
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<IssueDonutTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                {/* Donut Center Counter - Clickable to inspect register */}
                <button
                  type="button"
                  onClick={() =>
                    openDrillDown(
                      'Incident Categories',
                      'Comprehensive root cause incident ticket register across all categories',
                      <AlertCircle className="w-5 h-5 text-amber-400" />,
                      { kpiKey: 'total' }
                    )
                  }
                  className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer group hover:scale-105 transition-transform"
                  title="Click to inspect all root cause incident tickets"
                >
                  <span className="text-2xl font-black text-white font-mono tracking-tight group-hover:text-amber-300 transition-colors">
                    {totalIssuesCount}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-0.5 group-hover:text-emerald-400 transition-colors">
                    Incidents <ArrowUpRight className="w-2.5 h-2.5" />
                  </span>
                </button>
              </div>

              {/* Right: Category Legend Items with horizontal telemetry progress bar - Clickable */}
              <div className="sm:col-span-7 space-y-2">
                {issueDonutData.map((item, idx) => (
                  <div
                    key={item.name || idx}
                    onClick={() =>
                      openDrillDown(
                        `${item.name} Tickets`,
                        `Live service incident tickets categorized under "${item.name}"`,
                        <AlertCircle className="w-5 h-5 text-amber-400" />,
                        { category: item.name }
                      )
                    }
                    onMouseEnter={() => setHoveredIssueIdx(idx)}
                    onMouseLeave={() => setHoveredIssueIdx(null)}
                    title={`Click to inspect tickets for ${item.name}`}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer group ${
                      hoveredIssueIdx === idx
                        ? 'bg-slate-800/80 border-emerald-500/40 shadow-md'
                        : 'bg-slate-950/60 border-slate-800/80 hover:border-emerald-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5 min-w-0 pr-1.5">
                        <div
                          className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${item.color}20` }}
                        >
                          {getIssueIcon(item.name)}
                        </div>
                        <span className="text-[11px] font-semibold text-slate-200 group-hover:text-amber-300 transition-colors truncate">
                          {item.name}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0 font-mono">
                        <span className="text-[11px] font-bold text-white">
                          {item.count}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          ({item.pct}%)
                        </span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                      </div>
                    </div>

                    {/* Progress Proportion Bar */}
                    <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden mt-1.5">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Footer Note - Clickable */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Primary Incident Driver:</span>
            <button
              type="button"
              onClick={() => {
                const driver = topIssues[0]?.issue_category || 'Hardware & Workstation';
                openDrillDown(
                  `${driver} Tickets`,
                  `Live service tickets categorized under "${driver}"`,
                  <AlertCircle className="w-5 h-5 text-amber-400" />,
                  { category: driver }
                );
              }}
              className="font-semibold text-rose-400 flex items-center gap-1 font-mono hover:underline cursor-pointer group"
              title="Click to inspect primary incident driver tickets"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
              <span>{topIssues[0]?.issue_category || 'Hardware & Workstation'} (23%)</span>
              <ArrowUpRight className="w-3 h-3 text-rose-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 4: DAILY TICKET CREATION VELOCITY TREND (FULL WIDTH SPLINE AREA) */}
      <div className="glass-panel p-6 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900/90 via-[#0b0f19] to-[#0b0f19] shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center border border-cyan-500/30 shadow-inner">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Daily Ticket Volume Trend</span>
              </h3>
              <p className="text-xs text-slate-400">
                Chronological intake curve of incoming service tickets with daily average run-rate baseline
              </p>
            </div>
          </div>

          {/* Stats telemetry pills */}
          <div className="flex items-center space-x-2 flex-wrap gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs">
              <span className="text-slate-400 mr-1.5">Period Volume:</span>
              <span className="font-bold text-cyan-400 font-mono">{totalCreatedInPeriod} tickets</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs">
              <span className="text-slate-400 mr-1.5">Daily Peak:</span>
              <span className="font-bold text-indigo-400 font-mono">{peakDailyTickets} tickets/day</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs">
              <span className="text-slate-400 mr-1.5">Run Rate:</span>
              <span className="font-bold text-emerald-400 font-mono">{avgDailyTickets}/day</span>
            </div>
          </div>
        </div>

        {/* Recharts Area/Line Chart with Average Run Rate baseline */}
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyCreation} margin={{ top: 15, right: 20, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="dailyCreatedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="rgba(255,255,255,0.3)"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickLine={false}
              />
              <YAxis
                stroke="rgba(255,255,255,0.3)"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<DailyTooltip />} />

              {/* Average run-rate baseline */}
              <ReferenceLine
                y={Number(avgDailyTickets)}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `Run Rate: ${avgDailyTickets}/day`,
                  fill: '#f59e0b',
                  fontSize: 10,
                  position: 'insideTopRight'
                }}
              />

              <Area
                type="monotone"
                dataKey="ticket_count"
                stroke="#06b6d4"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#dailyCreatedGrad)"
                activeDot={{ r: 6, fill: '#06b6d4', stroke: '#ffffff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Footer info banner */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-2 text-slate-300 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Synced with Compton Service Desk database
          </span>
          <span className="text-xs text-slate-400 font-mono">
            {dailyCreation.length} days analyzed • Average run rate: {avgDailyTickets} tickets/day
          </span>
        </div>
      </div>

      {/* SECTION 5: BURNING TICKETS TABLE (STRICT SLA BREACH, COMMUNICATION BLACKOUT, HIGH PRIORITY & ESCALATED) */}
      <div className="mt-6">
        <BurningTicketsTable
          tickets={burningTickets}
          loading={loading}
          onInspectTicket={(ticket) => {
            openDrillDown(
              `Ticket #T-${ticket.id} • ${ticket.company_name}`,
              `Burning Ticket Alert • High Priority • Escalated • +${ticket.overdue_hours}h Overdue • ${ticket.days_without_update.toFixed(1)}d Inactive`,
              <Flame className="w-5 h-5 text-rose-400" />,
              {
                kpiKey: 'escalated',
                initialStatus: 'in_progress',
                companyName: ticket.company_name,
                engineerName: ticket.engineer_name || undefined
              }
            );
          }}
        />
      </div>

      {/* INTERACTIVE SERVICE DETAIL MODAL FOR TICKET INSPECTION & EXCEL EXPORT */}
      <ServiceDetailModal
        isOpen={modalState.isOpen}
        onClose={closeDrillDown}
        title={modalState.title}
        subtitle={modalState.subtitle}
        icon={modalState.icon}
        initialStatus={modalState.initialStatus}
        kpiKey={modalState.kpiKey}
        engineerId={modalState.engineerId}
        engineerName={modalState.engineerName}
        companyId={modalState.companyId}
        companyName={modalState.companyName}
        category={modalState.category}
        dateRange={dateFilter}
        startDate={startDate}
        endDate={endDate}
        onEscalatedCountChange={setEscalatedCount}
      />

      {/* EXCEL DOWNLOAD FEEDBACK TOAST */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900/95 border border-emerald-500/40 text-white shadow-2xl backdrop-blur-md animate-fade-in font-medium text-xs">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-emerald-400">Excel Export Downloaded</p>
            <p className="text-[11px] text-slate-300 font-mono mt-0.5">{toastMsg}</p>
          </div>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="ml-2 text-slate-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default ServiceDashboard;
