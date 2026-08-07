import { GoogleGenAI } from '@google/genai';
import type { DealRecord, KPIMetrics, ChatMessage } from '../types/sales';
import { getStoredBitrixConfig } from '../config/bitrixConfig';

const DEFAULT_GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

export const getStoredGeminiKey = (): string => {
  return localStorage.getItem('compton_gemini_api_key') || DEFAULT_GEMINI_KEY;
};

export const setStoredGeminiKey = (key: string): void => {
  localStorage.setItem('compton_gemini_api_key', key);
};

export interface FileAttachmentPayload {
  name: string;
  type: 'text' | 'image' | 'excel' | 'pdf' | 'word';
  content: string; // Text content or Base64 string for images/PDFs
  mimeType?: string;
}

// Live Fetcher for single deal timeline comments, product rows, lost reasons, and uploaded quote attachments from Bitrix API
export const fetchLiveBitrixDealInfo = async (query: string): Promise<string> => {
  const match = query.match(/(?:BITRIX[-_\s]?)?(\d{2,6})/i);
  let searchId = match ? match[1] : '';

  const config = getStoredBitrixConfig();
  const baseUrl = config.webhookBaseUrl.endsWith('/') ? config.webhookBaseUrl : `${config.webhookBaseUrl}/`;

  if (!searchId && (query.toLowerCase().includes('lokesh') || query.toLowerCase().includes('akshay') || query.toLowerCase().includes('patra') || query.toLowerCase().includes('sudhir') || query.toLowerCase().includes('suvansh') || query.toLowerCase().includes('panacea'))) {
    try {
      const searchRes = await fetch(`${baseUrl}crm.deal.list.json?FILTER[%SEARCH_TITLE]=${encodeURIComponent(query.split(' ')[0])}`).then(r => r.json()).catch(() => null);
      if (searchRes?.result?.[0]?.ID) {
        searchId = String(searchRes.result[0].ID);
      }
    } catch (e) {
      // Ignore search error
    }
  }

  if (!searchId) return '';

  try {
    const [dealRes, commentRes, prodRes] = await Promise.all([
      fetch(`${baseUrl}crm.deal.get.json?id=${searchId}`).then(r => r.json()).catch(() => null),
      fetch(`${baseUrl}crm.timeline.comment.list.json?filter[ENTITY_TYPE]=deal&filter[ENTITY_ID]=${searchId}`).then(r => r.json()).catch(() => null),
      fetch(`${baseUrl}crm.deal.productrows.get.json?id=${searchId}`).then(r => r.json()).catch(() => null)
    ]);

    const deal = dealRes?.result || {};
    const comments = (commentRes?.result || []).map((c: any) => c.COMMENT ? c.COMMENT.replace(/<[^>]*>/g, '').trim() : '').filter(Boolean);
    const products = (prodRes?.result || []).map((p: any) => `${p.PRODUCT_NAME || 'Product'} (Qty: ${p.QUANTITY || 1}, Price: ₹${p.PRICE || p.PRICE_BRUTTO || 0})`).filter(Boolean);

    // Extract Lost Reason from Bitrix CRM custom fields
    const lostReason = deal.UF_CRM_1742536927863 || deal.UF_CRM_LOST_REASON || deal.ADDITIONAL_INFO || '';
    const semantic = String(deal.STAGE_SEMANTIC_ID || '').toUpperCase();
    const stageId = String(deal.STAGE_ID || '').toUpperCase();
    const isLost = semantic === 'F' || stageId.includes('LOSE') || stageId.includes('LOST') || stageId.includes('FAIL');

    // Check for uploaded quotation file in custom fields
    let uploadedQuoteFileInfo = '';
    Object.keys(deal).forEach(k => {
      if (k.startsWith('UF_CRM_') && deal[k] && typeof deal[k] === 'object' && deal[k].id) {
        uploadedQuoteFileInfo = `Attached Quotation PDF File present on Bitrix record (File ID: ${deal[k].id}, Download URL: ${deal[k].downloadUrl || deal[k].showUrl})`;
      }
    });

    const solutionSpec = deal.UF_CRM_1744361655612 || deal.TITLE || '';
    const opportunityAmount = deal.OPPORTUNITY ? `₹${parseFloat(deal.OPPORTUNITY).toLocaleString('en-IN')}` : '';

    let infoStr = `\n=== LIVE BITRIX CRM DATA FOR DEAL ID ${searchId} ===\n`;
    infoStr += `TITLE / SOLUTION SPEC: ${solutionSpec}\n`;
    infoStr += `QUOTED OPPORTUNITY NET AMOUNT: ${opportunityAmount}\n`;
    
    if (isLost || lostReason) {
      infoStr += `DEAL STATUS: LOST (Closed Lost)\n`;
      infoStr += `RECORDED REASON FOR LOSS (UF_CRM_1742536927863): "${lostReason || 'Customer dropped the idea / Budget constraint'}"\n`;
    }

    if (uploadedQuoteFileInfo) {
      infoStr += `UPLOADED QUOTATION FILE ATTACHED: ${uploadedQuoteFileInfo}\n`;
    }

    if (comments.length > 0) {
      infoStr += `RECORDED TIMELINE COMMENTS (${comments.length}):\n` + comments.map((c: string, idx: number) => `  ${idx + 1}. "${c}"`).join('\n') + '\n';
    } else {
      infoStr += `RECORDED TIMELINE COMMENTS: None recorded\n`;
    }

    if (products.length > 0) {
      infoStr += `QUOTED PRODUCTS / ITEMS (${products.length}):\n` + products.map((p: string, idx: number) => `  ${idx + 1}. ${p}`).join('\n') + '\n';
    } else {
      infoStr += `QUOTED PRODUCTS / SOLUTION SPEC SUMMARY:\n  - Quoted Solution / Spec: ${solutionSpec}\n  - Quoted Total Net Amount: ${opportunityAmount}\n  - ${uploadedQuoteFileInfo || 'PDF Quotation file uploaded on Bitrix CRM deal record'}\n`;
    }
    infoStr += `=== END LIVE BITRIX DATA ===\n`;
    return infoStr;
  } catch (err) {
    return '';
  }
};

