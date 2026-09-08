import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let currentDir = process.cwd();
try {
  currentDir = path.dirname(fileURLToPath(import.meta.url));
} catch {
  currentDir = process.cwd();
}

// Cache deal sync result in memory across serverless warm starts
let serverlessCache: any = null;

// Helper: Split and Reconcile GST
const GST_RATE = 0.18;

function splitGst(grossRevenue: number, isWon: boolean) {
  const gross = Number.isFinite(grossRevenue) ? grossRevenue : 0;
  if (!isWon) return { netRevenue: gross, gstAmount: 0 };
  const netRevenue = Math.round((gross / (1 + GST_RATE)) * 100) / 100;
  const gstAmount = Math.round((gross - netRevenue) * 100) / 100;
  return { netRevenue, gstAmount };
}

function reconcileGst(grossRevenue: number, isWon: boolean, bitrixTaxValue: any) {
  const gross = Number.isFinite(grossRevenue) ? grossRevenue : 0;
  if (!isWon) return { netRevenue: gross, gstAmount: 0, source: 'computed' };

  const taxVal = typeof bitrixTaxValue === 'string' ? parseFloat(bitrixTaxValue) : bitrixTaxValue;
  if (taxVal && taxVal > 0 && gross > taxVal) {
    const computed = splitGst(gross, isWon);
    if (Math.abs(taxVal - computed.gstAmount) / computed.gstAmount <= 0.05) {
      return {
        netRevenue: Math.round((gross - taxVal) * 100) / 100,
        gstAmount: Math.round(taxVal * 100) / 100,
        source: 'bitrix'
      };
    }
  }
  const computed = splitGst(gross, isWon);
  return { ...computed, source: 'computed' };
}

const BITRIX_INDUSTRY_ENUM_MAP: Record<string, string> = {
  '240': 'Banking & Financial Services',
  '248': 'Education',
  '250': 'Pharmaceutical & Healthcare',
  '272': 'Manufacturing',
  '280': 'Exports',
  '288': 'IT & ITES',
  '296': 'Consulting & Professional Services',
  '304': 'Personal + self',
  '318': 'Real Estate & Construction',
  '326': 'Retail & E-commerce',
  '376': 'Food & Beverage',
  '420': 'Fertilizers',
  '422': 'IT & ITES',
  '424': 'Textile & Apparel',
  '426': 'Iron & Steel',
  '428': 'Paper & Packaging',
  '430': 'Automotive',
  '432': 'Media & Entertainment',
  '484': 'Embassy',
  '492': 'FMCG',
  '584': 'Electronic',
  '690': 'Hospitality',
  '1070': 'Others',
  '1072': 'Service',
  '1074': 'Infrastructure & Utilities',
  '1088': 'Pharmaceutical & Healthcare',
  '1098': 'Legal',
  '1108': 'Government & PSU',
  '1174': 'Food & Beverage',
  '1178': 'Sports Equipment',
  '1222': 'Manufacturing',
  '1224': 'Education',
  '1226': 'Banking & Financial Services',
  '1228': 'Pharmaceutical & Healthcare',
  '1230': 'Government & PSU',
  '1232': 'IT & ITES',
  '1234': 'Retail & E-commerce',
  '1236': 'Hospitality',
  '1238': 'Real Estate & Construction',
  '1240': 'Infrastructure & Utilities',
  '1242': 'Logistics & Transportation',
  '1244': 'Food & Beverage',
  '1246': 'Automotive',
  '1248': 'Media & Entertainment',
  '1250': 'Telecom',
  '1252': 'Consulting & Professional Services',
  '1254': 'Paper & Packaging',
  '1256': 'Textile & Apparel',
  '1258': 'FMCG',
  '1260': 'Others',
  '1396': 'NGO',
  '1416': 'Legal',
  '1426': 'Government & PSU'
};

