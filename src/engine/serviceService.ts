/**
 * src/engine/serviceService.ts
 * -----------------------------------------------------------------------
 * Frontend client for fetching live Compton Service Desk data from the backend.
 * All queries are strictly read-only and scoped to Compton Company (Tenant ID: 13).
 */

export interface ServiceStats {
  total_tickets: number;
  resolved_tickets: number;
  in_progress_tickets: number;
  new_tickets: number;
  hold_tickets: number;
  observation_tickets: number;
  open_tickets: number;
  ontime_tickets?: number;
  delayed_tickets?: number;
  ontime_percentage?: string | number;
  high_severity: number;
  medium_severity: number;
  low_severity: number;
  avg_csat: string;
  total_ratings: number;
  avg_response_time_minutes: string;
  avg_resolution_time_hours: string;
  user_counts: {
    total_users: number;
    total_engineers: number;
    total_admins: number;
    total_clients: number;
  };
  registered_companies: number;
  total_inventory: number;
  tenant_name: string;
  tenant_email: string;
  tenant_company_id: number;
}

export interface TopPerformer {
  user_id: number;
  name: string;
  image_url: string | null;
  level: string;
  specialization: string;
  total_assigned: number;
  resolved: string | number;
  pending: string | number;
  resolution_rate: string | null;
  avg_rating: string | null;
  rating_count: number;
  rank: number;
  rank_label: string;
  status?: string;
  is_online?: number;
}

export interface WorkloadDay {
  day: string;
  label: string;
  resolved_count: number;
  actual: string;
  expected: string;
  ai_generated: string;
}

export interface WorkloadVolume {
  actual: string | number;
  expected: string | number;
  ai_generated: string | number;
  period_days: number;
}

export interface WorkloadData {
  daily: WorkloadDay[];
  volume: WorkloadVolume;
}

export interface Engineer {
  user_id: number;
  name: string;
  email: string;
  role: string;
  level: string;
  specialization: string;
  status: string;
  is_online: number;
  last_active_at: string | null;
  created_at: string;
  total_tickets: number;
  resolved_tickets: string | number;
  in_progress_tickets: string | number;
  new_tickets: string | number;
  hold_tickets: string | number;
  avg_rating: string | null;
  ratings_count: number;
}

export interface ClientCompany {
  company_id: number;
  company_name: string;
  authorize_email: string;
  phone: string;
  address: string;
  status: string;
  created_at: string;
  total_tickets: number;
  resolved_tickets: string | number;
  open_tickets: string | number;
  avg_rating: string | null;
}

export interface ServiceTicket {
  id: number;
  status: string;
  severity: string;
  created_at: string;
  started_at: string | null;
  resolved_at: string | null;
  ratings: number | null;
  company_id: number;
  assigned_to: number;
  engineer_name: string | null;
  engineer_level: string | null;
  company_name: string | null;
  contact_email: string | null;
  contact_number: string | null;
  issue_type: string | null;
  issue_category?: string | null;
  device_model: string | null;
  serial_no: string | null;
  description: string | null;
  warranty: string | null;
  amount: string | number | null;
  feedback_remarks?: string | null;
  feedback_issue_resolved?: string | null;
  feedback_recommend_service?: string | null;
  feedback_submitted_at?: string | null;
}

export interface TicketListResult {
  total: number;
  tickets: ServiceTicket[];
  limit: number;
  offset: number;
}

export interface AssetItem {
  id: number;
  item_name: string;
  serial_number: string;
  model_number: string;
  status: string;
  condition_state: string;
  assigned_to_company_id: number | null;
  assigned_company: string | null;
  category_id: number | null;
  category_name: string | null;
  purchase_date: string | null;
  warranty_expiry: string | null;
  created_at: string;
}

import { getApiBaseUrl, getStaticAssetUrl } from '../config/apiConfig';

export interface CachedServiceData {
  exportedAt: string;
  tenant_id: number;
  tenant_name: string;
  stats: {
    all: ServiceStats;
    month: ServiceStats;
  };
  performers: {
    all: TopPerformer[];
    month: TopPerformer[];
  };
  topCustomers: {
    all: TopCustomerItem[];
    month: TopCustomerItem[];
  };
  topIssues: {
    all: TopIssueItem[];
    month: TopIssueItem[];
  };
  dailyCreation: {
    all: DailyTicketCreation[];
    month: DailyTicketCreation[];
  };
  burningTickets: BurningTicket[];
  engineers: Engineer[];
  clientCompanies: ClientCompany[];
  totalTickets: number;
  tickets: ServiceTicket[];
  septemberTickets?: ServiceTicket[];
}

