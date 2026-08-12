import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  extractQualitativeRiskSignals,
  ensembleAdjustWinProbability,
  computeRealCommentQuietDays
} from '../src/engine/qualitativeRiskEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║   Qualitative Risk Signal Hand-Verification & Ensemble Test           ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

  const cachePath = path.resolve(__dirname, 'cached_bitrix_deals.json');
  if (!fs.existsSync(cachePath)) {
    console.error('❌ Cache file not found at:', cachePath);
    return;
  }

  const rawCache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  const deals = [
    ...(rawCache.won || []),
    ...(rawCache.lost || []),
    ...(rawCache.progress || [])
  ];
  console.log(`📥 Loaded ${deals.length} total deals from Bitrix disk cache.\n`);

  // Find 5 open in-progress deals
  const testDeals = (rawCache.progress || []).slice(0, 5);

  if (testDeals.length === 0) {
    console.log('⚠️ No deals with comments found, fallback to sample deals.');
  }

  for (let i = 0; i < testDeals.length; i++) {
    const deal = testDeals[i];
    const baseWinProbabilityPct = 75; // Baseline test score

    const quietDays = computeRealCommentQuietDays(deal);
    const signals = extractQualitativeRiskSignals(deal, []);
    const ensemble = ensembleAdjustWinProbability(baseWinProbabilityPct, signals);

    console.log(`───────────────────────────────────────────────────────────────────────────`);
    console.log(`DEAL #${i + 1}: ${deal.id} — ${deal.customer}`);
    console.log(`Title: ${deal.rawRecord?.TITLE || deal.customer}`);
    console.log(`Sales Rep: ${deal.salesRep} | Stage: ${deal.stage} | Status: ${deal.type}`);
    console.log(`Raw Comment Text:\n"${(deal.comments || '').trim().replace(/\n+/g, ' ')}"`);
    console.log(`─`.repeat(75));
    console.log(`EXTRACTED SIGNALS:`);
    console.log(`  • Quiet Days: ${quietDays} days (Customer Quiet: ${signals.customerWentQuiet})`);
    console.log(`  • Competitor Mentioned: ${signals.competitorMentioned}`);
    console.log(`  • Decision Maker Changed: ${signals.decisionMakerChanged}`);
    console.log(`  • Scope/Price Revised: ${signals.scopeOrPriceChangedRecently}`);
    console.log(`  • Urgency Detected: ${signals.urgencyLanguageDetected}${signals.extractedUrgencyDate ? ` (Date: ${signals.extractedUrgencyDate})` : ''}`);
    console.log(`  • Qualitative Notes: ${signals.qualitativeNotes}`);
    console.log(`\nENSEMBLE PROBABILITY ADJUSTMENT:`);
    console.log(`  • Base Win Probability: ${ensemble.baseWinProbabilityPct}%`);
    console.log(`  • Adjusted Win Probability: ${ensemble.adjustedWinProbabilityPct}% (Multiplier: ${ensemble.adjustmentMultiplier}x)`);
    console.log(`  • Active Badges: ${ensemble.activeSignals.map(s => s.label).join(', ') || 'None'}`);
    console.log(`  • Explanation: ${ensemble.explanation}\n`);
  }
}

main().catch(console.error);
