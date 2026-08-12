/**
 * server/chatQueryLogger.js
 * -----------------------------------------------------------------------
 * Phase 21: Chatbot Query Logger & Feedback Signal Analytics
 *
 * Logs user chat interactions, invoked tools, response length, and detects
 * rephrase/dissatisfaction signals ("that's wrong", "no", "rephrase", "why", "incorrect").
 */

const fs = require('fs');
const path = require('path');

const LOGS_FILE = path.join(__dirname, 'chatQueryLogs.json');

function readLogs() {
  try {
    if (!fs.existsSync(LOGS_FILE)) return [];
    return JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
  } catch (_) {
    return [];
  }
}

function writeLogs(logs) {
  try {
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2), 'utf8');
  } catch (err) {
    console.warn('[chatQueryLogger] Failed to write logs:', err.message);
  }
}

/** Check if query indicates a rephrase or dissatisfaction with previous response */
function detectDissatisfactionSignal(userQuery) {
  const q = (userQuery || '').toLowerCase().trim();
  const rephrasePatterns = [
    "that's wrong", "that is wrong", "no that", "incorrect", "not right",
    "try again", "rephrase", "you missed", "where is the deal id", "what about"
  ];

  for (const pattern of rephrasePatterns) {
    if (q.includes(pattern)) return true;
  }
  return false;
}

function logChatInteraction({ sessionId, userQuery, toolsCalled = [], responseLength = 0 }) {
  try {
    const logs = readLogs();
    const isSignal = detectDissatisfactionSignal(userQuery);

    logs.push({
      id: 'chat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      timestamp: new Date().toISOString(),
      sessionId: sessionId || 'default',
      userQuery: (userQuery || '').slice(0, 300),
      toolsCalled: toolsCalled || [],
      responseLength,
      isDissatisfactionSignal: isSignal
    });

    writeLogs(logs.slice(-1000));
  } catch (err) {
    console.warn('[chatQueryLogger] Error logging chat interaction:', err.message);
  }
}

function getChatAnalyticsReport() {
  const logs = readLogs();
  const totalQueries = logs.length;
  const dissatisfactionCount = logs.filter(l => l.isDissatisfactionSignal).length;
  const dissatisfactionRatePct = totalQueries > 0 ? Math.round((dissatisfactionCount / totalQueries) * 100) : 0;

  const toolCounts = {};
  logs.forEach(l => {
    (l.toolsCalled || []).forEach(t => {
      toolCounts[t] = (toolCounts[t] || 0) + 1;
    });
  });

  const recentRephrases = logs
    .filter(l => l.isDissatisfactionSignal)
    .slice(-5)
    .map(l => ({ query: l.userQuery, timestamp: l.timestamp, toolsCalled: l.toolsCalled }));

  return {
    totalQueries,
    dissatisfactionCount,
    dissatisfactionRatePct,
    mostUsedTools: toolCounts,
    recentRephraseQueries: recentRephrases,
    learningRecommendation: dissatisfactionRatePct > 15
      ? 'High rephrase rate detected — add curated few-shot Q&A pairs to system prompt for these query types.'
      : 'Model response consistency is within optimal boundaries.'
  };
}

module.exports = {
  logChatInteraction,
  getChatAnalyticsReport
};
