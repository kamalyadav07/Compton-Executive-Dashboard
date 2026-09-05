// scripts/reprocess_cache.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cachePath = path.resolve(__dirname, '../server/cached_bitrix_deals.json');
const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));

const GST_RATE = 0.18;

function splitGst(grossRevenue, isWon) {
  const gross = Number.isFinite(grossRevenue) ? grossRevenue : 0;
  if (!isWon) return { netRevenue: gross, gstAmount: 0 };
  const netRevenue = Math.round((gross / (1 + GST_RATE)) * 100) / 100;
  const gstAmount = Math.round((gross - netRevenue) * 100) / 100;
  return { netRevenue, gstAmount };
}

function reconcileGst(grossRevenue, isWon, bitrixTaxValue) {
  const gross = Number.isFinite(grossRevenue) ? grossRevenue : 0;
  if (!isWon) return { netRevenue: gross, gstAmount: 0 };

  const taxVal = typeof bitrixTaxValue === 'string' ? parseFloat(bitrixTaxValue) : bitrixTaxValue;
  if (taxVal && taxVal > 0 && gross > taxVal) {
    const computed = splitGst(gross, isWon);
    if (Math.abs(taxVal - computed.gstAmount) / computed.gstAmount <= 0.05) {
      return {
        netRevenue: Math.round((gross - taxVal) * 100) / 100,
        gstAmount: Math.round(taxVal * 100) / 100
      };
    }
  }
  return splitGst(gross, isWon);
}

const BITRIX_INDUSTRY_ENUM_MAP = {
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

function normalizeBitrixIndustry(val, rawRecord) {
  const rawUfVal = rawRecord?.UF_CRM_67E4FF8E84730 || val;
  if (!rawUfVal) return 'General Industry';
  const str = String(rawUfVal).trim();
  if (BITRIX_INDUSTRY_ENUM_MAP[str]) return BITRIX_INDUSTRY_ENUM_MAP[str];
  const validNames = Object.values(BITRIX_INDUSTRY_ENUM_MAP);
  if (validNames.includes(str)) return str;
  return 'General Industry';
}

const BITRIX_SOLUTION_ENUM_MAP = {
  '1188': 'CCTV Solution',
  '1190': 'Passive Networking solution',
  '1192': 'Passive Networking solution',
  '1194': 'Server solution',
  '1196': 'Storage solution',
  '1198': 'Backup solution',
  '1200': 'Data center solution',
  '1202': 'Desktops/ Laptops',
  '1204': 'Printers',
  '1206': 'Power backup',
  '1208': 'Video Conferencing',
  '1210': 'Data security solution',
  '1212': 'Liscense',
  '1214': 'Application development',
  '1216': 'Data center solution',
  '1218': 'Services',
  '1220': 'Others'
};

const BITRIX_SOLUTION_TYPE_ENUM_MAP = {
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

function normalizeBitrixSolutionType(val, rawRecord) {
  const enumId = String(rawRecord?.UF_CRM_1782977521393 || '').trim();
  if (enumId && BITRIX_SOLUTION_ENUM_MAP[enumId] && BITRIX_SOLUTION_ENUM_MAP[enumId] !== 'Others') {
    return BITRIX_SOLUTION_ENUM_MAP[enumId];
  }

  const rawVal = rawRecord?.UF_CRM_1744361655612 || rawRecord?.UF_CRM_SOLUTION || val;
  const str = String(rawVal || '').trim();
  const lower = str.toLowerCase();

  const validList = Object.values(BITRIX_SOLUTION_TYPE_ENUM_MAP);
  const exactMatch = validList.find(v => v.toLowerCase() === lower);
  if (exactMatch) return exactMatch;

  const combinedText = `${lower} ${(rawRecord?.TITLE || '').toLowerCase()}`.replace(/\*+/g, '');

  if (combinedText.includes('switch') || combinedText.includes('passive') || combinedText.includes('netw') ||
      combinedText.includes('router') || combinedText.includes('cable') || combinedText.includes('rack') ||
      combinedText.includes('patch cord') || combinedText.includes('connector') || combinedText.includes('access point') ||
      combinedText.includes('wifi') || combinedText.includes('wi fi') || combinedText.includes('qn-i') ||
      combinedText.includes('cat-6') || combinedText.includes('cat6') || combinedText.includes('cat 6') ||
      combinedText.includes('crimping') || combinedText.includes('io box') || combinedText.includes('patch panel')) {
    return 'Passive Networking solution';
  }
  if (combinedText.includes('laptop') || combinedText.includes('desktop') || combinedText.includes('pc') ||
      combinedText.includes('all in one') || combinedText.includes('lenovo') || combinedText.includes('hp') ||
      combinedText.includes('dell') || combinedText.includes('macbook') || combinedText.includes('mac book') ||
      combinedText.includes('workstation') || combinedText.includes('thinkpad') || combinedText.includes('industrial pc')) {
    return 'Desktops/ Laptops';
  }
  if (combinedText.includes('cctv') || combinedText.includes('surveillance') || combinedText.includes('camera') ||
      combinedText.includes('dvr') || combinedText.includes('nvr') || combinedText.includes('door') ||
      combinedText.includes('access control') || combinedText.includes('ptz') || combinedText.includes('vms') ||
      combinedText.includes('biometric')) {
    return 'CCTV Solution';
  }
  if (combinedText.includes('server')) return 'Server solution';
  if (combinedText.includes('storage') || combinedText.includes('san') || combinedText.includes('nas') ||
      combinedText.includes('qnap') || combinedText.includes('synology') || combinedText.includes('hard drive') ||
      combinedText.includes('hdd') || combinedText.includes('ssd')) return 'Storage solution';
  if (combinedText.includes('backup') || combinedText.includes('back up') || combinedText.includes('veeam')) {
    return combinedText.includes('data') ? 'Data back up solution' : 'Backup solution';
  }
  if (combinedText.includes('security') || combinedText.includes('firewall') || combinedText.includes('sophos') ||
      combinedText.includes('fortinet') || combinedText.includes('cyber') || combinedText.includes('antivirus') ||
      combinedText.includes('edr') || combinedText.includes('mdm')) return 'Data security solution';
  if (combinedText.includes('datacenter') || combinedText.includes('data center') || combinedText.includes('cloud') ||
      combinedText.includes('aws') || combinedText.includes('azure')) return 'Data center solution';
  if (combinedText.includes('license') || combinedText.includes('licence') || combinedText.includes('liscense') ||
      combinedText.includes('subscription') || combinedText.includes('o365') || combinedText.includes('m365') ||
      combinedText.includes('office 365') || combinedText.includes('microsoft 365')) return 'Liscense';
  if (combinedText.includes('service') || combinedText.includes('amc') || combinedText.includes('installation') ||
      combinedText.includes('support') || combinedText.includes('maintenance') || combinedText.includes('manpower') ||
      combinedText.includes('repair') || combinedText.includes('site survey') || combinedText.includes('survey') ||
      combinedText.includes('warranty') || combinedText.includes('renewal')) return 'Services';
  if (combinedText.includes('printer') || combinedText.includes('scanner') || combinedText.includes('toner') || combinedText.includes('cartridge')) return 'Printers';
  if (combinedText.includes('power') || combinedText.includes('ups') || combinedText.includes('battery') || combinedText.includes('inverter')) return 'Power backup';
  if (combinedText.includes('accessory') || combinedText.includes('accessories') || combinedText.includes('mouse') ||
      combinedText.includes('keyboard') || combinedText.includes('bag') || combinedText.includes('headset') ||
      combinedText.includes('adapter')) return 'Accessories';
  if (combinedText.includes('video') || combinedText.includes('conferencing') || combinedText.includes('vc ') ||
      combinedText.includes('vc solution') || combinedText.includes('polycom') || combinedText.includes('logitech') ||
      combinedText.includes('meet')) return 'Video Conferencing';
  if (combinedText.includes('software') || combinedText.includes('tally') || combinedText.includes('os') || combinedText.includes('windows')) return 'Softwares';
  if (combinedText.includes('app') || combinedText.includes('development') || combinedText.includes('web') || combinedText.includes('code')) return 'Application development';

  if (enumId && BITRIX_SOLUTION_ENUM_MAP[enumId]) return BITRIX_SOLUTION_ENUM_MAP[enumId];
  return 'Others';
}

const BITRIX_LOST_REASON_MAP = {
  '1386': 'Price Challenge',
  '1388': 'Lost To Competitor',
  '1390': 'Project Cancelled',
  '1392': 'No Response from Customer',
  '1436': 'Lack of follow up',
  '1438': 'Customer is reseller himself',
  '1394': 'Other'
};

function formatBitrixStage(type, stId) {
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

function parseTitleParts(title, rawRecord) {
  const rawCompany = rawRecord?.COMPANY_TITLE || rawRecord?.CONTACT_NAME;
  if (!title) return { customer: rawCompany || 'Unknown Client', solution: 'Core Solution' };
  const cleanTitle = title.replace(/\*+/g, '').trim();
  if (cleanTitle.includes('/')) {
    const parts = cleanTitle.split('/').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 3) return { customer: rawCompany || parts[0], solution: parts[2] };
    if (parts.length === 2) return { customer: rawCompany || parts[0], solution: parts[1] };
  } else if (cleanTitle.includes('|')) {
    const parts = cleanTitle.split('|').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) return { customer: rawCompany || parts[0], solution: parts[1] };
  } else if (cleanTitle.includes(' - ') || cleanTitle.includes(' – ')) {
    const parts = cleanTitle.split(/ – | - /).map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) return { customer: rawCompany || parts[0], solution: parts[parts.length - 1] };
  }
  return { customer: rawCompany || cleanTitle, solution: 'Core Solution' };
}

