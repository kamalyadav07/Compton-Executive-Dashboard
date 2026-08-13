import { useState, useEffect, useMemo, useCallback } from 'react';
import type { DealRecord, GlobalFilterState, KPIMetrics } from './types/sales';
import { filterRecords, calculateKPIs } from './engine/kpiEngine';
import { syncProjectsGoogleSheet, type SheetFetchStatus } from './engine/googleSheetsService';
import { getStoredSheetsConfig, saveSheetsConfig, type GoogleSheetsConfig } from './config/sheetsConfig';
import { getStoredBitrixConfig, saveBitrixConfig, type BitrixConfig } from './config/bitrixConfig';
import { getStoredBitrixCache, type BitrixSyncResult } from './engine/bitrixService';
import { fetchDealsFromServer } from './engine/apiClient';
import { globalPlatform } from './platform/EventDrivenPlatform';

import { Navbar } from './components/common/Navbar';
import { SidebarNav } from './components/navigation/SidebarNav';

import { DealDashboard } from './dashboards/deal/DealDashboard';
import { SalesDashboard } from './dashboards/sales/SalesDashboard';
import { ProjectDashboard } from './dashboards/project/ProjectDashboard';
import { ServiceDashboard } from './dashboards/service/ServiceDashboard';
import { DataSyncScreen } from './dashboards/dataSync/DataSyncScreen';
import { DealForecastDashboard } from './dashboards/dealForecast/DealForecastDashboard';

import { AIChatbotDrawer } from './components/chatbot/AIChatbotDrawer';
import { ExportModal } from './components/export/ExportModal';
import { PlatformControlCenter } from './components/platform/PlatformControlCenter';

import type { ProjectFilterState } from './types/project';
import { INITIAL_SAMPLE_PROJECTS } from './engine/projectSheetsService';

