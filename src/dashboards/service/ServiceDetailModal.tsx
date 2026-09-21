import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Search,
  Building2,
  FileSpreadsheet,
  AlertTriangle,
  Star,
  Download,
  Filter,
  RotateCcw,
  ShieldAlert,
  Plus,
  Loader2,
  Trash2,
  RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  fetchTickets,
  fetchEscalatedTickets,
  escalateTicket,
  deescalateTicket,
  type ServiceTicket
} from '../../engine/serviceService';

export const TAB_DEFS = [
  { id: 'all', label: 'All Records' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'hold', label: 'On Hold' },
  { id: 'observation', label: 'Observation' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'delayed', label: 'Delayed' }
];

export const getTabsForKpi = (kpiKey?: string): { id: string; label: string }[] => {
  if (kpiKey === 'escalated') {
    // Escalated tickets are active incidents only - resolved tickets automatically exit this KPI
    return [
      { id: 'all', label: 'All Escalated' },
      { id: 'in_progress', label: 'In Progress' },
      { id: 'hold', label: 'On Hold' },
      { id: 'observation', label: 'Observation' },
      { id: 'delayed', label: 'Delayed (>48h)' }
    ];
  }
  if (kpiKey === 'in_progress') {
    return [
      { id: 'in_progress', label: 'All In Progress' },
      { id: 'delayed', label: 'Delayed (>48h)' }
    ];
  }
  if (kpiKey === 'hold') {
    return [
      { id: 'hold', label: 'All On Hold' },
      { id: 'delayed', label: 'Delayed (>48h)' }
    ];
  }
  if (kpiKey === 'observation') {
    return [
      { id: 'observation', label: 'All Observation' },
      { id: 'delayed', label: 'Delayed (>48h)' }
    ];
  }
  if (kpiKey === 'delayed') {
    return [
      { id: 'delayed', label: 'All Delayed' },
      { id: 'in_progress', label: 'In Progress' },
      { id: 'hold', label: 'On Hold' },
      { id: 'observation', label: 'Observation' },
      { id: 'resolved', label: 'Resolved (Breached)' }
    ];
  }
  if (kpiKey === 'csat') {
    return [
      { id: 'resolved', label: 'All Rated' },
      { id: '5_star', label: '5 Star' },
      { id: '4_star', label: '4 Star' },
      { id: '3_star_below', label: '≤ 3 Star' }
    ];
  }
  if (kpiKey === 'mttr') {
    return [
      { id: 'resolved', label: 'All Resolved' },
      { id: 'ontime', label: 'Ontime (≤48h)' },
      { id: 'delayed', label: 'Delayed (>48h)' }
    ];
  }
  if (kpiKey === 'ontime') {
    return [
      { id: 'ontime', label: 'All Ontime (≤48h)' }
    ];
  }
  return TAB_DEFS;
};

export const isTicketInTab = (t: ServiceTicket, tabId: string): boolean => {
  if (tabId === 'all') return true;
  if (tabId === 'resolved') return t.status === 'resolved' || (t.ratings !== null && Number(t.ratings) > 0);
  if (tabId === 'in_progress') return t.status === 'in_progress';
  if (tabId === 'hold') return t.status === 'hold';
  if (tabId === 'observation') return t.status === 'observation';
  if (tabId === 'delayed') {
    return t.status === 'delayed' || Boolean(t.created_at && (
      ((t.resolved_at ? new Date(t.resolved_at).getTime() : Date.now()) - new Date(t.created_at).getTime()) / (1000 * 60 * 60) > 48
    ));
  }
  if (tabId === '5_star') return Number(t.ratings) === 5;
  if (tabId === '4_star') return Number(t.ratings) === 4;
  if (tabId === '3_star_below') return t.ratings !== null && Number(t.ratings) <= 3 && Number(t.ratings) > 0;
  if (tabId === 'ontime') {
    if (t.status !== 'resolved') return false;
    if (t.created_at && t.resolved_at) {
      const diffHours = (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
      return diffHours <= 48;
    }
    return true;
  }
  return t.status === tabId;
};

export const ticketMatchesFilter = (t: ServiceTicket, severity: string, query: string): boolean => {
  if (severity !== 'all' && t.severity?.toLowerCase() !== severity) return false;
  if (query.trim()) {
    const q = query.toLowerCase();
    const matchesId = String(t.id).includes(q);
    const matchesCompany = t.company_name?.toLowerCase().includes(q) || false;
    const matchesEmail = t.contact_email?.toLowerCase().includes(q) || false;
    const matchesEng = t.engineer_name?.toLowerCase().includes(q) || false;
    const matchesIssue = t.issue_type?.toLowerCase().includes(q) || false;
    const matchesDevice = t.device_model?.toLowerCase().includes(q) || false;
    const matchesSerial = t.serial_no?.toLowerCase().includes(q) || false;
    const matchesDesc = t.description?.toLowerCase().includes(q) || false;
    const matchesRemark = t.feedback_remarks?.toLowerCase().includes(q) || false;
    return matchesId || matchesCompany || matchesEmail || matchesEng || matchesIssue || matchesDevice || matchesSerial || matchesDesc || matchesRemark;
  }
  return true;
};

export interface ServiceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  initialStatus?: string;
  kpiKey?: string;
  engineerId?: number;
  engineerName?: string;
  companyId?: number;
  companyName?: string;
  category?: string;
  dateRange?: string;
  startDate?: string;
  endDate?: string;
  onEscalatedCountChange?: (count: number) => void;
}

