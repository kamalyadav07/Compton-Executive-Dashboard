const SESSION_ID = `test-rag-${Date.now()}`;
const API = 'http://localhost:4000/api/chat/stream';

async function setupTestData() {
  console.log('📌 Indexing test documents into server via /api/chat/index-doc...');

  // Real Deal 1: BITRIX-64 (TSI)
  const doc1 = `COMPTON COMPUTERS INDIA PVT LTD
Quotation No: COMP-2025-0464
Date: 12-04-2025
Client: TSI Okhla / E Surveillance Project

Scope of Work & Commercial Quotation:
1. Hikvision 4MP IP Dome Cameras (Qty: 24 Nos) - ₹2,16,000
2. Hikvision 32-Channel NVR with 16TB Storage (Qty: 2 Nos) - ₹1,48,000
3. Cat6 Outdoor Cable Roll 305m (Qty: 6 Rolls) - ₹36,000
4. Passive Networking & Rack Installation - INCLUDED FREE OF COST
5. On-site Installation, Testing & Commissioning - INCLUDED

Commercial Terms:
- Net Total (Excl. GST): ₹4,00,000
- GST @ 18%: ₹72,000
- Total Invoice Value: ₹4,72,000
- Warranty: 3 Years On-site Comprehensive Warranty covering all cameras and NVR units.
- Payment Terms: 50% advance along with PO, 50% after successful commissioning.`;

  await fetch('http://localhost:4000/api/chat/index-doc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dealId: 'BITRIX-64',
      fileId: 'file-tsi-64',
      fileName: 'TSI_Surveillance_Quote_0464.pdf',
      text: doc1
    })
  });

  // Real Deal 2: BITRIX-230 (Mitsui Kinzoku)
  const doc2 = `COMPTON COMPUTERS INDIA PVT LTD
Quotation No: COMP-2025-0873
Client: Mitsui Kinzoku Components India Pvt Ltd, Bawal Plant

Quotation for High-End Engineering Workstations & Desktop Systems:
- HP Z2 Tower G9 Workstation (i7-13700K, 32GB RAM, 1TB NVMe, RTX A2000 12GB) - Qty: 5 Nos - ₹6,25,000
- Dell OptiPlex 7010 Tower (i5-13500, 16GB RAM, 512GB SSD) - Qty: 10 Nos - ₹5,80,000
- Dell 24-inch FHD IPS Monitors (Qty: 15 Nos) - ₹1,95,000

Service & Support Terms:
- Standard Delivery: 2-3 weeks from receipt of firm Purchase Order.
- Installation: Professional OS & Software Pre-loading + On-site Desktop Setup INCLUDED.
- Special Note: UPS Power Backup is NOT INCLUDED in this quotation and must be ordered separately.
- Warranty: 3 Years Next Business Day (NBD) Onsite OEM Warranty from HP and Dell India.`;

  await fetch('http://localhost:4000/api/chat/index-doc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dealId: 'BITRIX-230',
      fileId: 'file-mitsui-230',
      fileName: 'Mitsui_Kinzoku_Workstation_Quote_0873.docx',
      text: doc2
    })
  });

  console.log('✅ Test documents indexed into server documentStore.\n');
}

async function streamRequest(message) {
  console.log(`\n${'='.repeat(75)}`);
  console.log(`USER: ${message}`);
  console.log('─'.repeat(75));

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
      } catch (e) {}
    }
  }

  console.log('\n');
  return fullResponse;
}

async function main() {
  await setupTestData();

  console.log('╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║    Document Attachment RAG & Semantic Search Verification Test        ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝');

  const delay = ms => new Promise(r => setTimeout(r, ms));

  // Test 1: Query details / quote items for TSI deal
  await streamRequest("what's in the quote for TSI (BITRIX-64)?");
  await delay(12000);

  // Test 2: Specific item inclusion check (UPS power backup in Mitsui deal quote)
  await streamRequest("does Mitsui Kinzoku's quote (BITRIX-230) include UPS power backup and installation?");
  await delay(12000);

  // Test 3: Unrelated detail check (verifying non-hallucination on low similarity / missing items)
  await streamRequest("does TSI's quote (BITRIX-230 or BITRIX-64) mention solar panel installation?");
}

main().catch(console.error);
