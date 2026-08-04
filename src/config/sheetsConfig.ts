export interface GoogleSheetsConfig {
  wonDealsUrl: string;
  lostDealsUrl: string;
  inProgressDealsUrl: string;
  autoRefreshSeconds: number;
}

export const DEFAULT_SHEETS_CONFIG: GoogleSheetsConfig = {
  wonDealsUrl: "https://docs.google.com/spreadsheets/d/1-HRp_m7bQkFUifOEV8wI8Yn2OpAMJtOnu6mH-lxUbfU/edit?gid=0#gid=0",
  lostDealsUrl: "https://docs.google.com/spreadsheets/d/16fuiVZUB5GC-RvVicpeieicVg7KmQAX2UNiQ3Fo5l0Q/edit?gid=0#gid=0",
  inProgressDealsUrl: "https://docs.google.com/spreadsheets/d/1vLQAbqhtNGZQSX_Vs5OA6d9HWXrA5zg_JS6wjKTZQeQ/edit?gid=0#gid=0",
  autoRefreshSeconds: 60
};

const STORAGE_KEY = 'sales_dashboard_google_sheets_config';

export const getStoredSheetsConfig = (): GoogleSheetsConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        wonDealsUrl: parsed.wonDealsUrl || DEFAULT_SHEETS_CONFIG.wonDealsUrl,
        lostDealsUrl: parsed.lostDealsUrl || DEFAULT_SHEETS_CONFIG.lostDealsUrl,
        inProgressDealsUrl: parsed.inProgressDealsUrl || DEFAULT_SHEETS_CONFIG.inProgressDealsUrl,
        autoRefreshSeconds: parsed.autoRefreshSeconds || 60
      };
    }
  } catch (err) {
    console.warn("Could not load stored Google Sheets config, using default", err);
  }
  return DEFAULT_SHEETS_CONFIG;
};

export const saveSheetsConfig = async (config: GoogleSheetsConfig): Promise<boolean> => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));

    // Also save to backend server endpoint if available
    try {
      await fetch('/api/sheets-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
    } catch {
      // Ignore if backend API endpoint is not active
    }
    return true;
  } catch (err) {
    console.error("Failed to save sheets config", err);
    return false;
  }
};

/**
 * Converts any standard Google Sheet URL into direct CSV export / gviz URL format
 */
export const convertToCsvExportUrl = (url: string): string => {
  if (!url) return '';
  const trimmed = url.trim();

  // If already in CSV export format
  if (trimmed.includes('/export?format=csv') || trimmed.includes('/gviz/tq?tqx=out:csv') || trimmed.includes('/pub?output=csv')) {
    return trimmed;
  }

  // Extract Spreadsheet ID
  const idMatch = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return trimmed;

  const id = idMatch[1];

  // Extract GID
  let gid = '0';
  const gidMatch = trimmed.match(/[?&]gid=(\d+)/) || trimmed.match(/#gid=(\d+)/);
  if (gidMatch) {
    gid = gidMatch[1];
  }

  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`;
};
