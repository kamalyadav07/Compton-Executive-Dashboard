/**
 * src/utils/textUtils.ts
 * -----------------------------------------------------------------------
 * Shared utility for sanitizing and formatting deal titles and text strings.
 */

/**
 * Strips HTML tags, decodes HTML entities, and removes stray Markdown junk
 * (like literal asterisks or bold tags inside title text) from raw Bitrix deal titles.
 */
export function cleanDealTitle(rawTitle: string | undefined | null): string {
  if (!rawTitle) return '';

  let cleaned = String(rawTitle);

  // 1. Remove HTML tags (e.g. <br>, <p>, <span>, <div>, etc.)
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');

  // 2. Unescape common HTML entities
  cleaned = cleaned
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // 3. Remove stray Markdown formatting characters (e.g., literal * or _ or `)
  cleaned = cleaned.replace(/[*_`~]/g, '');

  // 4. Collapse multiple spaces / whitespace into single space and trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Formats a clean deal display label with optional Bitrix ID.
 */
export function formatDealLabel(title: string | undefined | null, dealId?: string | null): string {
  const clean = cleanDealTitle(title);
  if (!clean) return dealId ? `Deal (${dealId})` : 'Untitled Deal';
  if (dealId && !clean.toLowerCase().includes(dealId.toLowerCase())) {
    return `${clean} (${dealId})`;
  }
  return clean;
}