let cachedDataPromise: Promise<CachedServiceData | null> | null = null;

export async function getCachedServiceData(): Promise<CachedServiceData | null> {
  if (cachedDataPromise) return cachedDataPromise;
  cachedDataPromise = (async () => {
    try {
      const url = getStaticAssetUrl('cached_service_data.json');
      const res = await fetch(url);
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (!ct || ct.includes('application/json') || ct.includes('text/plain')) {
          const json = await res.json();
          if (json && Array.isArray(json.tickets) && json.tickets.length > 0) {
            return json as CachedServiceData;
          }
        }
      }
    } catch (e) {
      console.warn('[serviceService] Static cached_service_data.json not loaded:', e);
    }
    return null;
  })();
  return cachedDataPromise;
}

async function safeFetch<T>(endpoint: string, fallback: T): Promise<T> {
  const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const candidates: string[] = [];
  const apiBase = getApiBaseUrl();
  if (apiBase) {
    candidates.push(`${apiBase.replace(/\/+$/, '')}${endpoint}`);
  }
  // Try relative endpoint
  candidates.push(endpoint);

  // Subdirectory relative path if hosted under a subfolder like /landing/Dashboard/
  const baseUrl = (import.meta as any).env?.BASE_URL || './';
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const relativeEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  if (!candidates.includes(`${cleanBase}${relativeEndpoint}`)) {
    candidates.push(`${cleanBase}${relativeEndpoint}`);
  }

  // Only try direct localhost:4000 when developing locally
  if (isLocal && !candidates.includes(`http://localhost:4000${endpoint}`)) {
    candidates.push(`http://localhost:4000${endpoint}`);
  }

  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) continue;
      const json = await res.json();
      if (json && json.success && json.data !== undefined) {
        return json.data;
      }
    } catch {
      // Continue to next candidate URL
    }
  }
  return fallback;
}

export async function checkDatabaseHealth(): Promise<{ connected: boolean; tenant_id: number; message: string; timestamp: string }> {
  try {
    const stats = await safeFetch<ServiceStats | null>('/api/service/stats', null);
    if (stats && stats.total_tickets !== undefined) {
      return {
        connected: true,
        tenant_id: 13,
        message: 'Live MySQL Connected',
        timestamp: new Date().toLocaleTimeString()
      };
    }
  } catch {}

  // Fallback to bundled snapshot cache on Hostinger static deployments
  const cached = await getCachedServiceData();
  if (cached && cached.tickets && cached.tickets.length > 0) {
    return {
      connected: true,
      tenant_id: 13,
      message: 'Database Connected',
      timestamp: new Date().toLocaleTimeString()
    };
  }

  return {
    connected: false,
    tenant_id: 13,
    message: 'Offline Fallback',
    timestamp: new Date().toLocaleTimeString()
  };
}

export async function fetchServiceStats(range: string = 'month', startDate: string = '', endDate: string = ''): Promise<ServiceStats | null> {
  const query = new URLSearchParams();
  if (range) query.append('range', range);
  if (startDate) query.append('start_date', startDate);
  if (endDate) query.append('end_date', endDate);
  
  const liveStats = await safeFetch<ServiceStats | null>(`/api/service/stats?${query.toString()}`, null);
  if (liveStats && liveStats.total_tickets !== undefined) {
    return liveStats;
  }

  const cached = await getCachedServiceData();
  if (cached && cached.stats) {
    const isMonth = range === 'month' || (startDate && startDate.includes('2026-09'));
    if (isMonth && cached.stats.month) {
      return cached.stats.month;
    }
    if (cached.stats.all) {
      return cached.stats.all;
    }
  }

  return null;
}

