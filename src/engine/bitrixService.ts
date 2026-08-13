import type { DealRecord, DealType } from '../types/sales';
import { getStoredBitrixConfig, type BitrixConfig } from '../config/bitrixConfig';
import { splitGst, reconcileGst } from '../utils/financeUtils';
import { RateLimitedQueue, fetchAllPagesReliable } from './bitrixFetchQueue';
export { getStoredBitrixConfig, type BitrixConfig } from '../config/bitrixConfig';

const bitrixQueue = new RateLimitedQueue({ concurrency: 3, minIntervalMs: 300, maxRetries: 4 });


export interface BitrixLeadRecord {
  id: string;
  title: string;
  statusId: string;
  statusType: 'qualified' | 'disqualified' | 'in_progress';
  opportunity: number;
  assignedById: string;
  salesRep: string;
  dateCreate: string;
  sourceId: string;
  rawRecord?: Record<string, any>;
}

export interface BitrixSyncResult {
  won: DealRecord[];
  lost: DealRecord[];
  progress: DealRecord[];
  leads: BitrixLeadRecord[];
  qualifiedLeadsCount: number;
  disqualifiedLeadsCount: number;
  inProgressLeadsCount: number;
  totalFetchedDeals: number;
  totalFetchedLeads: number;
  lastSyncedAt: Date;
  status: 'success' | 'error';
  message: string;
}

const CACHE_KEY = 'sales_dashboard_bitrix_data_cache_v10';

export const BITRIX_INDUSTRY_ENUM_MAP: Record<string, string> = {
  '240': 'Banking and Finance',
  '248': 'Education',
  '250': 'Pharmaceutical',
  '272': 'Manufacturing',
  '280': 'Exports',
  '288': 'IT & Software',
  '296': 'Consulting',
  '304': 'Personal + self',
  '318': 'Real Estate',
  '326': 'Retail',
  '376': 'Food and Beverages',
  '420': 'Fertilizers',
  '422': 'IT',
  '424': 'Textile',
  '426': 'Iron & Steel',
  '428': 'Pulp and Paper',
  '430': 'Automobile',
  '432': 'Entertainment',
  '484': 'Embassy',
  '492': 'FMCG',
  '584': 'Electronic',
  '690': 'Hospitality',
  '1070': 'Others',
  '1072': 'Service',
  '1074': 'Infrastructure Development',
  '1088': 'Hospital',
  '1098': 'Legal',
  '1108': 'Government',
  '1174': 'Restaurants',
  '1178': 'Sports Equipment'
};

export const normalizeBitrixIndustry = (val: any, rawRecord?: any): string => {
  const rawUfVal = rawRecord?.UF_CRM_67E4FF8E84730 || val;
  if (!rawUfVal) return 'General Industry';
  const str = String(rawUfVal).trim();
  if (BITRIX_INDUSTRY_ENUM_MAP[str]) return BITRIX_INDUSTRY_ENUM_MAP[str];

  const validNames = Object.values(BITRIX_INDUSTRY_ENUM_MAP);
  if (validNames.includes(str)) return str;

  return 'General Industry';
};

export const BITRIX_SOLUTION_TYPE_ENUM_MAP: Record<string, string> = {
  'Data center solution': 'Data center solution',
  'Server solution': 'Server solution',
  'Storage solution': 'Storage solution',
  'Backup solution': 'Backup solution',
  'Data security solution': 'Data security solution',
  'Data back up solution': 'Data back up solution',
  'Passive Networking solution': 'Passive Networking solution',
  'CCTV Solution': 'CCTV Solution',
  'Liscense': 'Liscense',
  'Services': 'Services',
  'Desktops/ Laptops': 'Desktops/ Laptops',
  'Printers': 'Printers',
  'Power backup': 'Power backup',
  'Accessories': 'Accessories',
  'Video Conferencing': 'Video Conferencing',
  'Others': 'Others',
  'Application development': 'Application development',
  'Softwares': 'Softwares'
};

