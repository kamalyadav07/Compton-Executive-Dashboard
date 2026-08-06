import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileSpreadsheet, 
  FileText, 
  Download, 
  X,
  FolderKanban,
  Briefcase,
  Copy,
  Check,
  RefreshCw,
  Database,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { DealRecord, KPIMetrics } from '../../types/sales';
import type { ProjectRecord } from '../../types/project';
import { INITIAL_SAMPLE_PROJECTS, fetchProjectSheetData } from '../../engine/projectSheetsService';
import { getStoredSheetsConfig, saveSheetsConfig } from '../../config/sheetsConfig';
import { getStoredOrdersSheetUrl, saveStoredOrdersSheetUrl, fetchOrdersSheetData } from '../../engine/ordersSheetsService';
import { getStoredBitrixConfig, saveBitrixConfig } from '../../config/bitrixConfig';
import { fetchBitrixDeals } from '../../engine/bitrixService';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: DealRecord[];
  kpis: KPIMetrics;
  activeDashboardId?: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  records,
  activeDashboardId = 'deal'
}) => {
  const [activeTab, setActiveTab] = useState<'sync' | 'project' | 'sales'>('sync');
  const [projectList, setProjectList] = useState<ProjectRecord[]>(INITIAL_SAMPLE_PROJECTS);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Data Sync & Sheet URL Config State
  const [projectsSheetUrlInput, setProjectsSheetUrlInput] = useState<string>('');
  const [ordersSheetUrlInput, setOrdersSheetUrlInput] = useState<string>('');
  const [bitrixWebhookUrlInput, setBitrixWebhookUrlInput] = useState<string>('');
  const [syncStatusMsg, setSyncStatusMsg] = useState<string>('');
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false);

  useEffect(() => {
    if (activeDashboardId === 'project') {
      setActiveTab('project');
    } else if (activeDashboardId === 'sales') {
      setActiveTab('sales');
    } else {
      setActiveTab('sync');
    }
  }, [activeDashboardId, isOpen]);

  // Load current stored URLs on mount
  useEffect(() => {
    if (isOpen) {
      const pConf = getStoredSheetsConfig();
      setProjectsSheetUrlInput(pConf.projectsSheetUrl);

      const oUrl = getStoredOrdersSheetUrl();
      setOrdersSheetUrlInput(oUrl);

      const bConf = getStoredBitrixConfig();
      setBitrixWebhookUrlInput(bConf.webhookBaseUrl);

      fetchProjectSheetData(pConf.projectsSheetUrl).then(res => {
        if (res.status === 'success' && res.records.length > 0) {
          setProjectList(res.records);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle saving and syncing all connections inside Reports & Export
  const handleSaveAndSyncAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncingAll(true);
    setSyncStatusMsg('Syncing Google Sheets & Bitrix24 Webhooks...');

    try {
      // 1. Save & Sync Projects Sheet
      const pUrl = projectsSheetUrlInput.trim();
      await saveSheetsConfig({ projectsSheetUrl: pUrl, autoRefreshSeconds: 60 });
      const pRes = await fetchProjectSheetData(pUrl);
      if (pRes.status === 'success') {
        setProjectList(pRes.records);
      }

      // 2. Save & Sync Orders Sheet
      const oUrl = ordersSheetUrlInput.trim();
      saveStoredOrdersSheetUrl(oUrl);
      await fetchOrdersSheetData(oUrl);

      // 3. Save & Sync Bitrix24
      const bUrl = bitrixWebhookUrlInput.trim();
      const cleanBUrl = bUrl.endsWith('/') ? bUrl : `${bUrl}/`;
      const bConf = getStoredBitrixConfig();
      saveBitrixConfig({
        ...bConf,
        webhookBaseUrl: cleanBUrl,
        dealsWebhookUrl: `${cleanBUrl}crm.deal.list.json?SELECT%5B%5D=*&SELECT%5B%5D=UF_*`,
        leadsWebhookUrl: `${cleanBUrl}crm.lead.list.json?SELECT%5B%5D=*&SELECT%5B%5D=UF_*`
      });
      await fetchBitrixDeals();

      setSyncStatusMsg('All Data Streams & Google Sheets synced successfully!');
      setTimeout(() => setSyncStatusMsg(''), 3000);
    } catch (err: any) {
      setSyncStatusMsg(`Sync warning: ${err.message || 'Updated config saved.'}`);
    } finally {
      setIsSyncingAll(false);
    }
  };

  // -----------------------------------------------------------------
  // Project Export Handlers
  // -----------------------------------------------------------------
  const exportProjectToExcel = () => {
    const masterData = projectList.map(p => ({
      'S. No': p.sNo,
      'Customer Name': p.customerName,
      'Project Name': p.projectName,
      'Status': p.status,
      'Project Type': p.projectType,
      'Start Date': p.startDate,
      'Planned End Date': p.plannedEndDate,
      'Actual End Date': p.actualEndDate,
      'Timeline Status': p.timelineStatus,
      'Delay (Days)': p.delayDays,
      'Planned Budget (₹)': p.plannedBudget,
      'Actual Cost (₹)': p.actualCost,
      'Budget Variance (₹)': p.budgetVariance,
      'Budget Status': p.budgetStatus
    }));

    const worksheet = XLSX.utils.json_to_sheet(masterData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Projects');
    XLSX.writeFile(workbook, `Project_Performance_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportProjectToPDF = async () => {
    setIsGeneratingPdf(true);
    const element = document.getElementById('main-dashboard-content');
    if (!element) {
      setIsGeneratingPdf(false);
      return;
    }

    try {
      const canvas = await html2canvas(element, { scale: 1.5, backgroundColor: '#0b0f19' });
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Project_Performance_Briefing_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("Error exporting Project PDF:", err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const generateProjectSummaryText = () => {
    const total = projectList.length;
    const running = projectList.filter(p => p.status === 'Running').length;
    const delayed = projectList.filter(p => p.timelineStatus === 'Delayed').length;
    const onTime = projectList.filter(p => p.timelineStatus === 'On Time').length;
    const overBudget = projectList.filter(p => p.budgetStatus === 'Over Budget').length;
    const plannedSum = projectList.reduce((s, p) => s + p.plannedBudget, 0);
    const actualSum = projectList.reduce((s, p) => s + p.actualCost, 0);
    const varianceNet = actualSum - plannedSum;

    return `=====================================================
EXECUTIVE PROJECT PERFORMANCE BRIEFING
Generated: ${new Date().toLocaleString()}
=====================================================

1. OVERVIEW
-----------------------------------------------------
Total Monitored Projects: ${total}
Projects Currently Running: ${running}
Schedule Compliance: ${onTime} On Time | ${delayed} Delayed
Budget Compliance: ${projectList.length - overBudget} On/Under Budget | ${overBudget} Over Budget

2. FINANCIAL VARIANCE
-----------------------------------------------------
Total Planned Budget: ₹${plannedSum.toLocaleString('en-IN')}
Total Actual Cost Spent: ₹${actualSum.toLocaleString('en-IN')}
Net Variance: ${varianceNet > 0 ? `+₹${varianceNet.toLocaleString('en-IN')} (OVER BUDGET)` : `₹${varianceNet.toLocaleString('en-IN')} (SAVINGS)`}

=====================================================`;
  };

  const handleCopySummaryText = () => {
    const text = generateProjectSummaryText();
    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  // -----------------------------------------------------------------
  // Sales & Deals Export Handlers
  // -----------------------------------------------------------------
  const exportSalesToExcel = () => {
    const wsWon = XLSX.utils.json_to_sheet(records.filter(r => r.type === 'won'));
    const wsLost = XLSX.utils.json_to_sheet(records.filter(r => r.type === 'lost'));
    const wsProgress = XLSX.utils.json_to_sheet(records.filter(r => r.type === 'in_progress'));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsWon, "Won Deals");
    XLSX.utils.book_append_sheet(wb, wsLost, "Lost Deals");
    XLSX.utils.book_append_sheet(wb, wsProgress, "In Progress Deals");

    XLSX.writeFile(wb, `Deals_Operational_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportSalesToCSV = () => {
    const ws = XLSX.utils.json_to_sheet(records);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Deals_Dataset_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const exportSalesToPDF = async () => {
    setIsGeneratingPdf(true);
    const element = document.getElementById('main-dashboard-content');
    if (!element) {
      setIsGeneratingPdf(false);
      return;
    }

    try {
      const canvas = await html2canvas(element, { scale: 1.5, backgroundColor: '#0b0f19' });
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Deals_Operational_Dashboard_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("Error exporting Sales PDF:", err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-lg overflow-hidden">
      <div className="glass-panel w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar my-auto animate-scale-in">
        
        {/* Header & Close */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <Download className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="text-base font-bold text-slate-100">Reports, Data Sync & Export Center</h3>
              <p className="text-xs text-slate-400">Configure data connections, Google Sheets URLs & download reports</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* Tab Selector */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('sync')}
            className={`flex items-center justify-center space-x-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'sync'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-300" />
            <span>Data Connections</span>
          </button>

          <button
            onClick={() => setActiveTab('project')}
            className={`flex items-center justify-center space-x-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'project'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FolderKanban className="w-3.5 h-3.5 text-emerald-300" />
            <span>Project Reports</span>
          </button>

          <button
            onClick={() => setActiveTab('sales')}
            className={`flex items-center justify-center space-x-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'sales'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5 text-purple-300" />
            <span>Deals & Operational</span>
          </button>
        </div>

        {/* TAB 1: DATA CONNECTIONS & GOOGLE SHEETS SETTINGS */}
        {activeTab === 'sync' && (
          <form onSubmit={handleSaveAndSyncAll} className="space-y-4 animate-fade-in">
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-300 flex items-center space-x-2">
              <Database className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Configure all Google Sheets URLs and Bitrix24 Webhook connections in one centralized place.</span>
            </div>

            {/* 1. Project Dashboard Google Sheet */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Project Dashboard Google Sheet URL</span>
                {projectsSheetUrlInput && (
                  <a href={projectsSheetUrlInput} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-normal">
                    <span>Open Sheet</span> <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </label>
              <input
                type="url"
                required
                value={projectsSheetUrlInput}
                onChange={(e) => setProjectsSheetUrlInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/your_project_sheet_id/edit"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            {/* 2. Orders Billed & Unbilled Google Sheet */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Orders Billed & Unbilled Google Sheet URL</span>
                {ordersSheetUrlInput && (
                  <a href={ordersSheetUrlInput} target="_blank" rel="noopener noreferrer" className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-normal">
                    <span>Open Sheet</span> <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </label>
              <input
                type="url"
                required
                value={ordersSheetUrlInput}
                onChange={(e) => setOrdersSheetUrlInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/your_orders_sheet_id/edit"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
              <p className="text-[10px] text-slate-400">Missing Billed Date column is automatically parsed as <strong>Unbilled</strong>.</p>
            </div>

            {/* 3. Bitrix24 CRM REST Webhook Base URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Bitrix24 REST API Webhook Base URL</label>
              <input
                type="url"
                required
                value={bitrixWebhookUrlInput}
                onChange={(e) => setBitrixWebhookUrlInput(e.target.value)}
                placeholder="https://compton.bitrix24.in/rest/212/ml282niaoub4hrkz/"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>

            {syncStatusMsg && (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{syncStatusMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-800">
              <button
                type="submit"
                disabled={isSyncingAll}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg transition-all active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncingAll ? 'animate-spin' : ''}`} />
                <span>{isSyncingAll ? 'Syncing All Connections...' : 'Save Config & Sync All Data'}</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: PROJECT PERFORMANCE EXPORTS */}
        {activeTab === 'project' && (
          <div className="space-y-3 animate-fade-in">
            <div className="p-3 rounded-xl bg-[#151d30] border border-slate-800 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300">Monitored Projects: <strong className="text-white">{projectList.length}</strong></span>
              <span className="text-rose-400 font-bold">Delayed: {projectList.filter(p => p.timelineStatus === 'Delayed').length}</span>
              <span className="text-amber-400 font-bold">Over Budget: {projectList.filter(p => p.budgetStatus === 'Over Budget').length}</span>
            </div>

            <button
              onClick={exportProjectToPDF}
              disabled={isGeneratingPdf}
              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-900/90 hover:bg-blue-600/20 border border-slate-700/80 hover:border-blue-500 text-slate-100 transition-all text-xs font-semibold group"
            >
              <div className="flex items-center space-x-3">
                <FileText className="w-5 h-5 text-rose-400 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <p className="font-bold text-white">Project Performance Executive PDF Briefing</p>
                  <p className="text-[10px] text-slate-400 font-normal">Full PDF snapshot of KPI cards, charts & project table</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-white" />
            </button>

            <button
              onClick={exportProjectToExcel}
              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-900/90 hover:bg-emerald-600/20 border border-slate-700/80 hover:border-emerald-500 text-slate-100 transition-all text-xs font-semibold group"
            >
              <div className="flex items-center space-x-3">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <p className="font-bold text-white">Project Excel Workbook (.xlsx)</p>
                  <p className="text-[10px] text-slate-400 font-normal">Includes Master Registry & Budget Variance metrics</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-white" />
            </button>

            <button
              onClick={handleCopySummaryText}
              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-900/90 hover:bg-purple-600/20 border border-slate-700/80 hover:border-purple-500 text-slate-100 transition-all text-xs font-semibold group"
            >
              <div className="flex items-center space-x-3">
                {copiedSummary ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />}
                <div className="text-left">
                  <p className="font-bold text-white">{copiedSummary ? 'Copied to Clipboard!' : 'Copy Executive Text Brief'}</p>
                  <p className="text-[10px] text-slate-400 font-normal">Plain text summary ready for email or WhatsApp briefing</p>
                </div>
              </div>
              <Copy className="w-4 h-4 text-slate-400 group-hover:text-white" />
            </button>
          </div>
        )}

        {/* TAB 3: DEALS & OPERATIONAL EXPORTS */}
        {activeTab === 'sales' && (
          <div className="space-y-3 animate-fade-in">
            <div className="p-3 rounded-xl bg-[#151d30] border border-slate-800 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300">Total Deals: <strong className="text-white">{records.length}</strong></span>
              <span className="text-emerald-400 font-bold">Won: {records.filter(r => r.type === 'won').length}</span>
              <span className="text-cyan-400 font-bold">In Progress: {records.filter(r => r.type === 'in_progress').length}</span>
            </div>

            <button
              onClick={exportSalesToPDF}
              disabled={isGeneratingPdf}
              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-900/90 hover:bg-blue-600/20 border border-slate-700/80 hover:border-blue-500 text-slate-100 transition-all text-xs font-semibold group"
            >
              <div className="flex items-center space-x-3">
                <FileText className="w-5 h-5 text-rose-400 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <p className="font-bold text-white">Deals & Operational Dashboard PDF Snapshot</p>
                  <p className="text-[10px] text-slate-400 font-normal">Full PDF export of KPI grid, leaderboard & conversion charts</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-white" />
            </button>

            <button
              onClick={exportSalesToExcel}
              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-900/90 hover:bg-emerald-600/20 border border-slate-700/80 hover:border-emerald-500 text-slate-100 transition-all text-xs font-semibold group"
            >
              <div className="flex items-center space-x-3">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <p className="font-bold text-white">Multi-Tab Deals Excel Workbook (.xlsx)</p>
                  <p className="text-[10px] text-slate-400 font-normal">Includes Won Deals, Lost Deals & In Progress tabs</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-white" />
            </button>

            <button
              onClick={exportSalesToCSV}
              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-900/90 hover:bg-cyan-600/20 border border-slate-700/80 hover:border-cyan-500 text-slate-100 transition-all text-xs font-semibold group"
            >
              <div className="flex items-center space-x-3">
                <FileSpreadsheet className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <p className="font-bold text-white">Raw Dataset CSV Export (.csv)</p>
                  <p className="text-[10px] text-slate-400 font-normal">Raw deal records dataset export for custom analytics</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-white" />
            </button>
          </div>
        )}

      </div>
    </div>,
    document.body
  );
};
