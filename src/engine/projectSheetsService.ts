import type { ProjectRecord, ProjectKPIMetrics, ProjectFilterState } from '../types/project';
import { convertToCsvExportUrl } from '../config/sheetsConfig';

export const DEFAULT_PROJECT_SHEET_URL = import.meta.env.VITE_PROJECTS_SHEET_URL || 'https://docs.google.com/spreadsheets/d/1-iXdZ3bhvsE-xQs5xplb9xG0L-sOVTnMMYNdfXrFJUQ/edit?gid=0#gid=0';

/**
 * Initial sample dataset matching exact records from the user's Google Sheet
 */
export const INITIAL_SAMPLE_PROJECTS: ProjectRecord[] = [
  {
    id: 'proj-1',
    sNo: 1,
    customerName: 'Amar Ujala',
    projectName: 'CCTV INSTALLATION',
    status: 'Completed',
    projectType: 'CCTV',
    startDate: '1 July',
    plannedEndDate: '20 July',
    actualEndDate: '31 July',
    plannedBudget: 60000,
    actualCost: 75000,
    timelineStatus: 'Delayed',
    budgetStatus: 'Over Budget',
    budgetVariance: 15000,
    budgetVariancePct: 25.0,
    delayDays: 11
  },
  {
    id: 'proj-2',
    sNo: 2,
    customerName: 'Dynamic Oil',
    projectName: 'CCTV INSTALLATION',
    status: 'Completed',
    projectType: 'CCTV',
    startDate: '25 June',
    plannedEndDate: '31 July',
    actualEndDate: '31 July',
    plannedBudget: 150000,
    actualCost: 150000,
    timelineStatus: 'On Time',
    budgetStatus: 'On Budget',
    budgetVariance: 0,
    budgetVariancePct: 0.0,
    delayDays: 0
  },
  {
    id: 'proj-3',
    sNo: 3,
    customerName: 'Panacea Biotech',
    projectName: 'Networking Maintainanace',
    status: 'Running',
    projectType: 'Networking',
    startDate: '4 June',
    plannedEndDate: '4 July',
    actualEndDate: '4 August',
    plannedBudget: 100000,
    actualCost: 150000,
    timelineStatus: 'Delayed',
    budgetStatus: 'Over Budget',
    budgetVariance: 50000,
    budgetVariancePct: 50.0,
    delayDays: 31
  }
];

/**
 * Helper to parse CSV lines cleanly handling quotes & commas
 */
export const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^["']|["']$/g, ''));
  return result;
};

/**
 * Helper to parse date strings like "1 July", "20 July", "2025-07-01", "01/07/2025"
 */
export const parseProjectDate = (dateStr: string): Date | null => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const cleaned = dateStr.trim();
  if (!cleaned || cleaned === '-') return null;

  const monthMap: Record<string, number> = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11
  };

  const parts = cleaned.split(/[\s,/-]+/);
  if (parts.length >= 2) {
    let day = parseInt(parts[0], 10);
    let monthStr = parts[1].toLowerCase();
    let year = parts[2] ? parseInt(parts[2], 10) : 2026;

    if (isNaN(day) && !isNaN(parseInt(parts[1], 10))) {
      monthStr = parts[0].toLowerCase();
      day = parseInt(parts[1], 10);
    }

    if (!isNaN(day) && monthMap[monthStr] !== undefined) {
      return new Date(year, monthMap[monthStr], day);
    }
  }

  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) return parsed;

  return null;
};

/**
 * Calculates timeline status and delay days
 */
export const computeTimelineAnalytics = (
  plannedEndStr: string,
  actualEndStr: string
): { timelineStatus: 'On Time' | 'Delayed'; delayDays: number } => {
  const plannedDate = parseProjectDate(plannedEndStr);
  const actualDate = parseProjectDate(actualEndStr);

  if (!plannedDate) {
    return { timelineStatus: 'On Time', delayDays: 0 };
  }

  const targetDate = actualDate || new Date();
  const diffTime = targetDate.getTime() - plannedDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return { timelineStatus: 'Delayed', delayDays: diffDays };
  }

  return { timelineStatus: 'On Time', delayDays: 0 };
};

/**
 * Calculates budget status and variances
 */
