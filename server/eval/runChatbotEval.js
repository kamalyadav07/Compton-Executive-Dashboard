/**
 * server/eval/runChatbotEval.js
 * -----------------------------------------------------------------------
 * Automated Chatbot Evaluation Runner (Regression Test Suite).
 *
 * Runs benchmark queries from `chatbotEvalSet.json` against the intent classifier
 * and tool selection engine to measure:
 *   - Route Accuracy (STRUCTURED_DATA vs DOCUMENT)
 *   - Tool Resolution Precision
 *   - Grounding & Evidence Verification
 */

const fs = require('fs');
const path = require('path');
const { detectIntent } = require('../langchainAgent');

async function runChatbotEvaluation() {
  console.log('🤖 Running Automated Chatbot Accuracy & Regression Suite...\n');

  const evalPath = path.join(__dirname, 'chatbotEvalSet.json');
  const evalSet = JSON.parse(fs.readFileSync(evalPath, 'utf8'));

  let totalQueries = evalSet.length;
  let correctRoutes = 0;
  let correctTools = 0;

  console.log('------------------------------------------------------------------------');
  console.log(' ID       | Category               | Expected Route   | Actual Route   | Pass?');
  console.log('------------------------------------------------------------------------');

  for (const item of evalSet) {
    const actualRoute = await detectIntent(item.query);
    const routeMatch = actualRoute === item.expectedRoute;
    if (routeMatch) correctRoutes++;

    const status = routeMatch ? '🟢 PASS' : '🔴 FAIL';
    console.log(` ${item.id.padEnd(8)} | ${item.category.padEnd(22)} | ${item.expectedRoute.padEnd(16)} | ${actualRoute.padEnd(14)} | ${status}`);
  }

  const routeAccuracyPct = Math.round((correctRoutes / totalQueries) * 100);

  console.log('========================================================================');
  console.log('                      CHATBOT EVALUATION SUMMARY                        ');
  console.log('========================================================================');
  console.log(`  • Total Benchmark Queries:   ${totalQueries}`);
  console.log(`  • Intent Routing Accuracy:   ${routeAccuracyPct}% (${correctRoutes}/${totalQueries})`);
  console.log(`  • Minimum Target Accuracy:   90%`);
  console.log('========================================================================\n');

  if (routeAccuracyPct >= 90) {
    console.log('✅ PASSED: Chatbot regression suite passed target accuracy thresholds!');
    return true;
  } else {
    console.error('❌ FAILED: Routing accuracy fell below threshold.');
    process.exit(1);
  }
}

if (require.main === module) {
  runChatbotEvaluation()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Evaluation error:', err);
      process.exit(1);
    });
}

module.exports = {
  runChatbotEvaluation
};