const getCurrentMonthStr = (): string => {
  const now = new Date();
  const shortMonthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${shortMonthNames[now.getMonth()]} ${now.getFullYear()}`;
};

const initialFilters: GlobalFilterState = {
  startDate: '',
  endDate: '',
  selectedMonth: getCurrentMonthStr(),
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
  const [activeDashboardId, setActiveDashboardIdState] = useState<string>(() => {
    return localStorage.getItem('compton_active_tab') || 'sales';
  });

  const setActiveDashboardId = useCallback((id: string) => {
    localStorage.setItem('compton_active_tab', id);
    setActiveDashboardIdState(id);
  }, []);

  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const initialCache = getStoredBitrixCache();

  const [sheetsConfig, setSheetsConfig] = useState<GoogleSheetsConfig>(getStoredSheetsConfig());
  const [bitrixConfig, setBitrixConfig] = useState<BitrixConfig>(getStoredBitrixConfig());
  const [bitrixSyncResult, setBitrixSyncResult] = useState<BitrixSyncResult | null>(initialCache);

  const [wonRecords, setWonRecords] = useState<DealRecord[]>(initialCache?.won || []);
  const [lostRecords, setLostRecords] = useState<DealRecord[]>(initialCache?.lost || []);
  const [progressRecords, setProgressRecords] = useState<DealRecord[]>(initialCache?.progress || []);

  const [projectSheetStatus, setProjectSheetStatus] = useState<SheetFetchStatus>({
    url: sheetsConfig.projectsSheetUrl,
    status: 'loading',
    recordCount: 0
  });
  const [projectsCount, setProjectsCount] = useState<number>(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(initialCache?.lastSyncedAt || null);

  const [filters, setFilters] = useState<GlobalFilterState>(initialFilters);

  // Operational Dashboard Filters State (passed to Navbar header and SalesDashboard)
  const [opSearchQuery, setOpSearchQuery] = useState<string>('');
  const [opDateFilter, setOpDateFilter] = useState<string>(() => getCurrentMonthStr());
  const [opStartDate, setOpStartDate] = useState<string>('');
  const [opEndDate, setOpEndDate] = useState<string>('');
  const [opTableFilter, setOpTableFilter] = useState<'All' | 'Billed' | 'Unbilled'>('All');
  const [opRepFilter, setOpRepFilter] = useState<string>('All');
  const [opSourceFilter, setOpSourceFilter] = useState<string>('All');
  const [opCompanyFilter, setOpCompanyFilter] = useState<string>('All');

  const handleResetOpFilters = useCallback(() => {
    setOpSearchQuery('');
    setOpDateFilter(getCurrentMonthStr());
    setOpStartDate('');
    setOpEndDate('');
    setOpTableFilter('All');
    setOpRepFilter('All');
    setOpSourceFilter('All');
    setOpCompanyFilter('All');
  }, []);

  // Project Dashboard Filters State (passed to Navbar header and ProjectDashboard)
  const initialProjectFilters: ProjectFilterState = useMemo(() => ({
    searchQuery: '',
    dateFilter: 'All Dates',
    status: 'All',
    timelineStatus: 'All',
    budgetStatus: 'All',
    projectType: 'All',
    customer: 'All'
  }), []);
  const [projectFilters, setProjectFilters] = useState<ProjectFilterState>(initialProjectFilters);

  const handleResetProjectFilters = useCallback(() => {
    setProjectFilters(initialProjectFilters);
  }, [initialProjectFilters]);

  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPlatformOpen, setIsPlatformOpen] = useState(false);

  // Sync Bitrix24 Deals & Leads Data in Background (Stale-While-Revalidate)
  const handleSyncBitrix = useCallback(async (_currentConfig = bitrixConfig) => {
    try {
      const res = await fetchDealsFromServer();
      setBitrixSyncResult(res);

      if (res.status === 'success' && (res.totalFetchedDeals > 0 || res.won.length > 0)) {
        setWonRecords(res.won);
        setLostRecords(res.lost);
        setProgressRecords(res.progress);
        setLastSyncedAt(res.lastSyncedAt);

        const allRaw = [...res.won, ...res.lost, ...res.progress];
        await globalPlatform.processSheetIngestion('Bitrix24 CRM Webhook', allRaw, 'manual');
      }
    } catch (err) {
      console.error("Failed to sync Bitrix24:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [bitrixConfig]);

  // Sync Google Sheets Project Dashboard Data
  const handleSyncProjectsSheet = useCallback(async (currentConfig = sheetsConfig) => {
    try {
      const res = await syncProjectsGoogleSheet(currentConfig);
      setProjectSheetStatus(res.status);
      setProjectsCount(res.projects.length);
    } catch (err) {
      console.error("Failed to sync Projects Sheet:", err);
    }
  }, [sheetsConfig]);

  // Initial Sync on mount (Stable single-sync without periodic interval state resets)
  useEffect(() => {
    handleSyncBitrix();
    handleSyncProjectsSheet();
  }, []);

  // Save new sheet URLs
  const handleSaveConfig = async (newConfig: GoogleSheetsConfig) => {
    setSheetsConfig(newConfig);
    await saveSheetsConfig(newConfig);
    handleSyncProjectsSheet(newConfig);
  };

  const handleSaveBitrixConfig = (newConfig: BitrixConfig) => {
    setBitrixConfig(newConfig);
    saveBitrixConfig(newConfig);
    handleSyncBitrix(newConfig);
  };

  const allRecords = useMemo(() => {
    return [...wonRecords, ...lostRecords, ...progressRecords];
  }, [wonRecords, lostRecords, progressRecords]);

  const filteredRecords = useMemo(() => {
    return filterRecords(allRecords, filters);
  }, [allRecords, filters]);

  const kpis: KPIMetrics = useMemo(() => {
    return calculateKPIs(filteredRecords, filters, undefined, allRecords);
  }, [filteredRecords, filters, allRecords]);

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
        opSearchQuery={opSearchQuery}
        onOpSearchQueryChange={setOpSearchQuery}
        opDateFilter={opDateFilter}
        onOpDateFilterChange={setOpDateFilter}
        opStartDate={opStartDate}
        onOpStartDateChange={setOpStartDate}
        opEndDate={opEndDate}
        onOpEndDateChange={setOpEndDate}
        opTableFilter={opTableFilter}
        onOpTableFilterChange={setOpTableFilter}
        opRepFilter={opRepFilter}
        onOpRepFilterChange={setOpRepFilter}
        opSourceFilter={opSourceFilter}
        onOpSourceFilterChange={setOpSourceFilter}
        opCompanyFilter={opCompanyFilter}
        onOpCompanyFilterChange={setOpCompanyFilter}
        onResetOpFilters={handleResetOpFilters}
        projectFilters={projectFilters}
        onProjectFilterChange={setProjectFilters}
        onResetProjectFilters={handleResetProjectFilters}
        allProjects={INITIAL_SAMPLE_PROJECTS}
      />

      <div className="flex-1 flex overflow-hidden relative">
        {/* Collapsible Left Sidebar Navigation */}
        <SidebarNav
          activeDashboardId={activeDashboardId}
          onSelectDashboard={setActiveDashboardId}
          isSyncing={isSyncing}
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

          {activeDashboardId === 'deal-forecast' && (
            <DealForecastDashboard allRecords={allRecords} />
          )}

          {activeDashboardId === 'sales' && (
            <SalesDashboard 
              allRecords={allRecords} 
              bitrixSyncResult={bitrixSyncResult}
              onOpenExportModal={() => setIsExportModalOpen(true)}
              searchQuery={opSearchQuery}
              onSearchQueryChange={setOpSearchQuery}
              dateFilter={opDateFilter}
              onDateFilterChange={setOpDateFilter}
              startDate={opStartDate}
              onStartDateChange={setOpStartDate}
              endDate={opEndDate}
              onEndDateChange={setOpEndDate}
              tableFilter={opTableFilter}
              onTableFilterChange={setOpTableFilter}
              repFilter={opRepFilter}
              onRepFilterChange={setOpRepFilter}
              sourceFilter={opSourceFilter}
              onSourceFilterChange={setOpSourceFilter}
              companyFilter={opCompanyFilter}
              onCompanyFilterChange={setOpCompanyFilter}
              onResetFilters={handleResetOpFilters}
            />
          )}
          {activeDashboardId === 'project' && (
            <ProjectDashboard 
              onOpenExportModal={() => setIsExportModalOpen(true)}
              filters={projectFilters}
              onFilterChange={setProjectFilters}
              onResetFilters={handleResetProjectFilters}
            />
          )}
          {activeDashboardId === 'service' && <ServiceDashboard />}
          
          {activeDashboardId === 'data-sync' && (
            <DataSyncScreen
              config={sheetsConfig}
              bitrixConfig={bitrixConfig}
              bitrixSyncResult={bitrixSyncResult}
              projectSheetStatus={projectSheetStatus}
              projectsCount={projectsCount}
              wonRecords={wonRecords}
              lostRecords={lostRecords}
              progressRecords={progressRecords}
              lastSyncedAt={lastSyncedAt}
              isSyncing={isSyncing}
              onRefresh={() => handleSyncProjectsSheet()}
              onRefreshBitrix={() => handleSyncBitrix()}
              onSaveConfig={handleSaveConfig}
              onSaveBitrixConfig={handleSaveBitrixConfig}
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
      />
    </div>
  );
}

export default App;
