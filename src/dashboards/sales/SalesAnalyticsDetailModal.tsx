import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Search,
  FileSpreadsheet,
  Download,
  Building2,
  CheckCircle2,
  Share2,
  Sparkles,
  DollarSign,
  Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { DealRecord } from '../../types/sales';
import type { OrderRecord, OperationalKPIMetrics } from '../../types/orders';
import { normalizeBitrixSource, type BitrixLeadRecord } from '../../engine/bitrixService';

export type SalesAnalyticsChartType =
  | 'lead_qualification'
  | 'acquisition_channels'
  | 'sales_reps'
  | 'top_accounts'
  | 'billing_operations'
  | 'pipeline_stages';

export interface SalesAnalyticsDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  chartType: SalesAnalyticsChartType | null;
  initialCategory?: string | null;
  leads: BitrixLeadRecord[];
  wonDeals: DealRecord[];
  allDeals: DealRecord[];
  orders: OrderRecord[];
  kpis: OperationalKPIMetrics;
  dateFilter?: string;
  repFilter?: string;
}

export const SalesAnalyticsDetailModal: React.FC<SalesAnalyticsDetailModalProps> = ({
  isOpen,
  onClose,
  chartType,
  initialCategory,
  leads,
  wonDeals,
  allDeals,
  orders,
  kpis: _kpis,
  dateFilter,
  repFilter
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [_sortField, _setSortField] = useState<string>('default');
  const [_sortDirection, _setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Lock body scroll and sync initial category tab
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setSearchTerm('');

      if (initialCategory) {
        const cat = initialCategory.trim().toLowerCase();
        if (cat.includes('qualified') && !cat.includes('disqualified')) {
          setActiveTab('qualified');
        } else if (cat.includes('disqualified')) {
          setActiveTab('disqualified');
        } else if (cat.includes('progress') || cat.includes('review')) {
          setActiveTab('in_progress');
        } else {
          setActiveTab(initialCategory.trim());
        }
      } else {
        setActiveTab('all');
      }
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, chartType, initialCategory]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const formatRupee = (val: number) => {
    return `₹${Math.round(val).toLocaleString('en-IN')}`;
  };

  const formatLakhs = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  // -------------------------------------------------------------
  // Data Aggregations & Table Data Generation by Chart Type
  // -------------------------------------------------------------

  // 1. Leads Table Data (Lead Qualification & Conversion Funnel)
  const leadRows = useMemo(() => {
    if (chartType !== 'lead_qualification') return [];

    return leads.map((l, idx) => {
      const raw = l.rawRecord || {};
      const company = raw.COMPANY_TITLE || (l.title.includes('/') ? l.title.split('/')[0].trim() : 'Direct Lead');
      const contactName = [raw.NAME, raw.LAST_NAME].filter(Boolean).join(' ') || raw.HONORIFIC || 'Unspecified';
      const source = normalizeBitrixSource(l.sourceId || raw.SOURCE_ID || raw.UTM_SOURCE);
      const comments = raw.COMMENTS || raw.STATUS_DESCRIPTION || raw.UF_CRM_1743480413708 || '';
      const oppValue = l.opportunity || (parseFloat(raw.OPPORTUNITY || '0') || 0);

      return {
        sNo: idx + 1,
        id: String(l.id),
        title: l.title || 'Untitled Inquiry',
        company,
        contactName,
        statusType: l.statusType, // 'qualified' | 'disqualified' | 'in_progress'
        statusLabel: l.statusType === 'qualified' ? 'Qualified Lead' : l.statusType === 'disqualified' ? 'Disqualified Lead' : 'In Progress',
        source,
        salesRep: l.salesRep || 'Unassigned',
        opportunity: oppValue,
        createdDate: (l.dateCreate || raw.DATE_CREATE || '').slice(0, 10) || 'N/A',
        comments: comments.trim() || 'No notes logged'
      };
    });
  }, [leads, chartType]);

  // 2. Acquisition Channels Table Data (Strictly Leads only)
  const acquisitionRows = useMemo(() => {
    if (chartType !== 'acquisition_channels') return [];

    const rows: Array<{
      sNo: number;
      id: string;
      recordType: 'Lead';
      name: string;
      company: string;
      source: string;
      salesRep: string;
      status: string;
      value: number;
      date: string;
    }> = [];

    // Add Leads only
    leads.forEach((l, idx) => {
      const raw = l.rawRecord || {};
      const src = normalizeBitrixSource(l.sourceId || raw.SOURCE_ID || raw.UTM_SOURCE);
      rows.push({
        sNo: idx + 1,
        id: `LEAD-${l.id}`,
        recordType: 'Lead',
        name: l.title || 'Lead Inquiry',
        company: raw.COMPANY_TITLE || (l.title.includes('/') ? l.title.split('/')[0].trim() : 'Inbound Prospect'),
        source: src,
        salesRep: l.salesRep || 'Unassigned',
        status: l.statusType === 'qualified' ? 'Qualified' : l.statusType === 'disqualified' ? 'Disqualified' : 'In Progress',
        value: l.opportunity || 0,
        date: (l.dateCreate || '').slice(0, 10) || 'N/A'
      });
    });

    return rows.map((r, i) => ({ ...r, sNo: i + 1 }));
  }, [leads, chartType]);

  // 3. Sales Team Revenue Performance Table Data (Won deals grouped/filtered by Rep)
  const salesRepRows = useMemo(() => {
    if (chartType !== 'sales_reps') return [];

    return wonDeals.map((d, idx) => {
      const gross = d.grossRevenue || d.netRevenue || 0;
      const net = d.netRevenue || gross;
      const gst = Math.max(0, gross - net);

      return {
        sNo: idx + 1,
        id: `DEAL-${d.id}`,
        dealName: d.solution || `${d.customer} Deal`,
        company: d.customer || 'Client Account',
        salesRep: d.salesRep || 'Unassigned',
        netRevenue: net,
        grossRevenue: gross,
        gstValue: gst,
        stage: d.stage || 'Won',
        source: normalizeBitrixSource(d.leadSource),
        industry: d.industry || 'General',
        solution: d.solution || 'Standard',
        date: (d.date || d.monthYear || '').slice(0, 10) || 'N/A'
      };
    });
  }, [wonDeals, chartType]);

  // 4. Top Account Revenue Concentration Table Data (Won deals grouped by Client)
  const topAccountRows = useMemo(() => {
    if (chartType !== 'top_accounts') return [];

    return wonDeals.map((d, idx) => {
      const gross = d.grossRevenue || d.netRevenue || 0;
      const net = d.netRevenue || gross;
      const gst = Math.max(0, gross - net);

      return {
        sNo: idx + 1,
        id: `DEAL-${d.id}`,
        company: d.customer || 'Client Account',
        dealName: d.solution || `${d.customer} Solution`,
        salesRep: d.salesRep || 'Unassigned',
        netRevenue: net,
        grossRevenue: gross,
        gstValue: gst,
        stage: d.stage || 'Won',
        source: normalizeBitrixSource(d.leadSource),
        industry: d.industry || 'General',
        date: (d.date || d.monthYear || '').slice(0, 10) || 'N/A'
      };
    });
  }, [wonDeals, chartType]);

  // 5. Billing Operations Table Data (Orders Billed vs Unbilled)
  const billingRows = useMemo(() => {
    if (chartType !== 'billing_operations') return [];

    return orders.map((ord, idx) => ({
      sNo: idx + 1,
      id: ord.id || `ORD-${idx + 1}`,
      dealId: ord.dealId || 'N/A',
      company: ord.customerName || 'Client',
      dealName: ord.dealName || `${ord.customerName} Order`,
      salesRep: ord.salesRep || 'Unassigned',
      amount: ord.amount || 0,
      status: ord.status || 'Unbilled',
      billedDate: ord.billedDate || 'Pending',
      orderDate: (ord.orderDate || ord.isoCreationDate || '').slice(0, 10) || 'N/A'
    }));
  }, [orders, chartType]);

  // 6. Pipeline Deals Table Data (Won, Lost, In Progress deals)
  const pipelineRows = useMemo(() => {
    if (chartType !== 'pipeline_stages') return [];

    return allDeals.map((d, idx) => ({
      sNo: idx + 1,
      id: `DEAL-${d.id}`,
      dealName: d.solution || `${d.customer} Deal`,
      company: d.customer || 'Enterprise Account',
      salesRep: d.salesRep || 'Unassigned',
      netRevenue: d.netRevenue || 0,
      statusType: d.type === 'won' ? 'Won' : d.type === 'lost' ? 'Lost' : 'In Progress',
      stage: d.stage || d.type,
      source: normalizeBitrixSource(d.leadSource),
      date: (d.date || d.monthYear || '').slice(0, 10) || 'N/A'
    }));
  }, [allDeals, chartType]);

  // -------------------------------------------------------------
  // Filter Tabs Configuration
  // -------------------------------------------------------------
  const tabs = useMemo(() => {
    if (chartType === 'lead_qualification') {
      const qCount = leadRows.filter(r => r.statusType === 'qualified').length;
      const pCount = leadRows.filter(r => r.statusType === 'in_progress').length;
      const dCount = leadRows.filter(r => r.statusType === 'disqualified').length;

      return [
        { id: 'all', label: `All Leads (${leadRows.length})` },
        { id: 'qualified', label: `Qualified (${qCount})` },
        { id: 'in_progress', label: `In Progress (${pCount})` },
        { id: 'disqualified', label: `Disqualified (${dCount})` }
      ];
    }

    if (chartType === 'acquisition_channels') {
      const srcMap: Record<string, number> = {};
      acquisitionRows.forEach(r => {
        srcMap[r.source] = (srcMap[r.source] || 0) + 1;
      });
      const sortedSources = Object.entries(srcMap).sort((a, b) => b[1] - a[1]);

      return [
        { id: 'all', label: `All Sources (${acquisitionRows.length})` },
        ...sortedSources.map(([src, count]) => ({
          id: src,
          label: `${src} (${count})`
        }))
      ];
    }

    if (chartType === 'sales_reps') {
      const repMap: Record<string, { count: number; rev: number }> = {};
      salesRepRows.forEach(r => {
        if (!repMap[r.salesRep]) repMap[r.salesRep] = { count: 0, rev: 0 };
        repMap[r.salesRep].count += 1;
        repMap[r.salesRep].rev += r.netRevenue;
      });
      const sortedReps = Object.entries(repMap).sort((a, b) => b[1].rev - a[1].rev);

      return [
        { id: 'all', label: `All Sales Reps (${salesRepRows.length})` },
        ...sortedReps.map(([rep, data]) => ({
          id: rep,
          label: `${rep} (${data.count})`
        }))
      ];
    }

    if (chartType === 'top_accounts') {
      const custMap: Record<string, { count: number; rev: number }> = {};
      topAccountRows.forEach(r => {
        if (!custMap[r.company]) custMap[r.company] = { count: 0, rev: 0 };
        custMap[r.company].count += 1;
        custMap[r.company].rev += r.netRevenue;
      });
      const sortedCusts = Object.entries(custMap).sort((a, b) => b[1].rev - a[1].rev);

      return [
        { id: 'all', label: `All Accounts (${topAccountRows.length})` },
        ...sortedCusts.slice(0, 8).map(([cust, data]) => ({
          id: cust,
          label: `${cust.length > 18 ? cust.slice(0, 16) + '...' : cust} (${data.count})`
        }))
      ];
    }

    if (chartType === 'billing_operations') {
      const bCount = billingRows.filter(r => r.status === 'Billed').length;
      const uCount = billingRows.filter(r => r.status !== 'Billed').length;

      return [
        { id: 'all', label: `All Orders (${billingRows.length})` },
        { id: 'billed', label: `Billed (${bCount})` },
        { id: 'unbilled', label: `Unbilled (${uCount})` }
      ];
    }

    if (chartType === 'pipeline_stages') {
      const wonCount = pipelineRows.filter(r => r.statusType === 'Won').length;
      const progCount = pipelineRows.filter(r => r.statusType === 'In Progress').length;
      const lostCount = pipelineRows.filter(r => r.statusType === 'Lost').length;

      return [
        { id: 'all', label: `All Pipeline Deals (${pipelineRows.length})` },
        { id: 'won', label: `Won (${wonCount})` },
        { id: 'in_progress', label: `In Progress (${progCount})` },
        { id: 'lost', label: `Lost (${lostCount})` }
      ];
    }

    return [{ id: 'all', label: 'All Records' }];
  }, [chartType, leadRows, acquisitionRows, salesRepRows, topAccountRows, billingRows, pipelineRows]);

  // -------------------------------------------------------------
  // Filtered & Searched Data Rows
  // -------------------------------------------------------------
  const filteredRows = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();

    if (chartType === 'lead_qualification') {
      return leadRows.filter(r => {
        if (activeTab !== 'all' && r.statusType !== activeTab) return false;
        if (!q) return true;
        return (
          r.id.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.company.toLowerCase().includes(q) ||
          r.contactName.toLowerCase().includes(q) ||
          r.salesRep.toLowerCase().includes(q) ||
          r.source.toLowerCase().includes(q) ||
          r.comments.toLowerCase().includes(q)
        );
      });
    }

    if (chartType === 'acquisition_channels') {
      return acquisitionRows.filter(r => {
        if (activeTab !== 'all' && r.source.toLowerCase() !== activeTab.toLowerCase()) return false;
        if (!q) return true;
        return (
          r.id.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.company.toLowerCase().includes(q) ||
          r.source.toLowerCase().includes(q) ||
          r.salesRep.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q)
        );
      });
    }

    if (chartType === 'sales_reps') {
      return salesRepRows.filter(r => {
        if (activeTab !== 'all' && r.salesRep.toLowerCase() !== activeTab.toLowerCase()) return false;
        if (!q) return true;
        return (
          r.id.toLowerCase().includes(q) ||
          r.dealName.toLowerCase().includes(q) ||
          r.company.toLowerCase().includes(q) ||
          r.salesRep.toLowerCase().includes(q) ||
          r.source.toLowerCase().includes(q) ||
          r.industry.toLowerCase().includes(q)
        );
      });
    }

    if (chartType === 'top_accounts') {
      return topAccountRows.filter(r => {
        if (activeTab !== 'all' && r.company.toLowerCase() !== activeTab.toLowerCase()) return false;
        if (!q) return true;
        return (
          r.id.toLowerCase().includes(q) ||
          r.company.toLowerCase().includes(q) ||
          r.dealName.toLowerCase().includes(q) ||
          r.salesRep.toLowerCase().includes(q) ||
          r.source.toLowerCase().includes(q)
        );
      });
    }

    if (chartType === 'billing_operations') {
      return billingRows.filter(r => {
        if (activeTab === 'billed' && r.status !== 'Billed') return false;
        if (activeTab === 'unbilled' && r.status === 'Billed') return false;
        if (!q) return true;
        return (
          r.id.toLowerCase().includes(q) ||
          r.dealId.toLowerCase().includes(q) ||
          r.company.toLowerCase().includes(q) ||
          r.dealName.toLowerCase().includes(q) ||
          r.salesRep.toLowerCase().includes(q)
        );
      });
    }

    if (chartType === 'pipeline_stages') {
      return pipelineRows.filter(r => {
        if (activeTab === 'won' && r.statusType !== 'Won') return false;
        if (activeTab === 'in_progress' && r.statusType !== 'In Progress') return false;
        if (activeTab === 'lost' && r.statusType !== 'Lost') return false;
        if (!q) return true;
        return (
          r.id.toLowerCase().includes(q) ||
          r.dealName.toLowerCase().includes(q) ||
          r.company.toLowerCase().includes(q) ||
          r.salesRep.toLowerCase().includes(q) ||
          r.stage.toLowerCase().includes(q)
        );
      });
    }

    return [];
  }, [
    chartType,
    searchTerm,
    activeTab,
    leadRows,
    acquisitionRows,
    salesRepRows,
    topAccountRows,
    billingRows,
    pipelineRows
  ]);

  // -------------------------------------------------------------
  // Dynamic Title, Subtitle, & Quick KPI Badges
  // -------------------------------------------------------------
  const modalMeta = useMemo(() => {
    switch (chartType) {
      case 'lead_qualification': {
        const total = leadRows.length;
        const qualCount = leadRows.filter(r => r.statusType === 'qualified').length;
        const inProgCount = leadRows.filter(r => r.statusType === 'in_progress').length;
        const disqCount = leadRows.filter(r => r.statusType === 'disqualified').length;
        const qualRate = total > 0 ? ((qualCount / total) * 100).toFixed(1) : '0.0';

        return {
          title: 'Lead Qualification & Conversion Funnel Register (.xlsx)',
          subtitle: `Showing ${filteredRows.length} of ${total} CRM Lead records across conversion stages`,
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
          kpis: [
            { label: 'Total Inbound Leads', value: `${total}`, color: 'text-white' },
            { label: 'Qualified Rate', value: `${qualRate}%`, color: 'text-emerald-400' },
            { label: 'In Progress Leads', value: `${inProgCount}`, color: 'text-purple-400' },
            { label: 'Disqualified Leads', value: `${disqCount}`, color: 'text-slate-400' }
          ]
        };
      }
      case 'acquisition_channels': {
        const total = acquisitionRows.length;
        const srcMap: Record<string, number> = {};
        acquisitionRows.forEach(r => { srcMap[r.source] = (srcMap[r.source] || 0) + 1; });
        const topSrc = Object.entries(srcMap).sort((a, b) => b[1] - a[1])[0] || ['Google Ads', total];
        const topPct = total > 0 ? Math.round((topSrc[1] / total) * 100) : 100;

        return {
          title: 'Lead Acquisition Channels & Sources Register (.xlsx)',
          subtitle: `Showing ${filteredRows.length} inbound leads across marketing and referral channels`,
          icon: <Share2 className="w-5 h-5 text-sky-400" />,
          kpis: [
            { label: 'Total Inbound Leads', value: `${total} Leads`, color: 'text-sky-400' },
            { label: 'Top Channel', value: `${topSrc[0]}`, color: 'text-white' },
            { label: 'Channel Share', value: `${topPct}%`, color: 'text-emerald-400' },
            { label: 'Active Channels', value: `${Object.keys(srcMap).length}`, color: 'text-purple-400' }
          ]
        };
      }
      case 'sales_reps': {
        const total = salesRepRows.length;
        const totalRev = salesRepRows.reduce((s, r) => s + r.netRevenue, 0);
        const avgDeal = total > 0 ? Math.round(totalRev / total) : 0;
        const repMap: Record<string, number> = {};
        salesRepRows.forEach(r => { repMap[r.salesRep] = (repMap[r.salesRep] || 0) + r.netRevenue; });
        const topRep = Object.entries(repMap).sort((a, b) => b[1] - a[1])[0] || ['Unassigned', 0];

        return {
          title: 'Sales Team Revenue Performance Register (.xlsx)',
          subtitle: `Showing ${filteredRows.length} won deals attributed to sales representatives`,
          icon: <Sparkles className="w-5 h-5 text-amber-400" />,
          kpis: [
            { label: 'Total Won Revenue', value: formatLakhs(totalRev), color: 'text-amber-400' },
            { label: 'Deals Closed', value: `${total} Deals`, color: 'text-white' },
            { label: 'Top Performer', value: `${topRep[0]} (${formatLakhs(topRep[1])})`, color: 'text-purple-400' },
            { label: 'Average Deal Size', value: formatRupee(avgDeal), color: 'text-sky-400' }
          ]
        };
      }
      case 'top_accounts': {
        const total = topAccountRows.length;
        const totalRev = topAccountRows.reduce((s, r) => s + r.netRevenue, 0);
        const custMap: Record<string, number> = {};
        topAccountRows.forEach(r => { custMap[r.company] = (custMap[r.company] || 0) + r.netRevenue; });
        const topCust = Object.entries(custMap).sort((a, b) => b[1] - a[1])[0] || ['Unknown Account', 0];
        const topShare = totalRev > 0 ? ((topCust[1] / totalRev) * 100).toFixed(1) : '0.0';

        return {
          title: 'Top Account Revenue Concentration Register (.xlsx)',
          subtitle: `Showing ${filteredRows.length} deal records across key customer accounts`,
          icon: <Building2 className="w-5 h-5 text-indigo-400" />,
          kpis: [
            { label: 'Total Account Revenue', value: formatLakhs(totalRev), color: 'text-indigo-400' },
            { label: 'Deals Count', value: `${total} Deals`, color: 'text-white' },
            { label: 'Top Client', value: `${topCust[0]}`, color: 'text-sky-400' },
            { label: 'Top Client Share', value: `${topShare}% (${formatLakhs(topCust[1])})`, color: 'text-amber-400' }
          ]
        };
      }
      case 'billing_operations': {
        const total = billingRows.length;
        const totalVal = billingRows.reduce((s, r) => s + r.amount, 0);
        const billedVal = billingRows.filter(r => r.status === 'Billed').reduce((s, r) => s + r.amount, 0);
        const billedPct = totalVal > 0 ? Math.round((billedVal / totalVal) * 100) : 0;

        return {
          title: 'Billing Operations (Billed vs. Unbilled) Register (.xlsx)',
          subtitle: `Showing ${filteredRows.length} of ${total} operational order records`,
          icon: <DollarSign className="w-5 h-5 text-emerald-400" />,
          kpis: [
            { label: 'Total Sales Orders', value: formatLakhs(totalVal), color: 'text-blue-400' },
            { label: 'Billed Value', value: formatLakhs(billedVal), color: 'text-emerald-400' },
            { label: 'Billed Completion', value: `${billedPct}%`, color: 'text-emerald-400' },
            { label: 'Unbilled Gap', value: formatLakhs(totalVal - billedVal), color: 'text-amber-400' }
          ]
        };
      }
      case 'pipeline_stages': {
        const total = pipelineRows.length;
        const wonCount = pipelineRows.filter(r => r.statusType === 'Won').length;
        const progCount = pipelineRows.filter(r => r.statusType === 'In Progress').length;
        const lostCount = pipelineRows.filter(r => r.statusType === 'Lost').length;
        const winRate = (wonCount + lostCount) > 0 ? ((wonCount / (wonCount + lostCount)) * 100).toFixed(1) : '0.0';

        return {
          title: 'Pipeline Deals by Stage Register (.xlsx)',
          subtitle: `Showing ${filteredRows.length} deals across active sales pipeline stages`,
          icon: <Layers className="w-5 h-5 text-cyan-400" />,
          kpis: [
            { label: 'Total Pipeline Deals', value: `${total} Deals`, color: 'text-white' },
            { label: 'Win Conversion Rate', value: `${winRate}%`, color: 'text-emerald-400' },
            { label: 'In Progress Deals', value: `${progCount} Active`, color: 'text-cyan-400' },
            { label: 'Lost Deals', value: `${lostCount} Lost`, color: 'text-rose-400' }
          ]
        };
      }
      default:
        return {
          title: 'Sales Operations Data Register (.xlsx)',
          subtitle: `Showing ${filteredRows.length} records`,
          icon: <FileSpreadsheet className="w-5 h-5 text-emerald-400" />,
          kpis: []
        };
    }
  }, [chartType, leadRows, acquisitionRows, salesRepRows, topAccountRows, billingRows, pipelineRows, filteredRows]);

  // -------------------------------------------------------------
  // Full Excel Export Handler (.xlsx)
  // -------------------------------------------------------------
  const handleExportExcel = () => {
    setIsExporting(true);
    try {
      const exportData = filteredRows.map((r: any) => {
        if (chartType === 'lead_qualification') {
          return {
            'Lead ID': r.id,
            'Lead Title / Subject': r.title,
            'Company / Organization': r.company,
            'Contact Person': r.contactName,
            'Lead Status': r.statusLabel,
            'Acquisition Source': r.source,
            'Assigned Sales Rep': r.salesRep,
            'Estimated Opportunity (₹)': r.opportunity,
            'Creation Date': r.createdDate,
            'CRM Notes & Reason': r.comments
          };
        } else if (chartType === 'acquisition_channels') {
          return {
            'Lead ID': r.id,
            'Inquiry / Subject': r.name,
            'Company / Prospect': r.company,
            'Acquisition Channel': r.source,
            'Assigned Sales Rep': r.salesRep,
            'Qualification Status': r.status,
            'Estimated Opportunity (₹)': r.value,
            'Creation Date': r.date
          };
        } else if (chartType === 'sales_reps') {
          return {
            'Deal ID': r.id,
            'Deal Name / Opportunity': r.dealName,
            'Company / Client': r.company,
            'Responsible Sales Rep': r.salesRep,
            'Net Revenue (₹)': r.netRevenue,
            'Gross Revenue (₹)': r.grossRevenue,
            'GST 18% (₹)': r.gstValue,
            'Stage': r.stage,
            'Lead Source': r.source,
            'Industry': r.industry,
            'Solution Type': r.solution,
            'Won Date': r.date
          };
        } else if (chartType === 'top_accounts') {
          return {
            'Deal ID': r.id,
            'Company / Account Name': r.company,
            'Deal Opportunity': r.dealName,
            'Assigned Sales Rep': r.salesRep,
            'Net Revenue (₹)': r.netRevenue,
            'Gross Revenue (₹)': r.grossRevenue,
            'GST 18% (₹)': r.gstValue,
            'Deal Stage': r.stage,
            'Lead Source': r.source,
            'Industry': r.industry,
            'Won Date': r.date
          };
        } else if (chartType === 'billing_operations') {
          return {
            'Order ID': r.id,
            'Deal ID': r.dealId,
            'Customer Name': r.company,
            'Order Title': r.dealName,
            'Sales Rep': r.salesRep,
            'Order Amount (₹)': r.amount,
            'Billing Status': r.status,
            'Billed Date': r.billedDate,
            'Order Creation Date': r.orderDate
          };
        } else {
          return {
            'Deal ID': r.id,
            'Deal Title': r.dealName,
            'Customer': r.company,
            'Sales Rep': r.salesRep,
            'Net Value (₹)': r.netRevenue,
            'Pipeline Status': r.statusType,
            'Stage': r.stage,
            'Lead Source': r.source,
            'Date': r.date
          };
        }
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      // Auto column widths
      const colWidths = Object.keys(exportData[0] || {}).map(key => ({
        wch: Math.max(key.length + 4, 16)
      }));
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      const sheetName = (modalMeta.title.split('Register')[0] || 'Data').trim().slice(0, 31).replace(/[\\/?*[\]]/g, '');
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      const safeFileTitle = modalMeta.title
        .replace(/\(\.xlsx\)/gi, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_');
      const fileName = `Compton_${safeFileTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`;

      XLSX.writeFile(wb, fileName);
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen || !chartType) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/85 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-7xl max-h-[92vh] flex flex-col rounded-2xl bg-[#090e17] border border-emerald-500/40 shadow-2xl overflow-hidden ring-1 ring-emerald-500/20"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Spreadsheet Title Bar with Excel Green Accents */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-emerald-500/30 bg-gradient-to-r from-[#0c1a14] via-[#0d1624] to-[#0a121e]">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-inner">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold tracking-wide uppercase">
                  Excel Data Register (.xlsx)
                </span>
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  {modalMeta.title}
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                <span>{modalMeta.subtitle}</span>
                <span className="text-slate-600">•</span>
                <span className="text-emerald-400 font-mono font-semibold">
                  {filteredRows.length} rows loaded
                </span>
                {dateFilter && dateFilter !== 'All Dates' && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-cyan-400 font-medium">{dateFilter}</span>
                  </>
                )}
                {repFilter && repFilter !== 'All' && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-purple-400 font-medium">Rep: {repFilter}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            {/* Direct Export to Excel button */}
            <button
              onClick={handleExportExcel}
              disabled={isExporting || filteredRows.length === 0}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Download Excel Workbook (.xlsx)"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{isExporting ? 'Generating .xlsx...' : 'Export .xlsx'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
              title="Close register"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Executive Summary Metrics Strip */}
        {modalMeta.kpis.length > 0 && (
          <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-950/70 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {modalMeta.kpis.map((kpi, idx) => (
              <div
                key={idx}
                className="bg-slate-900/80 border border-slate-800/90 rounded-xl px-3.5 py-2 flex flex-col justify-center"
              >
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                  {kpi.label}
                </span>
                <span className={`text-base sm:text-lg font-bold font-mono tracking-tight ${kpi.color}`}>
                  {kpi.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Filter Controls & Live Search Bar */}
        <div className="px-5 py-2.5 border-b border-slate-800/80 bg-slate-950/40 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Segment Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {tabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600 text-slate-950 shadow-md font-bold'
                      : 'bg-slate-900/90 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search spreadsheet records..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>

        {/* Spreadsheet Data Grid View */}
        <div className="flex-1 overflow-auto bg-[#070b12] divide-y divide-slate-800/60">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-[#0c1322] text-slate-400 font-semibold border-b border-emerald-500/20 uppercase tracking-wider text-[10px]">
              {chartType === 'lead_qualification' && (
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-3">Lead ID</th>
                  <th className="py-2.5 px-3">Subject / Inquiry</th>
                  <th className="py-2.5 px-3">Company / Client</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Acquisition Channel</th>
                  <th className="py-2.5 px-3">Sales Rep</th>
                  <th className="py-2.5 px-3 text-right">Opportunity (₹)</th>
                  <th className="py-2.5 px-3">Created Date</th>
                  <th className="py-2.5 px-3">CRM Notes / Reason</th>
                </tr>
              )}

              {chartType === 'acquisition_channels' && (
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-3">Lead ID</th>
                  <th className="py-2.5 px-3">Subject / Inquiry</th>
                  <th className="py-2.5 px-3">Company / Prospect</th>
                  <th className="py-2.5 px-3">Acquisition Channel</th>
                  <th className="py-2.5 px-3">Sales Rep</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Opportunity (₹)</th>
                  <th className="py-2.5 px-3">Created Date</th>
                </tr>
              )}

              {chartType === 'sales_reps' && (
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-3">Deal ID</th>
                  <th className="py-2.5 px-3">Opportunity / Solution</th>
                  <th className="py-2.5 px-3">Company / Client</th>
                  <th className="py-2.5 px-3">Sales Rep</th>
                  <th className="py-2.5 px-3 text-right">Net Revenue (₹)</th>
                  <th className="py-2.5 px-3 text-right">Gross (₹)</th>
                  <th className="py-2.5 px-3 text-right">GST (₹)</th>
                  <th className="py-2.5 px-3">Lead Source</th>
                  <th className="py-2.5 px-3">Won Date</th>
                </tr>
              )}

              {chartType === 'top_accounts' && (
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-3">Deal ID</th>
                  <th className="py-2.5 px-3">Company / Client</th>
                  <th className="py-2.5 px-3">Deal Title / Solution</th>
                  <th className="py-2.5 px-3">Sales Rep</th>
                  <th className="py-2.5 px-3 text-right">Net Revenue (₹)</th>
                  <th className="py-2.5 px-3 text-right">Gross (₹)</th>
                  <th className="py-2.5 px-3">Lead Source</th>
                  <th className="py-2.5 px-3">Industry</th>
                  <th className="py-2.5 px-3">Date</th>
                </tr>
              )}

              {chartType === 'billing_operations' && (
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-3">Order ID</th>
                  <th className="py-2.5 px-3">Deal ID</th>
                  <th className="py-2.5 px-3">Customer Name</th>
                  <th className="py-2.5 px-3">Deal Title</th>
                  <th className="py-2.5 px-3">Sales Rep</th>
                  <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Billed Date</th>
                  <th className="py-2.5 px-3">Order Date</th>
                </tr>
              )}

              {chartType === 'pipeline_stages' && (
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-3">Deal ID</th>
                  <th className="py-2.5 px-3">Deal Opportunity</th>
                  <th className="py-2.5 px-3">Client Account</th>
                  <th className="py-2.5 px-3">Sales Rep</th>
                  <th className="py-2.5 px-3 text-right">Net Value (₹)</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Stage</th>
                  <th className="py-2.5 px-3">Lead Source</th>
                  <th className="py-2.5 px-3">Date</th>
                </tr>
              )}
            </thead>

            <tbody className="divide-y divide-slate-800/40 font-mono text-[11px]">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500 font-sans">
                    <FileSpreadsheet className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">No records match the current filter or search criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row: any, idx: number) => {
                  return (
                    <tr
                      key={row.id || idx}
                      className="hover:bg-slate-800/50 transition-colors font-sans"
                    >
                      <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[10px]">
                        {idx + 1}
                      </td>

                      {/* 1. Lead Qualification Table Rows */}
                      {chartType === 'lead_qualification' && (
                        <>
                          <td className="py-2.5 px-3 font-mono font-semibold text-emerald-400">
                            #{row.id}
                          </td>
                          <td className="py-2.5 px-3 text-white font-medium max-w-xs truncate" title={row.title}>
                            {row.title}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 font-medium">
                            {row.company}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                row.statusType === 'qualified'
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : row.statusType === 'disqualified'
                                  ? 'bg-slate-800 text-slate-400 border-slate-700'
                                  : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                              }`}
                            >
                              {row.statusLabel}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/20 text-[10px] font-medium">
                              {row.source}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            {row.salesRep}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                            {row.opportunity > 0 ? formatRupee(row.opportunity) : '₹0'}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-400 text-[10px]">
                            {row.createdDate}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 text-[11px] max-w-xs truncate" title={row.comments}>
                            {row.comments}
                          </td>
                        </>
                      )}

                      {/* 2. Acquisition Channels Table Rows (Leads only) */}
                      {chartType === 'acquisition_channels' && (
                        <>
                          <td className="py-2.5 px-3 font-mono font-semibold text-sky-400">
                            {row.id}
                          </td>
                          <td className="py-2.5 px-3 text-white font-medium max-w-xs truncate" title={row.name}>
                            {row.name}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            {row.company}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[10px] font-bold">
                              {row.source}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            {row.salesRep}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                row.status === 'Qualified'
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : row.status === 'Disqualified'
                                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                            {row.value > 0 ? formatRupee(row.value) : '₹0'}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-400 text-[10px]">
                            {row.date}
                          </td>
                        </>
                      )}

                      {/* 3. Sales Reps Table Rows */}
                      {chartType === 'sales_reps' && (
                        <>
                          <td className="py-2.5 px-3 font-mono font-semibold text-amber-400">
                            {row.id}
                          </td>
                          <td className="py-2.5 px-3 text-white font-medium max-w-xs truncate" title={row.dealName}>
                            {row.dealName}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 font-medium">
                            {row.company}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
                              {row.salesRep}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                            {formatRupee(row.netRevenue)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                            {formatRupee(row.grossRevenue)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                            {formatRupee(row.gstValue)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 text-[10px]">
                            {row.source}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-400 text-[10px]">
                            {row.date}
                          </td>
                        </>
                      )}

                      {/* 4. Top Accounts Table Rows */}
                      {chartType === 'top_accounts' && (
                        <>
                          <td className="py-2.5 px-3 font-mono font-semibold text-indigo-400">
                            {row.id}
                          </td>
                          <td className="py-2.5 px-3 text-white font-bold max-w-xs truncate" title={row.company}>
                            {row.company}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate" title={row.dealName}>
                            {row.dealName}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {row.salesRep}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                            {formatRupee(row.netRevenue)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                            {formatRupee(row.grossRevenue)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 text-[10px]">
                            {row.source}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 text-[10px]">
                            {row.industry}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-400 text-[10px]">
                            {row.date}
                          </td>
                        </>
                      )}

                      {/* 5. Billing Operations Table Rows */}
                      {chartType === 'billing_operations' && (
                        <>
                          <td className="py-2.5 px-3 font-mono font-semibold text-emerald-400">
                            {row.id}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-400">
                            #{row.dealId}
                          </td>
                          <td className="py-2.5 px-3 text-white font-bold">
                            {row.company}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate" title={row.dealName}>
                            {row.dealName}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {row.salesRep}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                            {formatRupee(row.amount)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                row.status === 'Billed'
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-400 text-[10px]">
                            {row.billedDate}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-400 text-[10px]">
                            {row.orderDate}
                          </td>
                        </>
                      )}

                      {/* 6. Pipeline Deals Table Rows */}
                      {chartType === 'pipeline_stages' && (
                        <>
                          <td className="py-2.5 px-3 font-mono font-semibold text-cyan-400">
                            {row.id}
                          </td>
                          <td className="py-2.5 px-3 text-white font-medium max-w-xs truncate" title={row.dealName}>
                            {row.dealName}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 font-medium">
                            {row.company}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {row.salesRep}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                            {formatRupee(row.netRevenue)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                row.statusType === 'Won'
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : row.statusType === 'In Progress'
                                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              }`}
                            >
                              {row.statusType}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 text-[10px]">
                            {row.stage}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 text-[10px]">
                            {row.source}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-400 text-[10px]">
                            {row.date}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Spreadsheet Footer Status Bar */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              Showing {filteredRows.length} records in active register
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleExportExcel}
              disabled={isExporting || filteredRows.length === 0}
              className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Excel Workbook</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
