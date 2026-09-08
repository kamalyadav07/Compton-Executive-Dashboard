export interface MonthInfo {
  name: string;
  short: string;
  num: number;
}

export const MONTH_INFO: MonthInfo[] = [
  { name: 'january', short: 'jan', num: 1 },
  { name: 'february', short: 'feb', num: 2 },
  { name: 'march', short: 'mar', num: 3 },
  { name: 'april', short: 'apr', num: 4 },
  { name: 'may', short: 'may', num: 5 },
  { name: 'june', short: 'jun', num: 6 },
  { name: 'july', short: 'jul', num: 7 },
  { name: 'august', short: 'aug', num: 8 },
  { name: 'september', short: 'sep', num: 9 },
  { name: 'october', short: 'oct', num: 10 },
  { name: 'november', short: 'nov', num: 11 },
  { name: 'december', short: 'dec', num: 12 }
];

/**
 * Normalizes Indian/Sheet dates like 9/8/2026 1:00:00 or 13/08/2026 into standard YYYY-MM-DD format
 */
export const normalizeSheetDateToIso = (dateStr: string | undefined | null): string => {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const trimmed = dateStr.trim();
  if (!trimmed || trimmed === '-' || trimmed === 'N/A' || trimmed === 'Unbilled') return '';

  const [datePart, timePart] = trimmed.split(/\s+/);
  const parts = datePart.split(/[-/.]/);
  if (parts.length === 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);

    if (p0 >= 2000 && p0 <= 2100) {
      // YYYY-MM-DD
      const mm = String(p1).padStart(2, '0');
      const dd = String(p2).padStart(2, '0');
      return timePart ? `${p0}-${mm}-${dd} ${timePart}` : `${p0}-${mm}-${dd}`;
    } else if (p2 >= 2000 && p2 <= 2100) {
      // DD/MM/YYYY (Indian standard in Google Sheets)
      const dd = String(p0).padStart(2, '0');
      const mm = String(p1).padStart(2, '0');
      return timePart ? `${p2}-${mm}-${dd} ${timePart}` : `${p2}-${mm}-${dd}`;
    }
  }
  return trimmed;
};

/**
 * Robust date matching supporting:
 * - Textual months: "1 July", "4 August", "31 July 2026"
 * - Numeric dates: "9/8/2026 1:00:00" (Aug 9), "2026-08-09", "13/08/2026"
 * - Filter formats: "Sep 2026", "Aug 2026", "September", "2026", "All Dates"
 */
export function matchesDateFilter(dateStr: string | undefined | null, filterVal: string | undefined | null): boolean {
  if (!filterVal || filterVal === 'All Dates' || filterVal === 'Custom Range' || filterVal === 'All') return true;
  if (!dateStr || dateStr === 'N/A' || dateStr === 'Unbilled' || dateStr === '-') return false;

  const str = String(dateStr).trim().toLowerCase();
  const f = String(filterVal).trim().toLowerCase();

  // 1. Direct substring match (e.g. if filter is just "2026" or exact string)
  if (str === f) return true;

  // 2. Year check if filter explicitly contains a 4-digit year like 2026
  const filterYearMatch = f.match(/\b(202\d)\b/);
  const filterYear = filterYearMatch ? filterYearMatch[1] : null;

  const dateYearMatch = str.match(/\b(202\d)\b/);
  const dateYear = dateYearMatch ? dateYearMatch[1] : null;

  if (filterYear) {
    if (dateYear && dateYear !== filterYear) return false;
    // If date string contains no year (e.g. "1 July"), allow matching the target month if filter specifies a year
  }

  // 3. Find target month from filterVal
  let targetMonthIdx = -1;
  for (let i = 0; i < MONTH_INFO.length; i++) {
    const m = MONTH_INFO[i];
    if (f.includes(m.name) || f.includes(m.short)) {
      targetMonthIdx = i;
      break;
    }
  }

  // If filter has no month specified, match by year or substring
  if (targetMonthIdx === -1) {
    return filterYear ? (dateYear === filterYear || str.includes(filterYear)) : str.includes(f);
  }

  const targetMonthNum = targetMonthIdx + 1;

  // 4. Check if dateStr contains textual month names (e.g. "31 July 2026", "4 August")
  for (let i = 0; i < MONTH_INFO.length; i++) {
    const m = MONTH_INFO[i];
    if (str.includes(m.name) || new RegExp(`\\b${m.short}\\b`, 'i').test(str)) {
      if (i === targetMonthIdx) {
        if (filterYear && dateYear) {
          return dateYear === filterYear;
        }
        return true;
      }
      // Explicitly contains a different month name -> does NOT match target month
      return false;
    }
  }

  // 5. Match month in numeric form (e.g. 5/8/2026, 2026-08-05, 05/08/2026, 9/8/2026)
  const parts = str.split(/[\sT]+/)[0].split(/[-/.]/);
  if (parts.length === 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);

    let monthNum = -1;
    let yearNum = -1;

    if (p0 >= 2000 && p0 <= 2100) {
      // ISO: YYYY-MM-DD
      yearNum = p0;
      monthNum = p1;
    } else if (p2 >= 2000 && p2 <= 2100) {
      // Date with 4-digit year at end: DD/MM/YYYY (Indian standard in Google Sheets)
      yearNum = p2;
      if (p1 > 12) {
        // MM/DD/YYYY if middle number > 12
        monthNum = p0;
      } else {
        // Standard DD/MM/YYYY: p1 is Month
        monthNum = p1;
      }
    }

    if (monthNum !== -1) {
      if (filterYear && yearNum !== -1 && String(yearNum) !== filterYear) {
        return false;
      }
      return monthNum === targetMonthNum;
    }
  }

  return false;
}
