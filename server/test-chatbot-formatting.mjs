import fetch from 'node-fetch';

const API = 'http://localhost:4000/api/chat/stream';
const SESSION_ID = `fmt-test-${Date.now()}`;

async function sendQuery(query) {
  console.log(`\n===========================================================================`);
  console.log(`USER: ${query}`);
  console.log(`---------------------------------------------------------------------------`);

  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: query, sessionId: SESSION_ID })
  });

  const reader = res.body;
  let fullResponse = '';

  for await (const chunk of reader) {
    const text = chunk.toString();
    const lines = text.split('\n\n');
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
      } catch (e) {}
    }
  }

  console.log('\n');
  return fullResponse;
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║       AI Chatbot Structured Formatting & Table/Card Test              ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝');

  // Test 1: Multi-deal comparison query
  await sendQuery('Which deals are most likely to close in the next 15 days?');

  // Test 2: Single-deal closing advice query
  await sendQuery('how do I close deal BITRIX-156');
}

main().catch(console.error);