function normalizeBitrixIndustry(val: any, rawRecord?: any): string {
  const rawUfVal = rawRecord?.UF_CRM_67E4FF8E84730 || val;
  if (!rawUfVal) return 'General Industry';
  if (typeof rawUfVal === 'string' && BITRIX_INDUSTRY_ENUM_MAP[rawUfVal.trim()]) {
    return BITRIX_INDUSTRY_ENUM_MAP[rawUfVal.trim()];
  }
  const s = String(rawUfVal).toUpperCase();
  if (s.includes('MANUFACT') || s.includes('MFG') || s.includes('PLANT')) return 'Manufacturing';
  if (s.includes('PHARMA') || s.includes('HEALTH') || s.includes('HOSP') || s.includes('CLINIC')) return 'Pharmaceutical & Healthcare';
  if (s.includes('IT') || s.includes('TECH') || s.includes('SOFTWARE') || s.includes('SAAS')) return 'IT & ITES';
  if (s.includes('BANK') || s.includes('FIN') || s.includes('INSUR') || s.includes('CAPITAL')) return 'Banking & Financial Services';
  if (s.includes('GOV') || s.includes('PSU') || s.includes('MINISTRY')) return 'Government & PSU';
  if (s.includes('EDU') || s.includes('SCHOOL') || s.includes('UNIV') || s.includes('COLLEGE')) return 'Education';
  if (s.includes('RETAIL') || s.includes('E-COM') || s.includes('MART')) return 'Retail & E-commerce';
  if (s.includes('REAL ESTATE') || s.includes('BUILD') || s.includes('INFRA') || s.includes('CONST')) return 'Real Estate & Construction';
  if (s.includes('AUTO') || s.includes('MOTOR') || s.includes('VEHICLE')) return 'Automotive';
  if (s.includes('LOGIST') || s.includes('TRANS') || s.includes('COURIER') || s.includes('CARGO')) return 'Logistics & Transportation';
  if (s.includes('FOOD') || s.includes('BEV') || s.includes('DAIRY') || s.includes('AGRI')) return 'Food & Beverage';
  if (s.includes('FMCG')) return 'FMCG';
  if (s.includes('CONSULT') || s.includes('LEGAL') || s.includes('ADVISOR')) return 'Consulting & Professional Services';
  if (s.includes('HOTEL') || s.includes('RESORT') || s.includes('TRAVEL')) return 'Hospitality';
  if (s.includes('MEDIA') || s.includes('ENTERTAIN')) return 'Media & Entertainment';
  return 'General Industry';
}

function normalizeBitrixSource(rawSource: string): string {
  const str = String(rawSource || '').trim().toUpperCase();
  if (!str || str === '0' || str === 'NONE' || str === 'EMPTY') return 'Self Generated';
  if (str.includes('WEBFORM') || str.includes('UC_RR2BTF') || str.includes('INDIAMART') || str.includes('INDIA') || str.includes('MART')) {
    return 'India Mart';
  }
  if (str.includes('CALLBACK') || str.includes('LINKEDIN') || str.includes('LINKED')) {
    return 'LinkedIn Ads';
  }
  if (str.includes('GOOGLE') || str.includes('SEARCH') || str.includes('ADS') || str.includes('ADWORDS') || str.includes('ORGANIC')) {
    return 'Google Ads';
  }
  if (str.includes('EMAIL') || str.includes('CAMPAIGN') || str.includes('NEWSLETTER')) {
    return 'Email Marketing';
  }
  return 'Self Generated';
}

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

function normalizeSalesRep(rawRep?: string, textToSearch?: string): string {
  const combined = `${rawRep || ''} ${textToSearch || ''}`.toLowerCase();
  if (combined.includes('jitesh')) return 'Jitesh Chander';
  if (combined.includes('sandeep')) return 'Sandeep Vahi';
  if (combined.includes('rohit')) return 'Rohit Yadav';
  if (combined.includes('taniya')) return 'Taniya Negi';
  if (combined.includes('tausif')) return 'Tausif Ahmad';
  if (combined.includes('ashok')) return 'Ashok Kumar';
  return rawRep || 'Jitesh Chander';
}

function mapBitrixAssignedUser(assignedId: string, textToSearch: string): string {
  const cleanId = String(assignedId || '').trim();
  if (BITRIX_USER_MAP[cleanId]) return BITRIX_USER_MAP[cleanId];
  return normalizeSalesRep('', textToSearch);
}

