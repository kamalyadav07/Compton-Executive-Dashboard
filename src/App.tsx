import { useState, useEffect, useMemo, useCallback } from 'react';
import type { DealRecord, GlobalFilterState, KPIMetrics, UploadValidationReport } from './types/sales';
import { filterRecords, calculateKPIs } from './engine/kpiEngine';
import { syncAllGoogleSheets, type SheetFetchStatus } from './engine/googleSheetsService';
import { getStoredSheetsConfig, saveSheetsConfig, type GoogleSheetsConfig } from './config/sheetsConfig';
import { globalPlatform } from './platform/EventDrivenPlatform';

import { Navbar } from './components/common/Navbar';
import { SidebarNav } from './components/navigation/SidebarNav';

import { DealDashboard } from './dashboards/deal/DealDashboard';
import { SalesDashboard } from './dashboards/sales/SalesDashboard';
import { ProjectDashboard } from './dashboards/project/ProjectDashboard';
import { ServiceDashboard } from './dashboards/service/ServiceDashboard';
import { DataSyncScreen } from './dashboards/dataSync/DataSyncScreen';

import { AIChatbotDrawer } from './components/chatbot/AIChatbotDrawer';
import { ExportModal } from './components/export/ExportModal';
import { PlatformControlCenter } from './components/platform/PlatformControlCenter';
import { AIDealCommandCenterModal } from './components/predictive/AIDealCommandCenterModal';

const initialFilters: GlobalFilterState = {
  startDate: '',
  endDate: '',
  selectedMonth: 'All',
  selectedQuarter: 'All',
  selectedYear: 'All',
  salesRep: 'All',
  industry: 'All',
  solution: 'All',
  leadSource: 'All',
  customerQuery: '',
  dealQuery: '',
  companyQuery: '',
  minDealValue: 0,
  maxDealValue: 0,
  pipelineStage: 'All'
};