// Resilient realistic mock tickets for offline presentation
const FALLBACK_TICKETS: ServiceTicket[] = [
  {
    id: 1042,
    status: 'resolved',
    severity: 'high',
    created_at: '2026-09-17 09:30:00',
    started_at: '2026-09-17 09:45:00',
    resolved_at: '2026-09-17 11:15:00',
    ratings: 5,
    company_id: 1,
    assigned_to: 445,
    engineer_name: 'Kunal Grover',
    engineer_level: 'level 3',
    company_name: 'Capri Global Capital Limited',
    contact_email: 'support@capriglobal.in',
    contact_number: '+91 98201 44321',
    issue_type: 'Server & Cloud',
    device_model: 'Dell PowerEdge R750',
    serial_no: 'DELL-SRV-9912',
    description: 'Hyper-V host VM replication degraded during peak transaction window.',
    warranty: 'Under Warranty',
    amount: null
  },
  {
    id: 1041,
    status: 'in_progress',
    severity: 'medium',
    created_at: '2026-09-17 10:12:00',
    started_at: '2026-09-17 10:30:00',
    resolved_at: null,
    ratings: null,
    company_id: 2,
    assigned_to: 467,
    engineer_name: 'Praveen Singh',
    engineer_level: 'level 1',
    company_name: 'Panacea Biotec',
    contact_email: 'it@panaceabiotec.com',
    contact_number: '+91 98110 32190',
    issue_type: 'Hardware & Workstation',
    device_model: 'Lenovo ThinkCentre M70q',
    serial_no: 'LNV-TC-4001',
    description: 'Executive desktop unexpected thermal throttling. Applied thermal paste and BIOS fan curve patch.',
    warranty: 'Under Warranty',
    amount: null
  },
  {
    id: 1039,
    status: 'resolved',
    severity: 'medium',
    created_at: '2026-09-16 14:20:00',
    started_at: '2026-09-16 14:35:00',
    resolved_at: '2026-09-16 15:45:00',
    ratings: 5,
    company_id: 3,
    assigned_to: 387,
    engineer_name: 'Shyam',
    engineer_level: 'level 1',
    company_name: 'MedEx India Pvt Ltd',
    contact_email: 'admin@medexindia.com',
    contact_number: '+91 99200 11234',
    issue_type: 'CCTV, VC Mic',
    device_model: 'Hikvision NVR 32CH',
    serial_no: 'HIK-NVR-4410',
    description: 'IP camera stream drops on Switch port 18. Re-terminated CAT6 keystone.',
    warranty: 'Under Warranty',
    amount: null
  },
  {
    id: 1038,
    status: 'hold',
    severity: 'high',
    created_at: '2026-09-16 11:05:00',
    started_at: '2026-09-16 11:20:00',
    resolved_at: null,
    ratings: null,
    company_id: 4,
    assigned_to: 489,
    engineer_name: 'Saif Ali Khan',
    engineer_level: 'level 2',
    company_name: 'Project Calls',
    contact_email: 'ops@projectcalls.org',
    contact_number: '+91 98711 55432',
    issue_type: 'Firewall & Network',
    device_model: 'Fortinet FortiGate 100F',
    serial_no: 'FG-100F-8893',
    description: 'Awaiting OEM license renewal token for SSL-VPN gateway authentication.',
    warranty: 'Under Warranty',
    amount: null
  },
  {
    id: 1035,
    status: 'observation',
    severity: 'low',
    created_at: '2026-09-15 15:40:00',
    started_at: '2026-09-15 16:00:00',
    resolved_at: null,
    ratings: null,
    company_id: 5,
    assigned_to: 445,
    engineer_name: 'Kunal Grover',
    engineer_level: 'level 3',
    company_name: 'Roop Polymers',
    contact_email: 'plant.it@rooppolymers.com',
    contact_number: '+91 97180 99432',
    issue_type: 'Printer & Peripherals',
    device_model: 'HP LaserJet Enterprise M608',
    serial_no: 'HP-M608-2231',
    description: 'Post-fuser roller replacement 48-hour thermal observation check.',
    warranty: 'Under AMC',
    amount: null
  },
  {
    id: 1033,
    status: 'delayed',
    severity: 'high',
    created_at: '2026-09-14 09:15:00',
    started_at: '2026-09-14 09:30:00',
    resolved_at: null,
    ratings: null,
    company_id: 1,
    assigned_to: 467,
    engineer_name: 'Praveen Singh',
    engineer_level: 'level 1',
    company_name: 'Capri Global Capital Limited',
    contact_email: 'support@capriglobal.in',
    contact_number: '+91 98201 44321',
    issue_type: 'Network & Connectivity',
    device_model: 'Cisco Catalyst 9300',
    serial_no: 'CSCO-9300-1122',
    description: 'SFP+ 10G fiber transceiver failure. Escalated to vendor spare logistics.',
    warranty: 'Under Warranty',
    amount: null
  },
  {
    id: 1029,
    status: 'resolved',
    severity: 'low',
    created_at: '2026-09-12 13:10:00',
    started_at: '2026-09-12 13:20:00',
    resolved_at: '2026-09-12 14:00:00',
    ratings: 5,
    company_id: 2,
    assigned_to: 445,
    engineer_name: 'Kunal Grover',
    engineer_level: 'level 3',
    company_name: 'Panacea Biotec',
    contact_email: 'it@panaceabiotec.com',
    contact_number: '+91 98110 32190',
    issue_type: 'Software & Applications',
    device_model: 'Microsoft 365 Exchange',
    serial_no: 'MS-M365-CLOUD',
    description: 'Exchange hybrid mail routing certificate renewed and verified.',
    warranty: 'Under AMC',
    amount: null
  },
  {
    id: 1024,
    status: 'resolved',
    severity: 'medium',
    created_at: '2026-09-10 11:00:00',
    started_at: '2026-09-10 11:15:00',
    resolved_at: '2026-09-10 13:30:00',
    ratings: 4,
    company_id: 3,
    assigned_to: 387,
    engineer_name: 'Shyam',
    engineer_level: 'level 1',
    company_name: 'MedEx India Pvt Ltd',
    contact_email: 'admin@medexindia.com',
    contact_number: '+91 99200 11234',
    issue_type: 'Hardware & Workstation',
    device_model: 'HP ProDesk 400 G7',
    serial_no: 'HP-PD400-9921',
    description: 'SMPS PSU fan noisy. Replaced with genuine HP 260W power unit.',
    warranty: 'Under AMC',
    amount: null
  }
];

