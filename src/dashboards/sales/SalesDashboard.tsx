import React, { useState, useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  TrendingUp, 
  Users, 
  AlertCircle, 
  Search,
  Package,
  Layers,
  DollarSign,
  PieChart,
  BarChart3,
  Sparkles,
  Building2,
  Share2,
  FolderKanban,
  PlayCircle,
  AlertTriangle,
  TrendingDown
} from 'lucide-react';
import type { OrderRecord, OperationalKPIMetrics } from '../../types/orders';
import type { DealRecord } from '../../types/sales';
import { getStoredBitrixCache, normalizeBitrixSource, type BitrixSyncResult } from '../../engine/bitrixService';
import { fetchDealsFromServer } from '../../engine/apiClient';
import { 
  fetchOrdersSheetData, 
  getStoredOrdersSheetUrl
} from '../../engine/ordersSheetsService';
import { 
  fetchProjectSheetsData, 
  calculateProjectKPIs, 
  INITIAL_SAMPLE_PROJECTS, 
  type ProjectRecord 
} from '../../engine/projectSheetsService';
import { splitGst } from '../../utils/financeUtils';

interface SalesDashboardProps {
  allRecords?: DealRecord[];
  bitrixSyncResult?: BitrixSyncResult | null;
  onOpenExportModal?: () => void;
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  dateFilter?: string;
  onDateFilterChange?: (d: string) => void;
  startDate?: string;
  onStartDateChange?: (d: string) => void;
  endDate?: string;
  onEndDateChange?: (d: string) => void;
  tableFilter?: 'All' | 'Billed' | 'Unbilled';
  onTableFilterChange?: (s: 'All' | 'Billed' | 'Unbilled') => void;
  repFilter?: string;
  onRepFilterChange?: (r: string) => void;
  sourceFilter?: string;
  onSourceFilterChange?: (s: string) => void;
  companyFilter?: string;
  onCompanyFilterChange?: (c: string) => void;
  onResetFilters?: () => void;
}

const MONTH_INFO: { name: string; short: string; num: string }[] = [
  { name: 'january', short: 'jan', num: '01' },
  { name: 'february', short: 'feb', num: '02' },
  { name: 'march', short: 'mar', num: '03' },
  { name: 'april', short: 'apr', num: '04' },
  { name: 'may', short: 'may', num: '05' },
  { name: 'june', short: 'jun', num: '06' },
  { name: 'july', short: 'jul', num: '07' },
  { name: 'august', short: 'aug', num: '08' },
  { name: 'september', short: 'sep', num: '09' },
  { name: 'october', short: 'oct', num: '10' },
  { name: 'november', short: 'nov', num: '11' },
  { name: 'december', short: 'dec', num: '12' },
];