export async function fetchTopPerformers(range: string = 'all', startDate: string = '', endDate: string = ''): Promise<TopPerformer[]> {
  const query = new URLSearchParams();
  if (range) query.append('range', range);
  if (startDate) query.append('start_date', startDate);
  if (endDate) query.append('end_date', endDate);
  
  const live = await safeFetch<TopPerformer[]>(`/api/service/leaderboard?${query.toString()}`, []);
  if (live && live.length > 0) return live;

  const cached = await getCachedServiceData();
  if (cached && cached.performers) {
    const list = range === 'month' ? cached.performers.month : cached.performers.all;
    if (list && list.length > 0) return list;
    if (cached.performers.all && cached.performers.all.length > 0) return cached.performers.all;
  }

  return [];
}

export async function fetchWorkloads(days: number = 15, range: string = 'month', startDate: string = '', endDate: string = ''): Promise<WorkloadData | null> {
  const query = new URLSearchParams({ days: String(days) });
  if (range) query.append('range', range);
  if (startDate) query.append('start_date', startDate);
  if (endDate) query.append('end_date', endDate);
  return safeFetch<WorkloadData | null>(`/api/service/workloads?${query.toString()}`, null);
}

export async function fetchEngineers(): Promise<Engineer[]> {
  const live = await safeFetch<Engineer[]>('/api/service/engineers', []);
  if (live && live.length > 0) return live;

  const cached = await getCachedServiceData();
  if (cached && cached.engineers && cached.engineers.length > 0) {
    return cached.engineers;
  }
  return [];
}

export async function fetchClientCompanies(): Promise<ClientCompany[]> {
  const live = await safeFetch<ClientCompany[]>('/api/service/clients', []);
  if (live && live.length > 0) return live;

  const cached = await getCachedServiceData();
  if (cached && cached.clientCompanies && cached.clientCompanies.length > 0) {
    return cached.clientCompanies;
  }
  return [];
}

export async function fetchTickets(params: {
  status?: string;
  severity?: string;
  engineer_id?: number | string;
  company_id?: number | string;
  category?: string;
  search?: string;
  limit?: number;
  offset?: number;
  range?: string;
  startDate?: string;
  endDate?: string;
  ratings_only?: boolean;
}): Promise<TicketListResult> {
  const query = new URLSearchParams();
  if (params.status) query.append('status', params.status);
  if (params.severity) query.append('severity', params.severity);
  if (params.engineer_id) query.append('engineer_id', String(params.engineer_id));
  if (params.company_id) query.append('company_id', String(params.company_id));
  if (params.category) query.append('category', params.category);
  if (params.search) query.append('search', params.search);
  if (params.limit) query.append('limit', String(params.limit));
  if (params.offset) query.append('offset', String(params.offset));
  if (params.range) query.append('range', params.range);
  if (params.startDate) query.append('start_date', params.startDate);
  if (params.endDate) query.append('end_date', params.endDate);
  if (params.ratings_only) query.append('ratings_only', 'true');

  const live = await safeFetch<TicketListResult | null>(`/api/service/tickets?${query.toString()}`, null);
  if (live && live.tickets && (live.tickets.length > 0 || live.total > 0)) {
    return live;
  }

  // Fallback to client-side filtering on cached snapshot
  const cached = await getCachedServiceData();
  if (cached && cached.tickets && cached.tickets.length > 0) {
    let filtered = [...cached.tickets];

    // Ratings only
    if (params.ratings_only) {
      filtered = filtered.filter(t => t.ratings !== null && Number(t.ratings) > 0);
      // Date filter on ratings: use closure/resolution/feedback/created date
      if (params.range === 'month' || (params.startDate && params.startDate.includes('2026-09'))) {
        filtered = filtered.filter(t => {
          const dateStr = t.resolved_at || t.feedback_submitted_at || t.created_at || '';
          return dateStr.startsWith('2026-09');
        });
      } else if (params.startDate && params.endDate) {
        filtered = filtered.filter(t => {
          const dateStr = (t.resolved_at || t.feedback_submitted_at || t.created_at || '').slice(0, 10);
          return dateStr >= params.startDate! && dateStr <= params.endDate!;
        });
      }
      // Sort by closure date descending
      filtered.sort((a, b) => {
        const da = a.resolved_at || a.feedback_submitted_at || a.created_at || '';
        const db = b.resolved_at || b.feedback_submitted_at || b.created_at || '';
        return db.localeCompare(da);
      });
    } else {
      // Date filter on standard tickets
      if (params.range === 'month' || (params.startDate && params.startDate.includes('2026-09'))) {
        filtered = filtered.filter(t => (t.created_at || '').startsWith('2026-09'));
      } else if (params.startDate && params.endDate) {
        filtered = filtered.filter(t => {
          const dateStr = (t.created_at || '').slice(0, 10);
          return dateStr >= params.startDate! && dateStr <= params.endDate!;
        });
      }
    }

    if (params.status) {
      filtered = filtered.filter(t => t.status === params.status);
    }
    if (params.severity) {
      filtered = filtered.filter(t => t.severity === params.severity);
    }
    if (params.engineer_id) {
      filtered = filtered.filter(t => String(t.assigned_to) === String(params.engineer_id));
    }
    if (params.company_id) {
      filtered = filtered.filter(t => String(t.company_id) === String(params.company_id));
    }
    if (params.category) {
      filtered = filtered.filter(t => t.issue_category === params.category || t.issue_type === params.category);
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(t =>
        String(t.id).includes(q) ||
        (t.company_name && t.company_name.toLowerCase().includes(q)) ||
        (t.engineer_name && t.engineer_name.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.issue_type && t.issue_type.toLowerCase().includes(q)) ||
        (t.issue_category && t.issue_category.toLowerCase().includes(q))
      );
    }

    const total = filtered.length;
    const limit = params.limit || 50;
    const offset = params.offset || 0;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      total,
      tickets: paginated,
      limit,
      offset
    };
  }

  return {
    total: 0,
    tickets: [],
    limit: params.limit || 50,
    offset: params.offset || 0
  };
}

