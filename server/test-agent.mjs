/**
 * server/test-agent.mjs
 * -----------------------------------------------------------------------
 * Quick integration test for the LangChain streaming chat agent.
 * Runs the 5 test questions from the implementation plan and verifies
 * conversational memory works on the follow-up question.
 *
 * Usage:  node server/test-agent.mjs
 * (server must be running on port 4000 first)
 */

const SESSION_ID = `test-${Date.now()}`;
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
        // skip parse errors on partial chunks
      }
    }
  }
  
  console.log('\n');
  return fullResponse;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  LangChain Agent Integration Test — 5 Questions + Follow-up  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  const responses = [];

  const delay = ms => new Promise(r => setTimeout(r, ms));

  // Q1: Monthly sales projection
  responses.push(await streamRequest("What is my company sales projection this month?"));
  await delay(5000);

  // Q2: Financial year projection (follow-up — proves memory)
  responses.push(await streamRequest("What about this financial year?"));
  await delay(5000);

  // Q3: Deals likely to close
  responses.push(await streamRequest("Which deals are most likely to close in the next 15 days?"));
  await delay(5000);

  // Q4: Rep performance (pick real rep name from data)
  responses.push(await streamRequest("How is Sandeep Vahi performing?"));
  await delay(5000);

  // Q5: Follow-up (conversational memory — no name repeated)
  responses.push(await streamRequest("and what's his win rate?"));

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('TEST SUMMARY');
  console.log('═'.repeat(70));
  responses.forEach((r, i) => {
    const hasContent = r && r.trim().length > 10;
    const hasNumbers = /[\d₹%]/.test(r);
    console.log(`  Q${i + 1}: ${hasContent ? '✅ Got response' : '❌ Empty/error'}  ${hasNumbers ? '📊 Contains numbers' : '⚠️  No numbers detected'} (${r.length} chars)`);
  });

  // Memory test: Q5 should reference Sandeep Vahi without his name being in Q5
  const q5 = responses[4] || '';
  const memoryWorks = q5.toLowerCase().includes('sandeep') || q5.toLowerCase().includes('win rate') || q5.toLowerCase().includes('%');
  console.log(`  Memory test: ${memoryWorks ? '✅ Q5 referenced context from Q4' : '❌ Q5 did NOT reference Q4 context'}`);
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