function parseTitleParts(title: string, rawRecord?: any): { customer: string; solution: string } {
  const rawCompany = rawRecord?.COMPANY_TITLE || rawRecord?.CONTACT_NAME;
  if (!title) return { customer: rawCompany || 'Unknown Client', solution: 'Core Solution' };
  const cleanTitle = title.replace(/\*+/g, '').trim();

  if (cleanTitle.includes('/')) {
    const parts = cleanTitle.split('/').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 3) {
      return { customer: rawCompany || parts[0], solution: parts[2] };
    } else if (parts.length === 2) {
      return { customer: rawCompany || parts[0], solution: parts[1] };
    }
  } else if (cleanTitle.includes('|')) {
    const parts = cleanTitle.split('|').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return { customer: rawCompany || parts[0], solution: parts[1] };
    }
  } else if (cleanTitle.includes(' - ') || cleanTitle.includes(' – ')) {
    const parts = cleanTitle.split(/ – | - /).map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return { customer: rawCompany || parts[0], solution: parts[parts.length - 1] };
    }
  }

  return { customer: rawCompany || cleanTitle, solution: 'Core Solution' };
}

const shortMonthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function normalizeBitrixDate(dateStr: any) {
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
      }
    }
  }

  if (!dt) dt = new Date();

  const y = dt.getFullYear();
  const mIdx = dt.getMonth();
  const dNum = String(dt.getDate()).padStart(2, '0');
  const mNum = String(mIdx + 1).padStart(2, '0');

  return {
    isoDate: `${y}-${mNum}-${dNum}`,
    monthYear: `${shortMonthNames[mIdx]} ${y}`,
    year: y,
    quarter: `Q${Math.floor(mIdx / 3) + 1} ${y}`
  };
}

