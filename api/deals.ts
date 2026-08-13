import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';

// Cache deal sync result in memory across serverless warm starts
let serverlessCache: any = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Attempt 1: In-memory warm cache
  if (serverlessCache) {
    return res.status(200).json(serverlessCache);
  }

  // Attempt 2: Bundled disk cache from server/cached_bitrix_deals.json (Instant <5ms load on Vercel)
  try {
    const diskCachePath = path.join(process.cwd(), 'server', 'cached_bitrix_deals.json');
    if (fs.existsSync(diskCachePath)) {
      const fileData = fs.readFileSync(diskCachePath, 'utf8');
      const parsed = JSON.parse(fileData);
      if (parsed && Array.isArray(parsed.won) && parsed.won.length > 0) {
        serverlessCache = parsed;
        return res.status(200).json(parsed);
      }
    }
  } catch (err: any) {
    console.warn('[api/deals] Failed to read server/cached_bitrix_deals.json:', err?.message);
  }

  // Attempt 3: Live Bitrix fetch fallback if disk cache is unavailable
  try {
    const webhookUrl = process.env.BITRIX_WEBHOOK_URL || process.env.VITE_BITRIX_WEBHOOK_URL || 'https://compton.bitrix24.in/rest/212/ml282niaoub4hrkz/';
    const cleanBaseUrl = webhookUrl.endsWith('/') ? webhookUrl : `${webhookUrl}/`;

    const qp = new URLSearchParams();
    qp.append('FILTER[>DATE_CREATE]', '2019-01-01');
    qp.append('SELECT[]', '*');
    qp.append('SELECT[]', 'UF_*');
    qp.append('start', '0');

    const firstRes = await fetch(`${cleanBaseUrl}crm.deal.list.json?${qp.toString()}`);
    if (!firstRes.ok) {
      return res.status(500).json({ status: 'error', message: `Bitrix HTTP ${firstRes.status}` });
    }

    const firstJson: any = await firstRes.json();
    const allDeals: any[] = firstJson.result || [];
    const targetDeals = allDeals.filter((d: any) => String(d.CATEGORY_ID || '0') === '6');

    const won: any[] = [];
    const lost: any[] = [];
    const progress: any[] = [];

    const shortMonthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
      const GST_RATE = 0.18;
      const netRevenue = isWonDeal ? Math.round((grossRevenue / (1 + GST_RATE)) * 100) / 100 : grossRevenue;
      const gstAmount = isWonDeal ? Math.round((grossRevenue - netRevenue) * 100) / 100 : 0;

      let dt = new Date();
      const dateStr = (dealType === 'won' || dealType === 'lost')
        ? (deal.CLOSEDATE || deal.DATE_MODIFY || deal.DATE_CREATE)
        : (deal.DATE_CREATE || deal.CLOSEDATE);
      if (dateStr) {
        const p = new Date(String(dateStr).trim().replace(' ', 'T'));
        if (!isNaN(p.getTime())) dt = p;
      }

      const y = dt.getFullYear();
      const mIdx = dt.getMonth();
      const dNum = String(dt.getDate()).padStart(2, '0');
      const mNum = String(mIdx + 1).padStart(2, '0');

      const dateInfo = {
        isoDate: `${y}-${mNum}-${dNum}`,
        monthYear: `${shortMonthNames[mIdx]} ${y}`,
        year: y,
        quarter: `Q${Math.floor(mIdx / 3) + 1} ${y}`
      };

      let stageName = 'Need Analysis';
      if (dealType === 'won') stageName = 'Won';
      else if (dealType === 'lost') stageName = 'Lost';

      const mappedDeal = {
        id: String(deal.ID ? `BITRIX-${deal.ID}` : `B24-${idx + 1000}`),
        customer: String(deal.TITLE || 'Direct Customer').split('/')[0].trim(),
        solution: 'Core Solution',
        grossRevenue,
        netRevenue,
        gstAmount,
        stage: stageName,
        type: dealType,
        date: dateInfo.isoDate,
        salesRep: 'Compton Sales Rep',
        salesCycleDays: 14,
        monthYear: dateInfo.monthYear,
        quarter: dateInfo.quarter,
        year: dateInfo.year,
        industry: 'General Industry',
        leadSource: 'Self Generated',
        rawRecord: deal
      };

      if (dealType === 'won') won.push(mappedDeal);
      else if (dealType === 'lost') lost.push(mappedDeal);
      else progress.push(mappedDeal);
    });

    const result = {
      won,
      lost,
      progress,
      leads: [],
      qualifiedLeadsCount: 0,
      disqualifiedLeadsCount: 0,
      inProgressLeadsCount: 0,
      totalFetchedDeals: allDeals.length,
      totalFetchedLeads: 0,
      lastSyncedAt: new Date().toISOString(),
      status: 'success',
      message: `Successfully loaded ${targetDeals.length} sales pipeline deals.`
    };

    serverlessCache = result;
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message || 'Serverless deal sync failed' });
  }
}