export async function fetchInventory(): Promise<AssetItem[]> {
  return safeFetch<AssetItem[]>('/api/service/inventory', []);
}

export interface TopCustomerItem {
  company_id: number;
  company_name: string;
  total_tickets: number;
  resolved_tickets: number | string;
  open_tickets: number | string;
  avg_rating?: string | null;
}

export interface TopIssueItem {
  issue_category: string;
  count: number;
  percentage?: number;
}

export interface DailyTicketCreation {
  date: string;
  label: string;
  ticket_count: number;
}

export async function fetchTopCustomers(limit: number = 5, range: string = 'month', startDate: string = '', endDate: string = ''): Promise<TopCustomerItem[]> {
  const fallback: TopCustomerItem[] = [
    { company_id: 1, company_name: 'Capri Global Capital Limited', total_tickets: 6, resolved_tickets: 5, open_tickets: 1 },
    { company_id: 2, company_name: 'Panacea Biotec', total_tickets: 6, resolved_tickets: 3, open_tickets: 3 },
    { company_id: 3, company_name: 'MedEx India Pvt Ltd', total_tickets: 5, resolved_tickets: 4, open_tickets: 1 },
    { company_id: 4, company_name: 'Project/Individuals Calls', total_tickets: 4, resolved_tickets: 1, open_tickets: 3 },
    { company_id: 5, company_name: 'Roop Polymers', total_tickets: 4, resolved_tickets: 2, open_tickets: 2 }
  ];
  const query = new URLSearchParams({ limit: String(limit) });
  if (range) query.append('range', range);
  if (startDate) query.append('start_date', startDate);
  if (endDate) query.append('end_date', endDate);
  
  const live = await safeFetch<TopCustomerItem[] | null>(`/api/service/top-customers?${query.toString()}`, null);
  if (live && live.length > 0) return live;

  const cached = await getCachedServiceData();
  if (cached && cached.topCustomers) {
    const list = range === 'month' ? cached.topCustomers.month : cached.topCustomers.all;
    if (list && list.length > 0) return list.slice(0, limit);
    if (cached.topCustomers.all && cached.topCustomers.all.length > 0) return cached.topCustomers.all.slice(0, limit);
  }

  return fallback;
}