function formatBitrixStage(type: 'won' | 'lost' | 'in_progress', stId: string): string {
  if (type === 'won') return 'Won';
  if (type === 'lost') return 'Lost';

  const s = String(stId || '').toUpperCase();
  if (s.includes('NEW')) return 'Need Analysis';
  if (s.includes('UC_U1DIM3')) return 'Solution Design';
  if (s.includes('PREPARATION')) return 'Solution Approval';
  if (s.includes('PREPAYMENT')) return 'Quote Creation';
  if (s.includes('EXECUTING')) return 'Quote Approval';
  if (s.includes('UC_OQLF1D') || s.includes('NEGOTIAT') || s.includes('CONTRACT') || s.includes('CLOSING')) return 'Negotiation';
  if (s.includes('UC_JFWHE2') || s.includes('ORDER')) return 'Sales Order Creation';

  if (s.includes('PREP')) return 'Solution Design';
  if (s.includes('INVOICE')) return 'Quote Creation';
  if (s.includes('FINAL') || s.includes('EXEC')) return 'Quote Approval';

  return 'Need Analysis';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const reqOrigin = (req.headers.origin || '') as string;
  const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(reqOrigin);

  if (reqOrigin && (allowedOrigins.includes(reqOrigin) || allowedOrigins.includes('*') || isLocalOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', reqOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  } else if (!reqOrigin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Attempt 1: In-memory warm cache across serverless warm requests
    if (serverlessCache && Array.isArray(serverlessCache.won) && serverlessCache.won.length > 0) {
      return res.status(200).json(serverlessCache);
    }

    // Attempt 2: Bundled disk cache from server/cached_bitrix_deals.json (Instant <5ms load on Vercel)
    const candidateDiskPaths = [
      path.join(process.cwd(), 'public', 'cached_bitrix_deals.json'),
      path.join(process.cwd(), 'server', 'cached_bitrix_deals.json'),
      path.join(process.cwd(), 'cached_bitrix_deals.json'),
      path.resolve(currentDir, '..', 'public', 'cached_bitrix_deals.json'),
      path.resolve(currentDir, '..', 'server', 'cached_bitrix_deals.json'),
      path.resolve(currentDir, '..', 'cached_bitrix_deals.json'),
      path.resolve(currentDir, 'server', 'cached_bitrix_deals.json'),
      path.resolve(currentDir, 'cached_bitrix_deals.json'),
      '/var/task/public/cached_bitrix_deals.json',
      '/var/task/server/cached_bitrix_deals.json',
      '/var/task/cached_bitrix_deals.json'
    ];

    for (const diskCachePath of candidateDiskPaths) {
      try {
        if (fs.existsSync(diskCachePath)) {
          const fileData = fs.readFileSync(diskCachePath, 'utf8');
          const parsed = JSON.parse(fileData);
          if (parsed && Array.isArray(parsed.won) && parsed.won.length > 0) {
            console.log(`[api/deals] Loaded prebuilt cache from ${diskCachePath}`);
            serverlessCache = parsed;
            return res.status(200).json(parsed);
          }
        }
      } catch (err: any) {
        console.warn(`[api/deals] Failed to read ${diskCachePath}:`, err?.message);
      }
    }

    // Attempt 3: Live Bitrix fetch fallback with pagination & lead sync
    const webhookUrl = (process.env.BITRIX_WEBHOOK_URL || process.env.VITE_BITRIX_WEBHOOK_URL || '').trim();
    if (!webhookUrl) {
      return res.status(200).json(serverlessCache || {
        status: 'warning',
        message: 'BITRIX_WEBHOOK_URL environment variable is not configured on serverless environment.',
        won: [],
        lost: [],
        progress: [],
        leads: [],
        lastSyncedAt: new Date().toISOString()
      });
    }
    const cleanBaseUrl = webhookUrl.endsWith('/') ? webhookUrl : `${webhookUrl}/`;

    // 1. Paginated Deals Fetch
    let allDeals: any[] = [];
    let startOffset = 0;
    const pageSize = 50;

    while (startOffset < 2500) {
      const qp = new URLSearchParams();
      qp.append('FILTER[>DATE_CREATE]', '2019-01-01');
      qp.append('SELECT[]', '*');
      qp.append('SELECT[]', 'UF_*');
      qp.append('start', String(startOffset));

      const dealRes = await fetch(`${cleanBaseUrl}crm.deal.list.json?${qp.toString()}`);
      if (!dealRes.ok) break;

      const dealJson: any = await dealRes.json();
      const items: any[] = dealJson.result || [];
      allDeals = allDeals.concat(items);

      const total = typeof dealJson.total === 'number' ? dealJson.total : allDeals.length;
      if (items.length < pageSize || allDeals.length >= total) {
        break;
      }
      startOffset += pageSize;
    }

    // 2. Paginated Leads Fetch
    let allLeads: any[] = [];
    let leadOffset = 0;
    while (leadOffset < 1000) {
      const qp = new URLSearchParams();
      qp.append('FILTER[>DATE_CREATE]', '2019-01-01');
      qp.append('SELECT[]', '*');
      qp.append('SELECT[]', 'UF_*');
      qp.append('start', String(leadOffset));

      const leadRes = await fetch(`${cleanBaseUrl}crm.lead.list.json?${qp.toString()}`);
      if (!leadRes.ok) break;

      const leadJson: any = await leadRes.json();
      const items: any[] = leadJson.result || [];
      allLeads = allLeads.concat(items);

      const total = typeof leadJson.total === 'number' ? leadJson.total : allLeads.length;
      if (items.length < pageSize || allLeads.length >= total) {
        break;
      }
      leadOffset += pageSize;
    }

    // Filter Category 6 deals
    const targetDeals = allDeals.filter((d: any) => String(d.CATEGORY_ID || '0') === '6');

    const won: any[] = [];
    const lost: any[] = [];
    const progress: any[] = [];

    targetDeals.forEach((deal: any, idx: number) => {
      const semantic = String(deal.STAGE_SEMANTIC_ID || '').toUpperCase();
      const stageId = String(deal.STAGE_ID || '').toUpperCase();
      const isClosed = deal.CLOSED === 'Y';

      let dealType: 'won' | 'lost' | 'in_progress' = 'in_progress';
      if (semantic === 'S' || stageId.includes('WON') || stageId.includes('SUCCESS')) {
        dealType = 'won';
      } else if (semantic === 'F' || stageId.includes('LOSE') || stageId.includes('LOST') || stageId.includes('FAIL')) {
        dealType = 'lost';
      } else if (!isClosed || semantic === 'P') {
        dealType = 'in_progress';
      }

      const grossRevenue = parseFloat(deal.OPPORTUNITY || '0') || 0;
      const isWonDeal = dealType === 'won';
      const gstInfo = reconcileGst(grossRevenue, isWonDeal, deal.TAX_VALUE);

      const titleParts = parseTitleParts(deal.TITLE, deal);
      const salesRep = mapBitrixAssignedUser(String(deal.ASSIGNED_BY_ID || ''), `${deal.TITLE || ''} ${deal.COMMENTS || ''}`);
      const dateStr = (dealType === 'won' || dealType === 'lost')
        ? (deal.CLOSEDATE || deal.DATE_MODIFY || deal.DATE_CREATE)
        : (deal.DATE_CREATE || deal.CLOSEDATE);
      const dateInfo = normalizeBitrixDate(dateStr);

      const solutionType = deal.UF_CRM_1744361655612 || deal.UF_CRM_SOLUTION || titleParts.solution || 'Core Solution';
      const industry = normalizeBitrixIndustry(deal.UF_CRM_67E4FF8E84730 || deal.UF_CRM_CATEGORY, deal);
      const leadSource = normalizeBitrixSource(deal.SOURCE_ID);

      const mappedDeal = {
        id: String(deal.ID ? `BITRIX-${deal.ID}` : `B24-${idx + 1000}`),
        customer: titleParts.customer,
        solution: solutionType,
        grossRevenue,
        netRevenue: gstInfo.netRevenue,
        gstAmount: gstInfo.gstAmount,
        stage: formatBitrixStage(dealType, stageId),
        type: dealType,
        date: dateInfo.isoDate,
        salesRep,
        salesCycleDays: 14,
        monthYear: dateInfo.monthYear,
        quarter: dateInfo.quarter,
        year: dateInfo.year,
        industry,
        leadSource,
        rawRecord: deal
      };

      if (dealType === 'won') won.push(mappedDeal);
      else if (dealType === 'lost') lost.push(mappedDeal);
      else progress.push(mappedDeal);
    });

    // Normalize leads
    const normalizedLeads: any[] = [];
    allLeads.forEach((lead: any) => {
      const statusId = String(lead.STATUS_ID || '').toUpperCase();
      const statusSemantic = String(lead.STATUS_SEMANTIC_ID || '').toUpperCase();

      let statusType: 'qualified' | 'disqualified' | 'in_progress' = 'in_progress';
      if (statusId === 'CONVERTED' || statusSemantic === 'S' || statusId.includes('WON')) {
        statusType = 'qualified';
      } else if (statusId === 'JUNK' || statusSemantic === 'F' || statusId.includes('LOST') || statusId.includes('FAIL')) {
        statusType = 'disqualified';
      }

      normalizedLeads.push({
        id: String(lead.ID || ''),
        title: String(lead.TITLE || ''),
        statusId: lead.STATUS_ID,
        statusType,
        opportunity: parseFloat(lead.OPPORTUNITY || '0') || 0,
        assignedById: String(lead.ASSIGNED_BY_ID || ''),
        salesRep: mapBitrixAssignedUser(String(lead.ASSIGNED_BY_ID || ''), lead.TITLE || ''),
        dateCreate: String(lead.DATE_CREATE || '').slice(0, 10),
        sourceId: String(lead.SOURCE_ID || ''),
        rawRecord: lead
      });
    });

    const qualifiedLeadsCount = normalizedLeads.filter(l => l.statusType === 'qualified').length;
    const disqualifiedLeadsCount = normalizedLeads.filter(l => l.statusType === 'disqualified').length;
    const inProgressLeadsCount = normalizedLeads.filter(l => l.statusType === 'in_progress').length;

    const result = {
      won,
      lost,
      progress,
      leads: normalizedLeads,
      qualifiedLeadsCount,
      disqualifiedLeadsCount,
      inProgressLeadsCount,
      totalFetchedDeals: allDeals.length,
      totalFetchedLeads: normalizedLeads.length,
      lastSyncedAt: new Date().toISOString(),
      status: 'success',
      message: `Successfully loaded ${targetDeals.length} sales pipeline deals (${won.length} won, ${lost.length} lost, ${progress.length} in-progress) & ${normalizedLeads.length} leads.`
    };

    serverlessCache = result;
    return res.status(200).json(result);
  } catch (err: any) {
    console.error("[api/deals] Handler error:", err);
    return res.status(200).json(serverlessCache || {
      status: 'error',
      message: err?.message || 'Serverless deal sync failed',
      won: [],
      lost: [],
      progress: [],
      leads: [],
      lastSyncedAt: new Date().toISOString()
    });
  }
}