export const normalizeBitrixSolutionType = (val: any, rawRecord?: any): string => {
  const rawVal = rawRecord?.UF_CRM_1744361655612 || rawRecord?.UF_CRM_SOLUTION || val;
  if (!rawVal) return 'Others';

  const str = String(rawVal).trim();
  const lower = str.toLowerCase();

  const validList = Object.values(BITRIX_SOLUTION_TYPE_ENUM_MAP);
  const exactMatch = validList.find(v => v.toLowerCase() === lower);
  if (exactMatch) return exactMatch;

  if (lower.includes('switch') || lower.includes('passive') || lower.includes('netw') || lower.includes('router') || lower.includes('cable') || lower.includes('rack')) {
    return 'Passive Networking solution';
  }
  if (lower.includes('laptop') || lower.includes('desktop') || lower.includes('pc') || lower.includes('all in one') || lower.includes('lenovo') || lower.includes('hp') || lower.includes('dell') || lower.includes('macbook')) {
    return 'Desktops/ Laptops';
  }
  if (lower.includes('cctv') || lower.includes('surveillance') || lower.includes('camera') || lower.includes('dvr') || lower.includes('nvr') || lower.includes('door')) {
    return 'CCTV Solution';
  }
  if (lower.includes('server')) {
    return 'Server solution';
  }
  if (lower.includes('storage') || lower.includes('san') || lower.includes('nas')) {
    return 'Storage solution';
  }
  if (lower.includes('backup') || lower.includes('back up') || lower.includes('veeam')) {
    return lower.includes('data') ? 'Data back up solution' : 'Backup solution';
  }
  if (lower.includes('security') || lower.includes('firewall') || lower.includes('sophos') || lower.includes('fortinet') || lower.includes('cyber')) {
    return 'Data security solution';
  }
  if (lower.includes('datacenter') || lower.includes('data center')) {
    return 'Data center solution';
  }
  if (lower.includes('license') || lower.includes('licence') || lower.includes('liscense') || lower.includes('subscription')) {
    return 'Liscense';
  }
  if (lower.includes('service') || lower.includes('amc') || lower.includes('installation') || lower.includes('support') || lower.includes('maintenance')) {
    return 'Services';
  }
  if (lower.includes('printer') || lower.includes('scanner') || lower.includes('toner')) {
    return 'Printers';
  }
  if (lower.includes('power') || lower.includes('ups') || lower.includes('battery')) {
    return 'Power backup';
  }
  if (lower.includes('accessory') || lower.includes('accessories') || lower.includes('mouse') || lower.includes('keyboard')) {
    return 'Accessories';
  }
  if (lower.includes('video') || lower.includes('conferencing') || lower.includes('polycom') || lower.includes('logitech') || lower.includes('meet')) {
    return 'Video Conferencing';
  }
  if (lower.includes('software') || lower.includes('tally') || lower.includes('os')) {
    return 'Softwares';
  }
  if (lower.includes('app') || lower.includes('development') || lower.includes('web') || lower.includes('code')) {
    return 'Application development';
  }

  return 'Others';
};

export const getStoredBitrixCache = (): BitrixSyncResult | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const sanitizeRecords = (records: DealRecord[]) => (records || []).map(r => {
        const grossRev = parseFloat(String(r.grossRevenue || r.netRevenue || '0')) || 0;
        const isWonDeal = r.type === 'won';
        const { netRevenue: netRevWithoutGst, gstAmount: computedGstVal } = splitGst(grossRev, isWonDeal);
        const rawSrc = r.leadSource || r.rawRecord?.SOURCE_ID || '';
        const rawInd = r.rawRecord?.UF_CRM_67E4FF8E84730 || r.industry || '';
        const rawSol = r.rawRecord?.UF_CRM_1744361655612 || r.solution || '';
        return {
          ...r,
          grossRevenue: grossRev,
          gstAmount: r.gstAmount || computedGstVal,
          netRevenue: netRevWithoutGst,
          industry: normalizeBitrixIndustry(rawInd, r.rawRecord),
          solution: normalizeBitrixSolutionType(rawSol, r.rawRecord),
          leadSource: normalizeBitrixSource(rawSrc),
          salesRep: normalizeSalesRep(r.salesRep, JSON.stringify(r.rawRecord || {}))
        };
      });
      const sanitizeLeads = (leads: BitrixLeadRecord[]) => (leads || []).map(l => ({
        ...l,
        salesRep: normalizeSalesRep(l.salesRep, JSON.stringify(l.rawRecord || {}))
      }));

      return {
        ...parsed,
        won: sanitizeRecords(parsed.won),
        lost: sanitizeRecords(parsed.lost),
        progress: sanitizeRecords(parsed.progress),
        leads: sanitizeLeads(parsed.leads),
        lastSyncedAt: new Date(parsed.lastSyncedAt)
      };
    }
  } catch (err) {
    console.warn("Could not load Bitrix cache:", err);
  }
  return null;
};

