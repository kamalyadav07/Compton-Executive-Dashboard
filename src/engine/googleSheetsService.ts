import { convertToCsvExportUrl, type GoogleSheetsConfig } from '../config/sheetsConfig';

export interface SheetFetchStatus {
  url: string;
  status: 'success' | 'error' | 'loading' | 'permission_error';
  recordCount: number;
  message?: string;
}

export interface ProjectsSheetSyncResult {
  projects: any[];
  status: SheetFetchStatus;
  lastSyncedAt: Date;
}

export const fetchProjectsSheet = async (
  rawUrl: string
): Promise<{ projects: any[]; status: SheetFetchStatus }> => {
  if (!rawUrl) {
    return {
      projects: [],
      status: {
        url: '',
        status: 'error',
        recordCount: 0,
        message: 'No Project Sheet URL configured.'
      }
    };
  }

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
          projects: [],
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

    if (text.includes('<!DOCTYPE html>') || text.includes('<html') || text.includes('accounts.google.com')) {
      return {
        projects: [],
        status: {
          url: rawUrl,
          status: 'permission_error',
          recordCount: 0,
          message: 'Permission Required: Please set Google Sheet access to "Anyone with link can view".'
        }
      };
    }

    // Parse CSV lines into project objects
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    const projects: any[] = [];
    if (lines.length > 1) {
      const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
      for (let i = 1; i < lines.length; i++) {
        const rowVals = lines[i].split(',').map(v => v.replace(/^"|"$/g, '').trim());
        const projectObj: Record<string, any> = {};
        headers.forEach((h, idx) => {
          projectObj[h || `Col_${idx}`] = rowVals[idx] || '';
        });
        projects.push(projectObj);
      }
    }

    return {
      projects,
      status: {
        url: rawUrl,
        status: 'success',
        recordCount: projects.length,
        message: `Successfully loaded ${projects.length} project records.`
      }
    };
  } catch (err: any) {
    console.error("Error fetching Projects Google Sheet:", err);
    return {
      projects: [],
      status: {
        url: rawUrl,
        status: 'error',
        recordCount: 0,
        message: err.message || 'Failed to fetch Projects Google Sheet data.'
      }
    };
  }
};

export const syncProjectsGoogleSheet = async (
  config: GoogleSheetsConfig
): Promise<ProjectsSheetSyncResult> => {
  const result = await fetchProjectsSheet(config.projectsSheetUrl);
  return {
    projects: result.projects,
    status: result.status,
    lastSyncedAt: new Date()
  };
};
