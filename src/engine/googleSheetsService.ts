import type { DealRecord, UploadValidationReport } from '../types/sales';
import { parseRawContent, validateAndSanitizeData } from './dataParser';
import { convertToCsvExportUrl, type GoogleSheetsConfig } from '../config/sheetsConfig';

export interface SheetFetchStatus {
  url: string;
  status: 'success' | 'error' | 'loading' | 'permission_error';
  recordCount: number;
  message?: string;
}

export interface GoogleSheetsSyncResult {
  won: DealRecord[];
  lost: DealRecord[];
  progress: DealRecord[];
  report: UploadValidationReport | null;
  statuses: {
    won: SheetFetchStatus;
    lost: SheetFetchStatus;
    progress: SheetFetchStatus;
  };
  lastSyncedAt: Date;
}

const fetchSingleSheet = async (
  rawUrl: string,
  dealType: 'won' | 'lost' | 'in_progress'
): Promise<{ records: DealRecord[]; columns: string[]; status: SheetFetchStatus }> => {
  const csvUrl = convertToCsvExportUrl(rawUrl);

  try {
    const response = await fetch(csvUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/csv,text/plain,application/csv,*/*'
      }
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return {
          records: [],
          columns: [],
          status: {
            url: rawUrl,
            status: 'permission_error',
            recordCount: 0,
            message: 'Sheet is private. Change sharing settings to "Anyone with link can view".'
          }
        };
      }
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const text = await response.text();

    // Check if Google returned HTML login page instead of CSV
    if (text.includes('<!DOCTYPE html>') || text.includes('<html') || text.includes('accounts.google.com')) {
      return {
        records: [],
        columns: [],
        status: {
          url: rawUrl,
          status: 'permission_error',
          recordCount: 0,
          message: 'Permission Required: Please set Google Sheet access to "Anyone with link can view".'
        }
      };
    }

    const { records, detectedColumns } = parseRawContent(text, dealType);

    return {
      records,
      columns: detectedColumns,
      status: {
        url: rawUrl,
        status: 'success',
        recordCount: records.length,
        message: `Successfully loaded ${records.length} records.`
      }
    };
  } catch (err: any) {
    console.error(`Error fetching Google Sheet (${dealType}):`, err);
    return {
      records: [],
      columns: [],
      status: {
        url: rawUrl,
        status: 'error',
        recordCount: 0,
        message: err.message || 'Failed to fetch Google Sheet data.'
      }
    };
  }
};

export const syncAllGoogleSheets = async (
  config: GoogleSheetsConfig
): Promise<GoogleSheetsSyncResult> => {
  const [wonResult, lostResult, progressResult] = await Promise.all([
    fetchSingleSheet(config.wonDealsUrl, 'won'),
    fetchSingleSheet(config.lostDealsUrl, 'lost'),
    fetchSingleSheet(config.inProgressDealsUrl, 'in_progress')
  ]);

  const { won, lost, progress, report } = validateAndSanitizeData(
    wonResult.records,
    lostResult.records,
    progressResult.records,
    wonResult.columns,
    lostResult.columns,
    progressResult.columns
  );

  return {
    won,
    lost,
    progress,
    report,
    statuses: {
      won: wonResult.status,
      lost: lostResult.status,
      progress: progressResult.status
    },
    lastSyncedAt: new Date()
  };
};