export const saveBitrixCache = (data: BitrixSyncResult): void => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("Could not save Bitrix cache:", err);
  }
};

export const ALLOWED_BITRIX_REPS = [
  'Jitesh Chander',
  'Sandeep Vahi',
  'Rohit Yadav',
  'Taniya Negi',
  'Tausif Ahmad',
  'Ashok Kumar'
] as const;

export const normalizeSalesRep = (rawRep?: string, textToSearch?: string): string => {
  const combined = `${rawRep || ''} ${textToSearch || ''}`.toLowerCase();
  if (combined.includes('jitesh')) return 'Jitesh Chander';
  if (combined.includes('sandeep')) return 'Sandeep Vahi';
  if (combined.includes('rohit')) return 'Rohit Yadav';
  if (combined.includes('taniya')) return 'Taniya Negi';
  if (combined.includes('tausif')) return 'Tausif Ahmad';
  if (combined.includes('ashok')) return 'Ashok Kumar';
  return 'Jitesh Chander';
};

export const normalizeBitrixSource = (rawSource: string): string => {
  const str = String(rawSource || '').trim().toUpperCase();
  if (!str || str === '0' || str === 'NONE' || str === 'EMPTY') return 'Self Generated';

  if (str.includes('WEBFORM') || str.includes('UC_RR2BTF') || str.includes('INDIAMART') || str.includes('INDIA') || str.includes('MART')) {
    return 'India Mart';
  }

  if (str.includes('CALLBACK') || str.includes('LINKEDIN') || str.includes('LINKED')) {
    return 'LinkedIn';
  }

  if (str.includes('RC_GENERATOR') || str.includes('UC_BI5EEB') || str.includes('GOOGLE') || str.includes('ADS') || str.includes('ADWORDS')) {
    return 'Google Ads';
  }

  if (str.includes('STORE') || str.includes('EXISTING') || str.includes('CLIENT')) {
    return 'Existing Client';
  }

  if (str.includes('REPEAT_SALE') || str.includes('RECOMMENDATION') || str.includes('REFERENCE') || str.includes('REF') || str.includes('WORD')) {
    return 'Reference';
  }

  if (str.includes('BOOKING') || str.includes('EMAIL') || str.includes('E-MAIL') || str.includes('MAIL')) {
    return 'E-Mail';
  }

  if (str.includes('CALL') || str.includes('PARTNER') || str.includes('SELF') || str.includes('DIRECT') || str.includes('OTHER') || str.includes('TRADE_SHOW')) {
    return 'Self Generated';
  }

  return 'Self Generated';
};

// User map for Bitrix assigned IDs mapped directly to allowed team members
const BITRIX_USER_MAP: Record<string, string> = {
  '12': 'Sandeep Vahi',
  '58': 'Jitesh Chander',
  '32': 'Rohit Yadav',
  '60': 'Taniya Negi',
  '108': 'Taniya Negi',
  '216': 'Ashok Kumar',
  '222': 'Tausif Ahmad',
  '46': 'Rohit Yadav',
  '64': 'Jitesh Chander',
  '66': 'Taniya Negi',
  '76': 'Sandeep Vahi',
  '212': 'Jitesh Chander',
  '10': 'Jitesh Chander',
  '1': 'Jitesh Chander'
};

export const mapBitrixAssignedUser = (assignedId: string, textToSearch?: string): string => {
  const cleanId = String(assignedId || '').trim();
  if (BITRIX_USER_MAP[cleanId]) {
    return BITRIX_USER_MAP[cleanId];
  }
  return normalizeSalesRep('', textToSearch);
};

