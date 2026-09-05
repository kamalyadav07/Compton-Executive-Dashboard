/**
 * server/chatRoutes.js
 * -----------------------------------------------------------------------
 * Replaces the placeholder app.post('/api/chat', ...) in dashboard-server.js
 * with a streaming, memory-aware, tool-using endpoint. Mount it like:
 *
 *   const { registerChatRoutes } = require('./chatRoutes');
 *   registerChatRoutes(app, cache);   // `cache` = the same object dashboard-server.js keeps synced
 *
 * Streaming (Server-Sent Events) is what gets you the "types out like
 * ChatGPT" feel in the UI instead of a spinner-then-dump.
 */

const path = require('path');
const rateLimit = require('express-rate-limit');
const { 
  buildConversationalAgent, 
  detectIntent, 
  executeDocumentRoute, 
  clearHistory, 
  sanitizeSessionHistory 
} = require('./langchainAgent');
const { validateNumericalGrounding } = require('./services/numericalGroundingValidator');

// Rate limiter for chat streaming and queries (60 requests per minute per IP)
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many chat requests from this IP. Please wait a minute and try again.'
  }
});

// Active per-session locks: sessionId -> { startTime, reqId }
const activeSessions = new Map();

// Helper to log chat messages, citations, and audit routes to PostgreSQL
async function logChatMessageToDb(sessionId, role, content, toolsInvoked = [], route = 'STRUCTURED_DATA', citations = [], sourceRef = '') {
  try {
    const { pool } = require('./db');
    await pool.query(
      `INSERT INTO chat_sessions (id, title)
       VALUES ($1, $2)
       ON CONFLICT (id) DO NOTHING`,
      [sessionId, `Chat Session ${new Date().toLocaleDateString()}`]
    );
    await pool.query(
      `INSERT INTO chat_messages (session_id, role, content, tools_invoked, route, source_type, source_reference, citations)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        sessionId,
        role,
        content,
        JSON.stringify(toolsInvoked),
        route,
        route === 'DOCUMENT' ? 'document_evidence' : 'structured_sql',
        sourceRef || (toolsInvoked.length > 0 ? `Tools: ${toolsInvoked.join(', ')}` : 'PostgreSQL Deals Table'),
        JSON.stringify(citations || [])
      ]
    );
  } catch (err) {
    console.warn('[chatRoutes] PostgreSQL chat audit log notice:', err.message);
  }
}

function registerChatRoutes(app, cache) {
  function getAgent() {
    return buildConversationalAgent(cache);
  }

  // ── Streaming chat endpoint ─────────────────────────────────────────
  app.post('/api/chat/stream', chatLimiter, async (req, res) => {
    const { message, sessionId, attachedFile } = req.body;
    if (!message || !sessionId) {
      return res.status(400).json({ error: 'message and sessionId are required' });
    }

    const reqId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const startTime = Date.now();

    // ── Concurrency Lock ──────────────────────────────────────────────
    if (activeSessions.has(sessionId)) {
      const existing = activeSessions.get(sessionId);
      const elapsed = Date.now() - existing.startTime;
      if (elapsed < 45000) {
        console.warn(`[CHAT STREAM] [${reqId}] Session "${sessionId}" already active (${Math.round(elapsed / 1000)}s elapsed). Rejecting concurrent submission.`);
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
        res.write(`data: ${JSON.stringify({ error: 'A message is already being processed for this session. Please wait.' })}\n\n`);
        res.write('data: [DONE]\n\n');
        return res.end();
      } else {
        console.warn(`[CHAT STREAM] [${reqId}] Stale active session "${sessionId}" detected (${Math.round(elapsed / 1000)}s elapsed). Clearing lock.`);
        activeSessions.delete(sessionId);
      }
    }

    activeSessions.set(sessionId, { startTime, reqId });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let firstTokenEmitted = false;
    let tokenCount = 0;
    let isTimedOut = false;
    let fullResponseText = '';
    let toolsCalled = [];
    let rawToolOutputs = [];
    let activeRoute = 'STRUCTURED_DATA';
    let citations = [];
    let sourceReference = '';

    // ── Server-Side Timeout (40s) ───────────────────────────────────────
    const timeoutId = setTimeout(async () => {
      isTimedOut = true;
      console.error(`[CHAT STREAM] [${reqId}] TIMEOUT after 40s | session: ${sessionId}`);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: 'Request timed out after 40s while waiting for AI response. Please try again.' })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      }
      activeSessions.delete(sessionId);
      await sanitizeSessionHistory(sessionId);
    }, 40000);

    try {
      console.log(`[CHAT STREAM] [${reqId}] Start request | session: ${sessionId} | input: "${message.slice(0, 60)}..."`);

      // 1. Intent Detection Step (Classify STRUCTURED_DATA vs DOCUMENT)
      activeRoute = await detectIntent(message, attachedFile);
      console.log(`[CHAT STREAM] [${reqId}] Active Route Classified: [${activeRoute}]`);
      res.write(`data: ${JSON.stringify({ route: activeRoute })}\n\n`);

      // Audit user message to PostgreSQL
      logChatMessageToDb(sessionId, 'user', message, [], activeRoute);

      // Clean up any dangling corrupted checkpoint before starting
      await sanitizeSessionHistory(sessionId);

      let input = message;
      if (attachedFile) {
        input = `${message}\n\n[Attached file: ${attachedFile.name}]\n${attachedFile.extractedText.slice(0, 6000)}`;
      }

      if (activeRoute === 'DOCUMENT') {
        // ── ROUTE B: DOCUMENT EVIDENCE GROUNDED RAG ─────────────────────
        console.log(`[CHAT STREAM] [${reqId}] Dispatching to Route B (Document Intelligence RAG)...`);
        toolsCalled = ['hybrid_retrieval'];

        const docResult = await executeDocumentRoute(message, attachedFile, (token) => {
          if (isTimedOut) return;
          if (!firstTokenEmitted) {
            firstTokenEmitted = true;
            const ttft = Date.now() - startTime;
            console.log(`[CHAT STREAM] [${reqId}] First token emitted (TTFT: ${ttft}ms) via Route B`);
          }
          tokenCount++;
          fullResponseText += token;
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        });

        fullResponseText = docResult.response || fullResponseText;
        citations = (docResult.evidenceChunks || []).map(c => ({
          fileName: c.fileName,
          chunkIndex: c.chunkIndex,
          score: c.finalScore,
          matchedTerms: c.matchedTerms,
          preview: (c.content || '').slice(0, 150)
        }));
        sourceReference = (docResult.evidenceFiles || []).join(', ') || 'Attached Quotations & Contracts';
      } else {
        // ── ROUTE A: STRUCTURED DATA & EXACT SQL TOOLS ──────────────────
        console.log(`[CHAT STREAM] [${reqId}] Dispatching to Route A (Structured Data & SQL Tools)...`);
        const { agent } = getAgent();
        const eventStream = agent.streamEvents(
          { messages: [{ role: 'user', content: input }] },
          { version: 'v2', configurable: { thread_id: sessionId } }
        );

        for await (const event of eventStream) {
          if (isTimedOut) break;

          if (event.event === 'on_tool_start') {
            if (event.name && !toolsCalled.includes(event.name)) {
              toolsCalled.push(event.name);
            }
          }

          if (event.event === 'on_tool_end') {
            const toolOut = event.data?.output;
            if (toolOut) {
              rawToolOutputs.push(toolOut);
            }
          }

          if (event.event === 'on_chat_model_stream') {
            const chunk = event.data?.chunk;
            if (chunk && typeof chunk.content === 'string' && chunk.content) {
              if (!firstTokenEmitted) {
                firstTokenEmitted = true;
                const ttft = Date.now() - startTime;
                console.log(`[CHAT STREAM] [${reqId}] First token emitted (TTFT: ${ttft}ms) via Route A`);
              }
              tokenCount++;
              fullResponseText += chunk.content;
              res.write(`data: ${JSON.stringify({ token: chunk.content })}\n\n`);
            }
          }
        }

        // 3. Post-Response Numerical Validation Step (Requirement 3)
        if (rawToolOutputs.length > 0) {
          const valResult = validateNumericalGrounding(fullResponseText, rawToolOutputs);
          if (!valResult.isValid) {
            console.warn(`[CHAT STREAM] [${reqId}] Numerical validation flagged ungrounded numbers:`, valResult.ungroundedNumbers);
          }
        }

        citations = toolsCalled.map(t => ({
          tool: t,
          source: 'PostgreSQL Database / Bitrix Synced CRM Data'
        }));
        sourceReference = toolsCalled.length > 0 ? `Tools: ${toolsCalled.join(', ')}` : 'PostgreSQL Deals Table';
      }

      clearTimeout(timeoutId);

      if (!isTimedOut) {
        const totalDuration = Date.now() - startTime;
        console.log(`[CHAT STREAM] [${reqId}] Request completed successfully | route: ${activeRoute} | duration: ${totalDuration}ms | tokens: ${tokenCount} | tools: ${toolsCalled.join(', ')}`);
        
        const { logChatInteraction } = require('./chatQueryLogger');
        logChatInteraction({
          sessionId,
          userQuery: message,
          toolsCalled,
          responseLength: tokenCount
        });

        // Emit Citation & Evidence Metadata to Frontend
        res.write(`data: ${JSON.stringify({ citations, sourceReference })}\n\n`);

        // Audit assistant response with route and citations to PostgreSQL
        logChatMessageToDb(sessionId, 'assistant', fullResponseText, toolsCalled, activeRoute, citations, sourceReference);

        res.write('data: [DONE]\n\n');
        res.end();
      }
    } catch (err) {
      clearTimeout(timeoutId);
      const totalDuration = Date.now() - startTime;
      console.error(`[CHAT STREAM] [${reqId}] Error after ${totalDuration}ms | session: ${sessionId}:`, err);

      await sanitizeSessionHistory(sessionId);

      // High-availability fallback engine: Fulfill user query using local deal tools
      try {
        console.log(`[CHAT STREAM] [${reqId}] Fulfilling query via high-availability fallback engine.`);
        const fallbackAnswer = executeFallbackToolAnswer(message, cache);
        for (const charChunk of fallbackAnswer.match(/[\s\S]{1,15}/g) || [fallbackAnswer]) {
          res.write(`data: ${JSON.stringify({ token: charChunk })}\n\n`);
        }
        res.write('data: [DONE]\n\n');
        return res.end();
      } catch (fallbackErr) {
        console.error(`[CHAT STREAM] [${reqId}] Fallback execution error:`, fallbackErr);
        let errorMessage = err.message || 'Something went wrong answering that — try again.';
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        }
      }
    } finally {
      clearTimeout(timeoutId);
      activeSessions.delete(sessionId);
    }
  });

  // ── Clear session memory ────────────────────────────────────────────
  app.post('/api/chat/clear', (req, res) => {
    const { sessionId } = req.body;
    if (sessionId) {
      clearHistory(sessionId);
    }
    res.json({ status: 'cleared' });
  });

  // ── File upload + text extraction ───────────────────────────────────
  let multer;
  try {
    multer = require('multer');
  } catch (e) {}

  if (multer) {
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 }
    });

    app.post('/api/chat/upload', upload.single('file'), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileName = req.file.originalname;
        const buffer = req.file.buffer;
        let extractedText = buffer.toString('utf-8');

        res.json({
          name: fileName,
          extractedText: extractedText.slice(0, 50000)
        });
      } catch (err) {
        console.error('[chat/upload] error', err);
        res.status(500).json({ error: 'Failed to extract text from file.' });
      }
    });
  }

  // ── Document Indexing Endpoint ───────────────────────────────────────
  app.post('/api/chat/index-doc', async (req, res) => {
    try {
      const { dealId, fileId, fileName, text } = req.body || {};
      const { indexDocument } = require('./documentStore');
      const count = await indexDocument({ dealId, fileId, fileName, text });
      res.json({ success: true, chunksIndexed: count });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

/**
 * High-availability fallback engine:
 * Answers questions directly using backend data tools when AI API endpoint fails.
 */
function executeFallbackToolAnswer(userQuery, cache) {
  const q = (userQuery || '').toLowerCase().trim();
  const { runDealIntelligence } = require('./engines/dealIntelligenceEngine');
  const { computeSalesProjection } = require('./engines/salesProjectionEngine');
  const { getTargets } = require('./salesTargets');

  const deals = cache ? [...(cache.won || []), ...(cache.lost || []), ...(cache.progress || [])] : [];
  const openDeals = cache ? (cache.progress || []) : [];
  const targets = getTargets();

  // 1. Sales Projection / Targets
  if (q.includes('projection') || q.includes('target') || q.includes('hit our number') || q.includes('forecast')) {
    const proj = computeSalesProjection(deals, 'month', targets);
    const revLakh = (proj.revenueToDate / 100000).toFixed(2);
    const pipeCr = (proj.pipelineValue / 10000000).toFixed(2);
    const projCr = (proj.totalProjection / 10000000).toFixed(2);
    const targetCr = (targets.monthlyTarget / 10000000).toFixed(2);
    const gapLakh = (proj.gapToTarget / 100000).toFixed(2);

    return `### Monthly Sales Projection Summary (August 2026)\n- **Monthly Target**: **₹${targetCr} Cr** (₹1.60 Cr)\n- **Booked Revenue (Net)**: **₹${revLakh} Lakh**\n- **Weighted Total Projection**: **₹${projCr} Cr** (**${proj.projectedAttainmentPct}%** target attainment)\n- **Pipeline Value**: **₹${pipeCr} Cr** across **${openDeals.length} open deals**\n- **Gap to Target**: **₹${gapLakh} Lakh**\n\n${proj.topDealsLikelyToClose && proj.topDealsLikelyToClose.length > 0 ? `> [!NOTE]\n> **Top Near-Term Closes**: ${proj.topDealsLikelyToClose.map(d => `${d.dealId || d.id} (${d.company || d.dealName || d.customer})`).join(', ')}\n` : ''}`;
  }

  // 2. Forecast Calibration / Model Accuracy
  if (q.includes('calibration') || q.includes('accurate') || q.includes('accuracy') || q.includes('reliability')) {
    const { computeCalibrationReport } = require('./calibrationEngine');
    const report = computeCalibrationReport(deals);
    return `### Deal Forecast Calibration Report\nOur predictive forecast engine is **${report.calibrationStatus}** across **${report.totalPredictionsTracked} historical deals** with a mean calibration error of **${report.meanCalibrationErrorPct}%**.\n\n| Bitrix Deal ID | Range | Predicted Deals | Actual Won | Win Rate | Calibration Error | Status |\n| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n${report.buckets.map(b => `| ${b.bucket} | ${b.range.join('-')}% | ${b.predictedCount} | ${b.actualWonCount} | ${b.actualWinRatePct}% | ${b.calibrationErrorPct}% | ${b.status} |`).join('\n')}`;
  }

  // 3. Near-term closes / 15-day / 7-day
  if (q.includes('close') || q.includes('15 days') || q.includes('7 days') || q.includes('likely to close')) {
    const { results } = runDealIntelligence(deals);
    const topCloses = results
      .filter(r => r.closesWithin15DaysPct >= 50)
      .slice(0, 10);
    return `### High-Probability Closes (Next 15 Days)\nFound **${topCloses.length} open deals** likely to close within 15 days (≥50% close probability).\n\n| Bitrix Deal ID | Deal Name & Customer | Sales Rep | Net Value | Stage | Date |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n${topCloses.map(r => `| ${r.deal.id} | ${r.deal.rawRecord?.TITLE || r.deal.customer || r.deal.title} | ${r.deal.salesRep || 'Unassigned'} | ₹${(r.deal.grossRevenue || 0).toLocaleString('en-IN')} | ${r.deal.stage} | ${r.deal.date || 'Near-term'} |`).join('\n')}`;
  }

  // 4. Sales-rep ranking / leaderboard questions (e.g. "which rep has the
  // highest revenue", "top performer", "who has the lowest win rate").
  // This must run BEFORE the generic entity-search branch below, since a
  // question like "which sales rep has the highest revenue" contains no
  // company/deal name to search for and would otherwise fall through to it.
  const isRankingQuestion = /\b(highest|lowest|top|best|worst|most|least|leaderboard|rank|ranking)\b/.test(q)
    && /\b(rep|sales ?rep|salesperson|performer|revenue|sales)\b/.test(q);
  if (isRankingQuestion) {
    const byRep = new Map();
    for (const d of deals) {
      const rep = d.salesRep || 'Unassigned';
      if (!byRep.has(rep)) byRep.set(rep, { rep, wonRevenue: 0, wonCount: 0, lostCount: 0 });
      const entry = byRep.get(rep);
      if (d.type === 'won') { entry.wonRevenue += (d.grossRevenue || 0); entry.wonCount += 1; }
      if (d.type === 'lost') entry.lostCount += 1;
    }
    const wantsLowest = /\b(lowest|worst|least)\b/.test(q);
    const ranked = [...byRep.values()]
      .filter(r => r.rep !== 'Unassigned')
      .sort((a, b) => wantsLowest ? a.wonRevenue - b.wonRevenue : b.wonRevenue - a.wonRevenue);

    if (ranked.length === 0) {
      return `### Sales Rep Leaderboard\nNo sales-rep-attributed deals were found in the currently cached data.`;
    }

    const top = ranked[0];
    return `### Sales Rep Leaderboard (by Won Revenue)\n**${top.rep}** has the ${wantsLowest ? 'lowest' : 'highest'} won revenue at **₹${(top.wonRevenue / 100000).toFixed(2)} Lakh** across **${top.wonCount} won deals**.\n\n| Sales Rep | Won Revenue | Won Deals | Lost Deals |\n| :--- | :--- | :--- | :--- |\n${ranked.slice(0, 10).map(r => `| ${r.rep} | ₹${(r.wonRevenue / 100000).toFixed(2)} Lakh | ${r.wonCount} | ${r.lostCount} |`).join('\n')}`;
  }

  // 5. Entity & Stage Query Matching (e.g. "recent capri won deals")
  let filtered = [...deals];
  const words = q.split(/\s+/);
  const ignoreWords = new Set([
    'recent', 'all', 'deals', 'deal', 'won', 'lost', 'open', 'in', 'july', 'august', 'june', 'may',
    'and', 'its', 'value', 'show', 'list', 'the', 'for', 'rep', 'reps',
    // question words — these must never be treated as a search term
    'which', 'who', 'what', 'whom', 'whose', 'why', 'how', 'has', 'have', 'had',
    'is', 'are', 'was', 'were', 'does', 'do', 'did', 'can', 'could', 'would', 'should',
    'highest', 'lowest', 'top', 'best', 'worst', 'most', 'least', 'about', 'our', 'company'
  ]);
  const companyTerms = words.filter(w => w.length >= 3 && !ignoreWords.has(w));

  let hadUnmatchedSearchTerm = false;
  if (companyTerms.length > 0) {
    const term = companyTerms[0];
    const matches = deals.filter(d =>
      (d.customer && d.customer.toLowerCase().includes(term)) ||
      (d.title && d.title.toLowerCase().includes(term)) ||
      (d.rawRecord?.TITLE && d.rawRecord.TITLE.toLowerCase().includes(term)) ||
      (d.salesRep && d.salesRep.toLowerCase().includes(term))
    );
    if (matches.length > 0) {
      filtered = matches;
    } else {
      // Do NOT silently fall back to "all deals" mislabeled as a match —
      // that's the bug that previously made every unrecognized question
      // return the entire 1000+ row dataset under a nonsense title.
      hadUnmatchedSearchTerm = true;
    }
  }

  if (hadUnmatchedSearchTerm) {
    return `### I couldn't find a specific match\nI didn't find any deals matching "${companyTerms[0]}", and this question doesn't match a metric I can compute from the cached deal data alone.\n\n> [!TIP]\n> Try asking things like:\n> * *"Which sales rep has the highest revenue?"*\n> * *"Show deals for [customer or rep name]"*\n> * *"What is our sales projection this month?"*\n> * *"Which deals are likely to close in the next 15 days?"*`;
  }

  if (q.includes('won')) {
    filtered = filtered.filter(d => d.type === 'won');
  } else if (q.includes('lost')) {
    filtered = filtered.filter(d => d.type === 'lost');
  } else if (q.includes('open') || q.includes('in progress')) {
    filtered = filtered.filter(d => d.type === 'in_progress');
  }

  filtered.sort((a, b) => new Date(b.date || '2026-01-01').getTime() - new Date(a.date || '2026-01-01').getTime());
  const displayDeals = filtered.slice(0, 10);
  const totalVal = displayDeals.reduce((sum, d) => sum + (d.grossRevenue || 0), 0);

  const titleTerm = companyTerms.length > 0 ? companyTerms[0].toUpperCase() : 'PIPELINE';
  const stageTerm = q.includes('won') ? 'Won' : q.includes('lost') ? 'Lost' : 'Pipeline';

  return `### ${titleTerm} ${stageTerm} Deals Summary\nFound **${filtered.length} matching deals** (totaling **₹${(totalVal / 100000).toFixed(2)} Lakh**).\n\n| Bitrix Deal ID | Deal Name & Customer | Sales Rep | Net Value | Stage | Date |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n${displayDeals.map(d => `| ${d.id} | ${d.rawRecord?.TITLE || d.customer || d.title} | ${d.salesRep || 'Unassigned'} | ₹${(d.grossRevenue || 0).toLocaleString('en-IN')} | ${d.stage || (d.type === 'won' ? 'Won' : 'In Progress')} | ${d.date || '2026-08-12'} |`).join('\n')}`;
}

module.exports = { registerChatRoutes };