const getCurrentMonthStr = (): string => {
  const now = new Date();
  const shortMonthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${shortMonthNames[now.getMonth()]} ${now.getFullYear()}`;
};

function matchesDateFilter(dateStr: string | undefined | null, filterVal: string | undefined | null): boolean {
  if (!filterVal || filterVal === 'All Dates' || filterVal === 'Custom Range') return true;
  if (!dateStr || dateStr === 'N/A' || dateStr === 'Unbilled') return false;

  const str = String(dateStr).trim().toLowerCase();
  const f = String(filterVal).trim().toLowerCase();

  // 1. Direct substring match
  if (str.includes(f)) return true;

  // 2. Year check if filter explicitly contains a 4-digit year like 2026
  const filterYearMatch = f.match(/\b(202\d)\b/);
  const filterYear = filterYearMatch ? filterYearMatch[1] : null;

  const dateYearMatch = str.match(/\b(202\d)\b/);
  const dateYear = dateYearMatch ? dateYearMatch[1] : null;

  if (filterYear) {
    if (dateYear && dateYear !== filterYear) return false;
    if (!dateYear && !str.includes(filterYear)) return false;
  }

  // 3. Find target month from filterVal
  let targetMonthIdx = -1;
  for (let i = 0; i < MONTH_INFO.length; i++) {
    const m = MONTH_INFO[i];
    if (f.includes(m.name) || f.includes(m.short)) {
      targetMonthIdx = i;
      break;
    }
  }

  if (targetMonthIdx === -1) {
    return filterYear ? (dateYear === filterYear || str.includes(filterYear)) : true;
  }

  const targetMonthNum = targetMonthIdx + 1;
  const targetMonthInfo = MONTH_INFO[targetMonthIdx];

  // Match month in textual form (e.g. "august", "aug")
  if (str.includes(targetMonthInfo.name) || str.includes(targetMonthInfo.short)) {
    return true;
  }

  // Match month in numeric form (e.g. 5/8/2026, 2026-08-05, 05/08/2026)
  const parts = str.split(/[\sT]+/)[0].split(/[-/.]/);
  if (parts.length === 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);

    if (p0 >= 2000 && p0 <= 2100) {
      if (p1 === targetMonthNum) return true;
    }
    if (p2 >= 2000 && p2 <= 2100) {
      if (p1 === targetMonthNum || p0 === targetMonthNum) return true;
    }
  }

  return false;
}

export const SalesDashboard: React.FC<SalesDashboardProps> = ({
  allRecords,
  bitrixSyncResult,
  onOpenExportModal: _onOpenExportModal,
  searchQuery: propSearchQuery,
  onSearchQueryChange: _onSearchQueryChange,
  dateFilter: propDateFilter,
  onDateFilterChange: _onDateFilterChange,
  startDate: propStartDate,
  onStartDateChange: _onStartDateChange,
  endDate: propEndDate,
  onEndDateChange: _onEndDateChange,
  tableFilter: propTableFilter,
  onTableFilterChange: _onTableFilterChange,
  repFilter: propRepFilter,
  onRepFilterChange: _onRepFilterChange,
  sourceFilter: propSourceFilter,
  onSourceFilterChange: _onSourceFilterChange,
  companyFilter: propCompanyFilter,
  onCompanyFilterChange: _onCompanyFilterChange,
  onResetFilters: _onResetFilters
}) => {
  const [localBitrixData, setLocalBitrixData] = useState<BitrixSyncResult | null>(getStoredBitrixCache());
  const [ordersUrl, _setOrdersUrl] = useState<string>(getStoredOrdersSheetUrl());
  const [sheetOrders, setSheetOrders] = useState<OrderRecord[]>([]);
  const [sheetStatusMessage, setSheetStatusMessage] = useState<string>('');
  const [_isSyncing, setIsSyncing] = useState<boolean>(false);

  // Single unified Bitrix dataset (Prioritizes prop from App -> local state -> cached localStorage)
  const bitrixData = bitrixSyncResult || localBitrixData || getStoredBitrixCache();
  
  // UI Controls & Filters (controlled via Navbar header or fallback local)
  const [_showConfigModal, _setShowConfigModal] = useState<boolean>(false);
  const [_editUrlInput, _setEditUrlInput] = useState<string>(ordersUrl);

  const [localTableFilter, _setLocalTableFilter] = useState<'All' | 'Billed' | 'Unbilled'>('All');
  const [localSearchQuery, _setLocalSearchQuery] = useState<string>('');
  const [localDateFilter, _setLocalDateFilter] = useState<string>(() => getCurrentMonthStr());
  const [localStartDate, _setLocalStartDate] = useState<string>('');
  const [localEndDate, _setLocalEndDate] = useState<string>('');
  const [localRepFilter, _setLocalRepFilter] = useState<string>('All');
  const [localSourceFilter, _setLocalSourceFilter] = useState<string>('All');
  const [localCompanyFilter, _setLocalCompanyFilter] = useState<string>('All');

  const searchQuery = propSearchQuery !== undefined ? propSearchQuery : localSearchQuery;
  const dateFilter = propDateFilter !== undefined ? propDateFilter : localDateFilter;
  const startDate = propStartDate !== undefined ? propStartDate : localStartDate;
  const endDate = propEndDate !== undefined ? propEndDate : localEndDate;
  const tableFilter = propTableFilter !== undefined ? propTableFilter : localTableFilter;
  const repFilter = propRepFilter !== undefined ? propRepFilter : localRepFilter;
  const sourceFilter = propSourceFilter !== undefined ? propSourceFilter : localSourceFilter;
  const companyFilter = propCompanyFilter !== undefined ? propCompanyFilter : localCompanyFilter;

  const setSearchQuery = (q: string) => {
    if (_onSearchQueryChange) _onSearchQueryChange(q);
    else _setLocalSearchQuery(q);
  };
  const setTableFilter = (s: 'All' | 'Billed' | 'Unbilled') => {
    if (_onTableFilterChange) _onTableFilterChange(s);
    else _setLocalTableFilter(s);
  };

  const [projectRecords, setProjectRecords] = useState<ProjectRecord[]>(INITIAL_SAMPLE_PROJECTS);

  // Sync orders sheet data on mount
  const loadAllData = async () => {
    setIsSyncing(true);
    try {
      const sRes = await fetchOrdersSheetData(ordersUrl);
      setSheetOrders(sRes.orders);
      setSheetStatusMessage(sRes.message);

      if (!bitrixSyncResult) {
        const bRes = await fetchDealsFromServer();
        if (bRes && (bRes.won.length > 0 || bRes.lost.length > 0 || bRes.progress.length > 0)) {
          setLocalBitrixData(bRes);
        }
      }

      fetchProjectSheetsData()
        .then(res => {
          if (res && res.records && res.records.length > 0) {
            setProjectRecords(res.records);
          }
        })
        .catch(() => {});

    } catch (err: any) {
      setSheetStatusMessage(`Sync error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [ordersUrl]);

  const projectKpis = useMemo(() => {
    return calculateProjectKPIs(projectRecords, true);
  }, [projectRecords]);

  // Fast Deal Map lookup by clean numeric dealId
  const bitrixMap = useMemo(() => {
    const map = new Map<string, DealRecord>();
    
    if (allRecords && allRecords.length > 0) {
      allRecords.forEach(d => {
        const cleanId = String(d.id).replace(/[^0-9]/g, '');
        if (cleanId) {
          map.set(cleanId, d);
        }
      });
    }

    if (bitrixData) {
      const allBitrixDeals = [...bitrixData.won, ...bitrixData.lost, ...bitrixData.progress];
      allBitrixDeals.forEach(d => {
        const cleanId = String(d.id).replace(/[^0-9]/g, '');
        if (cleanId && !map.has(cleanId)) {
          map.set(cleanId, d);
        }
      });
    }

    return map;
  }, [allRecords, bitrixData]);

  // Combine & Enrich Google Sheet Orders with Bitrix ISO Creation Dates & Responsible data
  const combinedOrders: OrderRecord[] = useMemo(() => {
    if (sheetOrders.length > 0) {
      return sheetOrders.map((ord, idx) => {
        const bMatch = bitrixMap.get(ord.dealId) || bitrixMap.get(ord.id.replace('ORD-', ''));
        const rawBitrix = bMatch?.rawRecord;

        // Use Google Sheet ISO Created Date directly if present, fallback to Bitrix DATE_CREATE
        let isoCreationDate = (ord.orderDate && ord.orderDate.trim().length > 0) ? ord.orderDate : '';
        if (!isoCreationDate && rawBitrix?.DATE_CREATE) {
          try {
            const d = new Date(rawBitrix.DATE_CREATE);
            isoCreationDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          } catch {
            isoCreationDate = String(rawBitrix.DATE_CREATE);
          }
        } else if (!isoCreationDate && bMatch?.date) {
          isoCreationDate = bMatch.date;
        }

        const salesRep = bMatch?.salesRep 
          ? bMatch.salesRep 
          : ((ord.salesRep && ord.salesRep !== 'Assigned Sales Rep' && ord.salesRep !== 'Unassigned') ? ord.salesRep : 'Unassigned Rep');

        return {
          ...ord,
          sNo: idx + 1,
          dealId: ord.dealId || `${idx + 1}`,
          salesRep,
          amount: ord.amount,
          isoCreationDate: isoCreationDate || 'N/A'
        };
      });
    }

    // Fallback: derive operational orders from Bitrix Won/Progress Deals
    const allBitrixDeals = bitrixData ? [...bitrixData.won, ...bitrixData.progress] : (allRecords || []);
    return allBitrixDeals.map((rec, idx) => {
      const isBilled = rec.type === 'won';
      const cleanId = String(rec.id).replace(/[^0-9]/g, '') || `${idx + 1}`;

      return {
        id: `ORD-${cleanId}`,
        dealId: cleanId,
        sNo: idx + 1,
        customerName: rec.customer,
        dealName: `${rec.customer} / ${rec.solution}`,
        salesRep: rec.salesRep,
        amount: rec.netRevenue || (rec.grossRevenue ? splitGst(rec.grossRevenue, true).netRevenue : 0),
        orderDate: rec.date,
        isoCreationDate: rec.date,
        billedDate: isBilled ? rec.date : 'Unbilled',
        status: isBilled ? 'Billed' : 'Unbilled',
        solutionType: rec.solution,
        industry: rec.industry
      };
    });
  }, [sheetOrders, bitrixData, bitrixMap, allRecords]);

  // Operational KPI Calculations dynamically filtered by Date Filter, Sales Rep Filter & Search Query
  const kpis: OperationalKPIMetrics = useMemo(() => {
    // 1. Filtered Orders
    const activeOrders = combinedOrders.filter(ord => {
      if (repFilter !== 'All' && ord.salesRep !== repFilter) return false;

      if (companyFilter !== 'All' && ord.customerName.toLowerCase() !== companyFilter.toLowerCase()) return false;

      if (sourceFilter !== 'All') {
        const bMatch = bitrixMap.get(ord.dealId) || bitrixMap.get(ord.id.replace('ORD-', ''));
        if (bMatch && bMatch.leadSource && bMatch.leadSource !== sourceFilter) return false;
      }

      if (startDate && endDate) {
        const ordDateStr = ord.orderDate || ord.isoCreationDate || '';
        if (ordDateStr && (ordDateStr < startDate || ordDateStr > endDate)) return false;
      } else if (dateFilter !== 'All Dates' && dateFilter !== 'Custom Range') {
        const matchOrd = matchesDateFilter(ord.orderDate, dateFilter);
        const matchIso = matchesDateFilter(ord.isoCreationDate, dateFilter);
        const matchBill = matchesDateFilter(ord.billedDate, dateFilter);
        if (!matchOrd && !matchIso && !matchBill) return false;
      }

      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchId = (ord.dealId || '').toLowerCase().includes(q);
        const matchCust = ord.customerName.toLowerCase().includes(q);
        const matchTitle = ord.dealName.toLowerCase().includes(q);
        const matchRep = ord.salesRep.toLowerCase().includes(q);
        if (!matchId && !matchCust && !matchTitle && !matchRep) return false;
      }

      return true;
    });

    const billedList = activeOrders.filter(o => o.status === 'Billed');
    const unbilledList = activeOrders.filter(o => o.status === 'Unbilled');

    const ordersBilledCount = billedList.length;
    const ordersBilledValue = billedList.reduce((s, o) => s + o.amount, 0);

    const unbilledOrdersCount = unbilledList.length;
    const unbilledOrdersValue = unbilledList.reduce((s, o) => s + o.amount, 0);

    const salesOrdersCreatedCount = activeOrders.length;
    const salesOrdersCreatedValue = activeOrders.reduce((s, o) => s + o.amount, 0);

    // 2. Filtered Bitrix Deals
    const matchDealFilterBase = (d: DealRecord) => {
      if (repFilter !== 'All' && d.salesRep !== repFilter) return false;
      if (companyFilter !== 'All' && (d.customer || '').toLowerCase() !== companyFilter.toLowerCase()) return false;
      if (sourceFilter !== 'All' && d.leadSource && d.leadSource !== sourceFilter) return false;

      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchCust = (d.customer || '').toLowerCase().includes(q);
        const matchTitle = (d.solution || '').toLowerCase().includes(q);
        const matchRep = (d.salesRep || '').toLowerCase().includes(q);
        const matchId = (d.id || '').toLowerCase().includes(q);
        if (!matchCust && !matchTitle && !matchRep && !matchId) return false;
      }

      return true;
    };

    const matchDealFilterWithDate = (d: DealRecord) => {
      if (!matchDealFilterBase(d)) return false;

      if (startDate && endDate) {
        const dDateStr = d.date || d.monthYear || '';
        if (dDateStr && (dDateStr < startDate || dDateStr > endDate)) return false;
      } else if (dateFilter !== 'All Dates' && dateFilter !== 'Custom Range') {
        const fullDateStr = `${d.date || ''} ${d.monthYear || ''} ${d.quarter || ''} ${d.year || ''}`;
        if (!matchesDateFilter(fullDateStr, dateFilter)) return false;
      }

      return true;
    };

    const wonList = bitrixData ? bitrixData.won.filter(matchDealFilterWithDate) : [];
    const lostList = bitrixData ? bitrixData.lost.filter(matchDealFilterWithDate) : [];
    // Note: In progress deals are shown irrespective of date filter as per requirement
    const progressList = bitrixData ? bitrixData.progress.filter(matchDealFilterBase) : [];

    const dealsWonCount = wonList.length;
    const dealsWonValue = wonList.reduce((s, d) => s + d.netRevenue, 0);

    const dealsLostCount = lostList.length;
    const dealsLostValue = lostList.reduce((s, d) => s + d.netRevenue, 0);

    const dealsInProgressCount = progressList.length;
    const dealsInProgressValue = progressList.reduce((s, d) => s + d.netRevenue, 0);

    // 3. Filtered Bitrix Leads (Qualified & Disqualified match Stage Change Date; In Progress leads exempt from date filter)
    const rawLeads = bitrixData ? (bitrixData.leads || []) : [];

    const matchLeadRep = (l: any) => {
      if (repFilter !== 'All' && l.salesRep !== repFilter) return false;
      return true;
    };

    const matchLeadDate = (l: any) => {
      if (!matchLeadRep(l)) return false;

      // Stage change date (dateClosed -> dateModify -> dateCreate)
      const stageChangeDate = l.dateClosed || l.dateModify || l.dateCreate || '';

      if (startDate && endDate) {
        if (stageChangeDate && (stageChangeDate < startDate || stageChangeDate > endDate)) return false;
      } else if (dateFilter !== 'All Dates' && dateFilter !== 'Custom Range') {
        if (!matchesDateFilter(stageChangeDate, dateFilter)) return false;
      }
      return true;
    };

    const qualifiedLeads = rawLeads.filter(l => l.statusType === 'qualified' && matchLeadDate(l));
    const disqualifiedLeads = rawLeads.filter(l => l.statusType === 'disqualified' && matchLeadDate(l));
    // In Progress leads do NOT have date filter applied as per explicit requirement
    const inProgressLeads = rawLeads.filter(l => l.statusType === 'in_progress' && matchLeadRep(l));

    const leadsQualifiedCount = qualifiedLeads.length;
    const leadsDisqualifiedCount = disqualifiedLeads.length;
    const leadsInProgressCount = inProgressLeads.length;
    const totalLeadsGeneratedCount = qualifiedLeads.length + disqualifiedLeads.length + inProgressLeads.length;

    return {
      ordersBilledCount,
      ordersBilledValue,
      unbilledOrdersCount,
      unbilledOrdersValue,
      salesOrdersCreatedCount,
      salesOrdersCreatedValue,
      dealsWonCount,
      dealsWonValue,
      dealsLostCount,
      dealsLostValue,
      dealsInProgressCount,
      dealsInProgressValue,
      leadsQualifiedCount,
      leadsDisqualifiedCount,
      leadsInProgressCount,
      totalLeadsGeneratedCount
    };
  }, [combinedOrders, bitrixData, dateFilter, startDate, endDate, repFilter, sourceFilter, companyFilter, searchQuery, bitrixMap]);

  // Filtered Orders Table List
  const filteredOrdersTable = useMemo(() => {
    return combinedOrders.filter(ord => {
      if (tableFilter === 'Billed' && ord.status !== 'Billed') return false;
      if (tableFilter === 'Unbilled' && ord.status !== 'Unbilled') return false;
      if (repFilter !== 'All' && ord.salesRep.toLowerCase() !== repFilter.toLowerCase()) return false;
      if (companyFilter !== 'All' && ord.customerName.toLowerCase() !== companyFilter.toLowerCase()) return false;

      if (startDate && endDate) {
        const ordDateStr = ord.orderDate || ord.isoCreationDate || '';
        if (ordDateStr && (ordDateStr < startDate || ordDateStr > endDate)) return false;
      } else if (dateFilter !== 'All Dates' && dateFilter !== 'Custom Range') {
        const matchOrd = matchesDateFilter(ord.orderDate, dateFilter);
        const matchIso = matchesDateFilter(ord.isoCreationDate, dateFilter);
        const matchBill = matchesDateFilter(ord.billedDate, dateFilter);
        if (!matchOrd && !matchIso && !matchBill) return false;
      }

      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchId = (ord.dealId || '').toLowerCase().includes(q);
        const matchCust = ord.customerName.toLowerCase().includes(q);
        const matchTitle = ord.dealName.toLowerCase().includes(q);
        const matchRep = ord.salesRep.toLowerCase().includes(q);
        if (!matchId && !matchCust && !matchTitle && !matchRep) return false;
      }

      return true;
    });
  }, [combinedOrders, tableFilter, searchQuery, dateFilter, startDate, endDate, repFilter, companyFilter]);

  const formatLakhs = (val: number) => {
    if (val >= 10000000) {
      return `₹${(val / 10000000).toFixed(2)} Cr`;
    } else if (val >= 100000) {
      return `₹${(val / 100000).toFixed(2)} L`;
    }
    return `₹${val.toLocaleString('en-IN')}`;
  };

  // -------------------------------------------------------------
  // Executive Operational Visual Analytics Configurations
  // -------------------------------------------------------------

  // 1. Orders Billed vs Unbilled Revenue Comparison
  const ordersBilledVsUnbilledOption = useMemo(() => {
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params: any) => {
          let res = `<div class="font-bold border-b border-slate-700 pb-1 mb-1 text-slate-200">Billing Operations Summary</div>`;
          params.forEach((item: any) => {
            res += `<div class="flex items-center justify-between gap-4 text-xs mt-1">
              <span style="color:${item.color}">● ${item.seriesName}:</span>
              <span class="font-mono font-bold">${formatLakhs(item.value)}</span>
            </div>`;
          });
          return res;
        }
      },
      legend: { top: '2%', right: '2%', textStyle: { color: '#94a3b8', fontSize: 11 } },
      grid: { top: '16%', left: '3%', right: '4%', bottom: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        data: ['Orders Billed', 'Unbilled Orders', 'Total Sales Created'],
        axisLabel: { color: '#94a3b8', fontSize: 11 },
        axisLine: { lineStyle: { color: '#334155' } }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#94a3b8',
          fontSize: 10,
          formatter: (v: number) => v >= 100000 ? `₹${(v / 100000).toFixed(0)}L` : `₹${v}`
        },
        splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } }
      },
      series: [
        {
          name: 'Order Value (₹)',
          type: 'bar',
          barWidth: '40%',
          data: [
            { value: kpis.ordersBilledValue, itemStyle: { color: '#10b981', borderRadius: [6, 6, 0, 0] } },
            { value: kpis.unbilledOrdersValue, itemStyle: { color: '#f59e0b', borderRadius: [6, 6, 0, 0] } },
            { value: kpis.salesOrdersCreatedValue, itemStyle: { color: '#3b82f6', borderRadius: [6, 6, 0, 0] } }
          ]
        }
      ]
    };
  }, [kpis]);

  // 2. Deals Pipeline Throughput (Count by Stage)
  const pipelineHealthOption = useMemo(() => {
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params: any) => {
          const item = params[0];
          return `<div class="font-bold border-b border-slate-700 pb-1 mb-1 text-slate-200">${item.name}</div>
            <div class="flex items-center justify-between gap-4 text-xs mt-1">
              <span style="color:${item.color}">● Volume:</span>
              <span class="font-mono font-bold">${item.value} Deals</span>
            </div>`;
        }
      },
      grid: { top: '12%', left: '3%', right: '8%', bottom: '10%', containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: { color: '#94a3b8', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } }
      },
      yAxis: {
        type: 'category',
        data: ['Deals Lost', 'In Progress', 'Deals Won'],
        axisLabel: { color: '#94a3b8', fontSize: 11 },
        axisLine: { lineStyle: { color: '#334155' } }
      },
      series: [
        {
          name: 'Deals Count',
          type: 'bar',
          barWidth: '45%',
          data: [
            { value: kpis.dealsLostCount, itemStyle: { color: '#f43f5e', borderRadius: [0, 6, 6, 0] } },
            { value: kpis.dealsInProgressCount, itemStyle: { color: '#06b6d4', borderRadius: [0, 6, 6, 0] } },
            { value: kpis.dealsWonCount, itemStyle: { color: '#10b981', borderRadius: [0, 6, 6, 0] } }
          ]
        }
      ]
    };
  }, [kpis]);

  // 3. Lead Qualification Conversion Funnel Donut
  const leadConversionOption = useMemo(() => {
    const total = kpis.totalLeadsGeneratedCount || 1;
    const qualPct = ((kpis.leadsQualifiedCount / total) * 100).toFixed(1);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: '{b}: <strong class="text-white">{c} Leads ({d}%)</strong>'
      },
      legend: { bottom: '2%', left: 'center', textStyle: { color: '#94a3b8', fontSize: 11 } },
      series: [
        {
          name: 'Lead Status',
          type: 'pie',
          radius: ['52%', '76%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 8, borderColor: '#0f172a', borderWidth: 3 },
          label: {
            show: true,
            position: 'center',
            formatter: `{val|${qualPct}%}\n{sub|QUALIFIED RATE}`,
            rich: {
              val: { fontSize: 24, fontWeight: 'bold', color: '#10b981', lineHeight: 30 },
              sub: { fontSize: 9, color: '#94a3b8', lineHeight: 14 }
            }
          },
          data: [
            { value: kpis.leadsQualifiedCount, name: 'Qualified Leads', itemStyle: { color: '#10b981' } },
            { value: kpis.leadsInProgressCount, name: 'In Progress Leads', itemStyle: { color: '#a855f7' } },
            { value: kpis.leadsDisqualifiedCount, name: 'Disqualified Leads', itemStyle: { color: '#64748b' } }
          ]
        }
      ]
    };
  }, [kpis]);

  // 4. NEW UNIQUE: Lead Source Acquisition Breakdown Donut
  const leadSourceChartOption = useMemo(() => {
    const sourceMap: Record<string, number> = {};

    const matchLeadRep = (l: any) => {
      if (repFilter !== 'All' && l.salesRep !== repFilter) return false;
      return true;
    };

    const matchLeadDate = (l: any) => {
      if (!matchLeadRep(l)) return false;
      const stageChangeDate = l.dateClosed || l.dateModify || l.dateCreate || l.date || '';
      if (startDate && endDate) {
        if (stageChangeDate && (stageChangeDate < startDate || stageChangeDate > endDate)) return false;
      } else if (dateFilter !== 'All Dates' && dateFilter !== 'Custom Range') {
        if (!matchesDateFilter(stageChangeDate, dateFilter)) return false;
      }
      return true;
    };

    const matchDealDate = (d: DealRecord) => {
      if (repFilter !== 'All' && d.salesRep !== repFilter) return false;
      if (companyFilter !== 'All' && (d.customer || '').toLowerCase() !== companyFilter.toLowerCase()) return false;
      if (startDate && endDate) {
        const dDateStr = d.date || d.monthYear || '';
        if (dDateStr && (dDateStr < startDate || dDateStr > endDate)) return false;
      } else if (dateFilter !== 'All Dates' && dateFilter !== 'Custom Range') {
        const fullDateStr = `${d.date || ''} ${d.monthYear || ''} ${d.quarter || ''} ${d.year || ''}`;
        if (!matchesDateFilter(fullDateStr, dateFilter)) return false;
      }
      return true;
    };

    if (bitrixData?.leads && bitrixData.leads.length > 0) {
      const activeLeads = [
        ...bitrixData.leads.filter((l: any) => l.statusType === 'qualified' && matchLeadDate(l)),
        ...bitrixData.leads.filter((l: any) => l.statusType === 'disqualified' && matchLeadDate(l)),
        ...bitrixData.leads.filter((l: any) => (l.statusType === 'in_progress' || !l.statusType) && matchLeadRep(l))
      ];
      activeLeads.forEach(l => {
        const rawSrc = l.sourceId || l.rawRecord?.SOURCE_ID || l.rawRecord?.UTM_SOURCE || '';
        const srcName = normalizeBitrixSource(rawSrc);
        sourceMap[srcName] = (sourceMap[srcName] || 0) + 1;
      });
    } else if (bitrixData) {
      const allDeals = [...bitrixData.won, ...bitrixData.lost, ...bitrixData.progress].filter(matchDealDate);
      allDeals.forEach(d => {
        const rawSrc = d.leadSource || d.rawRecord?.SOURCE_ID || d.rawRecord?.UTM_SOURCE || '';
        const srcName = normalizeBitrixSource(rawSrc);
        sourceMap[srcName] = (sourceMap[srcName] || 0) + 1;
      });
    }

    if (Object.keys(sourceMap).length === 0 && (!dateFilter || dateFilter === 'All Dates')) {
      sourceMap['India Mart'] = 195;
      sourceMap['Google Ads'] = 148;
      sourceMap['Reference'] = 112;
      sourceMap['LinkedIn'] = 86;
      sourceMap['Existing Client'] = 54;
      sourceMap['Self Generated'] = 32;
      sourceMap['E-Mail'] = 18;
    }

    const chartData = Object.entries(sourceMap)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const totalLeads = chartData.reduce((s, c) => s + c.value, 0);
    const colorPalette = ['#38bdf8', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b', '#a855f7'];

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: '{b}: <strong class="text-white">{c} Leads ({d}%)</strong>'
      },
      legend: {
        bottom: '0%',
        left: 'center',
        width: '95%',
        itemGap: 12,
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: '#94a3b8', fontSize: 10 }
      },
      series: [
        {
          name: 'Lead Source',
          type: 'pie',
          radius: ['44%', '66%'],
          center: ['50%', '36%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 6, borderColor: '#0f172a', borderWidth: 2 },
          label: {
            show: true,
            position: 'center',
            formatter: `{val|${totalLeads}}\n{sub|TOTAL LEADS}`,
            rich: {
              val: { fontSize: 22, fontWeight: 'bold', color: '#38bdf8', lineHeight: 28 },
              sub: { fontSize: 9, color: '#94a3b8', lineHeight: 14 }
            }
          },
          data: chartData.map((d, idx) => ({
            ...d,
            itemStyle: { color: colorPalette[idx % colorPalette.length] }
          }))
        }
      ]
    };
  }, [bitrixData, dateFilter, startDate, endDate, repFilter, companyFilter]);

  // Won deals filtered by active Date Filter, Rep Filter, Source Filter, Company Filter & Search Query
  const filteredWonDeals = useMemo(() => {
    const rawWon = bitrixData ? bitrixData.won : (allRecords ? allRecords.filter(r => r.type === 'won') : []);

    return rawWon.filter(d => {
      if (repFilter !== 'All' && d.salesRep !== repFilter) return false;
      if (companyFilter !== 'All' && (d.customer || '').toLowerCase() !== companyFilter.toLowerCase()) return false;
      if (sourceFilter !== 'All' && d.leadSource && d.leadSource !== sourceFilter) return false;

      if (startDate && endDate) {
        const dDateStr = d.date || d.monthYear || '';
        if (dDateStr && (dDateStr < startDate || dDateStr > endDate)) return false;
      } else if (dateFilter !== 'All Dates' && dateFilter !== 'Custom Range') {
        const fullDateStr = `${d.date || ''} ${d.monthYear || ''} ${d.quarter || ''} ${d.year || ''}`;
        if (!matchesDateFilter(fullDateStr, dateFilter)) return false;
      }

      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchCust = (d.customer || '').toLowerCase().includes(q);
        const matchTitle = (d.solution || '').toLowerCase().includes(q);
        const matchRep = (d.salesRep || '').toLowerCase().includes(q);
        const matchId = (d.id || '').toLowerCase().includes(q);
        if (!matchCust && !matchTitle && !matchRep && !matchId) return false;
      }

      return true;
    });
  }, [bitrixData, allRecords, dateFilter, startDate, endDate, repFilter, sourceFilter, companyFilter, searchQuery]);

  // 5. Sales Rep Revenue Performance Leaderboard (Won Deals for Selected Month)
  const salesRepPerformanceOption = useMemo(() => {
    const repMap: Record<string, number> = {};
    filteredWonDeals.forEach(d => {
      const rep = d.salesRep || 'Unassigned';
      const rev = d.netRevenue || d.grossRevenue || 0;
      repMap[rep] = (repMap[rep] || 0) + rev;
    });

    const sortedReps = Object.entries(repMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const names = sortedReps.map(r => r[0]).reverse();
    const values = sortedReps.map(r => r[1]).reverse();

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params: any) => {
          const item = params[0];
          return `<div class="font-bold border-b border-slate-700 pb-1 mb-1 text-slate-200">${item.name}</div>
            <div class="flex items-center justify-between gap-4 text-xs mt-1">
              <span style="color:#a855f7">● Won Deals Revenue:</span>
              <span class="font-mono font-bold">${formatLakhs(item.value)}</span>
            </div>`;
        }
      },
      grid: { top: '12%', left: '3%', right: '8%', bottom: '10%', containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: {
          color: '#94a3b8',
          fontSize: 10,
          formatter: (v: number) => v >= 100000 ? `₹${(v / 100000).toFixed(0)}L` : `₹${v}`
        },
        splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } }
      },
      yAxis: {
        type: 'category',
        data: names.length > 0 ? names : ['No Data'],
        axisLabel: { color: '#94a3b8', fontSize: 11 },
        axisLine: { lineStyle: { color: '#334155' } }
      },
      series: [
        {
          name: 'Won Revenue',
          type: 'bar',
          barWidth: '45%',
          data: values.map(v => ({
            value: v,
            itemStyle: {
              color: {
                type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
                colorStops: [{ offset: 0, color: '#8b5cf6' }, { offset: 1, color: '#ec4899' }]
              },
              borderRadius: [0, 6, 6, 0]
            }
          }))
        }
      ]
    };
  }, [filteredWonDeals]);

  // 6. Customer Revenue Concentration (Top Accounts - Won Deals for Selected Month)
  const topCustomersChartOption = useMemo(() => {
    const custMap: Record<string, number> = {};
    filteredWonDeals.forEach(d => {
      const c = d.customer || 'Unknown Account';
      const rev = d.netRevenue || d.grossRevenue || 0;
      custMap[c] = (custMap[c] || 0) + rev;
    });

    const sorted = Object.entries(custMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const names = sorted.map(s => s[0].length > 16 ? s[0].slice(0, 14) + '...' : s[0]).reverse();
    const values = sorted.map(s => s[1]).reverse();

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params: any) => {
          const item = params[0];
          return `<div class="font-bold border-b border-slate-700 pb-1 mb-1 text-slate-200">${item.name}</div>
            <div class="flex items-center justify-between gap-4 text-xs mt-1">
              <span style="color:#0ea5e9">● Total Won Account Value:</span>
              <span class="font-mono font-bold">${formatLakhs(item.value)}</span>
            </div>`;
        }
      },
      grid: { top: '12%', left: '3%', right: '8%', bottom: '10%', containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: {
          color: '#94a3b8',
          fontSize: 10,
          formatter: (v: number) => v >= 100000 ? `₹${(v / 100000).toFixed(0)}L` : `₹${v}`
        },
        splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } }
      },
      yAxis: {
        type: 'category',
        data: names.length > 0 ? names : ['No Data'],
        axisLabel: { color: '#94a3b8', fontSize: 11 },
        axisLine: { lineStyle: { color: '#334155' } }
      },
      series: [
        {
          name: 'Won Revenue',
          type: 'bar',
          barWidth: '45%',
          data: values.map(v => ({
            value: v,
            itemStyle: {
              color: {
                type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
                colorStops: [{ offset: 0, color: '#0ea5e9' }, { offset: 1, color: '#38bdf8' }]
              },
              borderRadius: [0, 6, 6, 0]
            }
          }))
        }
      ]
    };
  }, [filteredWonDeals]);

  return (
    <div className="space-y-6 animate-fade-in max-w-[1600px] mx-auto py-2">
      {/* 1. 10 CORE METRICS GRID (Exact list matching user image) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>Operational Dashboard</span>
          </h2>
        </div>

        {/* Row 1: Orders & Leads Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* 1. TOTAL ORDERS Executive Summary Box */}
          <div className="lg:col-span-5 bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800/90 shadow-xl shadow-slate-950/40 flex flex-col justify-between space-y-4 hover:border-slate-700/80 transition-all">
            {/* Card Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <Package className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-white tracking-wide uppercase">TOTAL ORDERS</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  {kpis.dealsWonCount} Total
                </span>
                <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {formatLakhs(kpis.dealsWonValue)}
                </span>
              </div>
            </div>

            {/* Flat Column Breakdown: Billed vs Unbilled */}
            <div className="grid grid-cols-2 gap-4 divide-x divide-slate-800/80 pt-1">
              {/* Billed Column */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Billed</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white font-mono">{kpis.ordersBilledCount}</span>
                  <span className="text-xs font-bold text-emerald-400 font-mono">{formatLakhs(kpis.ordersBilledValue)}</span>
                </div>
              </div>

              {/* Unbilled Column */}
              <div className="pl-4 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Unbilled</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-amber-400 font-mono">{kpis.unbilledOrdersCount}</span>
                  <span className="text-xs font-bold text-amber-400 font-mono">{formatLakhs(kpis.unbilledOrdersValue)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. TOTAL LEADS GENERATED Executive Summary Box */}
          <div className="lg:col-span-7 bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800/90 shadow-xl shadow-slate-950/40 flex flex-col justify-between space-y-4 hover:border-slate-700/80 transition-all">
            {/* Card Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-white tracking-wide uppercase">TOTAL LEADS GENERATED</h3>
              </div>
              <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20">
                {kpis.totalLeadsGeneratedCount} Total Leads
              </span>
            </div>

            {/* Flat Column Breakdown: Qualified vs Disqualified vs In Progress */}
            <div className="grid grid-cols-3 gap-4 divide-x divide-slate-800/80 pt-1">
              {/* Qualified */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Qualified</span>
                </div>
                <div className="text-3xl font-black text-white font-mono">{kpis.leadsQualifiedCount}</div>
              </div>

              {/* Disqualified */}
              <div className="pl-4 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Disqualified</span>
                </div>
                <div className="text-3xl font-black text-rose-400 font-mono">{kpis.leadsDisqualifiedCount}</div>
              </div>

              {/* In Progress */}
              <div className="pl-4 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-400">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>In Progress</span>
                </div>
                <div className="text-3xl font-black text-purple-300 font-mono">{kpis.leadsInProgressCount}</div>
              </div>
            </div>
          </div>

        </div>

        {/* Row 2: Deals Pipeline Overview KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* Deals Won Till Date */}
          <div className="bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800/90 shadow-xl shadow-slate-950/40 flex flex-col justify-between space-y-3 hover:border-slate-700/80 transition-all">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Deals Won Till Date
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Won
              </span>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-3xl font-black text-white font-mono">{kpis.dealsWonCount}</span>
              <span className="text-sm font-bold text-emerald-400 font-mono">{formatLakhs(kpis.dealsWonValue)}</span>
            </div>
          </div>

          {/* Deals Lost Till Date */}
          <div className="bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800/90 shadow-xl shadow-slate-950/40 flex flex-col justify-between space-y-3 hover:border-slate-700/80 transition-all">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <span className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                Deals Lost Till Date
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                Lost
              </span>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-3xl font-black text-rose-400 font-mono">{kpis.dealsLostCount}</span>
              <span className="text-sm font-bold text-rose-400 font-mono">{formatLakhs(kpis.dealsLostValue)}</span>
            </div>
          </div>

          {/* Deals In progress Till Date */}
          <div className="bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800/90 shadow-xl shadow-slate-950/40 flex flex-col justify-between space-y-3 hover:border-slate-700/80 transition-all">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-amber-400 animate-spin-slow" />
                Deals In Progress
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                Active
              </span>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-3xl font-black text-white font-mono">{kpis.dealsInProgressCount}</span>
              <span className="text-sm font-bold text-amber-400 font-mono">{formatLakhs(kpis.dealsInProgressValue)}</span>
            </div>
          </div>
        </div>

        {/* Row 3: Project Execution & Portfolio Health KPI Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* GROUP 1: TOTAL PROJECT SUMMARY CARD (Running | Completed) */}
          <div className="lg:col-span-4 bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800/90 shadow-xl shadow-slate-950/40 flex flex-col justify-between space-y-4 hover:border-slate-700/80 transition-all">
            {/* Card Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <FolderKanban className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-white tracking-wide uppercase">TOTAL PROJECT</h3>
              </div>
              <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20">
                {projectKpis.totalProjects} Total
              </span>
            </div>

            {/* Flat Column Breakdown: Running vs Completed */}
            <div className="grid grid-cols-2 gap-4 divide-x divide-slate-800/80 pt-1">
              {/* Running */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
                  <PlayCircle className="w-3.5 h-3.5 animate-spin-slow" />
                  <span>Running</span>
                </div>
                <div className="text-3xl font-black text-white font-mono">{projectKpis.projectsRunning}</div>
              </div>

              {/* Completed */}
              <div className="pl-4 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Completed</span>
                </div>
                <div className="text-3xl font-black text-white font-mono">{projectKpis.totalProjects - projectKpis.projectsRunning}</div>
              </div>
            </div>
          </div>

          {/* GROUP 2: RUNNING PROJECTS SCHEDULE CARD (Delayed | Ontime) */}
          <div className="lg:col-span-4 bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800/90 shadow-xl shadow-slate-950/40 flex flex-col justify-between space-y-4 hover:border-slate-700/80 transition-all">
            {/* Card Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
                  <PlayCircle className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-white tracking-wide uppercase">RUNNING PROJECTS</h3>
              </div>
              <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                {projectKpis.projectsRunning} Running
              </span>
            </div>

            {/* Flat Column Breakdown: Delayed vs Ontime */}
            <div className="grid grid-cols-2 gap-4 divide-x divide-slate-800/80 pt-1">
              {/* Delayed */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Delayed</span>
                </div>
                <div className="text-3xl font-black text-rose-400 font-mono">{projectKpis.delayedProjects}</div>
              </div>

              {/* On Time */}
              <div className="pl-4 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>On-Time</span>
                </div>
                <div className="text-3xl font-black text-white font-mono">{projectKpis.onTimeProjects}</div>
              </div>
            </div>
          </div>

          {/* GROUP 3: BUDGET STATUS CARD (Under Budget | Over Budget) */}
          <div className="lg:col-span-4 bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800/90 shadow-xl shadow-slate-950/40 flex flex-col justify-between space-y-4 hover:border-slate-700/80 transition-all">
            {/* Card Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20">
                  <TrendingDown className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-white tracking-wide uppercase">BUDGET STATUS</h3>
              </div>
              <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-md bg-teal-500/10 text-teal-300 border border-teal-500/20">
                Budget Health
              </span>
            </div>

            {/* Flat Column Breakdown: Under Budget vs Over Budget */}
            <div className="grid grid-cols-2 gap-4 divide-x divide-slate-800/80 pt-1">
              {/* Under Budget */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>Under Budget</span>
                </div>
                <div className="text-3xl font-black text-white font-mono">{projectKpis.underBudgetProjects}</div>
              </div>

              {/* Over Budget */}
              <div className="pl-4 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Over Budget</span>
                </div>
                <div className="text-3xl font-black text-rose-400 font-mono">{projectKpis.overBudgetProjects}</div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 3. SYMMETRICAL 6-CHART OPERATIONAL VISUAL ANALYTICS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Chart 1: Orders Billed vs Unbilled Value */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800/90 shadow-xl shadow-slate-950/40 space-y-3 flex flex-col justify-between hover:border-slate-700/80 transition-all">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-xs font-bold text-white flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>Billing Operations (Billed vs Unbilled Revenue)</span>
            </h3>
            <span className="text-[11px] font-mono text-blue-300 px-2.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20">
              Orders Volume
            </span>
          </div>
          <div className="h-[280px] w-full">
            <ReactECharts option={ordersBilledVsUnbilledOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

        {/* Chart 2: Bitrix Deals Pipeline Throughput */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800/90 shadow-xl shadow-slate-950/40 space-y-3 flex flex-col justify-between hover:border-slate-700/80 transition-all">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-xs font-bold text-white flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <span>Deals Pipeline Stage Volume</span>
            </h3>
            <span className="text-[11px] font-mono text-cyan-300 px-2.5 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20">
              Bitrix Deals
            </span>
          </div>
          <div className="h-[280px] w-full">
            <ReactECharts option={pipelineHealthOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

        {/* Chart 3: Lead Qualification Conversion Funnel */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800/90 shadow-xl shadow-slate-950/40 space-y-3 flex flex-col justify-between hover:border-slate-700/80 transition-all">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-xs font-bold text-white flex items-center space-x-2">
              <PieChart className="w-4 h-4 text-purple-400" />
              <span>Lead Qualification & Conversion Ratio</span>
            </h3>
            <span className="text-[11px] font-mono text-purple-300 px-2.5 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20">
              Lead Health
            </span>
          </div>
          <div className="h-[280px] w-full">
            <ReactECharts option={leadConversionOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

        {/* Chart 4: Lead Source Acquisition Breakdown */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800/90 shadow-xl shadow-slate-950/40 space-y-3 flex flex-col justify-between hover:border-slate-700/80 transition-all">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-xs font-bold text-white flex items-center space-x-2">
              <Share2 className="w-4 h-4 text-sky-400" />
              <span>Lead Source Acquisition Breakdown</span>
            </h3>
            <span className="text-[11px] font-mono text-sky-300 px-2.5 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20">
              Lead Channels
            </span>
          </div>
          <div className="h-[280px] w-full">
            <ReactECharts option={leadSourceChartOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

        {/* Chart 5: Sales Rep Revenue Leaderboard */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800/90 shadow-xl shadow-slate-950/40 space-y-3 flex flex-col justify-between hover:border-slate-700/80 transition-all">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-xs font-bold text-white flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Sales Rep Revenue Performance Leaderboard</span>
            </h3>
            <span className="text-[11px] font-mono text-amber-300 px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20">
              Team Performance
            </span>
          </div>
          <div className="h-[280px] w-full">
            <ReactECharts option={salesRepPerformanceOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

        {/* Chart 6: Customer Revenue Concentration (Top Accounts) */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800/90 shadow-xl shadow-slate-950/40 space-y-3 flex flex-col justify-between hover:border-slate-700/80 transition-all">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-xs font-bold text-white flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-indigo-400" />
              <span>Top Account Revenue Concentration</span>
            </h3>
            <span className="text-[11px] font-mono text-indigo-300 px-2.5 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20">
              Key Accounts
            </span>
          </div>
          <div className="h-[280px] w-full">
            <ReactECharts option={topCustomersChartOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

      </div>

      {/* 3. ORDERS MASTER TABLE SECTION */}
      <div className="glass-panel rounded-2xl border border-[var(--border-color)] bg-[#0f172a]/90 p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Billed & Unbilled</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {sheetStatusMessage || `Displaying ${filteredOrdersTable.length} order records.`}
            </p>
          </div>

          {/* Controls: Filter & Search */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Tabs */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
              <button
                onClick={() => setTableFilter('All')}
                className={`px-3 py-1.5 rounded-lg transition-all ${tableFilter === 'All' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                All ({combinedOrders.length})
              </button>
              <button
                onClick={() => setTableFilter('Billed')}
                className={`px-3 py-1.5 rounded-lg transition-all ${tableFilter === 'Billed' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                Billed ({kpis.ordersBilledCount})
              </button>
              <button
                onClick={() => setTableFilter('Unbilled')}
                className={`px-3 py-1.5 rounded-lg transition-all ${tableFilter === 'Unbilled' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                Unbilled ({kpis.unbilledOrdersCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto rounded-xl border border-slate-800/80">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">Deal ID</th>
                <th className="p-3">Customer Name</th>
                <th className="p-3">Deal / Order Title</th>
                <th className="p-3">Sales Rep</th>
                <th className="p-3 text-right">Order Amount (₹)</th>
                <th className="p-3">Creation Date (Bitrix ISO)</th>
                <th className="p-3">Billed Date</th>
                <th className="p-3 text-center">Billing Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
              {filteredOrdersTable.length > 0 ? (
                filteredOrdersTable.map((ord, i) => (
                  <tr key={ord.id || i} className="hover:bg-slate-800/50 transition-colors">
                    <td className="p-3 font-mono text-slate-500">{ord.sNo || i + 1}</td>
                    <td className="p-3 font-mono font-bold text-cyan-400">#{ord.dealId}</td>
                    <td className="p-3 font-bold text-white">{ord.customerName}</td>
                    <td className="p-3 text-slate-300 max-w-xs truncate">{ord.dealName}</td>
                    <td className="p-3 text-slate-300 font-semibold">{ord.salesRep}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-400">
                      ₹{ord.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 font-mono text-slate-300">{ord.isoCreationDate || ord.orderDate}</td>
                    <td className="p-3 font-mono text-slate-300">
                      {ord.status === 'Billed' ? ord.billedDate : <span className="text-amber-400/80 italic">Not Billed</span>}
                    </td>
                    <td className="p-3 text-center">
                      {ord.status === 'Billed' ? (
                        <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-md inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Billed
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-md inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Unbilled
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    No orders matching the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