const parseTitleParts = (title: string) => {
  if (!title) return { customer: 'Unknown Client', solution: 'Core Solution' };
  const parts = title.split('/').map(p => p.trim());
  if (parts.length >= 3) {
    return { customer: parts[0], solution: parts[2] };
  } else if (parts.length === 2) {
    return { customer: parts[0], solution: parts[1] };
  }
  return { customer: title.trim(), solution: 'Core Solution' };
};

const normalizeBitrixDate = (dateStr?: string): { isoDate: string; monthYear: string; year: number; quarter: string } => {
  let dt: Date | null = null;

  if (dateStr && typeof dateStr === 'string' && dateStr.trim().length > 0) {
    const cleanStr = dateStr.trim().replace(' ', 'T');
    const parsed = new Date(cleanStr);
    if (!isNaN(parsed.getTime())) {
      dt = parsed;
    } else {
      const mIso = cleanStr.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
      if (mIso) {
        dt = new Date(parseInt(mIso[1], 10), parseInt(mIso[2], 10) - 1, parseInt(mIso[3], 10));
      } else {
        const mEu = cleanStr.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
        if (mEu) {
          dt = new Date(parseInt(mEu[3], 10), parseInt(mEu[2], 10) - 1, parseInt(mEu[1], 10));
        }
      }
    }
  }

  if (!dt || isNaN(dt.getTime())) {
    dt = new Date();
  }

  const year = dt.getFullYear();
  const monthIdx = dt.getMonth();
  const day = String(dt.getDate()).padStart(2, '0');
  const monthNum = String(monthIdx + 1).padStart(2, '0');

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthYear = `${monthNames[monthIdx]} ${year}`;
  const quarter = `Q${Math.floor(monthIdx / 3) + 1} ${year}`;
  const isoDate = `${year}-${monthNum}-${day}`;

  return { isoDate, monthYear, year, quarter };
};

// Fast Parallel Rate-Limited Fetcher for Bitrix Leads
export const fetchBitrixLeads = async (customConfig?: BitrixConfig): Promise<BitrixLeadRecord[]> => {
  const config = customConfig || getStoredBitrixConfig();
  const baseUrl = config.webhookBaseUrl.endsWith('/') ? config.webhookBaseUrl : `${config.webhookBaseUrl}/`;

  try {
    const buildUrl = (start: number) => {
      const qp = new URLSearchParams();
      qp.append('FILTER[>DATE_CREATE]', config.minDate || '2019-01-01');
      qp.append('SELECT[]', '*');
      qp.append('SELECT[]', 'UF_*');
      qp.append('start', String(start));
      return `${baseUrl}crm.lead.list.json?${qp.toString()}`;
    };

    const { items: allRawLeads } = await fetchAllPagesReliable(buildUrl, 50, bitrixQueue);

    return allRawLeads.map((lead: any) => {
      const sem = String(lead.STATUS_SEMANTIC_ID || '').toUpperCase();
      const st = String(lead.STATUS_ID || '').toUpperCase();
      let statusType: 'qualified' | 'disqualified' | 'in_progress' = 'in_progress';

      if (sem === 'S' || st.includes('CONVERT') || st.includes('WON')) {
        statusType = 'qualified';
      } else if (sem === 'F' || st.includes('JUNK') || st.includes('DISQUAL')) {
        statusType = 'disqualified';
      }

      return {
        id: String(lead.ID || ''),
        title: lead.TITLE || 'Untitled Lead',
        statusId: lead.STATUS_ID || 'NEW',
        statusType: statusType,
        opportunity: parseFloat(lead.OPPORTUNITY || '0') || 0,
        assignedById: String(lead.ASSIGNED_BY_ID || ''),
        salesRep: mapBitrixAssignedUser(String(lead.ASSIGNED_BY_ID || ''), `${lead.TITLE || ''} ${lead.COMMENTS || ''}`),
        dateCreate: lead.DATE_CREATE || '',
        dateModify: lead.DATE_MODIFY || '',
        dateClosed: lead.DATE_CLOSED || lead.DATE_MODIFY || lead.DATE_CREATE || '',
        sourceId: lead.SOURCE_ID || 'Direct Inquiry',
        rawRecord: lead
      };
    });
  } catch (err) {
    console.error("Error fetching Bitrix Leads:", err);
    return [];
  }
};

