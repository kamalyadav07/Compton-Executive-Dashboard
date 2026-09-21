/**
 * src/config/salesTargets.ts
 * -----------------------------------------------------------------------
 * Single source of truth for company and individual sales rep targets.
 * Supports runtime customization, browser localStorage persistence,
 * server sync, and reactive dashboard event notifications.
 */

export const STORAGE_KEY_TARGETS = 'compton_sales_targets';

export const DEFAULT_COMPANY_MONTHLY_TARGET = 16000000;  // ₹1.6 Crore / month
export const DEFAULT_COMPANY_YEARLY_TARGET  = 200000000; // ₹20 Crore / FY (Apr–Mar)

export const DEFAULT_REP_MONTHLY_TARGETS: Record<string, number> = {
  'Sandeep Vahi':   3950000, // ₹39.5L
  'Rohit Yadav':    7500000, // ₹75L
  'Jitesh Chander': 4000000, // ₹40L
  'Taniya Negi':     550000, // ₹5.5L
};

export interface SalesTargetsConfig {
  monthlyTarget: number;
  yearlyTarget: number;
  repTargets: Record<string, number>;
  lastUpdated?: string;
}

// In-memory active targets
export let COMPANY_MONTHLY_TARGET = DEFAULT_COMPANY_MONTHLY_TARGET;
export let COMPANY_YEARLY_TARGET = DEFAULT_COMPANY_YEARLY_TARGET;
export const INDIVIDUAL_REP_MONTHLY_TARGETS: Record<string, number> = {
  ...DEFAULT_REP_MONTHLY_TARGETS
};

function applyTargets(config: Partial<SalesTargetsConfig>) {
  if (typeof config.monthlyTarget === 'number' && config.monthlyTarget > 0) {
    COMPANY_MONTHLY_TARGET = config.monthlyTarget;
  }
  if (typeof config.yearlyTarget === 'number' && config.yearlyTarget > 0) {
    COMPANY_YEARLY_TARGET = config.yearlyTarget;
  }
  if (config.repTargets && typeof config.repTargets === 'object') {
    for (const key of Object.keys(INDIVIDUAL_REP_MONTHLY_TARGETS)) {
      delete INDIVIDUAL_REP_MONTHLY_TARGETS[key];
    }
    Object.assign(INDIVIDUAL_REP_MONTHLY_TARGETS, config.repTargets);
  }
}

// Initialize from localStorage if running in browser
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TARGETS);
    if (raw) {
      const parsed = JSON.parse(raw);
      applyTargets(parsed);
    }
  } catch (e) {
    console.warn('[salesTargets] Failed to load targets from localStorage', e);
  }

  // Attempt async sync from /api/targets
  setTimeout(() => {
    fetch('/api/targets')
      .then(res => (res.ok ? res.json() : null))
      .then(serverData => {
        if (serverData && typeof serverData.monthlyTarget === 'number') {
          // If localStorage doesn't exist, apply server data
          const hasLocal = localStorage.getItem(STORAGE_KEY_TARGETS);
          if (!hasLocal && (serverData.isCustomized || serverData.repTargets)) {
            applyTargets(serverData);
            window.dispatchEvent(new CustomEvent('salesTargetsUpdated', { detail: getTargets() }));
          }
        }
      })
      .catch(() => {});
  }, 100);
}

export function getCompanyMonthlyTarget(): number {
  return COMPANY_MONTHLY_TARGET;
}

export function getCompanyYearlyTarget(): number {
  return COMPANY_YEARLY_TARGET;
}

export function getIndividualRepMonthlyTargets(): Record<string, number> {
  return { ...INDIVIDUAL_REP_MONTHLY_TARGETS };
}

export function isCustomizedTargets(): boolean {
  if (COMPANY_MONTHLY_TARGET !== DEFAULT_COMPANY_MONTHLY_TARGET) return true;
  if (COMPANY_YEARLY_TARGET !== DEFAULT_COMPANY_YEARLY_TARGET) return true;
  
  const currentKeys = Object.keys(INDIVIDUAL_REP_MONTHLY_TARGETS);
  const defaultKeys = Object.keys(DEFAULT_REP_MONTHLY_TARGETS);
  if (currentKeys.length !== defaultKeys.length) return true;

  for (const k of currentKeys) {
    if (INDIVIDUAL_REP_MONTHLY_TARGETS[k] !== DEFAULT_REP_MONTHLY_TARGETS[k]) return true;
  }
  return false;
}

export function getTargets() {
  return {
    monthlyTarget: COMPANY_MONTHLY_TARGET,
    yearlyTarget: COMPANY_YEARLY_TARGET,
    repMonthlyTargets: { ...INDIVIDUAL_REP_MONTHLY_TARGETS },
    repTargets: { ...INDIVIDUAL_REP_MONTHLY_TARGETS },
    isCustomized: isCustomizedTargets()
  };
}

export async function saveCustomTargets(newTargets: {
  monthlyTarget: number;
  yearlyTarget: number;
  repTargets: Record<string, number>;
}): Promise<void> {
  const configToSave: SalesTargetsConfig = {
    monthlyTarget: Math.round(newTargets.monthlyTarget),
    yearlyTarget: Math.round(newTargets.yearlyTarget),
    repTargets: { ...newTargets.repTargets },
    lastUpdated: new Date().toISOString()
  };

  applyTargets(configToSave);

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(STORAGE_KEY_TARGETS, JSON.stringify(configToSave));
    } catch (e) {
      console.error('[salesTargets] Failed to save targets to localStorage', e);
    }
  }

  // Dispatch global event for all listening components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('salesTargetsUpdated', { detail: getTargets() }));
  }

  // Persist to server API
  try {
    await fetch('/api/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configToSave)
    });
  } catch (e) {
    console.warn('[salesTargets] Could not sync targets to server endpoint', e);
  }
}

export async function resetCustomTargets(): Promise<void> {
  const defaults: SalesTargetsConfig = {
    monthlyTarget: DEFAULT_COMPANY_MONTHLY_TARGET,
    yearlyTarget: DEFAULT_COMPANY_YEARLY_TARGET,
    repTargets: { ...DEFAULT_REP_MONTHLY_TARGETS },
    lastUpdated: new Date().toISOString()
  };

  applyTargets(defaults);

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.removeItem(STORAGE_KEY_TARGETS);
    } catch (e) {
      console.error('[salesTargets] Failed to remove targets from localStorage', e);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('salesTargetsUpdated', { detail: getTargets() }));
  }

  try {
    await fetch('/api/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reset: true, ...defaults })
    });
  } catch (e) {
    console.warn('[salesTargets] Could not sync reset to server endpoint', e);
  }
}