export function App() {
  const [activeDashboardId, setActiveDashboardId] = useState<string>('deal');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const [sheetsConfig, setSheetsConfig] = useState<GoogleSheetsConfig>(getStoredSheetsConfig());
  const [wonRecords, setWonRecords] = useState<DealRecord[]>([]);
  const [lostRecords, setLostRecords] = useState<DealRecord[]>([]);
  const [progressRecords, setProgressRecords] = useState<DealRecord[]>([]);

  const [uploadReport, setUploadReport] = useState<UploadValidationReport | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const [sheetStatuses, setSheetStatuses] = useState<{
    won: SheetFetchStatus;
    lost: SheetFetchStatus;
    progress: SheetFetchStatus;
  }>({
    won: { url: sheetsConfig.wonDealsUrl, status: 'loading', recordCount: 0 },
    lost: { url: sheetsConfig.lostDealsUrl, status: 'loading', recordCount: 0 },
    progress: { url: sheetsConfig.inProgressDealsUrl, status: 'loading', recordCount: 0 }
  });

  const [filters, setFilters] = useState<GlobalFilterState>(initialFilters);

  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPlatformOpen, setIsPlatformOpen] = useState(false);
  const [isCommandCenterOpen, setIsCommandCenterOpen] = useState(false);

  // Sync Google Sheets Data through 10-Stage Event-Driven Data Platform
  const handleSyncData = useCallback(async (currentConfig = sheetsConfig) => {
    setIsSyncing(true);
    try {
      const res = await syncAllGoogleSheets(currentConfig);
      setWonRecords(res.won);
      setLostRecords(res.lost);
      setProgressRecords(res.progress);
      setUploadReport(res.report);
      setSheetStatuses(res.statuses);
      setLastSyncedAt(res.lastSyncedAt);

      // Ingest into 10-Stage Platform Architecture
      const allRaw = [...res.won, ...res.lost, ...res.progress];
      if (allRaw.length > 0) {
        await globalPlatform.processSheetIngestion('Google Sheets Combined', allRaw, 'manual');
      }
    } catch (err) {
      console.error("Failed to sync Google Sheets:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [sheetsConfig]);

  // Initial Sync & Auto-polling timer (every 60s)
  useEffect(() => {
    handleSyncData();

    const intervalSec = sheetsConfig.autoRefreshSeconds || 60;
    const timer = setInterval(() => {
      handleSyncData();
    }, intervalSec * 1000);

    return () => clearInterval(timer);
  }, [handleSyncData, sheetsConfig.autoRefreshSeconds]);

  // Save new sheet URLs
  const handleSaveConfig = async (newConfig: GoogleSheetsConfig) => {
    setSheetsConfig(newConfig);
    await saveSheetsConfig(newConfig);
    handleSyncData(newConfig);
  };

  const allRecords = useMemo(() => {
    return [...wonRecords, ...lostRecords, ...progressRecords];
  }, [wonRecords, lostRecords, progressRecords]);

  const filteredRecords = useMemo(() => {
    return filterRecords(allRecords, filters);
  }, [allRecords, filters]);

  const kpis: KPIMetrics = useMemo(() => {
    return calculateKPIs(filteredRecords, filters);
  }, [filteredRecords, filters]);

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${isDarkMode ? 'dark bg-[#0a0e1a]' : 'light-theme'}`}>
      <Navbar
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        onOpenChatbot={() => setIsChatbotOpen(true)}
        hasData={allRecords.length > 0}
        activeDashboardId={activeDashboardId}
        filters={filters}
        onFilterChange={setFilters}
        onResetFilters={() => setFilters(initialFilters)}
        allRecords={allRecords}
      />

      <div className="flex-1 flex overflow-hidden relative">
        {/* Collapsible Left Sidebar Navigation */}
        <SidebarNav
          activeDashboardId={activeDashboardId}
          onSelectDashboard={setActiveDashboardId}
          isSyncing={isSyncing}
          onOpenAIDealAnalysis={() => setIsCommandCenterOpen(true)}
          onOpenExportModal={() => setIsExportModalOpen(true)}
        />

        {/* Main Active Dashboard View */}
        <main id="main-dashboard-content" className="flex-1 overflow-y-auto max-w-[1600px] mx-auto px-4 lg:px-8 py-6 w-full">
          {activeDashboardId === 'deal' && (
            <DealDashboard
              filters={filters}
              onFilterChange={setFilters}
              onResetFilters={() => setFilters(initialFilters)}
              allRecords={allRecords}
              filteredRecords={filteredRecords}
              kpis={kpis}
            />
          )}

          {activeDashboardId === 'sales' && <SalesDashboard />}
          {activeDashboardId === 'project' && <ProjectDashboard onOpenExportModal={() => setIsExportModalOpen(true)} />}
          {activeDashboardId === 'service' && <ServiceDashboard />}
          
          {activeDashboardId === 'data-sync' && (
            <DataSyncScreen
              config={sheetsConfig}
              statuses={sheetStatuses}
              wonRecords={wonRecords}
              lostRecords={lostRecords}
              progressRecords={progressRecords}
              uploadReport={uploadReport}
              lastSyncedAt={lastSyncedAt}
              isSyncing={isSyncing}
              onRefresh={() => handleSyncData()}
              onSaveConfig={handleSaveConfig}
            />
          )}
        </main>
      </div>

      <AIChatbotDrawer
        isOpen={isChatbotOpen}
        onClose={() => setIsChatbotOpen(false)}
        records={allRecords}
        kpis={kpis}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        records={filteredRecords}
        kpis={kpis}
        activeDashboardId={activeDashboardId}
      />

      <PlatformControlCenter
        isOpen={isPlatformOpen}
        onClose={() => setIsPlatformOpen(false)}
        onRefreshData={() => handleSyncData()}
      />

      <AIDealCommandCenterModal
        isOpen={isCommandCenterOpen}
        onClose={() => setIsCommandCenterOpen(false)}
        records={allRecords}
      />
    </div>
  );
}

export default App;