function processDeal(d, type) {
  const raw = d.rawRecord || {};
  const gross = parseFloat(String(d.grossRevenue || d.netRevenue || '0')) || 0;
  const isWon = type === 'won';
  const gst = reconcileGst(gross, isWon, raw.TAX_VALUE);
  const titleParts = parseTitleParts(raw.TITLE || d.customer, raw);

  const lostReasonEnum = String(raw.UF_CRM_1786343383165 || '').trim();
  const lostReasonText = raw.UF_CRM_1742536927863 || raw.UF_CRM_67EBCBB2F3CE7 || d.lostReason || '';
  const lostReason = (BITRIX_LOST_REASON_MAP[lostReasonEnum]
    ? `${BITRIX_LOST_REASON_MAP[lostReasonEnum]}${lostReasonText ? `: ${lostReasonText}` : ''}`
    : lostReasonText) || undefined;

  return {
    ...d,
    customer: titleParts.customer,
    grossRevenue: gross,
    gstAmount: gst.gstAmount,
    netRevenue: gst.netRevenue,
    industry: normalizeBitrixIndustry(raw.UF_CRM_67E4FF8E84730 || d.industry, raw),
    solution: normalizeBitrixSolutionType(raw.UF_CRM_1744361655612 || d.solution, raw),
    stage: formatBitrixStage(type, raw.STAGE_ID),
    lostReason
  };
}

cache.won = cache.won.map(d => processDeal(d, 'won'));
cache.lost = cache.lost.map(d => processDeal(d, 'lost'));
cache.progress = cache.progress.map(d => processDeal(d, 'in_progress'));

fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
console.log('✅ Reprocessed and updated server/cached_bitrix_deals.json successfully!');
