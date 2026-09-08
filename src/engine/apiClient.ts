/**
 * apiClient.ts
 * -----------------------------------------------------------------------
 * Thin client that fetches deal data from the backend server instead of
 * calling Bitrix24 directly from the browser.
 *
 * This replaces direct usage of `fetchBitrixDeals()` from bitrixService.ts
 * in the UI layer.  The server (server/dashboard-server.js) owns the
 * Bitrix webhook URL and Gemini API key — they never reach the browser.
 *
 * The returned shape is identical to BitrixSyncResult so every consumer
 * (App.tsx, SalesDashboard, ExportModal) is a drop-in replacement.
 * -----------------------------------------------------------------------
 */

import { getStoredBitrixCache, saveBitrixCache, type BitrixSyncResult } from './bitrixService';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Fetch the latest cached deal data from the server.
 * Includes fallbacks to browser localStorage cache and direct Bitrix Webhook if server is unreachable.
 */
export async function fetchDealsFromServer(): Promise<BitrixSyncResult> {
  // Attempt 1: Try the backend Express server API (only works in dev or
  // when deployed alongside the Node.js server)
  try {
    const res = await fetch(`${API_BASE}/api/deals`, {
      headers: { 'Accept': 'application/json' }
    });

    // Detect static hosting: if the server responded with HTML instead of
    // JSON (e.g. Hostinger .htaccess SPA rewrite serving index.html), the
    // backend is not available — skip straight to fallbacks.
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('Backend server not available (response is not JSON — likely static hosting).');
    }

    // If server is performing initial Bitrix sync (503), retry a few times
    if (res.status === 503) {
      let retryRes = res;
      for (let i = 0; i < 15 && retryRes.status === 503; i++) {
        console.log(`[apiClient] Server is syncing Bitrix data (attempt ${i + 1}/15)...`);
        await new Promise(r => setTimeout(r, 1000));
        retryRes = await fetch(`${API_BASE}/api/deals`, {
          headers: { 'Accept': 'application/json' }
        });
      }
      if (!retryRes.ok) throw new Error(`Server responded with HTTP ${retryRes.status}`);
      const retryData = await retryRes.json();
      const retryResult: BitrixSyncResult = { ...retryData, lastSyncedAt: new Date(retryData.lastSyncedAt) };
      if (retryResult.status === 'success') saveBitrixCache(retryResult);
      return retryResult;
    }

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new Error(errorBody.message || `Server responded with HTTP ${res.status}`);
    }

    const data = await res.json();

    // Sanity check: the response must have the expected shape
    if (!data || typeof data.status !== 'string' || !Array.isArray(data.won)) {
      throw new Error('Backend returned unexpected response shape — falling back to direct Bitrix fetch.');
    }

    const result: BitrixSyncResult = {
      ...data,
      lastSyncedAt: new Date(data.lastSyncedAt)
    };

    // Cache locally for instant loading on next visit
    if (result.status === 'success' && (result.won.length > 0 || result.totalFetchedDeals > 0)) {
      saveBitrixCache(result);
    }

    return result;
  } catch (err: any) {
    console.warn('[apiClient] Backend server not available:', err.message);
  }

  // Attempt 2: Try fetching bundled static cached_bitrix_deals.json from public CDN assets
  try {
    const staticRes = await fetch('/cached_bitrix_deals.json');
    if (staticRes.ok) {
      const staticData = await staticRes.json();
      if (staticData && Array.isArray(staticData.won) && (staticData.won.length > 0 || staticData.progress?.length > 0)) {
        console.log('[apiClient] Loaded deals from static CDN cache.');
        const result: BitrixSyncResult = {
          ...staticData,
          lastSyncedAt: new Date(staticData.lastSyncedAt || Date.now())
        };
        saveBitrixCache(result);
        return result;
      }
    }
  } catch (staticErr: any) {
    console.warn('[apiClient] Static CDN cache not available:', staticErr?.message);
  }

  // Attempt 3: Browser localStorage cache (instant, offline-capable)
  const storedCache = getStoredBitrixCache();
  if (storedCache && (storedCache.won.length > 0 || storedCache.progress.length > 0)) {
    console.log('[apiClient] Loaded deals from browser localStorage offline cache.');
    return storedCache;
  }

  return {
    won: [],
    lost: [],
    progress: [],
    leads: [],
    qualifiedLeadsCount: 0,
    disqualifiedLeadsCount: 0,
    inProgressLeadsCount: 0,
    totalFetchedDeals: 0,
    totalFetchedLeads: 0,
    lastSyncedAt: new Date(),
    status: 'error',
    message: 'Could not connect to backend server. Ensure the backend server is running and BITRIX_WEBHOOK_URL is configured.'
  };
}