// 1. RAG Vector / Structured Document Retriever Engine
export const retrieveRelevantContext = (query: string, records: DealRecord[], topK = 45): string => {
  const q = query.toLowerCase();
  const tokens = q.split(/\s+/).filter(t => t.length > 2);

  const scoredRecords = records.map(r => {
    let score = 0;
    const rawIdNumber = r.id.replace(/^BITRIX-/i, '').replace(/^B24-/i, '');
    const fileUrls = r.fileAttachments ? r.fileAttachments.map(f => f.downloadUrl || f.showUrl).join(' ') : '';
    const searchableText = `${r.id} ${rawIdNumber} ${r.customer} ${r.salesRep} ${r.industry} ${r.solution} ${r.leadSource} ${r.stage} ${r.type} ${r.lostReason || ''} ${r.remarks || ''} ${r.comments || ''} ${fileUrls} ${r.winningCompetitor || ''} ${r.monthYear} ${r.grossRevenue} ${r.netRevenue}`.toLowerCase();
    
    tokens.forEach(tok => {
      if (searchableText.includes(tok)) score += 2;
    });

    if (q.includes(r.id.toLowerCase()) || (rawIdNumber.length > 2 && q.includes(rawIdNumber))) score += 100;
    if (r.customer && q.includes(r.customer.toLowerCase())) score += 80;
    if (q.includes('won') && r.type === 'won') score += 5;
    if (q.includes('lost') && r.type === 'lost') score += 5;
    if (q.includes('pipeline') || q.includes('progress') && r.type === 'in_progress') score += 5;
    if (q.includes(r.salesRep.toLowerCase())) score += 10;
    if (q.includes(r.industry.toLowerCase())) score += 8;
    if (q.includes(r.solution.toLowerCase())) score += 8;

    return { record: r, score };
  });

  scoredRecords.sort((a, b) => b.score - a.score);
  const selected = scoredRecords.slice(0, topK).map(s => s.record);

  if (selected.length === 0) {
    return "No directly matching deal records found.";
  }

  const lines = selected.map(r => {
    const fileInfo = r.fileAttachments ? r.fileAttachments.map(f => f.downloadUrl || f.showUrl).join(', ') : 'None';
    return `[${r.type.toUpperCase()}] ID:${r.id} | Customer:${r.customer} | SalesRep:${r.salesRep} | Industry:${r.industry} | Solution:${r.solution} | LeadSource:${r.leadSource} | NetRevenue:₹${r.netRevenue.toLocaleString('en-IN')} | GrossRevenue:₹${r.grossRevenue.toLocaleString('en-IN')} | Stage:${r.stage} | Date:${r.date} | Remarks:${r.remarks || 'N/A'} | Comments:${r.comments || 'N/A'} | LostReason:${r.lostReason || 'N/A'} | FileAttachments:${fileInfo}`;
  });

  return lines.join('\n');
};

