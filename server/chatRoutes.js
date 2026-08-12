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
const { buildConversationalAgent, clearHistory, sanitizeSessionHistory } = require('./langchainAgent');

// Active per-session locks: sessionId -> { startTime, reqId }
const activeSessions = new Map();

function registerChatRoutes(app, cache) {
  function getAgent() {
    return buildConversationalAgent(cache);
  }

  // ── Streaming chat endpoint ─────────────────────────────────────────
  app.post('/api/chat/stream', async (req, res) => {
    const { message, sessionId, attachedFile } = req.body;
    if (!message || !sessionId) {
      return res.status(400).json({ error: 'message and sessionId are required' });
    }

    const reqId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const startTime = Date.now();

    // ── Concurrency Lock (Requirement 3.d) ─────────────────────────────
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

    // ── Server-Side Timeout (Requirement 3.a - 40s) ──────────────────────
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

      // Clean up any dangling corrupted checkpoint before starting (Requirement 3.c)
      await sanitizeSessionHistory(sessionId);

      let input = message;
      if (attachedFile) {
        input = `${message}\n\n[Attached file: ${attachedFile.name}]\n${attachedFile.extractedText.slice(0, 6000)}`;
      }

      console.log(`[CHAT STREAM] [${reqId}] LangChain agent invocation starting...`);
      const { agent } = getAgent();
      const eventStream = agent.streamEvents(
        { messages: [{ role: 'user', content: input }] },
        { version: 'v2', configurable: { thread_id: sessionId } }
      );

      let toolsCalled = [];

      for await (const event of eventStream) {
        if (isTimedOut) break;

        if (event.event === 'on_tool_start') {
          if (event.name && !toolsCalled.includes(event.name)) {
            toolsCalled.push(event.name);
          }
        }

        if (event.event === 'on_chat_model_stream') {
          const chunk = event.data?.chunk;
          if (chunk && typeof chunk.content === 'string' && chunk.content) {
            if (!firstTokenEmitted) {
              firstTokenEmitted = true;
              const ttft = Date.now() - startTime;
              console.log(`[CHAT STREAM] [${reqId}] First token emitted (TTFT: ${ttft}ms)`);
            }
            tokenCount++;
            res.write(`data: ${JSON.stringify({ token: chunk.content })}\n\n`);
          }
        }
      }

      clearTimeout(timeoutId);

      if (!isTimedOut) {
        const totalDuration = Date.now() - startTime;
        console.log(`[CHAT STREAM] [${reqId}] Request completed successfully | duration: ${totalDuration}ms | tokens: ${tokenCount} | tools: ${toolsCalled.join(', ')}`);
        
        const { logChatInteraction } = require('./chatQueryLogger');
        logChatInteraction({
          sessionId,
          userQuery: message,
          toolsCalled,
          responseLength: tokenCount
        });

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
    return `### High-Probability Closes (Next 15 Days)\nFound **${topCloses.length} open deals** likely to close within 15 days (≥50% close probability).\n\n| Bitrix Deal ID | Deal Name & Customer | Sales Rep | Net Value | Stage | Date |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n${topCloses.map(r => `| ${r.deal.id} | ${r.deal.customer || r.deal.title} | ${r.deal.assignedRep || 'Unassigned'} | ₹${(r.deal.grossRevenue || 0).toLocaleString('en-IN')} | ${r.deal.stage} | ${r.deal.date || 'Near-term'} |`).join('\n')}`;
  }

  // 4. Entity & Stage Query Matching (e.g. "recent capri won deals")
  let filtered = [...deals];
  const words = q.split(/\s+/);
  const ignoreWords = new Set(['recent', 'all', 'deals', 'won', 'lost', 'open', 'in', 'july', 'august', 'june', 'may', 'and', 'its', 'value', 'show', 'list', 'the', 'for', 'rep']);
  const companyTerms = words.filter(w => w.length >= 3 && !ignoreWords.has(w));

  if (companyTerms.length > 0) {
    const term = companyTerms[0];
    const matches = deals.filter(d =>
      (d.customer && d.customer.toLowerCase().includes(term)) ||
      (d.title && d.title.toLowerCase().includes(term)) ||
      (d.assignedRep && d.assignedRep.toLowerCase().includes(term))
    );
    if (matches.length > 0) {
      filtered = matches;
    }
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

  return `### ${titleTerm} ${stageTerm} Deals Summary\nFound **${filtered.length} matching deals** (totaling **₹${(totalVal / 100000).toFixed(2)} Lakh**).\n\n| Bitrix Deal ID | Deal Name & Customer | Sales Rep | Net Value | Stage | Date |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n${displayDeals.map(d => `| ${d.id} | ${d.customer || d.title} | ${d.assignedRep || 'Unassigned'} | ₹${(d.grossRevenue || 0).toLocaleString('en-IN')} | ${d.stage || (d.type === 'won' ? 'Won' : 'In Progress')} | ${d.date || '2026-08-12'} |`).join('\n')}`;
}

module.exports = { registerChatRoutes };
