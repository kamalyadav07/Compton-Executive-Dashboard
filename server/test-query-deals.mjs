/**
 * server/test-query-deals.mjs
 * -----------------------------------------------------------------------
 * Test suite for query_deals tool with the 5 required test questions.
 */

const SESSION_ID = `test-qd-${Date.now()}`;
const API = 'http://localhost:4000/api/chat/stream';

async function streamRequest(message) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`USER: ${message}`);
  console.log('─'.repeat(70));

  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId: SESSION_ID })
  });

  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${await res.text()}`);
    return '';
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullResponse = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6);
      if (payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload);
        if (parsed.token) {
          process.stdout.write(parsed.token);
          fullResponse += parsed.token;
        }
        if (parsed.error) {
          console.error('\nERROR:', parsed.error);
        }
      } catch (e) {
        // skip
      }
    }
  }

  console.log('\n');
  return fullResponse;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║        query_deals Tool Test Suite — 5 Test Questions        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  const questions = [
    "which deals have had no update in the last 10 days",
    "how many deals came from the Healthcare industry this quarter",
    "list lost deals over ₹5 lakh",
    "what's our average deal size this year",
    "which sales rep has the most stale deals right now."
  ];

  const delay = ms => new Promise(r => setTimeout(r, ms));
  const results = [];

  for (let i = 0; i < questions.length; i++) {
    console.log(`\n--- [Question ${i+1}/${questions.length}] ---`);
    const resp = await streamRequest(questions[i]);
    results.push({ question: questions[i], response: resp });
    if (i < questions.length - 1) await delay(12000);
  }

  console.log('\n' + '═'.repeat(70));
  console.log('TEST RESULTS SUMMARY');
  console.log('═'.repeat(70));
  results.forEach((r, i) => {
    const ok = r.response && r.response.trim().length > 10;
    console.log(`Q${i+1}: ${ok ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`   Question: ${r.question}`);
    console.log(`   Length:   ${r.response ? r.response.length : 0} chars`);
  });
}

main().catch(console.error);
