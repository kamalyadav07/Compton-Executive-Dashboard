import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  FileText, 
  Download, 
  X,
  FolderKanban,
  Briefcase,
  Copy,
  Check
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { DealRecord, KPIMetrics } from '../../types/sales';
import type { ProjectRecord } from '../../types/project';
import { INITIAL_SAMPLE_PROJECTS, fetchProjectSheetData, DEFAULT_PROJECT_SHEET_URL } from '../../engine/projectSheetsService';

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
  const [activeTab, setActiveTab] = useState<'project' | 'sales'>('project');
  const [projectList, setProjectList] = useState<ProjectRecord[]>(INITIAL_SAMPLE_PROJECTS);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    if (activeDashboardId === 'project') {
      setActiveTab('project');
    } else {
      setActiveTab('sales');
    }
  }, [activeDashboardId, isOpen]);

  // Load latest project records
  useEffect(() => {
    if (isOpen) {
      const savedUrl = localStorage.getItem('project_dashboard_sheet_url') || DEFAULT_PROJECT_SHEET_URL;
      fetchProjectSheetData(savedUrl).then(res => {
        if (res.status === 'success' && res.records.length > 0) {
          setProjectList(res.records);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

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

    const alertsData = projectList
      .filter(p => p.timelineStatus === 'Delayed' || p.budgetStatus === 'Over Budget')
      .map(p => ({
        'Customer Name': p.customerName,
        'Project Name': p.projectName,
        'Status': p.status,
        'Timeline Health': p.timelineStatus,
        'Delay (Days)': p.delayDays,
        'Planned Budget': p.plannedBudget,
        'Actual Cost': p.actualCost,
        'Over Budget Variance (₹)': p.budgetVariance,
        'Budget Status': p.budgetStatus
      }));

    const completedData = projectList
      .filter(p => p.status === 'Completed' && p.timelineStatus === 'On Time')
      .map(p => ({
        'Customer Name': p.customerName,
        'Project Name': p.projectName,
        'Start Date': p.startDate,
        'End Date': p.actualEndDate,
        'Budget Spent': p.actualCost,
        'Budget Savings': Math.abs(Math.min(0, p.budgetVariance))
      }));

    const wb = XLSX.utils.book_new();
    const wsMaster = XLSX.utils.json_to_sheet(masterData);
    const wsAlerts = XLSX.utils.json_to_sheet(alertsData.length > 0 ? alertsData : [{ Message: 'No delayed or over-budget projects!' }]);
    const wsCompleted = XLSX.utils.json_to_sheet(completedData.length > 0 ? completedData : [{ Message: 'No completed on-time projects yet.' }]);

    XLSX.utils.book_append_sheet(wb, wsMaster, "All Projects Master");
    XLSX.utils.book_append_sheet(wb, wsAlerts, "Over Budget & Delayed Alerts");
    XLSX.utils.book_append_sheet(wb, wsCompleted, "On Time Completed");

    XLSX.writeFile(wb, `Project_Performance_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportProjectToCSV = () => {
    const exportData = projectList.map(p => ({
      'S. No': p.sNo,
      'Customer Name': p.customerName,
      'Project Name': p.projectName,
      'Status': p.status,
      'Project Type': p.projectType,
      'Start Date': p.startDate,
      'Planned End Date': p.plannedEndDate,
      'Actual End Date': p.actualEndDate,
      'Timeline Status': p.timelineStatus,
      'Planned Budget (INR)': p.plannedBudget,
      'Actual Cost (INR)': p.actualCost,
      'Budget Variance (INR)': p.budgetVariance,
      'Budget Status': p.budgetStatus
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Project_Performance_Dataset_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const exportProjectToPDF = async () => {
    setIsGeneratingPdf(true);
    const element = document.getElementById('main-dashboard-content');
    if (!element) {
      setIsGeneratingPdf(false);
      return;
    }

    try {
      const canvas = await html2canvas(element, { scale: 1.5, backgroundColor: '#0a0e1a' });
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Executive_Project_Performance_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("Error exporting Project PDF:", err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Generate Project Executive Summary Text
  const generateProjectSummaryText = (): string => {
    const total = projectList.length;
    const running = projectList.filter(p => p.status === 'Running').length;
    const onTime = projectList.filter(p => p.timelineStatus === 'On Time').length;
    const delayed = projectList.filter(p => p.timelineStatus === 'Delayed').length;
    const overBudget = projectList.filter(p => p.budgetStatus === 'Over Budget').length;

    const plannedSum = projectList.reduce((acc, p) => acc + p.plannedBudget, 0);
    const actualSum = projectList.reduce((acc, p) => acc + p.actualCost, 0);
    const varianceNet = actualSum - plannedSum;

    return `=====================================================
EXECUTIVE PROJECT PERFORMANCE AUDIT & AUDIT BRIEFING
Generated: ${new Date().toLocaleString()}
=====================================================

1. EXECUTIVE OVERVIEW
-----------------------------------------------------
Total Monitored Projects: ${total}
Projects Currently Running: ${running}
Schedule Compliance: ${onTime} On Time | ${delayed} Delayed
Budget Compliance: ${projectList.length - overBudget} On/Under Budget | ${overBudget} Over Budget

2. FINANCIAL & COST VARIANCE SUMMARY
-----------------------------------------------------
Total Planned Budget: ₹${plannedSum.toLocaleString('en-IN')}
Total Actual Cost Spent: ₹${actualSum.toLocaleString('en-IN')}
Net Variance: ${varianceNet > 0 ? `+₹${varianceNet.toLocaleString('en-IN')} (OVER BUDGET)` : `₹${varianceNet.toLocaleString('en-IN')} (SAVINGS)`}

3. PROJECT ALERT LISTING
-----------------------------------------------------
${projectList.map(p => `- [${p.status}] ${p.customerName} - ${p.projectName} | Budget: ₹${p.plannedBudget.toLocaleString('en-IN')} | Actual: ₹${p.actualCost.toLocaleString('en-IN')} | Timeline: ${p.timelineStatus} | Budget Status: ${p.budgetStatus}`).join('\n')}

=====================================================
Report generated from Sales Intelligence & Project OS
=====================================================`;
  };

  const handleCopySummaryText = () => {
    const text = generateProjectSummaryText();
    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  // -----------------------------------------------------------------
  // Sales Export Handlers
  // -----------------------------------------------------------------
  const exportSalesToExcel = () => {
    const wsWon = XLSX.utils.json_to_sheet(records.filter(r => r.type === 'won'));
    const wsLost = XLSX.utils.json_to_sheet(records.filter(r => r.type === 'lost'));
    const wsProgress = XLSX.utils.json_to_sheet(records.filter(r => r.type === 'in_progress'));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsWon, "Won Deals");
    XLSX.utils.book_append_sheet(wb, wsLost, "Lost Deals");
    XLSX.utils.book_append_sheet(wb, wsProgress, "In Progress Deals");

    XLSX.writeFile(wb, `Sales_Intelligence_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportSalesToCSV = () => {
    const ws = XLSX.utils.json_to_sheet(records);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Sales_Deals_Dataset_${new Date().toISOString().slice(0, 10)}.csv`;
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
      pdf.save(`Executive_Sales_Intelligence_Dashboard_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("Error exporting Sales PDF:", err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 md:p-6 overflow-y-auto animate-fade-in text-slate-100">
      <div className="glass-panel p-5 md:p-6 rounded-2xl max-w-xl w-full border border-slate-700 shadow-2xl relative max-h-[92vh] flex flex-col my-auto overflow-y-auto bg-[#0d1322]">
        
        {/* Header & Close */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <Download className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="text-base font-bold text-slate-100">Reports & Export Center</h3>
              <p className="text-xs text-slate-400">Download executive reports, Excel workbooks & dataset exports</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-2 gap-2 mb-4 p-1 bg-slate-900 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('project')}
            className={`flex items-center justify-center space-x-2 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'project'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FolderKanban className="w-4 h-4 text-cyan-300" />
            <span>Project Performance</span>
          </button>

          <button
            onClick={() => setActiveTab('sales')}
            className={`flex items-center justify-center space-x-2 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'sales'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Briefcase className="w-4 h-4 text-purple-300" />
            <span>Sales Intelligence</span>
          </button>
        </div>

        {/* TAB 1: PROJECT PERFORMANCE REPORTS & EXPORTS */}
        {activeTab === 'project' && (
          <div className="space-y-3 animate-fade-in">
            
            {/* Quick Stat Summary Banner */}
            <div className="p-3 rounded-xl bg-[#151d30] border border-slate-800 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300">Monitored Projects: <strong className="text-white">{projectList.length}</strong></span>
              <span className="text-rose-400 font-bold">Delayed: {projectList.filter(p => p.timelineStatus === 'Delayed').length}</span>
              <span className="text-amber-400 font-bold">Over Budget: {projectList.filter(p => p.budgetStatus === 'Over Budget').length}</span>
            </div>

            {/* Option 1: PDF Briefing */}
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

            {/* Option 2: Multi-Tab Excel Workbook */}
            <button
              onClick={exportProjectToExcel}
              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-900/90 hover:bg-emerald-600/20 border border-slate-700/80 hover:border-emerald-500 text-slate-100 transition-all text-xs font-semibold group"
            >
              <div className="flex items-center space-x-3">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <p className="font-bold text-white">Multi-Tab Project Excel Workbook (.xlsx)</p>
                  <p className="text-[10px] text-slate-400 font-normal">Includes Master Registry, Over-Budget Alerts & On-Time tabs</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-white" />
            </button>

            {/* Option 3: Flat CSV */}
            <button
              onClick={exportProjectToCSV}
              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-900/90 hover:bg-purple-600/20 border border-slate-700/80 hover:border-purple-500 text-slate-100 transition-all text-xs font-semibold group"
            >
              <div className="flex items-center space-x-3">
                <FileSpreadsheet className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <p className="font-bold text-white">Flat Project CSV Dataset (.csv)</p>
                  <p className="text-[10px] text-slate-400 font-normal">Raw project records for external BI tools</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-white" />
            </button>

            {/* Option 4: Copy Executive Summary Text */}
            <button
              onClick={handleCopySummaryText}
              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-900/90 hover:bg-cyan-600/20 border border-slate-700/80 hover:border-cyan-500 text-slate-100 transition-all text-xs font-semibold group"
            >
              <div className="flex items-center space-x-3">
                <Copy className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <p className="font-bold text-white">Copy Executive Project Audit Summary</p>
                  <p className="text-[10px] text-slate-400 font-normal">Generate text briefing for email / WhatsApp / Slack</p>
                </div>
              </div>
              {copiedSummary ? (
                <span className="text-emerald-400 font-bold flex items-center text-[11px]"><Check className="w-3.5 h-3.5 mr-1" /> Copied!</span>
              ) : (
                <Copy className="w-4 h-4 text-slate-400 group-hover:text-white" />
              )}
            </button>

          </div>
        )}

        {/* TAB 2: SALES INTELLIGENCE REPORTS & EXPORTS */}
        {activeTab === 'sales' && (
          <div className="space-y-3 animate-fade-in">
            <button
              onClick={exportSalesToPDF}
              disabled={isGeneratingPdf}
              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-900/90 hover:bg-blue-600/20 border border-slate-700/80 hover:border-blue-500 text-slate-100 transition-all text-xs font-semibold group"
            >
              <div className="flex items-center space-x-3">
                <FileText className="w-5 h-5 text-rose-400 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <p className="font-bold text-white">Sales Executive PDF Report</p>
                  <p className="text-[10px] text-slate-400 font-normal">Full sales briefing, revenue KPIs & conversion visual snapshot</p>
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
                  <p className="font-bold text-white">Cleaned Multi-Tab Sales Excel (.xlsx)</p>
                  <p className="text-[10px] text-slate-400 font-normal">Won, Lost, & Progress deal tabs with full metadata</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-white" />
            </button>

            <button
              onClick={exportSalesToCSV}
              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-900/90 hover:bg-purple-600/20 border border-slate-700/80 hover:border-purple-500 text-slate-100 transition-all text-xs font-semibold group"
            >
              <div className="flex items-center space-x-3">
                <FileSpreadsheet className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <p className="font-bold text-white">Flat Sales CSV Dataset (.csv)</p>
                  <p className="text-[10px] text-slate-400 font-normal">Standardized deal records for external BI</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-white" />
            </button>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
          >
            Close Center
          </button>
        </div>

      </div>
    </div>
  );
};

export default ExportModal;
