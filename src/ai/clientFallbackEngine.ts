/**
 * src/ai/clientFallbackEngine.ts
 * -----------------------------------------------------------------------
 * High-availability client-side fallback engine for Assistant Chatbot.
 * Provides instant executive intelligence, forecast projections, deal search,
 * and high-probability closes tables when backend server endpoint is unreachable.
 */

import type { DealRecord } from '../types/sales';
import { runDealIntelligence } from '../engine/dealIntelligenceEngine';
import { computeSalesProjection } from '../engine/salesProjectionEngine';

export function executeClientFallbackAnswer(userQuery: string, deals: DealRecord[]): string {
  const q = (userQuery || '').toLowerCase().trim();
  const allDeals = deals && deals.length > 0 ? deals : [];
  const openDeals = allDeals.filter(d => d.type === 'in_progress');
  const wonDeals = allDeals.filter(d => d.type === 'won');

  // 1. Sales Projection / Target queries
  if (q.includes('projection') || q.includes('target') || q.includes('hit our number') || q.includes('forecast')) {
    const targets = { monthlyTarget: 16000000, yearlyTarget: 192000000 }; // 1.60 Cr default monthly target
    const proj = computeSalesProjection(allDeals, 'month', targets);
    const revLakh = (proj.revenueToDate / 100000).toFixed(2);
    const pipeCr = (proj.pipelineValue / 10000000).toFixed(2);
    const projCr = (proj.totalProjection / 10000000).toFixed(2);
    const targetCr = (targets.monthlyTarget / 10000000).toFixed(2);
    const gapLakh = (proj.gapToTarget / 100000).toFixed(2);

    return `### Monthly Sales Projection Summary (August 2026)\n- **Monthly Target**: **₹${targetCr} Cr** (₹1.60 Cr)\n- **Booked Revenue (Net)**: **₹${revLakh} Lakh**\n- **Weighted Total Projection**: **₹${projCr} Cr** (**${proj.projectedAttainmentPct}%** target attainment)\n- **Pipeline Value**: **₹${pipeCr} Cr** across **${openDeals.length} open deals**\n- **Gap to Target**: **₹${gapLakh} Lakh**\n\n${proj.topDealsLikelyToClose && proj.topDealsLikelyToClose.length > 0 ? `> [!NOTE]\n> **Top Near-Term Closes**: ${proj.topDealsLikelyToClose.map(d => `${d.dealId} (${d.company || d.dealName || d.salesRep})`).join(', ')}\n` : ''}`;
  }

  // 2. Near-term closes / 15-day / 7-day
  if (q.includes('close') || q.includes('15 days') || q.includes('7 days') || q.includes('likely to close')) {
    const { results } = runDealIntelligence(allDeals);
    const topCloses = results
      .filter(r => r.closesWithin15DaysPct >= 50)
      .slice(0, 10);

    if (topCloses.length === 0) {
      return `### High-Probability Closes (Next 15 Days)\nNo open deals currently meet the ≥50% close likelihood threshold for the next 15 days across **${openDeals.length} open deals**.`;
    }

    return `### High-Probability Closes (Next 15 Days)\nFound **${topCloses.length} open deals** likely to close within 15 days (≥50% close probability).\n\n| Bitrix Deal ID | Deal Name & Customer | Sales Rep | Net Value | Stage | Date |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n${topCloses.map(r => {
      const title = r.deal.rawRecord?.TITLE || (r.deal.solution ? `${r.deal.customer} / ${r.deal.solution}` : r.deal.customer);
      const rep = r.deal.salesRep || 'Unassigned';
      const val = `₹${(r.deal.grossRevenue || 0).toLocaleString('en-IN')}`;
      return `| ${r.deal.id} | ${title} | ${rep} | ${val} | ${r.deal.stage} | ${r.deal.date || 'Near-term'} |`;
    }).join('\n')}`;
  }

  // 3. Sales-rep ranking / leaderboard questions (e.g. "which sales rep has
  // the highest revenue"). Must run before the generic search below, since
  // these questions have no company/deal name to search for.
  const isRankingQuestion = /\b(highest|lowest|top|best|worst|most|least|leaderboard|rank|ranking)\b/.test(q)
    && /\b(rep|sales ?rep|salesperson|performer|revenue|sales)\b/.test(q);
  if (isRankingQuestion) {
    const byRep = new Map<string, { rep: string; wonRevenue: number; wonCount: number; lostCount: number }>();
    for (const d of allDeals) {
      const rep = d.salesRep || 'Unassigned';
      if (!byRep.has(rep)) byRep.set(rep, { rep, wonRevenue: 0, wonCount: 0, lostCount: 0 });
      const entry = byRep.get(rep)!;
      if (d.type === 'won') { entry.wonRevenue += (d.grossRevenue || 0); entry.wonCount += 1; }
      if (d.type === 'lost') entry.lostCount += 1;
    }
    const wantsLowest = /\b(lowest|worst|least)\b/.test(q);
    const ranked = [...byRep.values()]
      .filter(r => r.rep !== 'Unassigned')
      .sort((a, b) => wantsLowest ? a.wonRevenue - b.wonRevenue : b.wonRevenue - a.wonRevenue);

    if (ranked.length === 0) {
      return `### Sales Rep Leaderboard\nNo sales-rep-attributed deals were found in the currently loaded data.`;
    }
    const top = ranked[0];
    return `### Sales Rep Leaderboard (by Won Revenue)\n**${top.rep}** has the ${wantsLowest ? 'lowest' : 'highest'} won revenue at **₹${(top.wonRevenue / 100000).toFixed(2)} Lakh** across **${top.wonCount} won deals**.\n\n| Sales Rep | Won Revenue | Won Deals | Lost Deals |\n| :--- | :--- | :--- | :--- |\n${ranked.slice(0, 10).map(r => `| ${r.rep} | ₹${(r.wonRevenue / 100000).toFixed(2)} Lakh | ${r.wonCount} | ${r.lostCount} |`).join('\n')}`;
  }

  // 4. Search specific deal by ID or Customer term
  const words = q.split(/\s+/);
  const ignoreWords = new Set([
    'recent', 'all', 'deals', 'deal', 'won', 'lost', 'open', 'in', 'july', 'august', 'june', 'may',
    'and', 'its', 'value', 'show', 'list', 'the', 'for', 'rep', 'reps',
    'what', 'which', 'who', 'whom', 'whose', 'why', 'how', 'has', 'have', 'had',
    'is', 'are', 'was', 'were', 'does', 'do', 'did', 'can', 'could', 'would', 'should',
    'highest', 'lowest', 'top', 'best', 'worst', 'most', 'least', 'about', 'our', 'company'
  ]);
  const searchTerms = words.filter(w => w.length >= 3 && !ignoreWords.has(w));

  if (searchTerms.length > 0) {
    const term = searchTerms[0];
    const matchedDeals = allDeals.filter(d =>
      String(d.id).toLowerCase().includes(term) ||
      (d.customer && d.customer.toLowerCase().includes(term)) ||
      (d.rawRecord?.TITLE && d.rawRecord.TITLE.toLowerCase().includes(term)) ||
      (d.salesRep && d.salesRep.toLowerCase().includes(term))
    );

    if (matchedDeals.length > 0) {
      const displayDeals = matchedDeals.slice(0, 10);
      const totalVal = displayDeals.reduce((sum, d) => sum + (d.grossRevenue || 0), 0);
      return `### Search Results for "${term.toUpperCase()}"\nFound **${matchedDeals.length} matching deals** (totaling **₹${(totalVal / 100000).toFixed(2)} Lakh**).\n\n| Bitrix Deal ID | Deal Name & Customer | Sales Rep | Net Value | Stage | Date |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n${displayDeals.map(d => {
        const title = d.rawRecord?.TITLE || (d.solution ? `${d.customer} / ${d.solution}` : d.customer);
        const rep = d.salesRep || 'Unassigned';
        const val = `₹${(d.grossRevenue || 0).toLocaleString('en-IN')}`;
        return `| ${d.id} | ${title} | ${rep} | ${val} | ${d.stage} | ${d.date || '2026-08-12'} |`;
      }).join('\n')}`;
    }
    // No matches — fall through to the default overview instead of
    // silently returning the whole unfiltered dataset mislabeled as a match.
  }

  // 5. Default Executive Pipeline Overview
  const totalOpenVal = openDeals.reduce((s, d) => s + (d.grossRevenue || 0), 0);
  const totalWonVal = wonDeals.reduce((s, d) => s + (d.grossRevenue || 0), 0);

  return `### Executive Sales Intelligence Summary\n- **Active Open Pipeline**: **₹${(totalOpenVal / 10000000).toFixed(2)} Cr** across **${openDeals.length} open deals**\n- **Total Won Revenue**: **₹${(totalWonVal / 10000000).toFixed(2)} Cr** across **${wonDeals.length} closed-won deals**\n\n> [!TIP]\n> You can ask specific questions like:\n> * *"Which deals are most likely to close in the next 15 days?"*\n> * *"What is my company sales projection this month?"*\n> * *"Show deals for Sandeep Vahi"*`;
}