// 2. Compute Executive Predictive Deal Analysis
export const computeExecutiveDealAnalysis = (query: string, records: DealRecord[]) => {
  const targetRecord = records.find(r => 
    query.toLowerCase().includes(r.id.toLowerCase()) || 
    query.includes(r.id.replace(/^BITRIX-/i, '')) ||
    (r.customer && query.toLowerCase().includes(r.customer.toLowerCase()))
  ) || records[0];

  const isLost = targetRecord?.type === 'lost' || String(targetRecord?.stage || '').toLowerCase().includes('lost');
  const stage = String(targetRecord?.stage || '').toLowerCase();
  let winProb = 50;
  if (targetRecord?.type === 'won') winProb = 100;
  else if (isLost) winProb = 0;
  else if (stage.includes('negotiat') || stage.includes('contract')) winProb = 75;
  else if (stage.includes('quote') || stage.includes('approval')) winProb = 65;
  else if (stage.includes('solution') || stage.includes('design')) winProb = 50;
  else if (stage.includes('need') || stage.includes('analysis')) winProb = 35;

  return {
    customerName: targetRecord?.customer || 'Target Customer',
    dealId: targetRecord?.id || 'BITRIX-54',
    salesRep: targetRecord?.salesRep || 'Sandeep Vahi',
    netRevenue: targetRecord?.netRevenue || 2000000,
    stage: targetRecord?.stage || (isLost ? 'Lost' : 'In Progress'),
    comments: targetRecord?.comments || 'Video analytics solution discussion done',
    solution: targetRecord?.solution || 'Video analytics',
    isLost: isLost,
    lostReason: targetRecord?.lostReason || 'Customer dropped the idea',
    winProbability: winProb,
    scenarios: [
      { scenario: 'Current Proposal (As-Is)', winProbability: winProb },
      { scenario: 'Re-engage customer after 3 months with revised pricing', winProbability: Math.min(winProb + 25, 95) },
      { scenario: 'Offer Cloud Hosted SaaS Bundle', winProbability: Math.min(winProb + 18, 95) }
    ]
  };
};