export const ServiceDetailModal: React.FC<ServiceDetailModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: _icon,
  initialStatus = 'all',
  kpiKey,
  engineerId,
  engineerName,
  companyId,
  companyName,
  category,
  dateRange,
  startDate,
  endDate,
  onEscalatedCountChange
}) => {
  const isAllTime = kpiKey === 'in_progress' || kpiKey === 'hold' || kpiKey === 'observation' ||
                    initialStatus === 'in_progress' || initialStatus === 'hold' || initialStatus === 'observation' ||
                    Boolean(engineerId);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string>(initialStatus);
  const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExportExporting] = useState(false);

  // Escalated Tickets Specific State
  const [inputTicketId, setInputTicketId] = useState('');
  const [isEscalating, setIsEscalating] = useState(false);
  const [escalateFeedback, setEscalateFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isDeescalatingId, setIsDeescalatingId] = useState<number | null>(null);

  // Tab change handler: auto-resets severity filter to 'all' so switching tabs always displays all tickets of that status
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (severityFilter !== 'all') {
      setSeverityFilter('all');
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setSearchTerm('');
      setSeverityFilter('all');
      const tabs = getTabsForKpi(kpiKey);
      const isInitialValid = tabs.some(tab => tab.id === initialStatus);
      setActiveTab(isInitialValid ? (initialStatus || tabs[0].id) : tabs[0].id);
      loadTickets();
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, initialStatus, kpiKey, engineerId, companyId, category, dateRange, startDate, endDate]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      // If Escalated Tickets KPI, query the dedicated live SQL escalation endpoint
      if (kpiKey === 'escalated') {
        const escRes = await fetchEscalatedTickets();
        let loaded = (escRes && escRes.tickets) ? escRes.tickets : [];
        // Ensure auto-pruning: any resolved ticket is omitted from display and count
        loaded = loaded.filter(t => t.status !== 'resolved' && !t.resolved_at);
        setTickets(loaded);
        if (onEscalatedCountChange) {
          onEscalatedCountChange(loaded.length);
        }
        return;
      }

      const effectiveRange = isAllTime ? 'all' : (dateRange || 'month');
      const effectiveStartDate = isAllTime ? undefined : startDate;
      const effectiveEndDate = isAllTime ? undefined : endDate;

      let statusParam: string | undefined = undefined;
      if (kpiKey === 'in_progress' || initialStatus === 'in_progress') statusParam = 'in_progress';
      else if (kpiKey === 'hold' || initialStatus === 'hold') statusParam = 'hold';
      else if (kpiKey === 'observation' || initialStatus === 'observation') statusParam = 'observation';
      else if (kpiKey === 'ontime' || kpiKey === 'mttr') statusParam = 'resolved';

      const res = await fetchTickets({
        status: statusParam,
        engineer_id: engineerId,
        company_id: companyId,
        category: category,
        range: effectiveRange,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
        ratings_only: kpiKey === 'csat',
        limit: 1000
      });

function classifyIssueCategory(t: { issue_category?: string | null; description?: string | null; issue_type?: string | null }): string {
  if (t.issue_category) return t.issue_category;
  const desc = (t.description || '').toLowerCase();
  if (desc.includes('amc') || desc.includes('visit')) return 'AMC & Maintenance';
  if (desc.includes('printer')) return 'Printer & Peripherals';
  if (desc.includes('wifi') || desc.includes('internet') || desc.includes('network') || desc.includes('ap ') || desc.includes('firewall')) return 'Network & Connectivity';
  if (desc.includes('outlook') || desc.includes('mail') || desc.includes('word') || desc.includes('software') || desc.includes('cad')) return 'Software & Applications';
  if (desc.includes('system') || desc.includes('laptop') || desc.includes('desktop') || desc.includes('hardware')) return 'Hardware & Workstation';
  return 'General IT Support';
}