/**
 * Ask the server to re-sync from Bitrix immediately (POST).
 * Useful for the "Sync Now" button.
 */
export async function triggerServerSync(): Promise<BitrixSyncResult> {
  try {
    const res = await fetch(`${API_BASE}/api/deals/sync`, { method: 'POST' });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new Error(errorBody.message || `Server responded with HTTP ${res.status}`);
    }

    const data = await res.json();
    const result: BitrixSyncResult = {
      ...data,
      lastSyncedAt: new Date(data.lastSyncedAt)
    };

    if (result.status === 'success') {
      saveBitrixCache(result);
    }

    return result;
  } catch (err: any) {
    console.error('[apiClient] Failed to trigger server sync:', err);
    return {
      won: [],
      lost: [],
      progress: [],
      leads: [],
      qualifiedLeadsCount: 0,
      disqualifiedLeadsCount: 0,
      inProgressLeadsCount: 0,
      totalFetchedDeals: 0,
      totalFetchedLeads: 0,
      lastSyncedAt: new Date(),
      status: 'error',
      message: err.message || 'Failed to trigger server sync. Please verify backend server is running.'
    };
  }
}

// ── Feature Flag for Server-Side Calculations ───────────────────────────

export const isServerKPIsEnabled = (): boolean => {
  return import.meta.env.VITE_USE_SERVER_KPIS !== 'false';
};

// ── SQL-Backed Dashboard Endpoints ──────────────────────────────────────

function buildQueryParams(filters: Partial<any> = {}): string {
  const qp = new URLSearchParams();
  Object.keys(filters).forEach(key => {
    const val = filters[key];
    if (val !== undefined && val !== null && val !== '' && val !== 'All') {
      qp.append(key, String(val));
    }
  });
  return qp.toString();
}

export async function fetchServerDashboardSummary(filters: any = {}): Promise<any | null> {
  try {
    const qs = buildQueryParams(filters);
    const res = await fetch(`${API_BASE}/api/dashboard/summary?${qs}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[apiClient] Failed to fetch server summary KPIs:', err);
    return null;
  }
}

export async function fetchServerRevenueAnalytics(filters: any = {}): Promise<any | null> {
  try {
    const qs = buildQueryParams(filters);
    const res = await fetch(`${API_BASE}/api/dashboard/revenue?${qs}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[apiClient] Failed to fetch server revenue analytics:', err);
    return null;
  }
}

export async function fetchServerPipelineAnalytics(filters: any = {}): Promise<any | null> {
  try {
    const qs = buildQueryParams(filters);
    const res = await fetch(`${API_BASE}/api/dashboard/pipeline?${qs}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[apiClient] Failed to fetch server pipeline analytics:', err);
    return null;
  }
}

export async function fetchServerWinRateAnalytics(filters: any = {}): Promise<any | null> {
  try {
    const qs = buildQueryParams(filters);
    const res = await fetch(`${API_BASE}/api/dashboard/win-rate?${qs}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[apiClient] Failed to fetch server win rate analytics:', err);
    return null;
  }
}

export async function fetchServerSalesRepAnalytics(filters: any = {}): Promise<any | null> {
  try {
    const qs = buildQueryParams(filters);
    const res = await fetch(`${API_BASE}/api/dashboard/sales-reps?${qs}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[apiClient] Failed to fetch server sales reps analytics:', err);
    return null;
  }
}

export async function fetchServerProjectAnalytics(filters: any = {}): Promise<any | null> {
  try {
    const qs = buildQueryParams(filters);
    const res = await fetch(`${API_BASE}/api/dashboard/projects?${qs}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[apiClient] Failed to fetch server project analytics:', err);
    return null;
  }
}