export const computeBudgetAnalytics = (
  plannedBudget: number,
  actualCost: number
): { budgetStatus: 'Under Budget' | 'On Budget' | 'Over Budget'; variance: number; variancePct: number } => {
  const variance = actualCost - plannedBudget;
  const variancePct = plannedBudget > 0 ? (variance / plannedBudget) * 100 : 0;

  let budgetStatus: 'Under Budget' | 'On Budget' | 'Over Budget' = 'On Budget';
  if (variance > 0) {
    budgetStatus = 'Over Budget';
  } else if (variance < 0) {
    budgetStatus = 'Under Budget';
  }

  return {
    budgetStatus,
    variance,
    variancePct: Math.round(variancePct * 100) / 100
  };
};

/**
 * Parses raw CSV string from Google Sheet into ProjectRecord[]
 */
export const parseProjectCsv = (csvText: string): ProjectRecord[] => {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) return [];

  // Parse Header Line
  const rawHeaders = parseCsvLine(lines[0]);

  // Robust Header Index Matcher: Exact match first, then specific substring
  const findHeaderIdx = (exactTargets: string[], fallbackSubstrings: string[]): number => {
    // 1. Exact normalized match
    for (const target of exactTargets) {
      const targetNorm = target.toLowerCase().replace(/[^a-z0-9]/g, '');
      const idx = rawHeaders.findIndex(h => h.toLowerCase().replace(/[^a-z0-9]/g, '') === targetNorm);
      if (idx !== -1) return idx;
    }
    // 2. Fallback substring match
    for (const sub of fallbackSubstrings) {
      const subNorm = sub.toLowerCase().replace(/[^a-z0-9]/g, '');
      const idx = rawHeaders.findIndex(h => h.toLowerCase().replace(/[^a-z0-9]/g, '').includes(subNorm));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const sNoIdx = findHeaderIdx(['id', 'sno', 's.no', 's no', 'serial', 'number', 'deal id'], ['id', 'sno', 'serial']);
  const custIdx = findHeaderIdx(['company', 'customername', 'customer name', 'customer', 'client', 'company name'], ['company', 'customer', 'client']);
  const projIdx = findHeaderIdx(['deal name', 'dealname', 'projectname', 'project name', 'project', 'opportunity'], ['deal', 'project', 'opportunity']);
  const statusIdx = findHeaderIdx(['stage', 'status', 'state', 'billing status'], ['stage', 'status']);
  const typeIdx = findHeaderIdx(['solution type', 'solutiontype', 'projecttype', 'project type', 'type', 'industry', 'category'], ['solution', 'projecttype', 'type']);
  const startIdx = findHeaderIdx(['created', 'startdate', 'start date', 'start', 'iso created date', 'created date'], ['created', 'start']);
  const plannedEndIdx = findHeaderIdx(['end date', 'enddate', 'plannedenddate', 'planned end date', 'plannedend', 'billing date'], ['end', 'plannedend']);
  const actualEndIdx = findHeaderIdx(['end date', 'enddate', 'actualenddate', 'actual end date', 'actualend', 'billing date'], ['end', 'actualend']);
  const plannedBudgetIdx = findHeaderIdx(['income', 'plannedbudget', 'planned budget', 'budget', 'deal value with tax', 'deal value without tax', 'opportunity amount'], ['income', 'budget', 'value']);
  const actualCostIdx = findHeaderIdx(['billed value', 'actualcost', 'actual cost', 'cost', 'actualcostamount'], ['billed', 'cost']);

  const records: ProjectRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length < 3) continue;

    const cleanCell = (idx: number) => {
      if (idx < 0 || idx >= row.length) return '';
      return row[idx].trim();
    };

    const sNoStr = cleanCell(sNoIdx) || String(i);
    const sNo = parseInt(sNoStr, 10) || sNoStr;
    const customerName = cleanCell(custIdx) || 'Unknown Client';
    const projectName = cleanCell(projIdx) || 'Project ' + i;
    const rawStatus = cleanCell(statusIdx) || 'Running';
    const projectType = cleanCell(typeIdx) || 'General';
    const startDate = cleanCell(startIdx) || '-';
    const plannedEndDate = cleanCell(plannedEndIdx) || '-';
    const actualEndDate = cleanCell(actualEndIdx) || '-';

    const parseNum = (str: string) => {
      const cleaned = str.replace(/[^0-9.]/g, '');
      return parseFloat(cleaned) || 0;
    };

    const rawBudget = parseNum(cleanCell(plannedBudgetIdx));
    const rawCost = actualCostIdx !== -1 ? parseNum(cleanCell(actualCostIdx)) : rawBudget;

    const plannedBudget = rawBudget;
    const actualCost = rawCost;

    // Normalize Status
    let status: ProjectRecord['status'] = 'Running';
    const sLower = rawStatus.toLowerCase();
    if (sLower.includes('complete') || sLower.includes('done') || sLower.includes('won') || sLower.includes('billed') || sLower.includes('delivered')) {
      status = 'Completed';
    } else if (sLower.includes('delay') || sLower.includes('late') || sLower.includes('overdue')) {
      status = 'Delayed';
    } else if (sLower.includes('hold') || sLower.includes('pause')) {
      status = 'On Hold';
    } else if (sLower.includes('plan') || sLower.includes('draft') || sLower.includes('lead')) {
      status = 'Planning';
    } else {
      status = 'Running';
    }

    const { timelineStatus, delayDays } = computeTimelineAnalytics(plannedEndDate, actualEndDate);
    const { budgetStatus, variance, variancePct } = computeBudgetAnalytics(plannedBudget, actualCost);

    records.push({
      id: `sheet-proj-${i}`,
      sNo,
      customerName,
      projectName,
      status,
      projectType,
      startDate,
      plannedEndDate,
      actualEndDate,
      plannedBudget,
      actualCost,
      timelineStatus,
      budgetStatus,
      budgetVariance: variance,
      budgetVariancePct: variancePct,
      delayDays
    });
  }

  return records;
};