// Ultra High-Speed Parallel Rate-Limited Batch Fetcher for Bitrix CRM Timeline Comments & Quoted Product Rows
export const fetchBitrixDetailsBatch = async (
  baseUrl: string,
  dealIds: string[]
): Promise<{ commentsMap: Record<string, string[]>; productsMap: Record<string, string[]> }> => {
  const commentsMap: Record<string, string[]> = {};
  const productsMap: Record<string, string[]> = {};

  if (!dealIds || dealIds.length === 0) return { commentsMap, productsMap };

  const BATCH_SIZE = 25; // 25 deals = 50 commands per batch call
  const chunks: string[][] = [];
  for (let i = 0; i < dealIds.length; i += BATCH_SIZE) {
    chunks.push(dealIds.slice(i, i + BATCH_SIZE));
  }

  // Execute batch chunks with rate-limiting and retry handling
  const batchPromises = chunks.map(chunk => {
    const bodyParams = new URLSearchParams();
    chunk.forEach(id => {
      bodyParams.append(`cmd[c_${id}]`, `crm.timeline.comment.list?filter[ENTITY_TYPE]=deal&filter[ENTITY_ID]=${id}`);
      bodyParams.append(`cmd[p_${id}]`, `crm.deal.productrows.get?id=${id}`);
    });

    return bitrixQueue.run(() =>
      fetch(`${baseUrl}batch.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams.toString()
      })
        .then(res => res.ok ? res.json() : null)
        .catch(() => null),
      `batchDetails-${chunk.join(',')}`
    ).catch(() => null);
  });

  const batchResultsList = await Promise.all(batchPromises);

  batchResultsList.forEach(json => {
    if (!json) return;
    const batchResults = json?.result?.result || {};
    Object.keys(batchResults).forEach(key => {
      if (key.startsWith('c_')) {
        const dealId = key.replace(/^c_/, '');
        const commentItems = batchResults[key] || [];
        if (Array.isArray(commentItems) && commentItems.length > 0) {
          commentsMap[dealId] = commentItems
            .map((item: any) => item.COMMENT ? item.COMMENT.replace(/<[^>]*>/g, '').trim() : '')
            .filter(Boolean);
        }
      } else if (key.startsWith('p_')) {
        const dealId = key.replace(/^p_/, '');
        const prodItems = batchResults[key] || [];
        if (Array.isArray(prodItems) && prodItems.length > 0) {
          productsMap[dealId] = prodItems
            .map((item: any) => `${item.PRODUCT_NAME || 'Product'} (Qty: ${item.QUANTITY || 1}, Price: ₹${item.PRICE || item.PRICE_BRUTTO || 0})`)
            .filter(Boolean);
        }
      }
    });
  });

  return { commentsMap, productsMap };
};

/**
 * Client-Side Bitrix Deal Fetcher with RateLimitedQueue & Retry Handling
 */
export const fetchBitrixDeals = async (customConfig?: BitrixConfig): Promise<BitrixSyncResult> => {
  const config = customConfig || getStoredBitrixConfig();
  const baseUrl = config.webhookBaseUrl.endsWith('/') ? config.webhookBaseUrl : `${config.webhookBaseUrl}/`;

  try {
    const buildUrl = (start: number) => {
      const qp = new URLSearchParams();
      qp.append('FILTER[>DATE_CREATE]', config.minDate || '2019-01-01');
      qp.append('SELECT[]', '*');
      qp.append('SELECT[]', 'UF_*');
      qp.append('start', String(start));
      return `${baseUrl}crm.deal.list.json?${qp.toString()}`;
    };

    // Start Deals fetch and Leads fetch concurrently via rate-limited queue!
    const dealsPromise = fetchAllPagesReliable(buildUrl, 50, bitrixQueue);
    const leadsPromise = fetchBitrixLeads(config);

    const [{ items: allDeals }, leads] = await Promise.all([dealsPromise, leadsPromise]);

    // Filter deals for Category 6 ("Sales Funnel" in Bitrix UI)
    const targetDeals = allDeals.filter((d: any) => String(d.CATEGORY_ID || '0') === '6');

    // Fetch Bitrix Timeline Comments & Quoted Products for all target deals in high-speed parallel batches
    const targetDealIds = targetDeals.map((d: any) => String(d.ID)).filter(Boolean);
    const { commentsMap: timelineCommentsMap, productsMap: dealProductsMap } = await fetchBitrixDetailsBatch(baseUrl, targetDealIds);

    const won: DealRecord[] = [];
    const lost: DealRecord[] = [];
    const progress: DealRecord[] = [];

    targetDeals.forEach((deal: any, idx: number) => {
      const semantic = String(deal.STAGE_SEMANTIC_ID || '').toUpperCase();
      const stageId = String(deal.STAGE_ID || '').toUpperCase();
      const isClosed = deal.CLOSED === 'Y';

      let dealType: DealType = 'in_progress';

      if (semantic === 'S' || stageId.includes('WON') || stageId.includes('SUCCESS')) {
        dealType = 'won';
      } else if (semantic === 'F' || stageId.includes('LOSE') || stageId.includes('LOST') || stageId.includes('FAIL')) {
        dealType = 'lost';
      } else if (!isClosed || semantic === 'P') {
        dealType = 'in_progress';
      }

      const titleParts = parseTitleParts(deal.TITLE);
      const revenue = parseFloat(deal.OPPORTUNITY || '0') || 0;
      const isWonDeal = dealType === 'won';
      const gstInfo = reconcileGst(revenue, isWonDeal, deal.TAX_VALUE);

      const salesRep = mapBitrixAssignedUser(String(deal.ASSIGNED_BY_ID || ''), `${deal.TITLE || ''} ${deal.COMMENTS || ''}`);
      const dateStr = (dealType === 'won' || dealType === 'lost')
        ? (deal.CLOSEDATE || deal.DATE_MODIFY || deal.DATE_CREATE)
        : (deal.DATE_CREATE || deal.CLOSEDATE);
      const dateInfo = normalizeBitrixDate(dateStr);

      const attachments: { id?: string; showUrl?: string; downloadUrl?: string }[] = [];
      Object.keys(deal).forEach(k => {
        if (k.startsWith('UF_CRM_') && deal[k] && typeof deal[k] === 'object' && deal[k].downloadUrl) {
          const fileObj = deal[k];
          const fullDownloadUrl = fileObj.downloadUrl.startsWith('http')
            ? fileObj.downloadUrl
            : `${baseUrl.replace(/\/rest\/.*$/, '')}${fileObj.downloadUrl}`;
          const fullShowUrl = fileObj.showUrl
            ? (fileObj.showUrl.startsWith('http') ? fileObj.showUrl : `${baseUrl.replace(/\/rest\/.*$/, '')}${fileObj.showUrl}`)
            : fullDownloadUrl;

          attachments.push({
            id: String(fileObj.id || ''),
            showUrl: fullShowUrl,
            downloadUrl: fullDownloadUrl
          });
        }
      });

      const productList = dealProductsMap[String(deal.ID)] || [];
      const baseRemarks = deal.UF_CRM_67EBCBB3098E8 || deal.SOURCE_DESCRIPTION || '';
      const allRemarksCombined = Array.from(new Set([baseRemarks, ...productList].filter(Boolean))).join(' | ');
      const remarks = allRemarksCombined || undefined;

      const baseComments = deal.COMMENTS ? deal.COMMENTS.replace(/<[^>]*>/g, '').trim() : '';
      const timelineList = timelineCommentsMap[String(deal.ID)] || [];
      const allCommentsCombined = Array.from(new Set([baseComments, ...timelineList].filter(Boolean))).join(' | ');
      const comments = allCommentsCombined || undefined;
      const lostReason = deal.UF_CRM_1742536927863 || '';
      const solutionType = normalizeBitrixSolutionType(deal.UF_CRM_1744361655612 || deal.UF_CRM_SOLUTION || titleParts.solution, deal);
      const industry = normalizeBitrixIndustry(deal.UF_CRM_67E4FF8E84730 || deal.UF_CRM_CATEGORY, deal);
      const leadSource = normalizeBitrixSource(deal.SOURCE_ID);

      const formatBitrixStage = (type: DealType, stId: string, _i: number): string => {
        if (type === 'won') return 'Won';
        if (type === 'lost') return 'Lost';

        const s = String(stId || '').toUpperCase();
        if (s.includes('NEW')) return 'Need Analysis';
        if (s.includes('UC_U1DIM3')) return 'Solution Design';
        if (s.includes('PREPARATION')) return 'Solution Approval';
        if (s.includes('PREPAYMENT')) return 'Quote Creation';
        if (s.includes('EXECUTING')) return 'Quote Approval';
        if (s.includes('UC_OQLF1D') || s.includes('NEGOTIAT') || s.includes('CONTRACT') || s.includes('CLOSING')) return 'Negotiation';

        if (s.includes('PREP')) return 'Solution Design';
        if (s.includes('INVOICE')) return 'Quote Creation';
        if (s.includes('FINAL') || s.includes('EXEC')) return 'Quote Approval';

        return 'Need Analysis';
      };

      // Calculate dynamic Sales Cycle Days for Bitrix deal using DATE_CREATE and CLOSEDATE / DATE_MODIFY
      let dealSalesCycleDays = 14;
      if (deal.DATE_CREATE) {
        const createTs = new Date(deal.DATE_CREATE).getTime();
        const closeDateStr = deal.CLOSEDATE || deal.DATE_MODIFY;
        const closeTs = closeDateStr ? new Date(closeDateStr).getTime() : NaN;
        if (!isNaN(createTs) && !isNaN(closeTs) && closeTs >= createTs) {
          const diffDays = Math.round((closeTs - createTs) / (1000 * 60 * 60 * 24));
          dealSalesCycleDays = Math.max(1, diffDays);
        }
      }

      const record: DealRecord = {
        id: deal.ID ? `BITRIX-${deal.ID}` : `B24-${idx + 1000}`,
        customer: titleParts.customer,
        grossRevenue: revenue,
        gstAmount: gstInfo.gstAmount,
        netRevenue: gstInfo.netRevenue,
        salesRep: salesRep,
        industry: industry,
        solution: solutionType,
        leadSource: leadSource,
        stage: formatBitrixStage(dealType, stageId, idx),
        date: dateInfo.isoDate,
        monthYear: dateInfo.monthYear,
        year: dateInfo.year,
        quarter: dateInfo.quarter,
        type: dealType,
        salesCycleDays: dealSalesCycleDays,
        lostReason: lostReason || undefined,
        remarks: remarks || undefined,
        comments: comments || undefined,
        fileAttachments: attachments.length > 0 ? attachments : undefined,
        rawRecord: deal
      };

      if (dealType === 'won') won.push(record);
      else if (dealType === 'lost') lost.push(record);
      else progress.push(record);
    });

    const qualifiedLeadsCount = leads.filter(l => l.statusType === 'qualified').length;
    const disqualifiedLeadsCount = leads.filter(l => l.statusType === 'disqualified').length;
    const inProgressLeadsCount = leads.filter(l => l.statusType === 'in_progress').length;

    const result: BitrixSyncResult = {
      won,
      lost,
      progress,
      leads,
      qualifiedLeadsCount,
      disqualifiedLeadsCount,
      inProgressLeadsCount,
      totalFetchedDeals: allDeals.length,
      totalFetchedLeads: leads.length,
      lastSyncedAt: new Date(),
      status: 'success',
      message: `Loaded ${targetDeals.length} sales pipeline deals (${won.length} won, ${lost.length} lost, ${progress.length} in-progress) & ${leads.length} leads.`
    };

    // Save result to Local Cache for 0ms instant loading on next page refresh!
    saveBitrixCache(result);

    return result;
  } catch (err: any) {
    console.error("Bitrix24 Sync Error:", err);
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
      message: err.message || 'Failed to fetch deals from Bitrix24 Webhook.'
    };
  }
};