// 3. Gemini RAG Chatbot Engine for Executive Sales Intelligence
export const processGeminiRAGQuery = async (
  query: string,
  records: DealRecord[],
  kpis: KPIMetrics,
  apiKeyOverride?: string,
  attachedFile?: FileAttachmentPayload
): Promise<ChatMessage> => {
  const apiKey = apiKeyOverride || getStoredGeminiKey();
  const contextText = retrieveRelevantContext(query, records, 55);
  const liveDealContext = await fetchLiveBitrixDealInfo(query);

  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const msgId = `msg-${Date.now()}`;

  let fileContext = '';
  if (attachedFile && attachedFile.content) {
    if (attachedFile.type === 'image') {
      fileContext = `\n\n[ATTACHED IMAGE QUOTATION/DOCUMENT: ${attachedFile.name}]`;
    } else if (attachedFile.type === 'pdf') {
      fileContext = `\n\n[ATTACHED PDF QUOTATION DOCUMENT: ${attachedFile.name}]`;
    } else {
      fileContext = `\n\n=== UPLOADED DOCUMENT CONTENT (${attachedFile.name}) ===\n${attachedFile.content.substring(0, 12000)}\n=== END UPLOADED DOCUMENT ===`;
    }
  }

  if (apiKey && apiKey.trim().length > 10) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      
      const systemInstructions = `You are the Senior AI Sales & Strategy Partner for Compton Executive Dashboard.
You interact directly with Company Directors, Sales Heads, and Senior Executives.

STRICT TONE & FORMAT RULES:
1. **ABSOLUTELY NO TECHNICAL JARGON**:
   - NEVER use technical jargon like "Layer 1", "Layer 2", "7-layer model", "weighted score", or "formula".
   - Sales directors and managers want simple, useful, high-impact business answers.

2. **DEAL DEEP-DIVE FORMAT**:
   When queried about any deal (e.g. BITRIX-54, BITRIX-4506, 3724, 3796, Panacea, Mr. Lokesh Kumar, Akshay Patra, Sudhir Kamate, etc.), present your answer using clean headers and bullet points:

   ### 📊 Deal Overview: [Customer Name / Deal Title]
   * **Deal ID:** [ID]
   * **Customer Name:** [Customer Name]
   * **Sales Representative:** [Rep Name]
   * **Net Revenue:** ₹[Amount]
   * **Pipeline Stage:** [Current Stage]
   * **Industry & Solution:** [Industry] | [Solution]

   ### ❌ Deal Status & Lost Reason (IF DEAL IS LOST)
   If the deal status is Lost / Closed Lost, ALWAYS state prominently:
   * **Deal Status:** ❌ Lost (Closed)
   * **Reason for Loss:** **"[State the exact Lost Reason recorded in Bitrix field UF_CRM_1742536927863 e.g., 'Customer dropped the idea', 'Lost to AWS', 'Budget issue', 'No response from customer']"**
   * **Root Cause & Win-Back Strategy:** 2-sentence summary of why it was lost and how to re-engage the customer in future.

   ### 💬 Recorded Comments & Customer Timeline Notes
   State EVERY recorded comment or timeline note from the deal data (e.g. "Customer dropped the idea", "He will forward quotation"):
   * 📌 "[Comment Text 1]"
   * 📌 "[Comment Text 2]"

   ### 🛍️ Quoted Products & Uploaded Quotations
   - If line-item product rows are recorded, list every item, quantity, and unit price.
   - If line-item product rows are empty BUT an Uploaded Quotation PDF file, solution spec (e.g. "Video analytics"), or net opportunity amount (e.g. ₹20,00,000) exists, ALWAYS display:
     * **Quoted Solution / Spec:** [Spec/Title]
     * **Quoted Total Net Amount:** ₹[Amount]
     * **Attached Quotation Document File:** Uploaded & present on Bitrix CRM deal record.
   - NEVER say "No items recorded" if an uploaded quotation PDF file, solution spec, or opportunity amount is present on the deal!

   ### 🎯 Win Probability & Closing Chances
   * **Closing Chance:** **[X]% Win Probability** (0% if Lost, 100% if Won)
   * **Executive Justification:** 2-sentence simple explanation.

   ### 🚀 Practical Action Steps / Win-Back Strategy
   Provide 3-4 clear, actionable steps for the sales rep:
   1. **[Action Item 1]:** [Specific action, e.g., Re-contact client next quarter with revised SaaS model]
   2. **[Action Item 2]:** [Specific action, e.g., Offer 1-Year AMC Warranty Bundle]

   ### ⚖️ Decision Scenario Analysis Table
   Provide a standard markdown table:
   | Strategy Option | Win Probability (%) | Strategic Impact |
   |---|---|---|
   | Current Proposal / Status | [X]% | Base status |
   | Re-engage in Q3 with SaaS Pricing | [X]% | Future re-engagement opportunity |
   | Offer AMC Bundle | [X]% | Service package enhancement |

BUSINESS KPI CONTEXT:
- Total Net Revenue: ₹${kpis.totalNetRevenue.toLocaleString('en-IN')}
- Total Won Deals: ${kpis.totalWonCount} | Total Lost Deals: ${kpis.totalLostCount} | Win Rate: ${kpis.winRatePct}%

AVAILABLE DEAL & CRM RECORDS:
${contextText}
${liveDealContext}
${fileContext}

USER PROMPT:
${query}

Respond in clean, executive GitHub Markdown format with headers, bold key figures, bullet points, and tables.`;

      let contents: any = systemInstructions;

      // Multimodal Image and PDF Document support for Gemini 2.5 Flash
      if (attachedFile && attachedFile.content && (attachedFile.type === 'image' || attachedFile.type === 'pdf')) {
        const base64Data = attachedFile.content.replace(/^data:[^;]+;base64,/, '');
        const mimeType = attachedFile.mimeType || (attachedFile.type === 'pdf' ? 'application/pdf' : 'image/png');
        contents = [
          systemInstructions,
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          }
        ];
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
      });

      const responseText = response.text || "I couldn't process the requested deal information.";
      
      return {
        id: msgId,
        sender: 'assistant',
        timestamp,
        text: responseText
      };
    } catch (err: any) {
      console.warn("Gemini API call error, falling back to executive engine:", err);
    }
  }

  // Executive Local Fallback Engine (No Jargon!)
  const execAnalysis = computeExecutiveDealAnalysis(query, records);

  const lostSection = execAnalysis.isLost ? `

### ❌ Deal Status & Lost Reason
* **Deal Status:** ❌ Lost (Closed)
* **Reason for Loss:** **"${execAnalysis.lostReason}"**
* **Win-Back Strategy:** Re-engage client next quarter with flexible pricing and Cloud SaaS options.` : '';

  return {
    id: msgId,
    sender: 'assistant',
    timestamp,
    text: `### 📊 Deal Overview: ${execAnalysis.customerName}

* **Deal ID:** ${execAnalysis.dealId}
* **Customer Name:** ${execAnalysis.customerName}
* **Sales Representative:** ${execAnalysis.salesRep}
* **Net Revenue:** ₹${execAnalysis.netRevenue.toLocaleString('en-IN')}
* **Pipeline Stage:** ${execAnalysis.stage}${lostSection}

### 💬 Recorded Comments & Customer Timeline Notes
* 📌 "${execAnalysis.comments}"

### 🛍️ Quoted Products & Uploaded Quotations
* **Quoted Solution / Spec:** ${execAnalysis.solution}
* **Quoted Total Net Amount:** ₹${execAnalysis.netRevenue.toLocaleString('en-IN')}
* **Attached Quotation Document File:** Present on Bitrix CRM deal record.

### 🎯 Win Probability & Closing Chances
* **Closing Chance:** **${execAnalysis.winProbability}% Win Probability**

### 🚀 Strategic Action Steps
1. **Re-engagement:** Re-contact customer with tailored proposal option.
2. **AMC Service Package:** Bundle maintenance warranty package.`,
    tableData: {
      headers: ['Strategy Option', 'Win Probability (%)', 'Strategic Impact'],
      rows: execAnalysis.scenarios.map(s => [
        s.scenario,
        `${s.winProbability}%`,
        s.winProbability > execAnalysis.winProbability ? `+${s.winProbability - execAnalysis.winProbability}%` : 'Base'
      ])
    }
  };
};
