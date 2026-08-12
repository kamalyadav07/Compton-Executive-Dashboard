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

import { getStoredBitrixCache, saveBitrixCache, fetchBitrixDeals, type BitrixSyncResult } from './bitrixService';

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

  // Attempt 2: Browser localStorage cache (instant, offline-capable)
  const storedCache = getStoredBitrixCache();
  if (storedCache && (storedCache.won.length > 0 || storedCache.progress.length > 0)) {
    console.log('[apiClient] Loaded deals from browser localStorage cache.');
    return storedCache;
  }

  // Attempt 3: Direct client-side fetch from Bitrix24 REST API
  // (works on any hosting — static, shared, CDN — as long as the
  // VITE_BITRIX_WEBHOOK_URL env var was baked into the build)
  try {
    console.log('[apiClient] Fetching deals directly from Bitrix24 API...');
    const directResult = await fetchBitrixDeals();
    if (directResult && (directResult.won.length > 0 || directResult.progress.length > 0)) {
      console.log(`[apiClient] Direct Bitrix fetch succeeded: ${directResult.won.length} won, ${directResult.lost.length} lost, ${directResult.progress.length} in-progress.`);
      saveBitrixCache(directResult);
      return directResult;
    }
  } catch (directErr: any) {
    console.error('[apiClient] Direct Bitrix fetch failed:', directErr.message);
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
    message: 'Could not load deal data. Please check your internet connection and Bitrix24 configuration.'
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
    console.error('[apiClient] Failed to trigger server sync, trying direct client sync:', err);
    try {
      return await fetchBitrixDeals();
    } catch (clientErr) {
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
        message: err.message || 'Failed to trigger server sync.'
      };
    }
  }
}

