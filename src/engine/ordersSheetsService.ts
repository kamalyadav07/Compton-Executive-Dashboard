import type { OrderRecord } from '../types/orders';
import { convertToCsvExportUrl } from '../config/sheetsConfig';
import { splitGst } from '../utils/financeUtils';
import { mapBitrixAssignedUser } from './bitrixService';

const DEFAULT_ORDERS_SHEET_FALLBACK = 'https://docs.google.com/spreadsheets/d/1HUkXoXIBgEBghfoVvazgunX-Cq66YTEHd96ke1scugo/edit?gid=1388928136#gid=1388928136';
export const DEFAULT_ORDERS_SHEET_URL = import.meta.env.VITE_ORDERS_SHEET_URL || DEFAULT_ORDERS_SHEET_FALLBACK;

const STORAGE_KEY = 'sales_dashboard_orders_sheet_url_v2';

export const getStoredOrdersSheetUrl = (): string => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored || stored.trim() === '' || stored.includes('1-HRp_m7bQkFUifOEV8wI8Yn2OpAMJtOnu6mH-lxUbfU') || !stored.includes('1HUkXoXIBgEBghfoVvazgunX-Cq66YTEHd96ke1scugo')) {
      localStorage.setItem(STORAGE_KEY, DEFAULT_ORDERS_SHEET_URL);
      return DEFAULT_ORDERS_SHEET_URL;
    }
    return stored;
  } catch {
    return DEFAULT_ORDERS_SHEET_URL;
  }
};

export const saveStoredOrdersSheetUrl = (url: string): void => {
  try {
    localStorage.setItem(STORAGE_KEY, url.trim());
  } catch (err) {
    console.warn("Could not save Orders Sheet URL:", err);
  }
};

// Robust CSV Row Parser handling double quotes and escaped commas inside values
const parseCsvLine = (text: string): string[] => {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(cur.replace(/^"|"$/g, '').trim());
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur.replace(/^"|"$/g, '').trim());
  return result;
};

export const fetchOrdersSheetData = async (
  rawUrl: string
): Promise<{ orders: OrderRecord[]; status: 'success' | 'error' | 'permission_error'; message: string }> => {
  if (!rawUrl) {
    return { orders: [], status: 'error', message: 'No Orders Google Sheet URL provided.' };
  }

  const baseCsvUrl = convertToCsvExportUrl(rawUrl);
  const csvUrl = `${baseCsvUrl}${baseCsvUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`;

  try {
    const res = await fetch(csvUrl, {
      method: 'GET',
      headers: { 
        'Accept': 'text/csv,text/plain,application/csv,*/*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { orders: [], status: 'permission_error', message: 'Sheet is private. Change Google Sheet sharing to "Anyone with link can view".' };
      }
      throw new Error(`HTTP ${res.status}`);
    }

    const text = await res.text();

    if (text.includes('<!DOCTYPE html>') || text.includes('<html') || text.includes('accounts.google.com')) {
      return { orders: [], status: 'permission_error', message: 'Permission Required: Set Google Sheet sharing to "Anyone with link can view".' };
    }

    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length <= 1) {
      return { orders: [], status: 'success', message: 'No data rows found in Google Sheet.' };
    }

    // Locate true column header row (skipping banner/title rows)
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(lines.length, 8); i++) {
      const parsed = parseCsvLine(lines[i]).map(h => h.toLowerCase());
      const matchCount = parsed.filter(h => 
        h.includes('deal id') || 
        h.includes('deal name') || 
        h.includes('deal value') || 
        h.includes('billed value') || 
        h.includes('created date') || 
        h.includes('billing status') ||
        h === 's/n' ||
        h === 'ccpl no.'
      ).length;

      if (matchCount >= 2) {
        headerRowIdx = i;
        break;
      }
    }
    if (headerRowIdx === -1) headerRowIdx = 0;

    const headers = parseCsvLine(lines[headerRowIdx]).map(h => h.toLowerCase());

    const findCol = (keywords: string[]): number => {
      return headers.findIndex(h => keywords.some(k => h.includes(k)));
    };

    const idxDealId = findCol(['deal id', 'id']);
    const idxDealName = findCol(['deal name', 'title', 'order name', 'project name']);
    const idxValWithTax = findCol(['deal value with tax', 'value with tax']);
    const idxValNet = findCol(['deal value without tax', 'without tax', 'net']);
    const idxBilledVal = findCol(['billed value']);
    const idxIsoCreated = findCol(['iso created date', 'created date']);
    const idxBillingDate = findCol(['billing date', 'billed date']);
    const idxStatus = findCol(['billing status', 'status']);

    const orders: OrderRecord[] = [];

    for (let i = headerRowIdx + 1; i < lines.length; i++) {
      const row = parseCsvLine(lines[i]);
      if (row.length === 0 || !row.some(r => r.length > 0)) continue;

      const rawDealId = idxDealId >= 0 ? row[idxDealId] : row[1] || `${i}`;
      const dealId = String(rawDealId).replace(/[^0-9]/g, '') || String(rawDealId);
      if (!dealId || dealId.length === 0) continue;

      const dealName = idxDealName >= 0 ? row[idxDealName] : row[2] || 'Sales Order';
      
      let customerName = '';
      if (dealName.includes('/')) {
        customerName = dealName.split('/')[0].trim();
      } else {
        customerName = dealName;
      }

      // Parse Amount (without 18% GST)
      const rawAmtWithTax = idxValWithTax >= 0 ? row[idxValWithTax] : '';
      const rawAmtNet = idxValNet >= 0 ? row[idxValNet] : '';
      const rawBilledVal = idxBilledVal >= 0 ? row[idxBilledVal] : '';
      
      const numWithTax = parseFloat(String(rawAmtWithTax || '').replace(/,/g, '')) || 0;
      const numNet = parseFloat(String(rawAmtNet || '').replace(/,/g, '')) || 0;
      const numBilled = parseFloat(String(rawBilledVal || '').replace(/,/g, '')) || 0;

      const isoCreationDate = idxIsoCreated >= 0 ? row[idxIsoCreated] : '';
      const billingDate = idxBillingDate >= 0 ? row[idxBillingDate] : '';
      const rawStatus = idxStatus >= 0 ? row[idxStatus] : '';

      // Clean Status rule: Billed if status is "Billed" OR billingDate is present
      const isBilled = (rawStatus && rawStatus.toLowerCase().includes('billed') && !rawStatus.toLowerCase().includes('unbilled')) ||
                       (billingDate && billingDate.trim().length > 0 && billingDate !== '-');

      const status: 'Billed' | 'Unbilled' = isBilled ? 'Billed' : 'Unbilled';

      let amount = 0;
      if (isBilled && numBilled > 0) {
        amount = numBilled;
      } else if (numNet > 0) {
        amount = numNet;
      } else if (numWithTax > 0) {
        amount = splitGst(numWithTax, true).netRevenue;
      } else if (numBilled > 0) {
        amount = numBilled;
      }

      orders.push({
        id: `ORD-${dealId}`,
        dealId: dealId,
        sNo: orders.length + 1,
        customerName,
        dealName,
        salesRep: mapBitrixAssignedUser('', `${customerName} ${dealName}`),
        amount,
        orderDate: isoCreationDate || '',
        billedDate: isBilled ? (billingDate || 'Billed') : 'Unbilled',
        status,
        rawRecord: { row }
      });
    }

    return {
      orders,
      status: 'success',
      message: ''
    };
  } catch (err: any) {
    console.error("Error fetching Orders Google Sheet:", err);
    return { orders: [], status: 'error', message: err.message || 'Failed to fetch Orders Google Sheet.' };
  }
};
