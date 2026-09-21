/**
 * src/config/apiConfig.ts
 * -----------------------------------------------------------------------
 * Centralized API base URL resolver.
 *
 * Ensures that:
 * 1. In local dev (localhost:3000), it connects to http://localhost:4000
 * 2. In production deployments (e.g. Hostinger, Vercel, Cloudflare), it prevents
 *    calling http://localhost:4000 (which triggers browser Mixed Content HTTPS blocks).
 * 3. If a production VITE_API_BASE_URL is provided (e.g. https://api.compton.com),
 *    it routes cleanly to that endpoint.
 */

export function getApiBaseUrl(): string {
  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL || '';
  if (typeof window !== 'undefined') {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      // Local development: connect to local Express server
      return envUrl || 'http://localhost:4000';
    }
    // Remote production deployment (e.g. Hostinger compton.in)
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      return envUrl.replace(/\/+$/, '');
    }
    // Default production backend on Compton VPS with valid Let's Encrypt SSL
    return 'https://backendhelpdesk.compton.in';
  }
  return envUrl && !envUrl.includes('localhost') ? envUrl.replace(/\/+$/, '') : 'https://backendhelpdesk.compton.in';
}

export function getStaticAssetUrl(assetPath: string): string {
  const baseUrl = (import.meta as any).env?.BASE_URL || './';
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const cleanPath = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;
  return `${cleanBase}${cleanPath}`;
}