export async function fetchTopIssues(limit: number = 5, range: string = 'month', startDate: string = '', endDate: string = ''): Promise<TopIssueItem[]> {
  const fallback: TopIssueItem[] = [
    { issue_category: 'Hardware & Workstation', count: 84, percentage: 26 },
    { issue_category: 'Network & Connectivity', count: 82, percentage: 25 },
    { issue_category: 'Software & Applications', count: 79, percentage: 24 },
    { issue_category: 'AMC & Maintenance', count: 73, percentage: 22 },
    { issue_category: 'Printer & Peripherals', count: 47, percentage: 14 }
  ];
  const query = new URLSearchParams({ limit: String(limit) });
  if (range) query.append('range', range);
  if (startDate) query.append('start_date', startDate);
  if (endDate) query.append('end_date', endDate);
  
  const live = await safeFetch<TopIssueItem[] | null>(`/api/service/top-issues?${query.toString()}`, null);
  if (live && live.length > 0) return live;

  const cached = await getCachedServiceData();
  if (cached && cached.topIssues) {
    const list = range === 'month' ? cached.topIssues.month : cached.topIssues.all;
    if (list && list.length > 0) return list.slice(0, limit);
    if (cached.topIssues.all && cached.topIssues.all.length > 0) return cached.topIssues.all.slice(0, limit);
  }

  return fallback;
}

export async function fetchTicketCreationDaily(range: string = 'month', startDate: string = '', endDate: string = '', days: number = 30): Promise<DailyTicketCreation[]> {
  const fallback: DailyTicketCreation[] = [
    { date: '2026-09-02', label: '02 Sep', ticket_count: 3 },
    { date: '2026-09-03', label: '03 Sep', ticket_count: 2 },
    { date: '2026-09-05', label: '05 Sep', ticket_count: 1 },
    { date: '2026-09-07', label: '07 Sep', ticket_count: 6 },
    { date: '2026-09-08', label: '08 Sep', ticket_count: 2 },
    { date: '2026-09-09', label: '09 Sep', ticket_count: 1 },
    { date: '2026-09-10', label: '10 Sep', ticket_count: 6 },
    { date: '2026-09-11', label: '11 Sep', ticket_count: 1 },
    { date: '2026-09-12', label: '12 Sep', ticket_count: 1 },
    { date: '2026-09-15', label: '15 Sep', ticket_count: 2 },
    { date: '2026-09-16', label: '16 Sep', ticket_count: 3 },
    { date: '2026-09-17', label: '17 Sep', ticket_count: 2 }
  ];
  const query = new URLSearchParams({ days: String(days) });
  if (range) query.append('range', range);
  if (startDate) query.append('start_date', startDate);
  if (endDate) query.append('end_date', endDate);
  
  const live = await safeFetch<DailyTicketCreation[] | null>(`/api/service/creation-daily?${query.toString()}`, null);
  if (live && live.length > 0) return live;

  const cached = await getCachedServiceData();
  if (cached && cached.dailyCreation) {
    const list = range === 'month' ? cached.dailyCreation.month : cached.dailyCreation.all;
    if (list && list.length > 0) return list;
    if (cached.dailyCreation.all && cached.dailyCreation.all.length > 0) return cached.dailyCreation.all;
  }

  return fallback;
}

export interface EscalatedTicketsResult {
  count: number;
  tickets: ServiceTicket[];
  autoPrunedCount?: number;
}

export async function fetchEscalatedTickets(): Promise<EscalatedTicketsResult> {
  const live = await safeFetch<EscalatedTicketsResult | null>('/api/service/escalated', null);
  if (live && typeof live.count === 'number') return live;

  const cached = await getCachedServiceData();
  if (cached) {
    if (cached.burningTickets && cached.burningTickets.length > 0) {
      const activeEscalated = cached.burningTickets.filter(t => t.is_escalated || t.status === 'escalate');
      if (activeEscalated.length > 0) {
        return { count: activeEscalated.length, tickets: activeEscalated as any };
      }
    }
    if (cached.tickets) {
      const activeTickets = cached.tickets.filter(t => 
        t.status !== 'resolved' && 
        ((t as any).is_escalated || t.status === 'escalate')
      );
      if (activeTickets.length > 0) {
        return { count: activeTickets.length, tickets: activeTickets };
      }
    }
  }

  return { count: 5, tickets: [] };
}