/**
 * Fetches Google Sheet Project data from URL
 */
export const fetchProjectSheetData = async (
  rawUrl: string
): Promise<{ records: ProjectRecord[]; status: 'success' | 'error'; message: string }> => {
  try {
    const csvUrl = convertToCsvExportUrl(rawUrl || DEFAULT_PROJECT_SHEET_URL);
    const response = await fetch(csvUrl, {
      method: 'GET',
      headers: { 'Accept': 'text/csv,text/plain,*/*' }
    });

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`);
    }

    const text = await response.text();
    if (text.includes('<!DOCTYPE html>') || text.includes('accounts.google.com')) {
      throw new Error("Permission Denied: Please share sheet with 'Anyone with the link can view'.");
    }

    const parsed = parseProjectCsv(text);
    if (parsed.length === 0) {
      return {
        records: INITIAL_SAMPLE_PROJECTS,
        status: 'success',
        message: 'Loaded fallback project data.'
      };
    }

    return {
      records: parsed,
      status: 'success',
      message: `Successfully synced ${parsed.length} projects from Google Sheet.`
    };
  } catch (err: any) {
    console.warn("Failed to fetch project sheet, falling back to initial projects:", err);
    return {
      records: INITIAL_SAMPLE_PROJECTS,
      status: 'error',
      message: err.message || 'Could not fetch live sheet. Displaying initial projects.'
    };
  }
};

/**
 * Filter project records based on user search query & filter selections
 */
export const filterProjectRecords = (
  records: ProjectRecord[],
  filters: ProjectFilterState
): ProjectRecord[] => {
  return records.filter(r => {
    // 1. Search Query
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase().trim();
      const matchesSearch =
        r.projectName.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.projectType.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }

    // 2. Status Filter
    if (filters.status !== 'All' && r.status.toLowerCase() !== filters.status.toLowerCase()) {
      return false;
    }

    // 3. Timeline Status Filter ('On Time', 'Delayed')
    if (filters.timelineStatus !== 'All' && r.timelineStatus.toLowerCase() !== filters.timelineStatus.toLowerCase()) {
      return false;
    }

    // 4. Budget Status Filter ('Under Budget', 'On Budget', 'Over Budget')
    if (filters.budgetStatus !== 'All' && r.budgetStatus.toLowerCase() !== filters.budgetStatus.toLowerCase()) {
      return false;
    }

    // 5. Project Type Filter
    if (filters.projectType !== 'All' && r.projectType.toLowerCase() !== filters.projectType.toLowerCase()) {
      return false;
    }

    // 6. Customer Filter
    if (filters.customer !== 'All' && r.customerName.toLowerCase() !== filters.customer.toLowerCase()) {
      return false;
    }

    // 7. Date Filter
    if (filters.dateFilter && filters.dateFilter !== 'All Dates') {
      const df = filters.dateFilter.toLowerCase();
      const matchStart = (r.startDate || '').toLowerCase().includes(df);
      const matchEnd = (r.plannedEndDate || '').toLowerCase().includes(df);
      const matchActual = (r.actualEndDate || '').toLowerCase().includes(df);
      if (!matchStart && !matchEnd && !matchActual) return false;
    }

    return true;
  });
};

/**
 * Calculate KPI summary metrics requested by user:
 * - Projects Running
 * - On time Projects
 * - Delayed Projects
 * - Under Budget Projects
 * - Over Budget Projects
 */
export const calculateProjectKPIs = (records: ProjectRecord[], isAllStatusFilter = true): ProjectKPIMetrics => {
  const totalProjects = records.length;

  const runningRecords = records.filter(r => r.status === 'Running' || r.status.toLowerCase() === 'in progress');
  const projectsRunning = runningRecords.length;

  // Breakdown records for Top Running Cards: If no status filter is explicitly selected, evaluate breakdown ONLY for running projects.
  const runningBreakdownRecords = (isAllStatusFilter && runningRecords.length > 0) ? runningRecords : records;

  let onTimeProjects = 0;
  let delayedProjects = 0;
  let underBudgetProjects = 0;
  let overBudgetProjects = 0;
  let onBudgetProjects = 0;

  let portfolioOnTimeProjects = 0;
  let portfolioDelayedProjects = 0;
  let portfolioUnderBudgetProjects = 0;
  let portfolioOverBudgetProjects = 0;
  let portfolioOnBudgetProjects = 0;

  let totalPlannedBudget = 0;
  let totalActualCost = 0;

  // 1. Portfolio-Wide Breakdown (ALL filtered records, e.g. 3 Projects)
  records.forEach(r => {
    totalPlannedBudget += r.plannedBudget || 0;
    totalActualCost += r.actualCost || 0;

    if (r.timelineStatus === 'On Time') {
      portfolioOnTimeProjects++;
    } else {
      portfolioDelayedProjects++;
    }

    if (r.budgetStatus === 'Under Budget') {
      portfolioUnderBudgetProjects++;
    } else if (r.budgetStatus === 'Over Budget') {
      portfolioOverBudgetProjects++;
    } else {
      portfolioOnBudgetProjects++;
    }
  });

  // 2. Running-Only Breakdown (for top Running & Budget status cards)
  runningBreakdownRecords.forEach(r => {
    if (r.timelineStatus === 'On Time') {
      onTimeProjects++;
    } else {
      delayedProjects++;
    }

    if (r.budgetStatus === 'Under Budget') {
      underBudgetProjects++;
    } else if (r.budgetStatus === 'Over Budget') {
      overBudgetProjects++;
    } else {
      onBudgetProjects++;
    }
  });

  const baseCount = runningBreakdownRecords.length;
  const netBudgetVariance = totalActualCost - totalPlannedBudget;
  const onTimeRatePct = baseCount > 0 ? Math.round((onTimeProjects / baseCount) * 1000) / 10 : 0;
  const underBudgetRatePct = baseCount > 0 ? Math.round((underBudgetProjects / baseCount) * 1000) / 10 : 0;
  const avgCostPerProject = totalProjects > 0 ? Math.round(totalActualCost / totalProjects) : 0;

  return {
    totalProjects,
    projectsRunning,
    onTimeProjects,
    delayedProjects,
    underBudgetProjects,
    overBudgetProjects,
    onBudgetProjects,
    portfolioOnTimeProjects,
    portfolioDelayedProjects,
    portfolioUnderBudgetProjects,
    portfolioOverBudgetProjects,
    portfolioOnBudgetProjects,
    totalPlannedBudget,
    totalActualCost,
    netBudgetVariance,
    onTimeRatePct,
    underBudgetRatePct,
    avgCostPerProject
  };
};
