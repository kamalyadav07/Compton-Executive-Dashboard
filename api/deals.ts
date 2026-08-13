import type { VercelRequest, VercelResponse } from '@vercel/node';

// Cache deal sync result in memory across serverless warm starts (60s TTL)
let serverlessCache: { data: any; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 1000;

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

  try {
    const webhookUrl = process.env.BITRIX_WEBHOOK_URL || process.env.VITE_BITRIX_WEBHOOK_URL || 'https://compton.bitrix24.in/rest/212/ml282niaoub4hrkz/';
    const cleanBaseUrl = webhookUrl.endsWith('/') ? webhookUrl : `${webhookUrl}/`;

    // Return warm memory cache if fresh
    const now = Date.now();
    if (serverlessCache && (now - serverlessCache.timestamp < CACHE_TTL_MS)) {
      return res.status(200).json(serverlessCache.data);
    }

    // 1. Fetch deal list
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
    let allDeals: any[] = firstJson.result || [];
    const totalDeals = firstJson.total || 0;

    // Fetch remaining pages sequentially with rate limit delay
    if (totalDeals > 50) {
      for (let s = 50; s < totalDeals; s += 50) {
        await new Promise(r => setTimeout(r, 300));
        const pageQp = new URLSearchParams();
        pageQp.append('FILTER[>DATE_CREATE]', '2019-01-01');
        pageQp.append('SELECT[]', '*');
        pageQp.append('SELECT[]', 'UF_*');
        pageQp.append('start', String(s));

        try {
          const pRes = await fetch(`${cleanBaseUrl}crm.deal.list.json?${pageQp.toString()}`);
          if (pRes.ok) {
            const pJson: any = await pRes.json();
            if (pJson.result && Array.isArray(pJson.result)) {
              allDeals = allDeals.concat(pJson.result);
            }
          }
        } catch (_) {}
      }
    }

    // Filter Category 6 (Sales Funnel)
    const targetDeals = allDeals.filter((d: any) => String(d.CATEGORY_ID || '0') === '6');

    // 2. Fetch Leads
    let leads: any[] = [];
    try {
      const lQp = new URLSearchParams();
      lQp.append('FILTER[>DATE_CREATE]', '2019-01-01');
      lQp.append('SELECT[]', '*');
      lQp.append('SELECT[]', 'UF_*');
      lQp.append('start', '0');
      const lRes = await fetch(`${cleanBaseUrl}crm.lead.list.json?${lQp.toString()}`);
      if (lRes.ok) {
        const lJson: any = await lRes.json();
        leads = lJson.result || [];
      }
    } catch (_) {}

    // Map deals into won, lost, progress
    const won: any[] = [];
    const lost: any[] = [];
    const progress: any[] = [];

    const shortMonthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    targetDeals.forEach((deal: any, idx: number) => {
      const semantic = String(deal.STAGE_SEMANTIC_ID || '').toUpperCase();
      const stageId = String(deal.STAGE_ID || '').toUpperCase();
      const isClosed = deal.CLOSED === 'Y';

      let dealType = 'in_progress';
      if (semantic === 'S' || stageId.includes('WON') || stageId.includes('SUCCESS')) {
        dealType = 'won';
      } else if (semantic === 'F' || stageId.includes('LOSE') || stageId.includes('LOST') || stageId.includes('FAIL')) {
        dealType = 'lost';
      } else if (!isClosed || semantic === 'P') {
        dealType = 'in_progress';
      }

      const revenue = parseFloat(deal.OPPORTUNITY || '0') || 0;
      const isWonDeal = dealType === 'won';
      const GST_RATE = 0.18;
      const netRevenue = isWonDeal ? Math.round((revenue / (1 + GST_RATE)) * 100) / 100 : revenue;
      const gstAmount = isWonDeal ? Math.round((revenue - netRevenue) * 100) / 100 : 0;

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
      else {
        if (stageId.includes('NEW')) stageName = 'Need Analysis';
        else if (stageId.includes('UC_U1DIM3')) stageName = 'Solution Design';
        else if (stageId.includes('PREPARATION')) stageName = 'Solution Approval';
        else if (stageId.includes('PREPAYMENT')) stageName = 'Quote Creation';
        else if (stageId.includes('EXECUTING')) stageName = 'Quote Approval';
        else if (stageId.includes('UC_OQLF1D') || stageId.includes('NEGOTIAT')) stageName = 'Negotiation';
      }

      const mappedDeal = {
        id: String(deal.ID || `deal-${idx}`),
        customer: String(deal.TITLE || 'Direct Customer').split('-')[0].trim(),
        solution: 'Core Solution',
        revenue,
        netRevenue,
        gstAmount,
        stage: stageName,
        dealType,
        closingDate: dateInfo.isoDate,
        salesRep: 'Compton Sales Rep',
        salesCycleDays: 14,
        monthYear: dateInfo.monthYear,
        quarter: dateInfo.quarter,
        year: dateInfo.year,
        bitrixId: String(deal.ID || ''),
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
      totalFetchedLeads: leads.length,
      lastSyncedAt: new Date().toISOString(),
      status: 'success',
      message: `Successfully loaded ${targetDeals.length} sales pipeline deals (${won.length} won, ${lost.length} lost, ${progress.length} in-progress).`
    };

    serverlessCache = { data: result, timestamp: now };
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message || 'Serverless deal sync failed' });
  }
}