function normalizeCategoryName(cat: string): string {
  const c = cat.toLowerCase();
  if (c.includes('amc') || c.includes('maintenance')) return 'AMC & Maintenance';
  if (c.includes('printer') || c.includes('peripheral')) return 'Printer & Peripherals';
  if (c.includes('network') || c.includes('connectivity') || c.includes('wifi')) return 'Network & Connectivity';
  if (c.includes('software') || c.includes('app') || c.includes('application')) return 'Software & Applications';
  if (c.includes('hardware') || c.includes('workstation')) return 'Hardware & Workstation';
  if (c.includes('general') || c.includes('it support')) return 'General IT Support';
  return cat.trim();
}

      let loaded: ServiceTicket[] = [];
      if (res && Array.isArray(res.tickets) && res.tickets.length > 0) {
        loaded = res.tickets;
      } else if (res && res.total === 0) {
        // Genuine 0 matching results from SQL
        loaded = [];
      } else {
        // Fallback demo pool when server unreachable
        loaded = [...FALLBACK_TICKETS];
        if (engineerId) loaded = loaded.filter(t => t.assigned_to === engineerId);
        if (companyId) loaded = loaded.filter(t => t.company_id === companyId);
        if (category) {
          const targetCat = normalizeCategoryName(category);
          loaded = loaded.filter(t => classifyIssueCategory(t) === targetCat);
        }
        if (kpiKey === 'in_progress' || initialStatus === 'in_progress') loaded = loaded.filter(t => t.status === 'in_progress');
        else if (kpiKey === 'hold' || initialStatus === 'hold') loaded = loaded.filter(t => t.status === 'hold');
        else if (kpiKey === 'observation' || initialStatus === 'observation') loaded = loaded.filter(t => t.status === 'observation');
      }

      // Post-filtering for specific metrics
      if (kpiKey === 'delayed') {
        loaded = loaded.filter(t => {
          if (t.status === 'delayed') return true;
          if (t.created_at) {
            const cDate = new Date(t.created_at).getTime();
            const rDate = t.resolved_at ? new Date(t.resolved_at).getTime() : Date.now();
            const diffHours = (rDate - cDate) / (1000 * 60 * 60);
            return diffHours > 48;
          }
          return false;
        });
      } else if (kpiKey === 'ontime') {
        loaded = loaded.filter(t => {
          if (t.status !== 'resolved') return false;
          if (t.created_at && t.resolved_at) {
            const diffHours = (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
            return diffHours <= 48;
          }
          return true;
        });
      } else if (kpiKey === 'csat') {
        loaded = loaded.filter(t => t.ratings !== null && Number(t.ratings) > 0);
      }

      // Strictly isolate by company if companyId or companyName is provided
      if (companyId || companyName) {
        loaded = loaded.filter(t => {
          if (companyId && Number(t.company_id) === Number(companyId)) return true;
          if (companyName && t.company_name && t.company_name.toLowerCase().includes(companyName.toLowerCase())) return true;
          return false;
        });
      }

      setTickets(loaded);
    } catch (e) {
      console.warn('[ServiceDetailModal] Fallback to demo ticket rows:', e);
      let fallback = [...FALLBACK_TICKETS];
      if (companyId || companyName) {
        fallback = fallback.filter(t => {
          if (companyId && Number(t.company_id) === Number(companyId)) return true;
          if (companyName && t.company_name && t.company_name.toLowerCase().includes(companyName.toLowerCase())) return true;
          return false;
        });
      } else if (engineerId) {
        fallback = fallback.filter(t => t.assigned_to === engineerId);
      }
      setTickets(fallback);
    } finally {
      setLoading(false);
    }
  };

  // Add a ticket to Escalated status by entering only its Ticket ID
  const handleEscalateTicket = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanId = inputTicketId.trim().replace(/[^0-9]/g, '');
    if (!cleanId) {
      setEscalateFeedback({
        type: 'error',
        message: 'Please enter a valid numeric Ticket ID (e.g. 2105).'
      });
      return;
    }

    if (tickets.some(t => String(t.id) === cleanId)) {
      setEscalateFeedback({
        type: 'error',
        message: `Ticket #${cleanId} is already in the Escalated Register.`
      });
      return;
    }

    setIsEscalating(true);
    setEscalateFeedback(null);

    try {
      const res = await escalateTicket(cleanId);
      if (res.success && res.ticket) {
        // Prepend fetched ticket from live SQL to table
        const updated = [res.ticket, ...tickets.filter(t => String(t.id) !== cleanId)];
        setTickets(updated);
        if (onEscalatedCountChange) {
          onEscalatedCountChange(updated.length);
        }
        setEscalateFeedback({
          type: 'success',
          message: `✓ Ticket #T-${res.ticket.id} (${res.ticket.company_name || 'Compton Client'}) fetched from SQL & escalated!`
        });
        setInputTicketId('');
        setTimeout(() => setEscalateFeedback(null), 4000);
      } else {
        setEscalateFeedback({
          type: 'error',
          message: res.message || `Failed to fetch ticket #${cleanId} from SQL database.`
        });
      }
    } catch (err: any) {
      setEscalateFeedback({
        type: 'error',
        message: err?.message || 'Error communicating with SQL server.'
      });
    } finally {
      setIsEscalating(false);
    }
  };

  // Remove / de-escalate ticket manually
  const handleDeescalateTicket = async (ticketId: number) => {
    setIsDeescalatingId(ticketId);
    try {
      const res = await deescalateTicket(ticketId);
      if (res.success) {
        const updated = tickets.filter(t => t.id !== ticketId);
        setTickets(updated);
        if (onEscalatedCountChange) {
          onEscalatedCountChange(updated.length);
        }
        setEscalateFeedback({
          type: 'success',
          message: `Ticket #T-${ticketId} de-escalated and removed from register.`
        });
        setTimeout(() => setEscalateFeedback(null), 3500);
      } else {
        setEscalateFeedback({
          type: 'error',
          message: `Failed to remove ticket #T-${ticketId}.`
        });
      }
    } catch {
      setEscalateFeedback({
        type: 'error',
        message: 'Error communicating with server.'
      });
    } finally {
      setIsDeescalatingId(null);
    }
  };

  const currentTabDefs = useMemo(() => getTabsForKpi(kpiKey), [kpiKey]);
  const currentTabDef = currentTabDefs.find(t => t.id === activeTab) || currentTabDefs[0];
  const currentTabTotal = useMemo(() => {
    return tickets.filter(t => isTicketInTab(t, activeTab)).length;
  }, [tickets, activeTab]);

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => isTicketInTab(t, activeTab) && ticketMatchesFilter(t, severityFilter, searchTerm));
  }, [tickets, activeTab, severityFilter, searchTerm]);

  // Show CSAT column only when tickets can have ratings (CSAT KPI, Total Tickets, or Resolved tab)
  const showCsatColumn = kpiKey === 'csat' || kpiKey === 'total' || (!kpiKey && (Boolean(engineerId) || Boolean(companyId))) || activeTab === 'resolved';
  const showMttrColumn = kpiKey === 'mttr' || kpiKey === 'ontime';

  const isFiltered = severityFilter !== 'all' || Boolean(searchTerm.trim());

  // Export to Excel handler (for when user explicitly wants to download the spreadsheet)
  const handleExport = () => {
    setIsExportExporting(true);
    try {
      const exportData = filteredTickets.map((t, idx) => {
        const row: Record<string, any> = {
          '#': idx + 1,
          'Ticket ID': `#T-${t.id}`,
          'Client Company': t.company_name || 'Compton Enterprise Client',
          'Contact Email': t.contact_email || 'N/A',
          'Contact Phone': t.contact_number || 'N/A',
          'Assigned Engineer': t.engineer_name || 'Unassigned',
          'Engineer Level': (t.engineer_level || 'Level 1').toUpperCase(),
          'Issue Category': t.issue_category || t.issue_type || 'General IT Support',
          'Device Model': t.device_model || 'System Station',
          'Serial Number': t.serial_no || 'N/A',
          'Status': (t.status || 'open').toUpperCase().replace('_', ' '),
          'Severity': (t.severity || 'medium').toUpperCase(),
          'Created Date': t.created_at || 'N/A'
        };

        if (kpiKey === 'escalated') {
          row['Escalation Register'] = 'ACTIVE ESCALATED';
        } else if (kpiKey === 'csat' || kpiKey === 'mttr' || activeTab === 'resolved' || t.status === 'resolved') {
          row['Resolved Date'] = t.resolved_at || 'Resolved';
          if (t.created_at && t.resolved_at) {
            const diffHours = (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
            row['Turnaround (Hours)'] = Number(diffHours.toFixed(1));
            row['Turnaround (Days)'] = Number((diffHours / 24).toFixed(1));
            row['SLA Benchmark (48h)'] = diffHours <= 48 ? 'ONTIME (<=48h)' : 'DELAYED (>48h)';
          }
          row['CSAT Rating (1-5)'] = t.ratings ? `${t.ratings} / 5.0` : 'Pending Review';
          if (kpiKey === 'csat' || t.feedback_remarks) {
            row['Client Feedback Remarks'] = t.feedback_remarks || 'No remarks recorded';
            row['Issue Resolved (Client Confirmed)'] = t.feedback_issue_resolved ? t.feedback_issue_resolved.toUpperCase() : 'YES';
          }
        } else if (kpiKey === 'total' || !kpiKey) {
          if (t.resolved_at || t.status === 'resolved') {
            row['Resolved Date'] = t.resolved_at || 'Resolved';
            row['CSAT Rating (1-5)'] = t.ratings ? `${t.ratings} / 5.0` : 'Pending Review';
            if (t.feedback_remarks) {
              row['Client Feedback Remarks'] = t.feedback_remarks;
            }
          }
        }

        row['Warranty / AMC'] = t.warranty || 'Under AMC';
        row['Incident Description'] = t.description || 'System maintenance & diagnosis';
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(exportData);

      // Auto-set dynamic column widths with generous allocation for Incident Description and Remarks
      if (exportData.length > 0) {
        const colKeys = Object.keys(exportData[0]);
        ws['!cols'] = colKeys.map(key => {
          if (key === 'Incident Description') return { wch: 75 };
          if (key === 'Client Feedback Remarks') return { wch: 45 };
          if (key === 'Client Company') return { wch: 30 };
          if (key === 'Contact Email') return { wch: 28 };
          if (key === 'Assigned Engineer') return { wch: 22 };
          if (key === 'Issue Category') return { wch: 26 };
          if (key === 'Device Model') return { wch: 26 };
          if (key === '#') return { wch: 6 };
          if (key === 'Ticket ID') return { wch: 14 };
          if (key === 'Status' || key === 'Severity') return { wch: 15 };
          if (key.includes('Date')) return { wch: 20 };
          return { wch: Math.max(key.length + 4, 16) };
        });

        // Set cell alignment & wrapText on all data cells so long descriptions do not get cropped
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
        for (let R = range.s.r; R <= range.e.r; ++R) {
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const addr = XLSX.utils.encode_cell({ r: R, c: C });
            if (!ws[addr]) continue;
            if (R === 0) {
              ws[addr].s = {
                font: { bold: true },
                alignment: { vertical: 'center', horizontal: 'center', wrapText: true }
              };
            } else {
              ws[addr].s = {
                alignment: { vertical: 'top', wrapText: true }
              };
            }
          }
        }
      }

      const wb = XLSX.utils.book_new();
      const sheetName = (companyName || engineerName || (kpiKey === 'csat' ? 'CSAT Ratings' : 'Tickets')).slice(0, 31).replace(/[\\/?*[\]]/g, '');
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      const safeTitle = (companyName || engineerName || (kpiKey === 'csat' ? 'CSAT_Satisfaction' : title) || 'Service_Tickets').replace(/[^a-zA-Z0-9_-]/g, '_');
      XLSX.writeFile(wb, `Compton_${safeTitle}_Tickets_${new Date().toISOString().slice(0, 10)}.xlsx`, { cellStyles: true });
    } finally {
      setIsExportExporting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/85 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-7xl max-h-[92vh] flex flex-col rounded-2xl bg-[#090e17] border border-emerald-500/40 shadow-2xl overflow-hidden ring-1 ring-emerald-500/20"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Spreadsheet Title Bar with Excel Green Accents */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-emerald-500/30 bg-gradient-to-r from-[#0c1a14] via-[#0d1624] to-[#0a121e]">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-inner">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold tracking-wide">
                  Ticket Register (.xlsx)
                </span>
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  {engineerName || title}
                </h3>
                {!engineerName && companyName && companyName !== title && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono font-medium">
                    {companyName}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                <span>{subtitle}</span>
                <span className="text-slate-600">•</span>
                {isFiltered ? (
                  <span className="text-amber-300 font-mono font-semibold">
                    {filteredTickets.length} of {currentTabTotal} rows shown (Filtered)
                  </span>
                ) : (
                  <span className="text-emerald-400 font-mono font-semibold">
                    {filteredTickets.length} rows loaded
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            {/* Side Escalate Ticket Button */}
            {kpiKey === 'escalated' && (
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('escalate-ticket-id-input');
                  if (el) el.focus();
                }}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/30 active:scale-95 cursor-pointer ring-1 ring-rose-400/40"
                title="Add a ticket to Escalated status by entering its Ticket ID"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>+ Escalate Ticket</span>
              </button>
            )}

            {/* Direct Export to Excel button */}
            <button
              onClick={handleExport}
              disabled={isExporting || filteredTickets.length === 0}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Export tickets as a .xlsx Excel file"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{isExporting ? 'Exporting...' : 'Export .xlsx'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
              title="Close ticket register"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Escalated Tickets Executive Quick Action Bar */}
        {kpiKey === 'escalated' && (
          <div className="px-5 py-3 bg-gradient-to-r from-rose-950/40 via-[#140f1d] to-[#0c1422] border-b border-rose-500/30">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 shadow-inner">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white tracking-wide">
                      Escalate New Ticket
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold">
                      Auto-Fetches SQL Data
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Enter Ticket ID below. All customer, engineer & incident details will be loaded from MySQL. Automatically clears when resolved.
                  </p>
                </div>
              </div>

              <form onSubmit={handleEscalateTicket} className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-60">
                  <input
                    id="escalate-ticket-id-input"
                    type="text"
                    value={inputTicketId}
                    onChange={e => {
                      setInputTicketId(e.target.value);
                      if (escalateFeedback) setEscalateFeedback(null);
                    }}
                    placeholder="Type Ticket ID (e.g. 2105)..."
                    disabled={isEscalating}
                    className="w-full pl-3 pr-8 py-1.5 rounded-xl bg-slate-950 border border-rose-500/40 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400/50 font-mono shadow-inner"
                  />
                  {inputTicketId && (
                    <button
                      type="button"
                      onClick={() => setInputTicketId('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isEscalating || !inputTicketId.trim()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/30 cursor-pointer shrink-0 active:scale-95"
                >
                  {isEscalating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Fetching SQL...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Fetch from SQL</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={loadTickets}
                  title="Re-sync with live MySQL database"
                  className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors cursor-pointer shrink-0"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-rose-400' : ''}`} />
                </button>
              </form>
            </div>

            {/* Live Feedback Toast Banner */}
            {escalateFeedback && (
              <div
                className={`mt-2.5 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between border animate-fade-in ${
                  escalateFeedback.type === 'success'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="font-bold">{escalateFeedback.type === 'success' ? '✓' : '⚠️'}</span>
                  <span>{escalateFeedback.message}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setEscalateFeedback(null)}
                  className="text-slate-400 hover:text-white ml-2 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Spreadsheet Ribbon / Toolbar: Sheet Tabs, Search, and Filters */}
        <div className="p-3.5 border-b border-slate-800 bg-[#0d1422] flex flex-col lg:flex-row items-center justify-between gap-3">
          {/* Excel Workbook Status Tabs */}
          <div className="flex items-center space-x-1 bg-slate-950/90 p-1 rounded-xl border border-slate-800/90 w-full lg:w-auto overflow-x-auto text-xs">
            {currentTabDefs.map(tab => {
              const totalInTab = tickets.filter(t => isTicketInTab(t, tab.id)).length;
              const filteredInTab = tickets.filter(t => isTicketInTab(t, tab.id) && ticketMatchesFilter(t, severityFilter, searchTerm)).length;
              const hasFilterHidingRows = isFiltered && filteredInTab < totalInTab;

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <span>{tab.label}</span>
                  {totalInTab > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono transition-colors ${
                        hasFilterHidingRows
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                          : activeTab === tab.id
                          ? 'bg-emerald-500/30 text-emerald-200 font-bold'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                      title={hasFilterHidingRows ? `${filteredInTab} matching filter of ${totalInTab} total` : `${totalInTab} tickets`}
                    >
                      {hasFilterHidingRows ? `${filteredInTab} / ${totalInTab}` : totalInTab}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search & Severity Filter */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            {/* Severity Quick Dropdown with active visual highlight */}
            <div className="flex items-center gap-1.5 text-xs">
              <Filter className={`w-3.5 h-3.5 shrink-0 transition-colors ${severityFilter !== 'all' ? 'text-amber-400' : 'text-slate-400'}`} />
              <select
                value={severityFilter}
                onChange={e => setSeverityFilter(e.target.value as any)}
                className={`text-xs rounded-lg px-2.5 py-1.5 focus:outline-none transition-all cursor-pointer ${
                  severityFilter !== 'all'
                    ? 'bg-amber-500/15 border border-amber-500/60 text-amber-300 font-bold shadow-sm ring-1 ring-amber-500/30'
                    : 'bg-slate-950 border border-slate-800 text-slate-300 focus:border-emerald-500'
                }`}
              >
                <option value="all">All Severity</option>
                <option value="high">High Severity</option>
                <option value="medium">Medium Severity</option>
                <option value="low">Low Severity</option>
              </select>
              {severityFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSeverityFilter('all')}
                  className="p-1 rounded-md text-amber-400 hover:text-white hover:bg-amber-500/20 transition-colors cursor-pointer"
                  title="Clear severity filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* In-spreadsheet Search Input */}
            <div className="relative flex-1 sm:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search cells: #ID, company, engineer, serial..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 shadow-inner"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Active Filter Notification & 1-Click Reset Banner */}
        {isFiltered && (
          <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/25 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                Filter active: Showing <strong className="font-bold text-white font-mono">{filteredTickets.length}</strong> of <strong className="font-bold text-white font-mono">{currentTabTotal}</strong> {currentTabDef.label} tickets
              </span>
              {severityFilter !== 'all' && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold uppercase tracking-wider">
                  {severityFilter} Severity
                </span>
              )}
              {searchTerm.trim() && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px]">
                  Search: "{searchTerm}"
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setSeverityFilter('all');
                setSearchTerm('');
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 hover:text-white text-[11px] font-bold transition-all border border-amber-500/40 cursor-pointer shadow-xs"
              title="Clear all filters to display all tickets"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear Filter (Show All {currentTabTotal})</span>
            </button>
          </div>
        )}

        {/* Main Spreadsheet Grid Table */}
        <div className="flex-1 overflow-auto min-h-[380px] bg-[#070b12] custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-80 space-y-3">
              <div className="w-9 h-9 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
              <p className="text-xs text-slate-400 font-medium">Loading ticket register...</p>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-80 text-center space-y-3 p-4">
              <AlertTriangle className="w-8 h-8 text-amber-400/70" />
              <p className="text-sm font-bold text-slate-200">No tickets match the active filter</p>
              <p className="text-xs text-slate-400 max-w-md">
                There are {currentTabTotal} tickets in {currentTabDef.label}, but none match the current filter{severityFilter !== 'all' ? ` (${severityFilter} severity)` : ''}{searchTerm.trim() ? ` or search "${searchTerm}"` : ''}.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSeverityFilter('all');
                  setSearchTerm('');
                }}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-md flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filter (Show All {currentTabTotal} Tickets)</span>
              </button>
            </div>
          ) : (
            <div className="inline-block min-w-full align-middle">
              <table className="min-w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-[#0c1422] sticky top-0 z-10 shadow-xs">
                    <th className="py-2.5 px-3 w-12 text-center text-slate-500 font-mono border-r border-slate-800/80 bg-[#0c1422]">
                      #
                    </th>
                    <th className="py-2.5 px-3.5 font-mono border-r border-slate-800/80">Ticket ID</th>
                    <th className="py-2.5 px-3.5 border-r border-slate-800/80">Client Account</th>
                    <th className="py-2.5 px-3.5 border-r border-slate-800/80">Assigned Engineer</th>
                    <th className="py-2.5 px-3.5 border-r border-slate-800/80">Issue Category & Device</th>
                    <th className="py-2.5 px-3 text-center border-r border-slate-800/80">Severity</th>
                    <th className="py-2.5 px-3 text-center border-r border-slate-800/80">Status</th>
                    <th className="py-2.5 px-3.5 border-r border-slate-800/80 font-mono">Created Date</th>
                    {showMttrColumn && (
                      <th className="py-2.5 px-3.5 border-r border-slate-800/80 text-right font-mono">Turnaround (MTTR)</th>
                    )}
                    {showCsatColumn && (
                      <th className="py-2.5 px-3.5 border-r border-slate-800/80 text-right">CSAT</th>
                    )}
                    <th className="py-2.5 px-4 min-w-[260px]">Incident Description</th>
                    {kpiKey === 'escalated' && (
                      <th className="py-2.5 px-3 text-center border-l border-slate-800/80 w-20">De-escalate</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {filteredTickets.map((ticket, idx) => {
                    const statusColorMap: Record<string, string> = {
                      resolved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
                      in_progress: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
                      hold: 'bg-orange-500/10 text-orange-400 border-orange-500/25',
                      observation: 'bg-purple-500/10 text-purple-400 border-purple-500/25',
                      delayed: 'bg-rose-500/10 text-rose-400 border-rose-500/25'
                    };

                    const severityColorMap: Record<string, string> = {
                      high: 'text-rose-400 bg-rose-500/10 border-rose-500/25',
                      medium: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
                      low: 'text-sky-400 bg-sky-500/10 border-sky-500/25'
                    };

                    const isEven = idx % 2 === 0;

                    return (
                      <tr
                        key={ticket.id || idx}
                        className={`transition-colors group ${
                          isEven ? 'bg-[#090e17]' : 'bg-[#0c121e]'
                        } hover:bg-slate-800/40`}
                      >
                        {/* Row Number */}
                        <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px] border-r border-slate-800/60 bg-slate-950/40">
                          {idx + 1}
                        </td>

                        {/* Ticket ID */}
                        <td className="py-2.5 px-3.5 font-mono font-bold text-cyan-400 whitespace-nowrap border-r border-slate-800/60">
                          #T-{ticket.id}
                        </td>

                        {/* Client Account */}
                        <td className="py-2.5 px-3.5 border-r border-slate-800/60">
                          <div className="font-bold text-slate-100 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[180px]">{ticket.company_name || 'Individual Call'}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[180px]">
                            {ticket.contact_email || ticket.contact_number || 'support@client.com'}
                          </div>
                        </td>

                        {/* Engineer */}
                        <td className="py-2.5 px-3.5 border-r border-slate-800/60">
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300 shrink-0">
                              {ticket.engineer_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'EN'}
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-slate-200 whitespace-nowrap">
                                {ticket.engineer_name || 'Unassigned'}
                              </div>
                              <div className="text-[10px] text-slate-500 capitalize">
                                {ticket.engineer_level || 'Level 1'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Category & Device */}
                        <td className="py-2.5 px-3.5 border-r border-slate-800/60">
                          <span className="font-semibold text-slate-200 block truncate max-w-[190px]">
                            {ticket.issue_category || ticket.issue_type || 'General IT Support'}
                          </span>
                          <div className="text-[10px] text-slate-400 truncate max-w-[190px]">
                            {ticket.device_model || ticket.serial_no || 'System diagnostics'}
                          </div>
                        </td>

                        {/* Severity */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap border-r border-slate-800/60">
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${
                            severityColorMap[ticket.severity?.toLowerCase()] || severityColorMap.medium
                          }`}>
                            {ticket.severity || 'Medium'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap border-r border-slate-800/60">
                          <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-md border ${
                            statusColorMap[ticket.status?.toLowerCase()] || statusColorMap.resolved
                          }`}>
                            {ticket.status?.replace('_', ' ') || 'Resolved'}
                          </span>
                        </td>

                        {/* Created Date */}
                        <td className="py-2.5 px-3.5 whitespace-nowrap font-mono text-[11px] text-slate-300 border-r border-slate-800/60">
                          {ticket.created_at ? ticket.created_at.slice(0, 16) : '2026-09-15 10:00'}
                        </td>

                        {/* MTTR Turnaround Duration */}
                        {showMttrColumn && (
                          <td className="py-2.5 px-3.5 text-right whitespace-nowrap border-r border-slate-800/60 font-mono text-xs">
                            {ticket.created_at && ticket.resolved_at ? (() => {
                              const diffHours = (new Date(ticket.resolved_at).getTime() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60);
                              const isDelayed = diffHours > 48;
                              return (
                                <div className="flex flex-col items-end gap-0.5">
                                  <span className={`font-bold ${isDelayed ? 'text-rose-400' : 'text-teal-400'}`}>
                                    {diffHours < 1 ? `${Math.round(diffHours * 60)}m` : `${diffHours.toFixed(1)}h`}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-sans">
                                    {diffHours >= 24 ? `~${(diffHours / 24).toFixed(1)}d` : 'Same day'}
                                  </span>
                                </div>
                              );
                            })() : (
                              <span className="text-[10px] text-slate-500 font-mono">-</span>
                            )}
                          </td>
                        )}

                        {/* CSAT */}
                        {showCsatColumn && (
                          <td className="py-2.5 px-3.5 text-right whitespace-nowrap border-r border-slate-800/60">
                            {ticket.ratings ? (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="text-xs font-bold text-amber-400 flex items-center justify-end gap-1 font-mono">
                                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                  <span>{Number(ticket.ratings).toFixed(1)}</span>
                                </span>
                                {ticket.feedback_issue_resolved && (
                                  <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                                    ticket.feedback_issue_resolved === 'yes'
                                      ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                                      : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                                  }`}>
                                    {ticket.feedback_issue_resolved === 'yes' ? 'Resolved' : 'Unresolved'}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-mono">-</span>
                            )}
                          </td>
                        )}

                        {/* Description & Remarks */}
                        <td className="py-2.5 px-4 text-slate-300 text-xs min-w-[280px] max-w-md whitespace-normal break-words leading-relaxed">
                          <div
                            className="line-clamp-2 hover:line-clamp-none transition-all cursor-pointer select-text"
                            title={ticket.description || 'Routine support and technical maintenance'}
                          >
                            {ticket.description || 'Routine support and technical maintenance'}
                          </div>
                          {ticket.feedback_remarks && (
                            <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-md px-2 py-1 shadow-sm">
                              <span className="font-semibold text-amber-400 shrink-0">Client Remark:</span>
                              <span className="italic break-words">"{ticket.feedback_remarks}"</span>
                            </div>
                          )}
                        </td>

                        {/* De-escalate Action */}
                        {kpiKey === 'escalated' && (
                          <td className="py-2.5 px-3 text-center whitespace-nowrap border-l border-slate-800/60">
                            <button
                              type="button"
                              onClick={() => handleDeescalateTicket(ticket.id)}
                              disabled={isDeescalatingId === ticket.id}
                              title="Remove ticket from Escalated register (De-escalate)"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 border border-transparent hover:border-rose-500/30 transition-all cursor-pointer disabled:opacity-50"
                            >
                              {isDeescalatingId === ticket.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Excel Spreadsheet Footer Status Bar */}
        <div className="px-5 py-2.5 border-t border-slate-800/90 bg-[#090e18] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              READY
            </span>
            <span className="text-slate-600">|</span>
            <span>
              Showing <strong className="text-white font-mono">{filteredTickets.length}</strong> of{' '}
              <strong className="text-white font-mono">{currentTabTotal}</strong> {currentTabDef.label} records
              {tickets.length !== currentTabTotal && (
                <span className="text-slate-500 ml-1">({tickets.length} total in register)</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-400 font-mono">
            <span>Period: <b className="text-slate-300">
              {isAllTime
                ? 'All-Time'
                : startDate && endDate
                ? `${startDate} to ${endDate}`
                : dateRange === 'month' || dateRange === 'this_month'
                ? 'September 2026'
                : dateRange === 'last_month'
                ? 'August 2026'
                : dateRange === 'all'
                ? 'All-Time'
                : dateRange || 'September 2026'}
            </b></span>
            <span className="text-slate-400">Compton Service Operations</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ServiceDetailModal;
