import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ReactECharts from 'echarts-for-react';
import {
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Layers,
  Filter,
  AlertTriangle,
  Award,
  User,
  Globe,
  X,
  Search,
  Download,
  Building2,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  CircleDollarSign
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { DealRecord, KPIMetrics } from '../../types/sales';
import { normalizeBitrixSource, normalizeBitrixIndustry, normalizeBitrixSolutionType } from '../../engine/bitrixService';

interface ChartsDashboardProps {
  records: DealRecord[];
  kpis: KPIMetrics;
}

export const ChartsDashboard: React.FC<ChartsDashboardProps> = ({ records, kpis }) => {
  const wonDeals = records.filter(r => r.type === 'won');
  const lostDeals = records.filter(r => r.type === 'lost');
  const progressDeals = records.filter(r => r.type === 'in_progress');

  // Modal states for chart clicks
  const [selectedLeadSource, setSelectedLeadSource] = useState<string | null>(null);
  const [selectedFunnelStage, setSelectedFunnelStage] = useState<string | null>(null);
  const [selectedRep, setSelectedRep] = useState<string | null>(null);
  const [selectedDealBracket, setSelectedDealBracket] = useState<string | null>(null);
  const [modalSearch, setModalSearch] = useState<string>('');
  const [modalStageTab, setModalStageTab] = useState<'all' | 'won' | 'lost' | 'in_progress'>('all');

  const isAnyModalOpen = Boolean(selectedDealBracket || selectedFunnelStage || selectedLeadSource || selectedRep);

  useEffect(() => {
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isAnyModalOpen]);

  // Helper to parse Month-Year strings into timestamp for chronological sorting
  const monthOrderMap: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };

  const getMonthYearTime = (str: string): number => {
    if (!str) return 0;
    const parts = str.trim().split(/\s+/);
    if (parts.length >= 2) {
      const mStr = parts[0].toLowerCase().substring(0, 3);
      const yNum = parseInt(parts[1], 10);
      const mNum = monthOrderMap[mStr] !== undefined ? monthOrderMap[mStr] : 0;
      if (!isNaN(yNum)) {
        return new Date(yNum, mNum, 1).getTime();
      }
    }
    return 0;
  };

  // -------------------------------------------------------------
  // 1. Monthly Revenue Trend Chart
  // -------------------------------------------------------------
  const monthMap: Record<string, number> = {};
  wonDeals.forEach(r => {
    monthMap[r.monthYear] = (monthMap[r.monthYear] || 0) + r.netRevenue;
  });

  const monthKeys = Object.keys(monthMap).sort((a, b) => getMonthYearTime(a) - getMonthYearTime(b));
  const revenueValues = monthKeys.map(k => Math.round((monthMap[k] / 100000) * 100) / 100);

  const numSelectedMonths = Math.max(1, monthKeys.length);
  const avgSeriesName = numSelectedMonths === 1 ? 'Period Average' : `${numSelectedMonths}-Month Moving Avg`;

  const movingAvgValues = revenueValues.map((_, idx, arr) => {
    const windowSize = Math.min(idx + 1, numSelectedMonths);
    const startIdx = idx - windowSize + 1;
    const subArr = arr.slice(startIdx, idx + 1);
    const sum = subArr.reduce((acc, v) => acc + v, 0);
    const avg = sum / subArr.length;
    return Math.round(avg * 100) / 100;
  });

  const revenueTrendOption = {
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
            <span class="font-mono font-bold">₹${Number(item.value).toFixed(2)} L</span>
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
    grid: {
      top: '18%',
      left: '3%',
      right: '4%',
      bottom: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: monthKeys.length > 0 ? monthKeys : ['Jul 2026'],
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      axisLine: { lineStyle: { color: '#334155' } }
    },
    yAxis: {
      type: 'value',
      name: '₹ Lakhs',
      nameTextStyle: { color: '#94a3b8', fontSize: 11, padding: [0, 0, 0, -20] },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } }
    },
    series: [
      {
        name: 'Actual Revenue',
        type: 'bar',
        barWidth: '35%',
        data: revenueValues.length > 0 ? revenueValues : [0],
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: '#3b82f6' }, { offset: 1, color: '#1d4ed8' }]
          },
          borderRadius: [6, 6, 0, 0]
        }
      },
      {
        name: avgSeriesName,
        type: 'line',
        smooth: true,
        data: movingAvgValues.length > 0 ? movingAvgValues : [0],
        lineStyle: { width: 3, color: '#10b981' },
        itemStyle: { color: '#10b981' }
      }
    ]
  };

  // -------------------------------------------------------------
  // 2. Revenue & Performance by Responsible Person (CLICKABLE)
  // -------------------------------------------------------------
  const repRevMap: Record<string, number> = {};
  wonDeals.forEach(r => {
    repRevMap[r.salesRep] = (repRevMap[r.salesRep] || 0) + r.netRevenue;
  });

  const sortedReps = Object.entries(repRevMap).sort((a, b) => a[1] - b[1]);

  const repPerformanceOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#f8fafc', fontSize: 12 },
      formatter: (params: any) => {
        const repName = params[0].name;
        const repDeals = records.filter(r => r.salesRep === repName);
        return `<div class="font-bold border-b border-slate-700 pb-1 mb-1">${repName}</div>
          <div class="text-xs text-slate-300">Won Revenue: <strong class="text-emerald-400">₹${Number(params[0].value).toFixed(2)} L</strong></div>
          <div class="text-xs text-slate-400">Total Deals: <strong>${repDeals.length} deals</strong></div>
          <div class="text-[10px] text-blue-400 font-bold mt-1">👉 Click bar to view & download Excel worksheet</div>`;
      }
    },
    grid: {
      top: '8%',
      left: '3%',
      right: '8%',
      bottom: '5%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      name: '₹ Lakhs',
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } }
    },
    yAxis: {
      type: 'category',
      data: sortedReps.map(r => r[0]),
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      axisLine: { lineStyle: { color: '#334155' } }
    },
    series: [
      {
        name: 'Revenue (₹ Lakhs)',
        type: 'bar',
        data: sortedReps.map(r => Math.round((r[1] / 100000) * 100) / 100),
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [{ offset: 0, color: '#10b981' }, { offset: 1, color: '#3b82f6' }]
          },
          borderRadius: [0, 6, 6, 0]
        },
        label: {
          show: true,
          position: 'right',
          color: '#cbd5e1',
          fontSize: 10,
          formatter: (params: any) => `₹${Number(params.value).toFixed(2)} L`
        }
      }
    ]
  };

  const handleRepClick = (params: any) => {
    if (params && params.name) {
      setSelectedRep(params.name);
      setModalSearch('');
      setModalStageTab('all');
    }
  };

  // -------------------------------------------------------------
  // 3. Revenue by Lead Source Channel (CLICKABLE)
  // -------------------------------------------------------------
  const BITRIX_SOURCES = ['India Mart', 'LinkedIn', 'Google Ads', 'Existing Client', 'Reference', 'Self Generated', 'E-Mail'];
  const leadSourceMap: Record<string, number> = {};
  BITRIX_SOURCES.forEach(s => { leadSourceMap[s] = 0; });

  records.forEach(r => {
    const normSource = normalizeBitrixSource(r.leadSource);
    if (r.type === 'won') {
      leadSourceMap[normSource] = (leadSourceMap[normSource] || 0) + r.netRevenue;
    } else if (leadSourceMap[normSource] === undefined) {
      leadSourceMap[normSource] = 0;
    }
  });

  const filteredLeadSources = Object.entries(leadSourceMap).filter(([_, revenue]) => revenue > 0);
  const sortedLeadSources = (filteredLeadSources.length > 0 ? filteredLeadSources : Object.entries(leadSourceMap)).sort((a, b) => b[1] - a[1]);

  const leadSourceOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#f8fafc', fontSize: 12 },
      formatter: (params: any) => {
        const sourceName = params[0].name;
        const sourceDeals = records.filter(r => normalizeBitrixSource(r.leadSource) === sourceName);
        return `<div class="font-bold border-b border-slate-700 pb-1 mb-1">${sourceName}</div>
          <div class="text-xs text-slate-300">Won Revenue: <strong class="text-emerald-400">₹${Number(params[0].value).toFixed(2)} L</strong></div>
          <div class="text-xs text-slate-400">Total Deals: <strong>${sourceDeals.length} deals</strong></div>
          <div class="text-[10px] text-blue-400 font-bold mt-1">👉 Click bar to view & download Excel worksheet</div>`;
      }
    },
    grid: {
      top: '12%',
      left: '3%',
      right: '4%',
      bottom: '16%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: sortedLeadSources.map(s => s[0]),
      axisLabel: { color: '#94a3b8', fontSize: 10, interval: 0, rotate: 15 },
      axisLine: { lineStyle: { color: '#334155' } }
    },
    yAxis: {
      type: 'value',
      name: '₹ Lakhs',
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } }
    },
    series: [
      {
        name: 'Revenue (₹ Lakhs)',
        type: 'bar',
        barWidth: '35%',
        data: sortedLeadSources.map(s => Math.round((s[1] / 100000) * 100) / 100),
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: '#f59e0b' }, { offset: 1, color: '#d97706' }]
          },
          borderRadius: [6, 6, 0, 0]
        },
        label: {
          show: true,
          position: 'top',
          color: '#cbd5e1',
          fontSize: 10,
          formatter: (params: any) => `₹${Number(params.value).toFixed(2)} L`
        }
      }
    ]
  };

  const handleLeadSourceClick = (params: any) => {
    if (params && params.name) {
      setSelectedLeadSource(params.name);
      setModalSearch('');
      setModalStageTab('all');
    }
  };

  // -------------------------------------------------------------
  // 4. Target vs Revenue Comparison
  // -------------------------------------------------------------
  const actualRevLakhs = Math.round((kpis.totalNetRevenue / 100000) * 100) / 100;
  const targetLakhs = Math.round((kpis.monthlyTarget / 100000) * 100) / 100;
  const gapLakhs = Math.max(0, Math.round((targetLakhs - actualRevLakhs) * 100) / 100);

  const targetVsRevOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#f8fafc', fontSize: 12 }
    },
    legend: {
      top: '2%',
      right: '2%',
      textStyle: { color: '#94a3b8', fontSize: 11 }
    },
    grid: {
      top: '18%',
      left: '3%',
      right: '4%',
      bottom: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: ['Actual Revenue', 'Monthly Target', 'Target Gap'],
      axisLabel: { color: '#94a3b8', fontSize: 11 },
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
        name: 'Revenue (₹ Lakhs)',
        type: 'bar',
        barWidth: '40%',
        data: [
          { value: actualRevLakhs, itemStyle: { color: '#10b981', borderRadius: [6, 6, 0, 0] } },
          { value: targetLakhs, itemStyle: { color: '#6366f1', borderRadius: [6, 6, 0, 0] } },
          { value: gapLakhs, itemStyle: { color: '#f43f5e', borderRadius: [6, 6, 0, 0] } }
        ],
        label: {
          show: true,
          position: 'top',
          color: '#e2e8f0',
          fontSize: 11,
          fontWeight: 'bold',
          formatter: (params: any) => `₹${Number(params.value).toFixed(2)} L`
        }
      }
    ]
  };

  // -------------------------------------------------------------
  // 5. Sales Pipeline Funnel (100% Dynamic Partitioning of in_progress deals)
  // -------------------------------------------------------------
  const stageCanonicalList = [
    { id: 'need', name: '1. Need Analysis', color: '#3b82f6', shapeWeight: 100 },
    { id: 'design', name: '2. Solution Design', color: '#06b6d4', shapeWeight: 82 },
    { id: 'sol_app', name: '3. Solution Approval', color: '#10b981', shapeWeight: 65 },
    { id: 'quote', name: '4. Quote Creation', color: '#8b5cf6', shapeWeight: 48 },
    { id: 'quote_app', name: '5. Quote Approval', color: '#f59e0b', shapeWeight: 32 },
    { id: 'neg', name: '6. Negotiation', color: '#f43f5e', shapeWeight: 18 }
  ];

  // Map every in_progress deal into exactly ONE stage index (0 to 5)
  const getStageIndex = (r: DealRecord): number => {
    const s = (r.stage || '').toLowerCase().trim();
    const rawS = String(r.rawRecord?.['Stage'] || r.rawRecord?.['Deal Stage'] || r.rawRecord?.['STAGE_ID'] || '').toLowerCase().trim();
    const combined = `${s} ${rawS}`;

    // Index 5: Negotiation
    if (combined.includes('negotiat') || combined.includes('oqlf1d') || combined.includes('contract') || combined.includes('closing')) return 5;

    // Index 4: Quote Approval / Quotation Approval
    if ((combined.includes('quote') || combined.includes('quotation')) && (combined.includes('appr') || combined.includes('app'))) return 4;
    if (combined.includes('executing') || combined.includes('exec')) return 4;

    // Index 3: Quote Creation
    if (combined.includes('quote creation') || (combined.includes('quote') && combined.includes('creat')) || combined.includes('prepayment') || combined.includes('invoice')) return 3;
    if (combined.includes('quote') || combined.includes('quotation') || combined.includes('proposal')) return 3;

    // Index 2: Solution Approval
    if (combined.includes('solution approval') || (combined.includes('solution') && (combined.includes('appr') || combined.includes('app'))) || combined.includes('preparation')) return 2;

    // Index 1: Solution Design
    if (combined.includes('solution design') || combined.includes('design') || combined.includes('u1dim3') || combined.includes('architect')) return 1;

    // Index 0: Need Analysis
    return 0;
  };

  const funnelBuckets: DealRecord[][] = stageCanonicalList.map(() => []);
  progressDeals.forEach(r => {
    const idx = getStageIndex(r);
    funnelBuckets[idx].push(r);
  });

  const funnelStageMetrics = stageCanonicalList.map((stg, idx) => {
    const stageDeals = funnelBuckets[idx];
    const count = stageDeals.length;
    const revenue = stageDeals.reduce((sum, r) => sum + r.netRevenue, 0);

    return {
      name: stg.name,
      count,
      revenue,
      shapeWeight: stg.shapeWeight,
      color: stg.color,
      deals: stageDeals
    };
  });

  // 3D Color gradients for each stage
  const funnel3DColors = [
    { top: '#60a5fa', bottom: '#1d4ed8' }, // 1. Need Analysis (3D Sapphire Blue)
    { top: '#22d3ee', bottom: '#0891b2' }, // 2. Solution Design (3D Cyan Teal)
    { top: '#34d399', bottom: '#047857' }, // 3. Solution Approval (3D Emerald)
    { top: '#c084fc', bottom: '#7e22ce' }, // 4. Quote Creation (3D Violet)
    { top: '#fbbf24', bottom: '#b45309' }, // 5. Quote Approval (3D Amber Gold)
    { top: '#f87171', bottom: '#be123c' }  // 6. Negotiation (3D Coral Red)
  ];

  const funnelData = funnelStageMetrics.map((stg, idx) => {
    const c = funnel3DColors[idx] || { top: stg.color, bottom: stg.color };
    return {
      value: stg.shapeWeight,
      actualCount: stg.count,
      actualRevenue: stg.revenue,
      name: stg.name,
      itemStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: c.top },
            { offset: 0.5, color: stg.color },
            { offset: 1, color: c.bottom }
          ]
        },
        shadowBlur: 14,
        shadowColor: 'rgba(0, 0, 0, 0.65)',
        shadowOffsetY: 6,
        borderColor: 'rgba(255, 255, 255, 0.25)',
        borderWidth: 2,
        borderRadius: 4
      }
    };
  });

  const funnelOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: '#0f172a',
      borderColor: '#3b82f6',
      borderWidth: 1.5,
      textStyle: { color: '#f8fafc', fontSize: 12 },
      formatter: (params: any) => {
        const d = params.data;
        return `<div class="font-bold border-b border-slate-700 pb-1 mb-1 text-blue-400">${d.name}</div>
          <div class="text-xs text-slate-200 font-mono">Stage Volume: <strong class="text-white font-bold">${d.actualCount} Deals</strong></div>
          <div class="text-xs text-slate-300 font-mono">Est. Value: <strong class="text-emerald-400 font-bold">₹${(d.actualRevenue / 100000).toFixed(2)} L</strong></div>
          <div class="text-[10px] text-cyan-400 font-bold mt-1">👉 Click 3D stage to view & download Excel worksheet</div>`;
      }
    },
    series: [
      {
        name: '3D Sales Pipeline Funnel',
        type: 'funnel',
        top: '2%',
        bottom: '2%',
        left: '4%',
        width: '56%',
        minSize: '24%',
        maxSize: '100%',
        sort: 'none',
        gap: 4,
        funnelAlign: 'center',
        label: {
          show: true,
          position: 'right',
          color: '#f1f5f9',
          fontSize: 11,
          fontWeight: 'bold',
          formatter: (params: any) => {
            const d = params.data;
            return `{title|${d.name}}\n{sub|${d.actualCount} deals • ₹${(d.actualRevenue / 100000).toFixed(1)}L}`;
          },
          rich: {
            title: {
              fontSize: 11,
              fontWeight: 'bold',
              color: '#f8fafc',
              lineHeight: 16
            },
            sub: {
              fontSize: 10,
              fontFamily: 'monospace',
              color: '#34d399',
              lineHeight: 14
            }
          }
        },
        labelLine: {
          show: true,
          length: 8,
          length2: 6,
          lineStyle: { color: '#64748b', width: 1.5, type: 'solid' }
        },
        emphasis: {
          scale: true,
          focus: 'series',
          itemStyle: {
            shadowBlur: 24,
            shadowColor: 'rgba(59, 130, 246, 0.8)',
            borderColor: '#ffffff',
            borderWidth: 2
          }
        },
        data: funnelData
      }
    ]
  };

  const handleFunnelClick = (params: any) => {
    if (params && params.name) {
      setSelectedFunnelStage(params.name);
      setModalSearch('');
    }
  };
  const totalAllCount = records.length;
  const wonPct = totalAllCount > 0 ? Math.round((kpis.totalWonCount / totalAllCount) * 1000) / 10 : 0;
  const lostPct = totalAllCount > 0 ? Math.round((kpis.totalLostCount / totalAllCount) * 1000) / 10 : 0;
  const pipelinePct = totalAllCount > 0 ? Math.round((progressDeals.length / totalAllCount) * 1000) / 10 : 0;

  const wonValue = wonDeals.reduce((acc, r) => acc + r.netRevenue, 0);
  const lostValue = lostDeals.reduce((acc, r) => acc + r.netRevenue, 0);
  const pipelineValue = progressDeals.reduce((acc, r) => acc + r.netRevenue, 0);

  const formatCurrencyVal = (val: number): string => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const winLostOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#f8fafc', fontSize: 12 },
      formatter: (params: any) => {
        const monetaryVal = params.data?.monetaryValue ?? 0;
        const formattedAmount = formatCurrencyVal(monetaryVal);
        return `<div class="font-bold border-b border-slate-700 pb-1 mb-1">${params.name}</div>
          <div class="text-xs text-slate-200">Volume: <strong class="font-mono text-white">${params.value} Deals</strong></div>
          <div class="text-xs text-emerald-400">Value: <strong class="font-mono text-emerald-300 font-bold">${formattedAmount}</strong></div>
          <div class="text-xs text-slate-400">Share: <strong class="font-mono text-cyan-400">${params.percent}%</strong></div>`;
      }
    },
    legend: { show: false },
    title: { show: false },
    series: [
      {
        name: 'Deal Outcomes',
        type: 'pie',
        center: ['50%', '50%'],
        radius: ['60%', '88%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#0f172a',
          borderWidth: 4
        },
        label: {
          show: true,
          position: 'center',
          formatter: `{val|${totalAllCount}}\n{sub|TOTAL DEALS}`,
          rich: {
            val: {
              fontSize: 28,
              fontWeight: '900',
              color: '#ffffff',
              lineHeight: 34,
              align: 'center'
            },
            sub: {
              fontSize: 10,
              fontWeight: 'bold',
              color: '#94a3b8',
              lineHeight: 16,
              align: 'center'
            }
          }
        },
        emphasis: {
          scale: true,
          scaleSize: 8,
          label: {
            show: true,
            formatter: `{val|${totalAllCount}}\n{sub|TOTAL DEALS}`,
            rich: {
              val: {
                fontSize: 28,
                fontWeight: '900',
                color: '#ffffff',
                lineHeight: 34,
                align: 'center'
              },
              sub: {
                fontSize: 10,
                fontWeight: 'bold',
                color: '#94a3b8',
                lineHeight: 16,
                align: 'center'
              }
            }
          },
          itemStyle: {
            shadowBlur: 15,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        },
        data: [
          {
            value: kpis.totalWonCount,
            name: 'Won Deals',
            monetaryValue: wonValue,
            itemStyle: {
              color: {
                type: 'linear', x: 0, y: 0, x2: 1, y2: 1,
                colorStops: [{ offset: 0, color: '#10b981' }, { offset: 1, color: '#059669' }]
              }
            }
          },
          {
            value: kpis.totalLostCount,
            name: 'Lost Deals',
            monetaryValue: lostValue,
            itemStyle: {
              color: {
                type: 'linear', x: 0, y: 0, x2: 1, y2: 1,
                colorStops: [{ offset: 0, color: '#f43f5e' }, { offset: 1, color: '#e11d48' }]
              }
            }
          },
          {
            value: progressDeals.length,
            name: 'In Pipeline',
            monetaryValue: pipelineValue,
            itemStyle: {
              color: {
                type: 'linear', x: 0, y: 0, x2: 1, y2: 1,
                colorStops: [{ offset: 0, color: '#3b82f6' }, { offset: 1, color: '#2563eb' }]
              }
            }
          }
        ]
      }
    ]
  };

  // -------------------------------------------------------------
  // 7. Industry Breakdown (Real Bitrix Industry Field)
  // -------------------------------------------------------------
  const indMap: Record<string, { revenue: number; count: number }> = {};
  wonDeals.forEach(r => {
    const rawUf = r.rawRecord?.UF_CRM_67E4FF8E84730 || r.industry;
    const ind = normalizeBitrixIndustry(rawUf, r.rawRecord);
    if (!indMap[ind]) indMap[ind] = { revenue: 0, count: 0 };
    indMap[ind].revenue += r.netRevenue;
    indMap[ind].count += 1;
  });

  // Sort descending by revenue, take top 10, then reverse for horizontal bar chart (highest at top)
  const sortedIndList = Object.entries(indMap)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 10)
    .reverse();

  const industryNames = sortedIndList.map(([name]) => name.length > 22 ? name.slice(0, 20) + '...' : name);
  const industryRevenues = sortedIndList.map(([, d]) => Math.round((d.revenue / 100000) * 100) / 100);
  const industryCounts = sortedIndList.map(([, d]) => d.count);

  const industryOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#0f172a',
      borderColor: '#8b5cf6',
      borderWidth: 1.5,
      textStyle: { color: '#f8fafc', fontSize: 12 },
      formatter: (params: any[]) => {
        const item = params[0];
        if (!item) return '';
        const idx = item.dataIndex;
        const revLakhs = item.value;
        const dealsCount = industryCounts[idx] || 0;
        return `<div class="font-bold border-b border-slate-700 pb-1 mb-1 text-purple-400">${item.name}</div>
          <div class="text-xs text-slate-200">Won Revenue: <strong class="font-mono text-emerald-300 font-bold">₹${Number(revLakhs).toFixed(2)} Lakhs</strong></div>
          <div class="text-xs text-slate-400">Won Deals: <strong class="font-mono text-white">${dealsCount} deals</strong></div>`;
      }
    },
    grid: {
      top: '8%',
      left: '3%',
      right: '12%',
      bottom: '5%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      name: '₹ Lakhs',
      axisLabel: { color: '#94a3b8', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } }
    },
    yAxis: {
      type: 'category',
      data: industryNames.length > 0 ? industryNames : ['General Industry'],
      axisLabel: { color: '#cbd5e1', fontSize: 11, fontWeight: 'bold' },
      axisLine: { lineStyle: { color: '#334155' } }
    },
    series: [
      {
        name: 'Revenue (₹ Lakhs)',
        type: 'bar',
        barWidth: '55%',
        data: industryRevenues,
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [{ offset: 0, color: '#8b5cf6' }, { offset: 1, color: '#ec4899' }]
          },
          borderRadius: [0, 6, 6, 0]
        },
        label: {
          show: true,
          position: 'right',
          color: '#e2e8f0',
          fontSize: 10,
          fontWeight: 'bold',
          formatter: (params: any) => `₹${Number(params.value).toFixed(2)} L`
        }
      }
    ]
  };

  // -------------------------------------------------------------
  // 8. Reasons Deals Were Lost (Clean Horizontal Bar Chart)
  // -------------------------------------------------------------
  const lostReasonCounts: Record<string, { count: number; value: number }> = {};

  lostDeals.forEach(r => {
    const raw = (r.lostReason || r.rawRecord?.COMMENTS || '').toLowerCase().trim();
    let cat = 'Other Reasons';

    if (raw.includes('price') || raw.includes('budget') || raw.includes('high') || raw.includes('cost') || raw.includes('expensive')) {
      cat = 'Price & Commercial Challenge';
    } else if (raw.includes('no response') || raw.includes('cold response') || raw.includes('not received') || raw.includes('unresponsive') || raw.includes('follow-up')) {
      cat = 'No Customer Response';
    } else if (raw.includes('drop') || raw.includes('not require') || raw.includes('no requirement') || raw.includes('postponed') || raw.includes('cancelled')) {
      cat = 'Requirement Dropped';
    } else if (raw.includes('hold') || raw.includes('case hold') || raw.includes('clarity')) {
      cat = 'Project Put On Hold';
    } else if (raw.includes('management') || raw.includes('agree') || raw.includes('disagree') || raw.includes('internal')) {
      cat = 'Management Disagreement';
    } else if (raw.includes('delay') || raw.includes('late') || raw.includes('slow') || raw.includes('time')) {
      cat = 'Delay in Process / Quote';
    } else if (raw.includes('somewhere else') || raw.includes('another brand') || raw.includes('competitor') || raw.includes('vendor')) {
      cat = 'Competitor Selected';
    }

    if (!lostReasonCounts[cat]) {
      lostReasonCounts[cat] = { count: 0, value: 0 };
    }
    lostReasonCounts[cat].count += 1;
    lostReasonCounts[cat].value += r.netRevenue;
  });

  const sortedLossReasons = Object.entries(lostReasonCounts)
    .sort((a, b) => b[1].count - a[1].count);

  // Reverse for horizontal bar chart so highest count is at top
  const sortedLossReasonsRev = [...sortedLossReasons].reverse();
  const reasonYCategories = sortedLossReasonsRev.map(([name]) => name);
  const reasonBarValues = sortedLossReasonsRev.map(([, data]) => data.count);
  const reasonMonetaryValues = sortedLossReasonsRev.map(([, data]) => data.value);
  const totalLostDealsCount = lostDeals.length || 1;

  const paretoOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#0f172a',
      borderColor: '#f43f5e',
      borderWidth: 1.5,
      textStyle: { color: '#f8fafc', fontSize: 12 },
      formatter: (params: any[]) => {
        const item = params[0];
        if (!item) return '';
        const idx = item.dataIndex;
        const val = item.value;
        const rev = reasonMonetaryValues[idx] || 0;
        const pct = ((val / totalLostDealsCount) * 100).toFixed(1);
        const formattedAmount = formatCurrencyVal(rev);
        return `<div class="font-bold border-b border-slate-700 pb-1 mb-1 text-rose-400">${item.name}</div>
          <div class="text-xs text-slate-200">Lost Deals: <strong class="font-mono text-white">${val} deals (${pct}%)</strong></div>
          <div class="text-xs text-emerald-400">Total Lost Value: <strong class="font-mono text-emerald-300 font-bold">${formattedAmount}</strong></div>`;
      }
    },
    grid: {
      top: '8%',
      left: '3%',
      right: '14%',
      bottom: '5%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#94a3b8', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } }
    },
    yAxis: {
      type: 'category',
      data: reasonYCategories.length > 0 ? reasonYCategories : ['No Data'],
      axisLabel: { color: '#cbd5e1', fontSize: 11, fontWeight: 'bold' },
      axisLine: { lineStyle: { color: '#334155' } }
    },
    series: [
      {
        name: 'Lost Deals',
        type: 'bar',
        barWidth: '55%',
        data: reasonBarValues,
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#f43f5e' },
              { offset: 1, color: '#e11d48' }
            ]
          },
          borderRadius: [0, 6, 6, 0]
        },
        label: {
          show: true,
          position: 'right',
          color: '#f43f5e',
          fontSize: 11,
          fontWeight: 'bold',
          formatter: (params: any) => `${params.value} deals`
        }
      }
    ]
  };

  // -------------------------------------------------------------
  // 9. Revenue by Solution Type (Ultra-Clean Executive Treemap)
  // -------------------------------------------------------------
  const solutionMap: Record<string, { revenue: number; count: number }> = {};
  wonDeals.forEach(r => {
    const normSol = normalizeBitrixSolutionType(r.solution, r.rawRecord);
    if (!solutionMap[normSol]) solutionMap[normSol] = { revenue: 0, count: 0 };
    solutionMap[normSol].revenue += r.netRevenue;
    solutionMap[normSol].count += 1;
  });

  const treemapColors = [
    '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4',
    '#ec4899', '#f43f5e', '#64748b', '#059669', '#d97706'
  ];

  const sortedSolutionEntries = Object.entries(solutionMap)
    .sort((a, b) => b[1].revenue - a[1].revenue);

  const totalSolutionRev = sortedSolutionEntries.reduce((sum, [, d]) => sum + d.revenue, 0);

  const treeMapData = sortedSolutionEntries.map(([name, data], idx) => {
    const revLakhs = Math.round((data.revenue / 100000) * 100) / 100;
    const pct = totalSolutionRev > 0 ? (data.revenue / totalSolutionRev) : 0;
    const formattedVal = revLakhs >= 1 ? `₹${revLakhs.toFixed(2)} L` : `₹${Math.round(data.revenue / 1000)} K`;

    // Sleek Proportional Font Sizes (Executive & Tasteful)
    let titleFontSize = 12;
    let valFontSize = 10;
    let titleLineHeight = 16;
    let valLineHeight = 14;

    if (pct >= 0.40) {
      // Large Block
      titleFontSize = 16;
      valFontSize = 13;
      titleLineHeight = 22;
      valLineHeight = 18;
    } else if (pct >= 0.15) {
      // Medium-Large Block
      titleFontSize = 14;
      valFontSize = 12;
      titleLineHeight = 19;
      valLineHeight = 16;
    } else if (pct >= 0.05) {
      // Medium Block
      titleFontSize = 12;
      valFontSize = 10;
      titleLineHeight = 16;
      valLineHeight = 14;
    } else {
      // Small Block
      titleFontSize = 11;
      valFontSize = 9;
      titleLineHeight = 14;
      valLineHeight = 12;
    }

    return {
      name: name,
      value: revLakhs,
      dealsCount: data.count,
      itemStyle: {
        color: treemapColors[idx % treemapColors.length]
      },
      label: {
        show: true,
        align: 'center',
        verticalAlign: 'middle',
        formatter: `{title|${name}}\n{val|${formattedVal}}`,
        rich: {
          title: {
            fontSize: titleFontSize,
            fontWeight: '600',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            color: '#ffffff',
            lineHeight: titleLineHeight,
            align: 'center'
          },
          val: {
            fontSize: valFontSize,
            fontWeight: '500',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            color: '#e0f2fe',
            lineHeight: valLineHeight,
            align: 'center'
          }
        }
      }
    };
  });

  const treemapOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: '#0f172a',
      borderColor: '#38bdf8',
      borderWidth: 1.5,
      textStyle: { color: '#f8fafc', fontSize: 12 },
      formatter: (params: any) => {
        const d = params.data;
        if (!d) return '';
        return `<div class="font-bold border-b border-slate-700 pb-1 mb-1 text-cyan-400">${d.name}</div>
          <div class="text-xs text-slate-200">Won Revenue: <strong class="font-mono text-emerald-300 font-bold">₹${Number(d.value).toFixed(2)} Lakhs</strong></div>
          <div class="text-xs text-slate-400">Won Deals: <strong class="font-mono text-white">${d.dealsCount || 0} deals</strong></div>`;
      }
    },
    series: [
      {
        name: 'Solution Type',
        type: 'treemap',
        breadcrumb: { show: false },
        roam: false,
        top: '4%',
        bottom: '4%',
        left: '4%',
        right: '4%',
        visibleMin: 0.1,
        nodeClick: false,
        upperLabel: { show: false },
        labelLayout: (params: any) => {
          if (params && params.rect && params.rect.width > 0 && params.rect.height > 0) {
            return {
              x: params.rect.x + params.rect.width / 2,
              y: params.rect.y + params.rect.height / 2,
              verticalAlign: 'middle',
              align: 'center'
            };
          }
          return { verticalAlign: 'middle', align: 'center' };
        },
        data: treeMapData.length > 0 ? treeMapData : [{ name: 'No Won Deals', value: 0 }],
        label: {
          show: true,
          align: 'center',
          verticalAlign: 'middle',
          color: '#ffffff'
        },
        itemStyle: {
          borderColor: '#090e1a',
          borderWidth: 3,
          gapWidth: 3,
          borderRadius: 6
        },
        levels: [
          {
            itemStyle: {
              borderColor: '#090e1a',
              borderWidth: 3,
              gapWidth: 3
            },
            upperLabel: { show: false },
            label: {
              show: true,
              align: 'center',
              verticalAlign: 'middle'
            }
          }
        ]
      }
    ]
  };

  // -------------------------------------------------------------
  // 10. Deal Size Bracket Distribution (NEW HIGH-IMPACT CHART replacing forecast)
  // -------------------------------------------------------------
  const dealBrackets = [
    { label: 'Micro (<25k)', min: 0, max: 25000 },
    { label: 'Mid-Tier (25k - 1L)', min: 25000, max: 100000 },
    { label: 'High-Value (1L - 5L)', min: 100000, max: 500000 },
    { label: 'Enterprise (>5L)', min: 500000, max: Infinity }
  ];

  const bracketCounts = dealBrackets.map(b => {
    return wonDeals.filter(r => r.netRevenue >= b.min && r.netRevenue < b.max).length;
  });

  const bracketRevenues = dealBrackets.map(b => {
    const sum = wonDeals
      .filter(r => r.netRevenue >= b.min && r.netRevenue < b.max)
      .reduce((acc, r) => acc + r.netRevenue, 0);
    return Math.round((sum / 100000) * 100) / 100;
  });

  const dealSizeBracketOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#f8fafc', fontSize: 12 },
      formatter: (params: any) => {
        const bLabel = params[0].name;
        const count = params[0].value;
        const rev = params[1] ? params[1].value : 0;
        return `<div class="font-bold border-b border-slate-700 pb-1 mb-1 text-cyan-400">${bLabel}</div>
          <div class="text-xs text-slate-200">Won Count: <strong class="text-blue-400 font-bold">${count} Deals</strong></div>
          <div class="text-xs text-slate-200">Won Revenue: <strong class="text-emerald-400 font-bold">₹${Number(rev).toFixed(2)} Lakhs</strong></div>
          <div class="text-[10px] text-cyan-400 font-bold mt-1.5">👉 Click bar to view & download Excel worksheet</div>`;
      }
    },
    legend: {
      top: '2%',
      right: '4%',
      textStyle: { color: '#cbd5e1', fontSize: 11, fontWeight: '500' },
      itemGap: 16
    },
    grid: {
      top: '16%',
      left: '3%',
      right: '4%',
      bottom: '14%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: dealBrackets.map(b => b.label),
      axisLabel: { color: '#cbd5e1', fontSize: 11, fontWeight: '500' },
      axisLine: { lineStyle: { color: '#334155' } },
      axisTick: { show: false }
    },
    yAxis: [
      {
        type: 'value',
        name: '',
        axisLabel: { color: '#94a3b8', fontSize: 11 },
        splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } }
      },
      {
        type: 'value',
        name: '',
        axisLabel: { color: '#94a3b8', fontSize: 11 },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: 'Deal Count',
        type: 'bar',
        yAxisIndex: 0,
        barWidth: '32%',
        data: bracketCounts,
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: '#3b82f6' }, { offset: 1, color: '#1d4ed8' }]
          },
          borderRadius: [6, 6, 0, 0]
        },
        label: {
          show: true,
          position: 'top',
          distance: 4,
          color: '#f8fafc',
          fontSize: 10,
          fontWeight: '600',
          formatter: (p: any) => (p.value > 0 ? `${p.value} Deals` : '')
        }
      },
      {
        name: 'Revenue (₹ Lakhs)',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        data: bracketRevenues,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { width: 3, color: '#10b981' },
        itemStyle: { color: '#10b981', borderWidth: 2, borderColor: '#ffffff' },
        label: {
          show: true,
          position: 'top',
          distance: 4,
          color: '#34d399',
          fontSize: 10,
          fontWeight: '600',
          formatter: (p: any) => (p.value > 0 ? `₹${Number(p.value).toFixed(2)} L` : '')
        }
      }
    ]
  };

  const handleBracketClick = (params: any) => {
    if (params && params.name) {
      setSelectedDealBracket(params.name);
      setModalSearch('');
    }
  };

  // Filter deals for selected Deal Size Bracket (WON DEALS ONLY)
  const bracketDeals = selectedDealBracket
    ? wonDeals.filter(r => {
      const rev = r.netRevenue;
      if (selectedDealBracket.includes('Micro')) return rev < 25000;
      if (selectedDealBracket.includes('Mid-Tier')) return rev >= 25000 && rev < 100000;
      if (selectedDealBracket.includes('High-Value')) return rev >= 100000 && rev < 500000;
      if (selectedDealBracket.includes('Enterprise')) return rev >= 500000;
      return true;
    })
    : [];

  const modalBracketFilteredDeals = bracketDeals.filter(r => {
    if (!modalSearch) return true;
    const q = modalSearch.toLowerCase();
    return (
      r.id.toLowerCase().includes(q) ||
      r.customer.toLowerCase().includes(q) ||
      r.solution.toLowerCase().includes(q) ||
      r.industry.toLowerCase().includes(q) ||
      r.salesRep.toLowerCase().includes(q) ||
      r.stage.toLowerCase().includes(q) ||
      String(r.rawRecord?.['Deal Name'] || '').toLowerCase().includes(q)
    );
  });

  const exportBracketExcel = (bLabel: string) => {
    const deals = modalBracketFilteredDeals.length > 0 ? modalBracketFilteredDeals : bracketDeals;
    const exportRows = deals.map(r => {
      const isWon = r.type === 'won';
      const grossRev = r.grossRevenue || r.netRevenue;
      const gstVal = isWon ? Math.round((grossRev - r.netRevenue) * 100) / 100 : 0;
      return {
        'Deal ID': r.id,
        'Deal Stage': r.stage,
        'Status Type': isWon ? 'WON' : r.type === 'lost' ? 'LOST' : 'IN PIPELINE',
        'Company / Client': r.customer,
        'Responsible Person': r.salesRep,
        'Deal Name / Opportunity': r.rawRecord?.['Deal Name'] || `${r.customer} - ${r.solution}`,
        'Lead Source': r.leadSource,
        'Gross Revenue (₹)': grossRev,
        'GST 18% (₹)': gstVal,
        'Net Revenue (₹)': r.netRevenue,
        'Industry': r.industry,
        'Solution Type': r.solution,
        'Created Date': r.rawRecord?.['Created'] || r.date,
        'Lost Reason': r.lostReason || 'N/A'
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(wb, ws, `${bLabel} Deals`);
    XLSX.writeFile(wb, `${bLabel.replace(/[^a-zA-Z0-9]/g, '_')}_Bracket_Deals.xlsx`);
  };

  // Filter deals for selected Funnel Stage
  const funnelStageDeals = selectedFunnelStage
    ? (funnelStageMetrics.find(m => m.name === selectedFunnelStage)?.deals || [])
    : [];

  const modalFunnelFilteredDeals = funnelStageDeals.filter(r => {
    if (!modalSearch) return true;
    const q = modalSearch.toLowerCase();
    return (
      r.id.toLowerCase().includes(q) ||
      r.customer.toLowerCase().includes(q) ||
      r.solution.toLowerCase().includes(q) ||
      r.industry.toLowerCase().includes(q) ||
      r.salesRep.toLowerCase().includes(q) ||
      r.stage.toLowerCase().includes(q) ||
      String(r.rawRecord?.['Deal Name'] || '').toLowerCase().includes(q)
    );
  });

  const exportFunnelExcel = (stageName: string) => {
    const deals = modalFunnelFilteredDeals.length > 0 ? modalFunnelFilteredDeals : funnelStageDeals;
    const exportRows = deals.map(r => {
      const isWon = r.type === 'won';
      const grossRev = r.grossRevenue || r.netRevenue;
      const gstVal = isWon ? Math.round((grossRev - r.netRevenue) * 100) / 100 : 0;
      return {
        'Deal ID': r.id,
        'Deal Stage': r.stage,
        'Status Type': isWon ? 'WON' : r.type === 'lost' ? 'LOST' : 'IN PIPELINE',
        'Company / Client': r.customer,
        'Responsible Person': r.salesRep,
        'Deal Name / Opportunity': r.rawRecord?.['Deal Name'] || `${r.customer} - ${r.solution}`,
        'Lead Source': r.leadSource,
        'Gross Revenue (₹)': grossRev,
        'GST 18% (₹)': gstVal,
        'Net Revenue (₹)': r.netRevenue,
        'Industry': r.industry,
        'Solution Type': r.solution,
        'Created Date': r.rawRecord?.['Created'] || r.date,
        'Lost Reason': r.lostReason || 'N/A'
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(wb, ws, `${stageName} Deals`);
    XLSX.writeFile(wb, `${stageName.replace(/[^a-zA-Z0-9]/g, '_')}_Stage_Deals.xlsx`);
  };

  // Filter deals for selected Lead Source
  const sourceAllDeals = selectedLeadSource
    ? records.filter(r => r.leadSource === selectedLeadSource)
    : [];

  const sourceWonDeals = sourceAllDeals.filter(r => r.type === 'won');
  const sourceLostDeals = sourceAllDeals.filter(r => r.type === 'lost');
  const sourceProgressDeals = sourceAllDeals.filter(r => r.type === 'in_progress');

  const stageFilteredDeals = sourceAllDeals.filter(r => {
    if (modalStageTab === 'all') return true;
    return r.type === modalStageTab;
  });

  const modalSourceFilteredDeals = stageFilteredDeals.filter(r => {
    if (!modalSearch) return true;
    const q = modalSearch.toLowerCase();
    return (
      r.id.toLowerCase().includes(q) ||
      r.customer.toLowerCase().includes(q) ||
      r.solution.toLowerCase().includes(q) ||
      r.industry.toLowerCase().includes(q) ||
      r.salesRep.toLowerCase().includes(q) ||
      r.stage.toLowerCase().includes(q) ||
      String(r.rawRecord?.['Deal Name'] || '').toLowerCase().includes(q)
    );
  });

  const exportSourceExcel = (sourceName: string) => {
    const deals = modalSourceFilteredDeals.length > 0 ? modalSourceFilteredDeals : stageFilteredDeals;
    const exportRows = deals.map(r => {
      const isWon = r.type === 'won';
      const grossRev = r.grossRevenue || r.netRevenue;
      const gstVal = isWon ? Math.round((grossRev - r.netRevenue) * 100) / 100 : 0;
      return {
        'Deal ID': r.id,
        'Deal Stage': r.stage,
        'Status Type': isWon ? 'WON' : r.type === 'lost' ? 'LOST' : 'IN PIPELINE',
        'Company / Client': r.customer,
        'Responsible Person': r.salesRep,
        'Deal Name / Opportunity': r.rawRecord?.['Deal Name'] || `${r.customer} - ${r.solution}`,
        'Lead Source': r.leadSource,
        'Gross Revenue (₹)': grossRev,
        'GST 18% (₹)': gstVal,
        'Net Revenue (₹)': r.netRevenue,
        'Industry': r.industry,
        'Solution Type': r.solution,
        'Created Date': r.rawRecord?.['Created'] || r.date,
        'Lost Reason': r.lostReason || 'N/A'
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(wb, ws, `${sourceName} Deals`);
    XLSX.writeFile(wb, `${sourceName.replace(/[^a-zA-Z0-9]/g, '_')}_Deals.xlsx`);
  };

  // Filter deals for selected Sales Rep
  const repAllDeals = selectedRep
    ? records.filter(r => r.salesRep === selectedRep)
    : [];

  const repWonDeals = repAllDeals.filter(r => r.type === 'won');
  const repLostDeals = repAllDeals.filter(r => r.type === 'lost');
  const repProgressDeals = repAllDeals.filter(r => r.type === 'in_progress');

  const repStageFilteredDeals = repAllDeals.filter(r => {
    if (modalStageTab === 'all') return true;
    return r.type === modalStageTab;
  });

  const modalRepFilteredDeals = repStageFilteredDeals.filter(r => {
    if (!modalSearch) return true;
    const q = modalSearch.toLowerCase();
    return (
      r.id.toLowerCase().includes(q) ||
      r.customer.toLowerCase().includes(q) ||
      r.solution.toLowerCase().includes(q) ||
      r.industry.toLowerCase().includes(q) ||
      r.salesRep.toLowerCase().includes(q) ||
      r.stage.toLowerCase().includes(q) ||
      String(r.rawRecord?.['Deal Name'] || '').toLowerCase().includes(q)
    );
  });

  const exportRepExcel = (repName: string) => {
    const deals = modalRepFilteredDeals.length > 0 ? modalRepFilteredDeals : repStageFilteredDeals;
    const exportRows = deals.map(r => {
      const isWon = r.type === 'won';
      const grossRev = r.grossRevenue || r.netRevenue;
      const gstVal = isWon ? Math.round((grossRev - r.netRevenue) * 100) / 100 : 0;
      return {
        'Deal ID': r.id,
        'Deal Stage': r.stage,
        'Status Type': isWon ? 'WON' : r.type === 'lost' ? 'LOST' : 'IN PIPELINE',
        'Company / Client': r.customer,
        'Responsible Person': r.salesRep,
        'Deal Name / Opportunity': r.rawRecord?.['Deal Name'] || `${r.customer} - ${r.solution}`,
        'Lead Source': r.leadSource,
        'Gross Revenue (₹)': grossRev,
        'GST 18% (₹)': gstVal,
        'Net Revenue (₹)': r.netRevenue,
        'Industry': r.industry,
        'Solution Type': r.solution,
        'Created Date': r.rawRecord?.['Created'] || r.date,
        'Lost Reason': r.lostReason || 'N/A'
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(wb, ws, `${repName} Deals`);
    XLSX.writeFile(wb, `${repName.replace(/[^a-zA-Z0-9]/g, '_')}_Deals.xlsx`);
  };

  return (
    <div className="w-full mb-8 space-y-6">
      {/* Row 1: Responsible Person & Lead Source */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer title="Revenue by Responsible Person (Click Bar to View Excel)" icon={<User className="w-4 h-4 text-emerald-400" />}>
          <ReactECharts
            option={repPerformanceOption}
            onEvents={{ click: handleRepClick }}
            style={{ height: '280px', cursor: 'pointer' }}
          />
        </ChartContainer>

        <ChartContainer title="Revenue by Acquisition Lead Source (Click Bar to View Excel)" icon={<Globe className="w-4 h-4 text-amber-400" />}>
          <ReactECharts
            option={leadSourceOption}
            onEvents={{ click: handleLeadSourceClick }}
            style={{ height: '280px', cursor: 'pointer' }}
          />
        </ChartContainer>
      </div>

      {/* Row 2: Revenue Trend & Target vs Actual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer title={`Monthly Revenue Trend & ${avgSeriesName}`} icon={<TrendingUp className="w-4 h-4 text-blue-400" />}>
          <ReactECharts option={revenueTrendOption} notMerge={true} style={{ height: '280px' }} />
        </ChartContainer>

        <ChartContainer title="Target vs Actual Revenue" icon={<BarChart3 className="w-4 h-4 text-emerald-400" />}>
          <ReactECharts option={targetVsRevOption} style={{ height: '280px' }} />
        </ChartContainer>
      </div>

      {/* Row 3: Sales Pipeline Funnel & Win/Lost Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer title="Sales Pipeline Funnel (Click 3D Stage to View Excel)" icon={<Filter className="w-4 h-4 text-indigo-400" />}>
          <ReactECharts
            option={funnelOption}
            onEvents={{ click: handleFunnelClick }}
            style={{ height: '300px', cursor: 'pointer' }}
          />
        </ChartContainer>

        <ChartContainer title="Deal Outcomes (Won vs Lost vs Pipeline)" icon={<PieChartIcon className="w-4 h-4 text-purple-400" />}>
          <div className="flex flex-col h-full justify-between space-y-2">
            <ReactECharts option={winLostOption} notMerge={true} style={{ height: '210px' }} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2.5 border-t border-slate-800/80">
              {/* Won Deals Card */}
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col justify-between space-y-1 transition-all hover:bg-emerald-500/15">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wider">Won Deals</span>
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {wonPct}%
                  </span>
                </div>
                <div>
                  <div className="text-sm font-black text-white font-mono tracking-tight">
                    {formatCurrencyVal(wonValue)}
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    {kpis.totalWonCount} Deals
                  </div>
                </div>
              </div>

              {/* Lost Deals Card */}
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex flex-col justify-between space-y-1 transition-all hover:bg-rose-500/15">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-rose-400 font-extrabold uppercase tracking-wider">Lost Deals</span>
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    {lostPct}%
                  </span>
                </div>
                <div>
                  <div className="text-sm font-black text-white font-mono tracking-tight">
                    {formatCurrencyVal(lostValue)}
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    {kpis.totalLostCount} Deals
                  </div>
                </div>
              </div>

              {/* In Pipeline Card */}
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 flex flex-col justify-between space-y-1 transition-all hover:bg-blue-500/15">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-blue-400 font-extrabold uppercase tracking-wider">In Pipeline</span>
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {pipelinePct}%
                  </span>
                </div>
                <div>
                  <div className="text-sm font-black text-white font-mono tracking-tight">
                    {formatCurrencyVal(pipelineValue)}
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    {progressDeals.length} Deals
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ChartContainer>
      </div>

      {/* Row 4: Industry Revenue & Reasons Lost */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer title="Revenue by Industry (₹ Lakhs)" icon={<Award className="w-4 h-4 text-amber-400" />}>
          <ReactECharts option={industryOption} style={{ height: '280px' }} />
        </ChartContainer>

        <ChartContainer title="Reasons Deals Were Lost" icon={<AlertTriangle className="w-4 h-4 text-rose-400" />}>
          <ReactECharts option={paretoOption} style={{ height: '280px' }} />
        </ChartContainer>
      </div>

      {/* Row 5: Solution Treemap & Deal Size Bracket Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer title="Revenue by Solution Type" icon={<Layers className="w-4 h-4 text-cyan-400" />}>
          <ReactECharts option={treemapOption} notMerge={true} style={{ height: '280px' }} />
        </ChartContainer>

        <ChartContainer title="Deal Size Category Breakdown (Ticket Size Analysis)" icon={<CircleDollarSign className="w-4 h-4 text-emerald-400" />}>
          <ReactECharts
            option={dealSizeBracketOption}
            notMerge={true}
            onEvents={{ click: handleBracketClick }}
            style={{ height: '280px', cursor: 'pointer' }}
          />
        </ChartContainer>
      </div>

      {/* Deal Size Bracket Worksheet Modal */}
      {selectedDealBracket && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 backdrop-blur-lg p-3 md:p-6 overflow-hidden">
          <div className="glass-panel p-5 md:p-6 rounded-2xl max-w-7xl w-full max-h-[92vh] flex flex-col border border-slate-700/80 shadow-2xl relative overflow-hidden bg-slate-900/95 my-auto">

            {/* Modal Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CircleDollarSign className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-extrabold text-slate-100">
                      {selectedDealBracket} — Ticket Size Worksheet
                    </h3>
                    <span className="px-2.5 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-md">
                      {bracketDeals.length} Deals in Bracket
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 flex flex-wrap items-center gap-3 mt-1">
                    <span>Total Bracket Revenue: <strong className="text-emerald-400 font-mono">₹{(bracketDeals.reduce((a, b) => a + b.netRevenue, 0) / 100000).toFixed(2)} Lakhs</strong></span>
                    <span>•</span>
                    <span>Deal Count: <strong className="text-blue-400">{bracketDeals.length} deals</strong></span>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => exportBracketExcel(selectedDealBracket)}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 active:scale-95 whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Excel (.xlsx)</span>
                </button>

                <button
                  onClick={() => setSelectedDealBracket(null)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="py-3 flex items-center justify-between gap-3 border-b border-slate-800/60">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Search bracket deals by ID, company, rep, solution..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="text-xs text-slate-400 font-mono">
                Showing {modalBracketFilteredDeals.length} of {bracketDeals.length} Bracket Deals
              </div>
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-y-auto overflow-x-auto my-3 rounded-xl border border-slate-800 bg-slate-950/90 shadow-inner">
              <table className="w-full text-left text-xs text-slate-300 border-collapse min-w-[1100px]">
                <thead className="bg-slate-900 sticky top-0 z-10 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3.5 whitespace-nowrap min-w-[90px]">Deal ID</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[120px]">Status / Stage</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[180px]">Company / Client</th>
                    <th className="p-3.5 min-w-[300px]">Deal Name / Opportunity</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[140px]">Responsible Person</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[130px]">Income / Value (₹)</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[120px]">Lead Source</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[130px]">Industry</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[170px]">Solution Type</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[110px]">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-medium">
                  {modalBracketFilteredDeals.length > 0 ? (
                    modalBracketFilteredDeals.map((deal) => {
                      const fullDealName = deal.rawRecord?.['Deal Name'] || `${deal.customer} - ${deal.solution}`;
                      return (
                        <tr key={deal.id} className="hover:bg-slate-900/90 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-blue-400 whitespace-nowrap">{deal.id}</td>

                          <td className="p-3.5 whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${deal.type === 'won'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : deal.type === 'lost'
                                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                  : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                              }`}>
                              {deal.stage}
                            </span>
                          </td>

                          <td className="p-3.5 font-bold text-slate-100">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                              <span>{deal.customer}</span>
                            </div>
                          </td>

                          <td className="p-3.5 text-slate-200 font-normal leading-relaxed whitespace-normal break-words max-w-md">
                            {fullDealName}
                          </td>

                          <td className="p-3.5 font-semibold text-slate-200 whitespace-nowrap">
                            {deal.salesRep}
                          </td>

                          <td className="p-3.5 font-extrabold text-emerald-400 font-mono text-xs whitespace-nowrap">
                            ₹{deal.netRevenue.toLocaleString('en-IN')}
                          </td>

                          <td className="p-3.5 whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-800 text-slate-200 border border-slate-700 whitespace-nowrap inline-block">
                              {deal.leadSource}
                            </span>
                          </td>

                          <td className="p-3.5 text-slate-300 whitespace-nowrap">{deal.industry}</td>

                          <td className="p-3.5 whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 whitespace-nowrap inline-block">
                              {deal.solution}
                            </span>
                          </td>

                          <td className="p-3.5 text-slate-400 font-mono whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              <span>{deal.date}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-500">
                        No deals matching bracket "{selectedDealBracket}" and search "{modalSearch}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer Summary */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs">
              <div className="flex items-center space-x-4">
                <span className="text-slate-400">Filtered Deals: <strong className="text-slate-100">{modalBracketFilteredDeals.length}</strong></span>
                <span className="text-slate-400">Total Value: <strong className="text-emerald-400 font-mono font-bold">₹{modalBracketFilteredDeals.reduce((a, b) => a + b.netRevenue, 0).toLocaleString('en-IN')}</strong></span>
              </div>
              <button
                onClick={() => setSelectedDealBracket(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-colors w-fit"
              >
                Close Worksheet
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* Funnel Stage Deal Worksheet Modal */}
      {selectedFunnelStage && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 backdrop-blur-lg p-3 md:p-6 overflow-hidden">
          <div className="glass-panel p-5 md:p-6 rounded-2xl max-w-7xl w-full max-h-[92vh] flex flex-col border border-slate-700/80 shadow-2xl relative overflow-hidden bg-slate-900/95 my-auto">

            {/* Modal Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Filter className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-extrabold text-slate-100">
                      {selectedFunnelStage} — Pipeline Stage Deal Worksheet
                    </h3>
                    <span className="px-2.5 py-0.5 text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-md">
                      {funnelStageDeals.length} Deals in Stage
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 flex flex-wrap items-center gap-3 mt-1">
                    <span>Total Stage Value: <strong className="text-emerald-400 font-mono">₹{(funnelStageDeals.reduce((a, b) => a + b.netRevenue, 0) / 100000).toFixed(2)} Lakhs</strong></span>
                    <span>•</span>
                    <span>Total Deals: <strong className="text-blue-400">{funnelStageDeals.length} deals</strong></span>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => exportFunnelExcel(selectedFunnelStage)}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 active:scale-95 whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Excel (.xlsx)</span>
                </button>

                <button
                  onClick={() => setSelectedFunnelStage(null)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="py-3 flex items-center justify-between gap-3 border-b border-slate-800/60">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Search stage deals by ID, company, rep, solution..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="text-xs text-slate-400 font-mono">
                Showing {modalFunnelFilteredDeals.length} of {funnelStageDeals.length} Stage Deals
              </div>
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-y-auto overflow-x-auto my-3 rounded-xl border border-slate-800 bg-slate-950/90 shadow-inner">
              <table className="w-full text-left text-xs text-slate-300 border-collapse min-w-[1100px]">
                <thead className="bg-slate-900 sticky top-0 z-10 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3.5 whitespace-nowrap min-w-[90px]">Deal ID</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[120px]">Status / Stage</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[180px]">Company / Client</th>
                    <th className="p-3.5 min-w-[300px]">Deal Name / Opportunity</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[140px]">Responsible Person</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[130px]">Income / Value (₹)</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[120px]">Lead Source</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[130px]">Industry</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[170px]">Solution Type</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[110px]">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-medium">
                  {modalFunnelFilteredDeals.length > 0 ? (
                    modalFunnelFilteredDeals.map((deal) => {
                      const fullDealName = deal.rawRecord?.['Deal Name'] || `${deal.customer} - ${deal.solution}`;
                      return (
                        <tr key={deal.id} className="hover:bg-slate-900/90 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-blue-400 whitespace-nowrap">{deal.id}</td>

                          <td className="p-3.5 whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${deal.type === 'won'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : deal.type === 'lost'
                                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                  : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                              }`}>
                              {deal.stage}
                            </span>
                          </td>

                          <td className="p-3.5 font-bold text-slate-100">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                              <span>{deal.customer}</span>
                            </div>
                          </td>

                          <td className="p-3.5 text-slate-200 font-normal leading-relaxed whitespace-normal break-words max-w-md">
                            {fullDealName}
                          </td>

                          <td className="p-3.5 font-semibold text-slate-200 whitespace-nowrap">
                            {deal.salesRep}
                          </td>

                          <td className="p-3.5 font-extrabold text-emerald-400 font-mono text-xs whitespace-nowrap">
                            ₹{deal.netRevenue.toLocaleString('en-IN')}
                          </td>

                          <td className="p-3.5 whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-800 text-slate-200 border border-slate-700 whitespace-nowrap inline-block">
                              {deal.leadSource}
                            </span>
                          </td>

                          <td className="p-3.5 text-slate-300 whitespace-nowrap">{deal.industry}</td>

                          <td className="p-3.5 whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 whitespace-nowrap inline-block">
                              {deal.solution}
                            </span>
                          </td>

                          <td className="p-3.5 text-slate-400 font-mono whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              <span>{deal.date}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-500">
                        No deals matching funnel stage "{selectedFunnelStage}" and search "{modalSearch}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer Summary */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs">
              <div className="flex items-center space-x-4">
                <span className="text-slate-400">Filtered Deals: <strong className="text-slate-100">{modalFunnelFilteredDeals.length}</strong></span>
                <span className="text-slate-400">Total Value: <strong className="text-emerald-400 font-mono font-bold">₹{modalFunnelFilteredDeals.reduce((a, b) => a + b.netRevenue, 0).toLocaleString('en-IN')}</strong></span>
              </div>
              <button
                onClick={() => setSelectedFunnelStage(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-colors w-fit"
              >
                Close Worksheet
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* Lead Source Deal Worksheet Modal */}
      {selectedLeadSource && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 backdrop-blur-lg p-3 md:p-6 overflow-hidden">
          <div className="glass-panel p-5 md:p-6 rounded-2xl max-w-7xl w-full max-h-[92vh] flex flex-col border border-slate-700/80 shadow-2xl relative overflow-hidden bg-slate-900/95 my-auto">

            {/* Modal Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-extrabold text-slate-100">
                      {selectedLeadSource} — Lead Source Deal Worksheet
                    </h3>
                    <span className="px-2.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-md">
                      {sourceAllDeals.length} Total Sourced Deals
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 flex flex-wrap items-center gap-3 mt-1">
                    <span>Won Revenue: <strong className="text-emerald-400 font-mono">₹{(sourceWonDeals.reduce((a, b) => a + b.netRevenue, 0) / 100000).toFixed(2)} Lakhs</strong></span>
                    <span>•</span>
                    <span>Pipeline Value: <strong className="text-blue-400 font-mono">₹{(sourceProgressDeals.reduce((a, b) => a + b.netRevenue, 0) / 100000).toFixed(2)} L</strong></span>
                    <span>•</span>
                    <span>Won Deals: <strong className="text-emerald-400">{sourceWonDeals.length}</strong></span>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => exportSourceExcel(selectedLeadSource)}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 active:scale-95 whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Excel (.xlsx)</span>
                </button>

                <button
                  onClick={() => setSelectedLeadSource(null)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Stage Selector Tabs & Search */}
            <div className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/60">
              {/* Stage Filter Buttons */}
              <div className="flex items-center space-x-2 overflow-x-auto scrollbar-none">
                <button
                  onClick={() => setModalStageTab('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${modalStageTab === 'all' ? 'bg-amber-600 text-white shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>All Deals ({sourceAllDeals.length})</span>
                </button>

                <button
                  onClick={() => setModalStageTab('won')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${modalStageTab === 'won' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Won Deals ({sourceWonDeals.length})</span>
                </button>

                <button
                  onClick={() => setModalStageTab('lost')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${modalStageTab === 'lost' ? 'bg-rose-600 text-white shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                >
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Lost Deals ({sourceLostDeals.length})</span>
                </button>

                <button
                  onClick={() => setModalStageTab('in_progress')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${modalStageTab === 'in_progress' ? 'bg-cyan-600 text-white shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                >
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>In Progress ({sourceProgressDeals.length})</span>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative flex-1 max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Search deals by ID, company, rep, stage..."
                  className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-y-auto overflow-x-auto my-3 rounded-xl border border-slate-800 bg-slate-950/90 shadow-inner">
              <table className="w-full text-left text-xs text-slate-300 border-collapse min-w-[1100px]">
                <thead className="bg-slate-900 sticky top-0 z-10 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3.5 whitespace-nowrap min-w-[90px]">Deal ID</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[120px]">Status / Stage</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[180px]">Company / Client</th>
                    <th className="p-3.5 min-w-[300px]">Deal Name / Opportunity</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[140px]">Responsible Person</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[130px]">Income / Value (₹)</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[120px]">Lead Source</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[130px]">Industry</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[170px]">Solution Type</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[110px]">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-medium">
                  {modalSourceFilteredDeals.length > 0 ? (
                    modalSourceFilteredDeals.map((deal) => {
                      const fullDealName = deal.rawRecord?.['Deal Name'] || `${deal.customer} - ${deal.solution}`;
                      return (
                        <tr key={deal.id} className="hover:bg-slate-900/90 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-blue-400 whitespace-nowrap">{deal.id}</td>

                          <td className="p-3.5 whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${deal.type === 'won'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : deal.type === 'lost'
                                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                  : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                              }`}>
                              {deal.stage}
                            </span>
                          </td>

                          <td className="p-3.5 font-bold text-slate-100">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                              <span>{deal.customer}</span>
                            </div>
                          </td>

                          <td className="p-3.5 text-slate-200 font-normal leading-relaxed whitespace-normal break-words max-w-md">
                            {fullDealName}
                          </td>

                          <td className="p-3.5 font-semibold text-slate-200 whitespace-nowrap">
                            {deal.salesRep}
                          </td>

                          <td className="p-3.5 font-extrabold text-emerald-400 font-mono text-xs whitespace-nowrap">
                            ₹{deal.netRevenue.toLocaleString('en-IN')}
                          </td>

                          <td className="p-3.5 whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-800 text-slate-200 border border-slate-700 whitespace-nowrap inline-block">
                              {deal.leadSource}
                            </span>
                          </td>

                          <td className="p-3.5 text-slate-300 whitespace-nowrap">{deal.industry}</td>

                          <td className="p-3.5 whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 whitespace-nowrap inline-block">
                              {deal.solution}
                            </span>
                          </td>

                          <td className="p-3.5 text-slate-400 font-mono whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              <span>{deal.date}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-500">
                        No deals matching lead source "{selectedLeadSource}", tab "{modalStageTab}", and search "{modalSearch}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer Summary */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs">
              <div className="flex items-center space-x-4">
                <span className="text-slate-400">Filtered Deals: <strong className="text-slate-100">{modalSourceFilteredDeals.length}</strong></span>
                <span className="text-slate-400">Total Value: <strong className="text-emerald-400 font-mono font-bold">₹{modalSourceFilteredDeals.reduce((a, b) => a + b.netRevenue, 0).toLocaleString('en-IN')}</strong></span>
              </div>
              <button
                onClick={() => setSelectedLeadSource(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-colors w-fit"
              >
                Close Worksheet
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* Sales Rep Deal Worksheet Modal */}
      {selectedRep && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 backdrop-blur-lg p-3 md:p-6 overflow-hidden">
          <div className="glass-panel p-5 md:p-6 rounded-2xl max-w-7xl w-full max-h-[92vh] flex flex-col border border-slate-700/80 shadow-2xl relative overflow-hidden bg-slate-900/95 my-auto">

            {/* Modal Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-extrabold text-slate-100">
                      {selectedRep} — Sales Rep Deal Worksheet
                    </h3>
                    <span className="px-2.5 py-0.5 text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-md">
                      {repAllDeals.length} Assigned Deals
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 flex flex-wrap items-center gap-3 mt-1">
                    <span>Won Revenue: <strong className="text-emerald-400 font-mono">₹{(repWonDeals.reduce((a, b) => a + b.netRevenue, 0) / 100000).toFixed(2)} Lakhs</strong></span>
                    <span>•</span>
                    <span>Pipeline Value: <strong className="text-blue-400 font-mono">₹{(repProgressDeals.reduce((a, b) => a + b.netRevenue, 0) / 100000).toFixed(2)} L</strong></span>
                    <span>•</span>
                    <span>Won Deals: <strong className="text-emerald-400">{repWonDeals.length}</strong></span>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => exportRepExcel(selectedRep)}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 active:scale-95 whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Excel (.xlsx)</span>
                </button>

                <button
                  onClick={() => setSelectedRep(null)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Stage Selector Tabs & Search */}
            <div className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/60">
              {/* Stage Filter Buttons */}
              <div className="flex items-center space-x-2 overflow-x-auto scrollbar-none">
                <button
                  onClick={() => setModalStageTab('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${modalStageTab === 'all' ? 'bg-blue-600 text-white shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>All Deals ({repAllDeals.length})</span>
                </button>

                <button
                  onClick={() => setModalStageTab('won')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${modalStageTab === 'won' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Won Deals ({repWonDeals.length})</span>
                </button>

                <button
                  onClick={() => setModalStageTab('lost')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${modalStageTab === 'lost' ? 'bg-rose-600 text-white shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                >
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Lost Deals ({repLostDeals.length})</span>
                </button>

                <button
                  onClick={() => setModalStageTab('in_progress')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${modalStageTab === 'in_progress' ? 'bg-cyan-600 text-white shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                >
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>In Progress ({repProgressDeals.length})</span>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative flex-1 max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Search deals by ID, company, stage..."
                  className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-y-auto overflow-x-auto my-3 rounded-xl border border-slate-800 bg-slate-950/90 shadow-inner">
              <table className="w-full text-left text-xs text-slate-300 border-collapse min-w-[1100px]">
                <thead className="bg-slate-900 sticky top-0 z-10 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3.5 whitespace-nowrap min-w-[90px]">Deal ID</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[120px]">Status / Stage</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[180px]">Company / Client</th>
                    <th className="p-3.5 min-w-[300px]">Deal Name / Opportunity</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[140px]">Responsible Person</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[130px]">Income / Value (₹)</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[120px]">Lead Source</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[130px]">Industry</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[170px]">Solution Type</th>
                    <th className="p-3.5 whitespace-nowrap min-w-[110px]">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-medium">
                  {modalRepFilteredDeals.length > 0 ? (
                    modalRepFilteredDeals.map((deal) => {
                      const fullDealName = deal.rawRecord?.['Deal Name'] || `${deal.customer} - ${deal.solution}`;
                      return (
                        <tr key={deal.id} className="hover:bg-slate-900/90 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-blue-400 whitespace-nowrap">{deal.id}</td>

                          <td className="p-3.5 whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${deal.type === 'won'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : deal.type === 'lost'
                                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                  : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                              }`}>
                              {deal.stage}
                            </span>
                          </td>

                          <td className="p-3.5 font-bold text-slate-100">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                              <span>{deal.customer}</span>
                            </div>
                          </td>

                          <td className="p-3.5 text-slate-200 font-normal leading-relaxed whitespace-normal break-words max-w-md">
                            {fullDealName}
                          </td>

                          <td className="p-3.5 font-semibold text-slate-200 whitespace-nowrap">
                            {deal.salesRep}
                          </td>

                          <td className="p-3.5 font-extrabold text-emerald-400 font-mono text-xs whitespace-nowrap">
                            ₹{deal.netRevenue.toLocaleString('en-IN')}
                          </td>

                          <td className="p-3.5 whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-800 text-slate-200 border border-slate-700 whitespace-nowrap inline-block">
                              {deal.leadSource}
                            </span>
                          </td>

                          <td className="p-3.5 text-slate-300 whitespace-nowrap">{deal.industry}</td>

                          <td className="p-3.5 whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 whitespace-nowrap inline-block">
                              {deal.solution}
                            </span>
                          </td>

                          <td className="p-3.5 text-slate-400 font-mono whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              <span>{deal.date}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-500">
                        No deals matching sales rep "{selectedRep}", tab "{modalStageTab}", and search "{modalSearch}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer Summary */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs">
              <div className="flex items-center space-x-4">
                <span className="text-slate-400">Filtered Deals: <strong className="text-slate-100">{modalRepFilteredDeals.length}</strong></span>
                <span className="text-slate-400">Total Value: <strong className="text-emerald-400 font-mono font-bold">₹{modalRepFilteredDeals.reduce((a, b) => a + b.netRevenue, 0).toLocaleString('en-IN')}</strong></span>
              </div>
              <button
                onClick={() => setSelectedRep(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-colors w-fit"
              >
                Close Worksheet
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

interface ChartContainerProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const ChartContainer: React.FC<ChartContainerProps> = ({ title, icon, children }) => {
  return (
    <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 shadow-xl flex flex-col justify-between">
      <div className="flex items-center space-x-2 pb-3 mb-2 border-b border-slate-800/60">
        <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-700/60">
          {icon}
        </div>
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
};