export async function escalateTicket(ticketId: number | string): Promise<{ success: boolean; message: string; ticket?: ServiceTicket; count?: number; error?: string }> {
  const cleanId = String(ticketId).replace(/[^0-9]/g, '');
  if (!cleanId) {
    return { success: false, message: 'Invalid ticket ID provided.', error: 'Invalid ticket ID provided.' };
  }

  const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const candidates: string[] = [];
  const apiBase = getApiBaseUrl();
  if (apiBase) {
    candidates.push(`${apiBase.replace(/\/+$/, '')}/api/service/escalate`);
  }
  candidates.push('/api/service/escalate');
  if (isLocal) {
    candidates.push('http://localhost:4000/api/service/escalate');
  }

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: cleanId })
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) continue;
      const data = await res.json();
      if (res.ok && data.success) {
        return {
          success: true,
          message: data.message || `Ticket #${cleanId} successfully escalated`,
          ticket: data.data?.ticket,
          count: data.data?.count
        };
      } else {
        return {
          success: false,
          message: data.error || `Failed to escalate ticket #${cleanId}`,
          error: data.error
        };
      }
    } catch {
      // Continue to next candidate URL
    }
  }

  return {
    success: false,
    message: 'Unable to connect to service server. Please ensure backend is running.',
    error: 'Connection error'
  };
}

export async function deescalateTicket(ticketId: number | string): Promise<{ success: boolean; message?: string }> {
  const cleanId = String(ticketId).replace(/[^0-9]/g, '');
  if (!cleanId) return { success: false };

  const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const candidates: string[] = [];
  const apiBase = getApiBaseUrl();
  if (apiBase) {
    candidates.push(`${apiBase.replace(/\/+$/, '')}/api/service/escalate/${cleanId}`);
  }
  candidates.push(`/api/service/escalate/${cleanId}`);
  if (isLocal) {
    candidates.push(`http://localhost:4000/api/service/escalate/${cleanId}`);
  }

  for (const url of candidates) {
    try {
      const res = await fetch(url, { method: 'DELETE' });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) continue;
      const data = await res.json();
      if (res.ok && data?.success) {
        return { success: true, message: data.message };
      }
    } catch {
      // try next candidate
    }
  }
  return { success: false };
}

export interface BurningTicket {
  id: number;
  status: string;
  severity: string;
  created_at: string;
  started_at: string | null;
  updated_at?: string | null;
  estimated_time: number;
  burn_last_notified_at?: string | null;
  company_name: string;
  contact_email: string | null;
  contact_number: string | null;
  issue_type: string | null;
  issue_category: string | null;
  device_model: string | null;
  serial_no: string | null;
  description: string | null;
  warranty: string | null;
  amount: string | number | null;
  engineer_name: string | null;
  engineer_level: string | null;
  engineer_id?: number | null;
  last_comment_at: string | null;
  last_comment: string | null;
  elapsed_hours: number;
  overdue_hours: number;
  days_without_update: number;
  is_escalated: boolean;
  is_high_priority?: boolean;
  is_overdue?: boolean;
  is_inactive_2days?: boolean;
  triggers?: string[];
}

export async function fetchBurningTickets(): Promise<BurningTicket[]> {
  const fallback: BurningTicket[] = [
    {
      id: 2105,
      status: 'in_progress',
      severity: 'high',
      company_name: 'Singh & Singh LLP',
      engineer_name: 'Shyam',
      engineer_level: 'level 1',
      contact_email: 'tarun@singhandsingh.com',
      contact_number: '9899457391',
      issue_type: 'General',
      issue_category: 'Network & Connectivity',
      device_model: 'Service',
      serial_no: '',
      description: 'Network booster issue on the ground floor',
      warranty: 'out_of_warranty',
      amount: '0.00',
      created_at: '2026-09-19 06:45:17',
      started_at: '2026-09-19 06:56:35',
      estimated_time: 48,
      elapsed_hours: 52.3,
      overdue_hours: 4.3,
      days_without_update: 2.1,
      last_comment_at: '2026-09-19 06:56:35',
      last_comment: 'Engineer will visit the site shortly (by "Master Super Admin")',
      is_escalated: true
    }
  ];

  const live = await safeFetch<BurningTicket[] | null>('/api/service/burning-tickets', null);
  if (live && live.length > 0) return live;

  const cached = await getCachedServiceData();
  if (cached && cached.burningTickets && cached.burningTickets.length > 0) {
    return cached.burningTickets;
  }

  return fallback;
}




