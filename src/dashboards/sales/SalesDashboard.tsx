import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  DollarSign,
  PieChart,
  BarChart3,
  Sparkles,
  Building2,
  Share2,
  FolderKanban,
  TrendingDown,
  Target,
  FileSpreadsheet
} from 'lucide-react';
import { SalesAnalyticsDetailModal, type SalesAnalyticsChartType } from './SalesAnalyticsDetailModal';
import {
  getCompanyMonthlyTarget,
  getCompanyYearlyTarget,
  getIndividualRepMonthlyTargets
} from '../../config/salesTargets';
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
import { matchesDateFilter, getCurrentMonthStr } from '../../utils/dateUtils';

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




const HalfGaugeArc: React.FC<{ percentage: number; label?: string }> = ({
  percentage,
  label = "billed"
}) => {
  const clamped = Math.min(100, Math.max(0, percentage));
  const radius = 44;
  const strokeWidth = 8;
  const arcLength = Math.PI * radius; // ~138.23
  const strokeDashoffset = arcLength - (arcLength * clamped) / 100;
  const strokeColor = clamped >= 75 ? '#10b981' : clamped >= 25 ? '#0284c7' : '#f59e0b';

  return (
    <div className="flex flex-col items-center justify-center relative select-none w-36 px-1">
      <div className="relative w-36 h-20 flex items-end justify-center overflow-visible">
        <svg className="w-full h-full overflow-visible" viewBox="0 0 108 58">
          {/* Background Track Arc */}
          <path
            d="M 10 50 A 44 44 0 0 1 98 50"
            fill="none"
            stroke="#334155"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Filled Progress Arc */}
          <path
            d="M 10 50 A 44 44 0 0 1 98 50"
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={arcLength}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Centered Metric inside arch */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1 text-center">
          <span className="text-2xl font-bold text-white font-mono tracking-tight leading-none">
            {clamped.toFixed(0)}%
          </span>
          <span className="text-[11px] text-slate-400 font-medium capitalize mt-1">
            {label}
          </span>
        </div>
      </div>
    </div>
  );
};


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

  const setTableFilter = (s: 'All' | 'Billed' | 'Unbilled') => {
    if (_onTableFilterChange) _onTableFilterChange(s);
    else _setLocalTableFilter(s);
  };

  const setSearchQuery = (q: string) => {
    if (_onSearchQueryChange) _onSearchQueryChange(q);
    else _setLocalSearchQuery(q);
  };

  const [projectRecords, setProjectRecords] = useState<ProjectRecord[]>(INITIAL_SAMPLE_PROJECTS);

  // Interactive Excel Data Register Modal State
  const [activeExcelModal, setActiveExcelModal] = useState<SalesAnalyticsChartType | null>(null);
  const [modalInitialCategory, setModalInitialCategory] = useState<string | null>(null);

  const handleChartElementClick = useCallback((type: SalesAnalyticsChartType, params: any) => {
    let category: string | null = null;
    if (params) {
      if (params.data && typeof params.data.name === 'string') {
        category = params.data.name;
      } else if (typeof params.name === 'string' && params.name) {
        category = params.name;
      } else if (typeof params.value === 'string' && params.value) {
        category = params.value;
      }
    }
    setActiveExcelModal(type);
    setModalInitialCategory(category ? category.trim() : null);
  }, []);

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
        .catch(() => { });

    } catch (err: any) {
      setSheetStatusMessage(`Sync error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadAllData();
    const interval = setInterval(() => {
      fetchOrdersSheetData(ordersUrl).then(sRes => {
        if (sRes && sRes.orders && sRes.orders.length > 0) {
          setSheetOrders(sRes.orders);
        }
      }).catch(() => { });
    }, 30000);
    return () => clearInterval(interval);
  }, [ordersUrl]);

  const filteredProjects = useMemo(() => {
    return projectRecords.filter(p => {
      if (startDate && endDate) {
        const pStart = p.startDate || '';
        const pEnd = p.actualEndDate || p.plannedEndDate || '';
        if (pStart && pEnd && (pEnd < startDate || pStart > endDate)) return false;
      } else if (dateFilter !== 'All Dates' && dateFilter !== 'Custom Range') {
        const matchStart = matchesDateFilter(p.startDate, dateFilter);
        const matchPlanned = matchesDateFilter(p.plannedEndDate, dateFilter);
        const matchActual = matchesDateFilter(p.actualEndDate, dateFilter);
        if (!matchStart && !matchPlanned && !matchActual) return false;
      }
      return true;
    });
  }, [projectRecords, dateFilter, startDate, endDate]);

  const projectKpis = useMemo(() => {
    return calculateProjectKPIs(filteredProjects, true);
  }, [filteredProjects]);

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

  // Filtered Orders matching active Date Filter, Rep Filter, Source Filter, Company Filter & Search Query
  const filteredActiveOrders = useMemo(() => {
    return combinedOrders.filter(ord => {
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
  }, [combinedOrders, repFilter, companyFilter, sourceFilter, startDate, endDate, dateFilter, searchQuery, bitrixMap]);

  // Operational KPI Calculations dynamically filtered by Date Filter, Sales Rep Filter & Search Query
  const kpis: OperationalKPIMetrics = useMemo(() => {
    // 1. Filtered Orders
    const activeOrders = filteredActiveOrders;

    const billedList = activeOrders.filter(o => o.status === 'Billed');
    const unbilledList = activeOrders.filter(o => o.status === 'Unbilled');

    const ordersBilledCount = billedList.length;
    const ordersBilledValue = billedList.reduce((s, o) => s + o.amount, 0);

    const unbilledOrdersCount = unbilledList.length;
    const unbilledOrdersValue = unbilledList.reduce((s, o) => s + o.amount, 0);

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

      const dDateStr = d.date || '';

      if (startDate && endDate) {
        const dIso = dDateStr.split(/[\sT]+/)[0];
        if (dIso && (dIso < startDate || dIso > endDate)) return false;
      } else if (dateFilter !== 'All Dates' && dateFilter !== 'Custom Range') {
        if (!matchesDateFilter(dDateStr, dateFilter)) return false;
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

    // Sales Orders Created: matches Orders Sheet when present for the period, otherwise won deals
    const salesOrdersCreatedCount = activeOrders.length > 0 ? activeOrders.length : dealsWonCount;
    const salesOrdersCreatedValue = activeOrders.length > 0 ? activeOrders.reduce((s, o) => s + o.amount, 0) : dealsWonValue;

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
  }, [filteredActiveOrders, bitrixData, dateFilter, startDate, endDate, repFilter, sourceFilter, companyFilter, searchQuery]);

  // Reusable Date Matching for Deals across Charts & Excel Modal
  const matchDealDate = useCallback((d: DealRecord) => {
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
  }, [repFilter, companyFilter, sourceFilter, startDate, endDate, dateFilter, searchQuery]);

  // Active Filtered Won Deals
  const filteredWonDeals = useMemo(() => {
    const rawWon = bitrixData ? bitrixData.won : (allRecords ? allRecords.filter(r => r.type === 'won') : []);
    return rawWon.filter(matchDealDate);
  }, [bitrixData, allRecords, matchDealDate]);

  // Active Filtered All Deals (Won, Lost, Progress - strictly filtered by date, rep, etc.)
  const filteredAllDeals = useMemo(() => {
    const rawAll = bitrixData ? [...bitrixData.won, ...bitrixData.lost, ...bitrixData.progress] : (allRecords || []);
    return rawAll.filter(matchDealDate);
  }, [bitrixData, allRecords, matchDealDate]);

  // Active Filtered Leads (strictly adheres to date filter and rep filter)
  const matchLeadDate = useCallback((l: any) => {
    if (repFilter !== 'All' && l.salesRep !== repFilter) return false;
    const stageChangeDate = l.dateClosed || l.dateModify || l.dateCreate || l.date || '';
    if (startDate && endDate) {
      if (stageChangeDate && (stageChangeDate < startDate || stageChangeDate > endDate)) return false;
    } else if (dateFilter !== 'All Dates' && dateFilter !== 'Custom Range') {
      if (!matchesDateFilter(stageChangeDate, dateFilter)) return false;
    }
    return true;
  }, [repFilter, startDate, endDate, dateFilter]);

  const filteredActiveLeads = useMemo(() => {
    const rawLeads = bitrixData ? (bitrixData.leads || []) : [];
    return rawLeads.filter(matchLeadDate);
  }, [bitrixData, matchLeadDate]);

  const formatLakhs = (val: number) => {
    if (val >= 10000000) {
      return `₹${(val / 10000000).toFixed(2)} Cr`;
    } else if (val >= 100000) {
      return `₹${(val / 100000).toFixed(2)} L`;
    }
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const totalOrdersValue = kpis.salesOrdersCreatedValue;
  const totalOrdersCount = kpis.salesOrdersCreatedCount;
  const billedPct = totalOrdersValue > 0 ? Math.min(100, Math.round((kpis.ordersBilledValue / totalOrdersValue) * 100)) : 0;

  // Deal Target & Performance Achievement Metrics
  const [targetsVersion, setTargetsVersion] = useState(0);
  useEffect(() => {
    const handleTargetsUpdated = () => setTargetsVersion(v => v + 1);
    window.addEventListener('salesTargetsUpdated', handleTargetsUpdated);
    return () => window.removeEventListener('salesTargetsUpdated', handleTargetsUpdated);
  }, []);

  const isMonthFilter = Boolean(dateFilter && dateFilter !== 'All Dates' && dateFilter !== 'Custom Range');
  const targetValue = useMemo(() => {
    const repTargets = getIndividualRepMonthlyTargets();
    if (repFilter !== 'All') {
      const repMonthly = repTargets[repFilter] || 4000000;
      return isMonthFilter ? repMonthly : repMonthly * 12;
    }
    return isMonthFilter ? getCompanyMonthlyTarget() : getCompanyYearlyTarget();
  }, [repFilter, isMonthFilter, targetsVersion]);

  const dealAchievementPct = targetValue > 0 ? Math.min(100, Math.round((kpis.dealsWonValue / targetValue) * 100)) : 0;

  // Project KPIs & Metrics
  const runningProjectsValue = useMemo(() => {
    return filteredProjects
      .filter(r => r.status === 'Running' || r.status.toLowerCase() === 'in progress')
      .reduce((sum, r) => sum + (r.plannedBudget || r.actualCost || 0), 0);
  }, [filteredProjects]);

  // Top Lead Source calculation (Strictly Leads only)
  const topLeadSource = useMemo(() => {
    const srcMap: Record<string, number> = {};
    const leadList = filteredActiveLeads.length > 0 ? filteredActiveLeads : (bitrixData?.leads || []);
    if (leadList && leadList.length > 0) {
      leadList.forEach((l: any) => {
        const rawSrc = l.sourceId || l.rawRecord?.SOURCE_ID || l.rawRecord?.UTM_SOURCE || '';
        const srcName = normalizeBitrixSource(rawSrc);
        srcMap[srcName] = (srcMap[srcName] || 0) + 1;
      });
    }
    const sorted = Object.entries(srcMap).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : 'Google Ads';
  }, [filteredActiveLeads, bitrixData]);

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

  // Filtered Orders Table List (matching active tableFilter 'All' | 'Billed' | 'Unbilled')
  const filteredOrdersTable = useMemo(() => {
    return filteredActiveOrders.filter(ord => {
      if (tableFilter === 'Billed' && ord.status !== 'Billed') return false;
      if (tableFilter === 'Unbilled' && ord.status !== 'Unbilled') return false;
      return true;
    });
  }, [filteredActiveOrders, tableFilter]);

  // 4. NEW UNIQUE: Lead Source Acquisition Breakdown Donut (Strictly Leads Only)
  const leadSourceChartOption = useMemo(() => {
    const sourceMap: Record<string, number> = {};

    filteredActiveLeads.forEach(l => {
      const rawSrc = l.sourceId || l.rawRecord?.SOURCE_ID || l.rawRecord?.UTM_SOURCE || '';
      const srcName = normalizeBitrixSource(rawSrc);
      sourceMap[srcName] = (sourceMap[srcName] || 0) + 1;
    });

    if (Object.keys(sourceMap).length === 0 && (!dateFilter || dateFilter === 'All Dates')) {
      sourceMap['Google Ads'] = 5;
      sourceMap['Existing Client'] = 3;
      sourceMap['Self Generated'] = 2;
      sourceMap['Reference'] = 1;
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
            name: d.name,
            value: d.value,
            itemStyle: { color: colorPalette[idx % colorPalette.length] }
          }))
        }
      ]
    };
  }, [filteredActiveLeads, dateFilter]);

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
          data: values.map((v, idx) => ({
            value: v,
            name: names[idx],
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

    const fullNames = sorted.map(s => s[0]).reverse();
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
          const fullName = item.data?.name || item.name || '';
          return `<div class="font-bold border-b border-slate-700 pb-1 mb-1 text-slate-200">${fullName}</div>
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
          data: values.map((v, idx) => ({
            value: v,
            name: fullNames[idx],
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
        {/* Row 1: Finance Health & Deal Performance Compound KPI Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* 1. Finance Health Executive Compound Card */}
          <div className="lg:col-span-6 bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800/90 shadow-xl shadow-slate-950/40 flex flex-col justify-between space-y-4 hover:border-slate-700/80 transition-all">
            {/* Card Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <Package className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-white tracking-tight">Finance Health</h3>
              </div>
            </div>

            {/* Top Section: Hero Metric (Left) + Half Gauge Arc (Right) */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-medium text-slate-400">Total Sales Orders</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-bold text-white tracking-tight">{formatLakhs(totalOrdersValue)}</span>
                  <span className="text-base font-normal text-slate-500">/</span>
                  <span className="text-xl font-semibold text-slate-300 font-mono">{totalOrdersCount}</span>
                </div>
              </div>

              {/* Right: Half Gauge Arc Graph */}
              <div className="flex flex-col items-center justify-center pl-4 shrink-0">
                <HalfGaugeArc percentage={billedPct} label="billed" />
              </div>
            </div>

            {/* Bottom Section: Full Width Sub-Cards Grid (Billed & Unbilled) */}
            <div className="grid grid-cols-2 gap-3.5 pt-1">
              {/* Billed Sub-Card */}
              <div className="glass-panel p-3.5 rounded-xl border border-slate-800/80 bg-slate-950/70 space-y-2 hover:border-emerald-500/40 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 truncate">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Billed Orders</span>
                  </div>
                  <span className="text-xs font-semibold font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 shrink-0">
                    {kpis.ordersBilledCount}
                  </span>
                </div>
                <div className="text-xl font-bold text-emerald-400 tracking-tight font-mono">
                  {formatLakhs(kpis.ordersBilledValue)}
                </div>
              </div>

              {/* Unbilled Sub-Card */}
              <div className="glass-panel p-3.5 rounded-xl border border-slate-800/80 bg-slate-950/70 space-y-2 hover:border-amber-500/40 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-amber-400 truncate">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>Unbilled Orders</span>
                  </div>
                  <span className="text-xs font-semibold font-mono px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 shrink-0">
                    {kpis.unbilledOrdersCount}
                  </span>
                </div>
                <div className="text-xl font-bold text-amber-400 tracking-tight font-mono">
                  {formatLakhs(kpis.unbilledOrdersValue)}
                </div>
              </div>
            </div>
          </div>

          {/* 2. SALES DEAL HEALTH Executive Compound Card */}
          <div className="lg:col-span-6 bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800/90 shadow-xl shadow-slate-950/40 flex flex-col justify-between space-y-4 hover:border-slate-700/80 transition-all">
            {/* Card Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <Target className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-white tracking-tight">Deal Performance</h3>
              </div>
            </div>

            {/* Top Section: Hero Metric (Left) + Half Gauge Arc (Right) */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-medium text-slate-400">Closed Won Deals</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-bold text-white tracking-tight">{formatLakhs(kpis.dealsWonValue)}</span>
                  <span className="text-base font-normal text-slate-500">/</span>
                  <span className="text-xl font-semibold text-slate-300 font-mono">{kpis.dealsWonCount}</span>
                </div>
              </div>

              {/* Right: Half Gauge Arc Graph for Target Achievement */}
              <div className="flex flex-col items-center justify-center pl-4 shrink-0">
                <HalfGaugeArc percentage={dealAchievementPct} label="achieved" />
              </div>
            </div>

            {/* Bottom Section: Full Width Sub-Cards Grid (In Progress & Lost Deals) */}
            <div className="grid grid-cols-2 gap-3.5 pt-1">
              {/* In Progress Sub-Card */}
              <div className="glass-panel p-3.5 rounded-xl border border-slate-800/80 bg-slate-950/70 space-y-2 hover:border-cyan-500/40 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-cyan-400 truncate">
                    <RefreshCw className="w-4 h-4 shrink-0" />
                    <span>In Pipeline</span>
                  </div>
                  <span className="text-xs font-semibold font-mono px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 shrink-0">
                    {kpis.dealsInProgressCount}
                  </span>
                </div>
                <div className="text-xl font-bold text-cyan-400 tracking-tight font-mono">
                  {formatLakhs(kpis.dealsInProgressValue)}
                </div>
              </div>

              {/* Lost Deals Sub-Card */}
              <div className="glass-panel p-3.5 rounded-xl border border-slate-800/80 bg-slate-950/70 space-y-2 hover:border-rose-500/40 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-rose-400 truncate">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Lost Opportunities</span>
                  </div>
                  <span className="text-xs font-semibold font-mono px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/20 shrink-0">
                    {kpis.dealsLostCount}
                  </span>
                </div>
                <div className="text-xl font-bold text-rose-400 tracking-tight font-mono">
                  {formatLakhs(kpis.dealsLostValue)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Sales Lead Health & Project Health Compound KPI Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* 1. SALES LEAD HEALTH Executive Compound Card */}
          <div
            onClick={() => {
              setActiveExcelModal('lead_qualification');
              setModalInitialCategory(null);
            }}
            className="lg:col-span-6 bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800/90 shadow-xl shadow-slate-950/40 flex flex-col justify-between space-y-4 hover:border-purple-500/50 hover:shadow-purple-950/20 transition-all cursor-pointer group relative"
            title="Click to view Lead Pipeline register & export Excel"
          >
            {/* Card Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20 group-hover:scale-105 transition-transform">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-white tracking-tight">Lead Pipeline</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveExcelModal('lead_qualification');
                    setModalInitialCategory(null);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/25 text-xs font-semibold transition-all group-hover:scale-105 cursor-pointer shadow-sm"
                  title="View Lead Pipeline Excel data register"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>View Sheet</span>
                </button>
                <span className="text-xs font-medium text-purple-300 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20">
                  Lead Health
                </span>
              </div>
            </div>

            {/* Main Content Layout: Left Stack */}
            <div className="space-y-3">
              {/* Top: Total Leads Health Count */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveExcelModal('lead_qualification');
                  setModalInitialCategory('qualified');
                }}
                className="cursor-pointer group/lead hover:opacity-90 transition-opacity"
                title="Click to view Qualified leads in Excel register"
              >
                <span className="text-xs font-medium text-slate-400 group-hover/lead:text-purple-300 transition-colors">Qualified Leads</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-bold text-white tracking-tight font-mono">{kpis.leadsQualifiedCount}</span>
                  <span className="text-base font-normal text-slate-500">/</span>
                  <span className="text-xl font-semibold text-slate-300 font-mono">{kpis.totalLeadsGeneratedCount} total</span>
                </div>
              </div>

              {/* Sub-cards Grid: In Progress, Disqualified, Top Source */}
              <div className="grid grid-cols-3 gap-3 pt-1">
                {/* In Progress */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveExcelModal('lead_qualification');
                    setModalInitialCategory('in_progress');
                  }}
                  className="glass-panel p-3 rounded-xl border border-slate-800/80 bg-slate-950/70 space-y-1.5 hover:border-purple-500/60 hover:bg-purple-950/20 cursor-pointer transition-all hover:scale-[1.02] active:scale-95 group/sub"
                  title="Click to view In Review leads in Excel register"
                >
                  <div className="flex items-center gap-1.5 text-xs font-medium text-purple-400">
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>In Review</span>
                  </div>
                  <div className="text-2xl font-bold text-white tracking-tight font-mono">
                    {kpis.leadsInProgressCount}
                  </div>
                </div>

                {/* Disqualified */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveExcelModal('lead_qualification');
                    setModalInitialCategory('disqualified');
                  }}
                  className="glass-panel p-3 rounded-xl border border-slate-800/80 bg-slate-950/70 space-y-1.5 hover:border-rose-500/60 hover:bg-rose-950/20 cursor-pointer transition-all hover:scale-[1.02] active:scale-95 group/sub"
                  title="Click to view Disqualified leads in Excel register"
                >
                  <div className="flex items-center gap-1.5 text-xs font-medium text-rose-400">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Disqualified</span>
                  </div>
                  <div className="text-2xl font-bold text-rose-400 tracking-tight font-mono">
                    {kpis.leadsDisqualifiedCount}
                  </div>
                </div>

                {/* Top Source */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveExcelModal('acquisition_channels');
                    setModalInitialCategory(topLeadSource || null);
                  }}
                  className="glass-panel p-3 rounded-xl border border-slate-800/80 bg-slate-950/70 space-y-1.5 hover:border-amber-500/60 hover:bg-amber-950/20 cursor-pointer transition-all hover:scale-[1.02] active:scale-95 group/sub"
                  title={`Click to view leads from ${topLeadSource} in Excel register`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Top Source</span>
                  </div>
                  <div className="text-sm font-semibold text-amber-300 truncate tracking-tight pt-0.5">
                    {topLeadSource}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. PROJECT HEALTH Executive Compound Card */}
          <div className="lg:col-span-6 bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800/90 shadow-xl shadow-slate-950/40 flex flex-col justify-between space-y-4 hover:border-slate-700/80 transition-all">
            {/* Card Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
                  <FolderKanban className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-white tracking-tight">Project Delivery</h3>
              </div>
            </div>

            {/* Main Content Layout: Left Stack */}
            <div className="space-y-3">
              {/* Top: Running Projects Value & Count */}
              <div>
                <span className="text-xs font-medium text-slate-400">Active Projects</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-bold text-white tracking-tight font-mono">{formatLakhs(runningProjectsValue)}</span>
                  <span className="text-base font-normal text-slate-500">/</span>
                  <span className="text-xl font-semibold text-slate-300 font-mono">{projectKpis.projectsRunning}</span>
                </div>
              </div>

              {/* Sub-cards Grid: On-Time, Under Budget, Over Budget */}
              <div className="grid grid-cols-3 gap-3 pt-1">
                {/* On-Time */}
                <div className="glass-panel p-3 rounded-xl border border-slate-800/80 bg-slate-950/70 space-y-1.5 hover:border-emerald-500/40 transition-all">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>On Schedule</span>
                  </div>
                  <div className="text-2xl font-bold text-white tracking-tight font-mono">
                    {projectKpis.onTimeProjects}
                  </div>
                </div>

                {/* Under Budget */}
                <div className="glass-panel p-3 rounded-xl border border-slate-800/80 bg-slate-950/70 space-y-1.5 hover:border-cyan-500/40 transition-all">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-cyan-400">
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>Under Budget</span>
                  </div>
                  <div className="text-2xl font-bold text-cyan-400 tracking-tight font-mono">
                    {projectKpis.underBudgetProjects}
                  </div>
                </div>

                {/* Over Budget */}
                <div className="glass-panel p-3 rounded-xl border border-slate-800/80 bg-slate-950/70 space-y-1.5 hover:border-rose-500/40 transition-all">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-rose-400">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Over Budget</span>
                  </div>
                  <div className="text-2xl font-bold text-rose-400 tracking-tight font-mono">
                    {projectKpis.overBudgetProjects}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. SYMMETRICAL 6-CHART OPERATIONAL VISUAL ANALYTICS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Chart 1: Orders Billed vs Unbilled Value */}
        <div
          onClick={() => {
            setActiveExcelModal('billing_operations');
            setModalInitialCategory(null);
          }}
          className="bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800/90 shadow-xl shadow-slate-950/40 space-y-3 flex flex-col justify-between hover:border-emerald-500/50 hover:shadow-emerald-950/20 transition-all cursor-pointer group relative"
          title="Click to view underlying Excel data register"
        >
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>Billing Operations (Billed vs. Unbilled)</span>
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveExcelModal('billing_operations');
                  setModalInitialCategory(null);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 text-xs font-semibold transition-all group-hover:scale-105 cursor-pointer shadow-sm"
                title="View Excel spreadsheet data"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>View Sheet</span>
              </button>
              <span className="text-xs font-medium text-blue-300 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20">
                Revenue Split
              </span>
            </div>
          </div>
          <div className="h-[280px] w-full" onClick={(e) => e.stopPropagation()}>
            <ReactECharts
              option={ordersBilledVsUnbilledOption}
              style={{ height: '100%', width: '100%' }}
              onEvents={{
                click: (params: any) => handleChartElementClick('billing_operations', params)
              }}
            />
          </div>
        </div>

        {/* Chart 2: Bitrix Deals Pipeline Throughput */}
        <div
          onClick={() => {
            setActiveExcelModal('pipeline_stages');
            setModalInitialCategory(null);
          }}
          className="bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800/90 shadow-xl shadow-slate-950/40 space-y-3 flex flex-col justify-between hover:border-emerald-500/50 hover:shadow-emerald-950/20 transition-all cursor-pointer group relative"
          title="Click to view underlying Excel data register"
        >
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <span>Pipeline Deals by Stage</span>
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveExcelModal('pipeline_stages');
                  setModalInitialCategory(null);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 text-xs font-semibold transition-all group-hover:scale-105 cursor-pointer shadow-sm"
                title="View Excel spreadsheet data"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>View Sheet</span>
              </button>
              <span className="text-xs font-medium text-cyan-300 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                Deal Pipeline
              </span>
            </div>
          </div>
          <div className="h-[280px] w-full" onClick={(e) => e.stopPropagation()}>
            <ReactECharts
              option={pipelineHealthOption}
              style={{ height: '100%', width: '100%' }}
              onEvents={{
                click: (params: any) => handleChartElementClick('pipeline_stages', params)
              }}
            />
          </div>
        </div>

        {/* Chart 3: Lead Qualification Conversion Funnel */}
        <div
          onClick={() => {
            setActiveExcelModal('lead_qualification');
            setModalInitialCategory(null);
          }}
          className="bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800/90 shadow-xl shadow-slate-950/40 space-y-3 flex flex-col justify-between hover:border-emerald-500/50 hover:shadow-emerald-950/20 transition-all cursor-pointer group relative"
          title="Click to view underlying Excel data register"
        >
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
              <PieChart className="w-4 h-4 text-purple-400" />
              <span>Lead Qualification & Funnel</span>
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveExcelModal('lead_qualification');
                  setModalInitialCategory(null);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 text-xs font-semibold transition-all group-hover:scale-105 cursor-pointer shadow-sm"
                title="View Excel spreadsheet data"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>View Sheet</span>
              </button>
              <span className="text-xs font-medium text-purple-300 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20">
                Conversion Funnel
              </span>
            </div>
          </div>
          <div className="h-[280px] w-full" onClick={(e) => e.stopPropagation()}>
            <ReactECharts
              option={leadConversionOption}
              style={{ height: '100%', width: '100%' }}
              onEvents={{
                click: (params: any) => handleChartElementClick('lead_qualification', params)
              }}
            />
          </div>
        </div>

        {/* Chart 4: Lead Source Acquisition Breakdown */}
        <div
          onClick={() => {
            setActiveExcelModal('acquisition_channels');
            setModalInitialCategory(null);
          }}
          className="bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800/90 shadow-xl shadow-slate-950/40 space-y-3 flex flex-col justify-between hover:border-emerald-500/50 hover:shadow-emerald-950/20 transition-all cursor-pointer group relative"
          title="Click to view underlying Excel data register"
        >
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
              <Share2 className="w-4 h-4 text-sky-400" />
              <span>Acquisition Channels</span>
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveExcelModal('acquisition_channels');
                  setModalInitialCategory(null);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 text-xs font-semibold transition-all group-hover:scale-105 cursor-pointer shadow-sm"
                title="View Excel spreadsheet data"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>View Sheet</span>
              </button>
              <span className="text-xs font-medium text-sky-300 px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20">
                Lead Sources
              </span>
            </div>
          </div>
          <div className="h-[280px] w-full" onClick={(e) => e.stopPropagation()}>
            <ReactECharts
              option={leadSourceChartOption}
              style={{ height: '100%', width: '100%' }}
              onEvents={{
                click: (params: any) => handleChartElementClick('acquisition_channels', params)
              }}
            />
          </div>
        </div>

        {/* Chart 5: Sales Rep Revenue Leaderboard */}
        <div
          onClick={() => {
            setActiveExcelModal('sales_reps');
            setModalInitialCategory(null);
          }}
          className="bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800/90 shadow-xl shadow-slate-950/40 space-y-3 flex flex-col justify-between hover:border-emerald-500/50 hover:shadow-emerald-950/20 transition-all cursor-pointer group relative"
          title="Click to view underlying Excel data register"
        >
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Sales Team Revenue Performance</span>
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveExcelModal('sales_reps');
                  setModalInitialCategory(null);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 text-xs font-semibold transition-all group-hover:scale-105 cursor-pointer shadow-sm"
                title="View Excel spreadsheet data"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>View Sheet</span>
              </button>
              <span className="text-xs font-medium text-amber-300 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                Leaderboard
              </span>
            </div>
          </div>
          <div className="h-[280px] w-full" onClick={(e) => e.stopPropagation()}>
            <ReactECharts
              option={salesRepPerformanceOption}
              style={{ height: '100%', width: '100%' }}
              onEvents={{
                click: (params: any) => handleChartElementClick('sales_reps', params)
              }}
            />
          </div>
        </div>

        {/* Chart 6: Customer Revenue Concentration (Top Accounts) */}
        <div
          onClick={() => {
            setActiveExcelModal('top_accounts');
            setModalInitialCategory(null);
          }}
          className="bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800/90 shadow-xl shadow-slate-950/40 space-y-3 flex flex-col justify-between hover:border-emerald-500/50 hover:shadow-emerald-950/20 transition-all cursor-pointer group relative"
          title="Click to view underlying Excel data register"
        >
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-indigo-400" />
              <span>Top Account Revenue Concentration</span>
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveExcelModal('top_accounts');
                  setModalInitialCategory(null);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 text-xs font-semibold transition-all group-hover:scale-105 cursor-pointer shadow-sm"
                title="View Excel spreadsheet data"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>View Sheet</span>
              </button>
              <span className="text-xs font-medium text-indigo-300 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                Account Concentration
              </span>
            </div>
          </div>
          <div className="h-[280px] w-full" onClick={(e) => e.stopPropagation()}>
            <ReactECharts
              option={topCustomersChartOption}
              style={{ height: '100%', width: '100%' }}
              onEvents={{
                click: (params: any) => handleChartElementClick('top_accounts', params)
              }}
            />
          </div>
        </div>

      </div>

      {/* 3. ORDERS MASTER TABLE SECTION */}
      <div className="glass-panel rounded-2xl border border-[var(--border-color)] bg-[#0f172a]/90 p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight">Orders Register</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {sheetStatusMessage || `Displaying ${filteredOrdersTable.length} order records.`}
            </p>
          </div>

          {/* Controls: Filter & Search */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Tabs */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-medium">
              <button
                onClick={() => setTableFilter('All')}
                className={`px-3 py-1.5 rounded-lg transition-all ${tableFilter === 'All' ? 'bg-blue-600 text-white shadow-sm font-semibold' : 'text-slate-400 hover:text-white'}`}
              >
                All ({kpis.ordersBilledCount + kpis.unbilledOrdersCount})
              </button>
              <button
                onClick={() => setTableFilter('Billed')}
                className={`px-3 py-1.5 rounded-lg transition-all ${tableFilter === 'Billed' ? 'bg-emerald-600 text-white shadow-sm font-semibold' : 'text-slate-400 hover:text-white'}`}
              >
                Billed ({kpis.ordersBilledCount})
              </button>
              <button
                onClick={() => setTableFilter('Unbilled')}
                className={`px-3 py-1.5 rounded-lg transition-all ${tableFilter === 'Unbilled' ? 'bg-amber-600 text-white shadow-sm font-semibold' : 'text-slate-400 hover:text-white'}`}
              >
                Unbilled ({kpis.unbilledOrdersCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search orders..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-48 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-400">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800 font-semibold">
              <tr>
                <th className="py-3 px-3.5">#</th>
                <th className="py-3 px-3.5">Deal ID</th>
                <th className="py-3 px-3.5">Customer Name</th>
                <th className="py-3 px-3.5">Deal Name / Solution</th>
                <th className="py-3 px-3.5">Assigned Rep</th>
                <th className="py-3 px-3.5 text-right">Amount</th>
                <th className="py-3 px-3.5">Order / ISO Date</th>
                <th className="py-3 px-3.5 text-center">Billing Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredOrdersTable.length > 0 ? (
                filteredOrdersTable.map((ord, idx) => (
                  <tr key={ord.id || idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3.5 text-slate-500 font-mono">{idx + 1}</td>
                    <td className="py-3 px-3.5 font-mono text-blue-400 font-medium">
                      {ord.dealId || 'N/A'}
                    </td>
                    <td className="py-3 px-3.5 font-medium text-white">{ord.customerName}</td>
                    <td className="py-3 px-3.5 text-slate-300 max-w-[200px] truncate" title={ord.dealName}>
                      {ord.dealName}
                    </td>
                    <td className="py-3 px-3.5 text-slate-300">{ord.salesRep}</td>
                    <td className="py-3 px-3.5 text-right font-mono font-semibold text-emerald-400">
                      ₹{ord.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3.5 font-mono text-slate-300">{ord.isoCreationDate || ord.orderDate}</td>
                    <td className="py-3 px-3.5 text-center">
                      {ord.status === 'Billed' ? (
                        <span className="px-2.5 py-1 text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 rounded-md inline-flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Billed
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/25 rounded-md inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> Unbilled
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

      {/* 4. INTERACTIVE EXCEL DATA REGISTER MODAL */}
      <SalesAnalyticsDetailModal
        isOpen={Boolean(activeExcelModal)}
        onClose={() => {
          setActiveExcelModal(null);
          setModalInitialCategory(null);
        }}
        chartType={activeExcelModal}
        initialCategory={modalInitialCategory}
        leads={filteredActiveLeads}
        wonDeals={filteredWonDeals}
        allDeals={filteredAllDeals}
        orders={filteredActiveOrders}
        kpis={kpis}
        dateFilter={dateFilter}
        repFilter={repFilter}
      />

    </div>
  );
};
