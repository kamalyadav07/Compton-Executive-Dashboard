/**
 * server/documentStore.js
 * -----------------------------------------------------------------------
 * In-memory document chunk store and vector search engine for Bitrix deal
 * attachments + user-uploaded chat documents.
 *
 * Extracted text is chunked (~1500 chars / ~500 tokens), embedded using
 * Gemini's `gemini-embedding-001` model, and indexed by dealId and fileId.
 * Search uses cosine similarity over vector embeddings.
 */

const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const XLSX = require('xlsx');

// ── Embedding Model Initialization ─────────────────────────────────────

let embeddingsInstance = null;

function getEmbeddings() {
  if (!embeddingsInstance) {
    const fs = require('fs');
    const path = require('path');
    let apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      try {
        const envPath = path.resolve(__dirname, '../.env');
        if (fs.existsSync(envPath)) {
          const match = fs.readFileSync(envPath, 'utf8').match(/GEMINI_API_KEY=(.*)/);
          if (match) apiKey = match[1].trim();
        }
      } catch (_) {}
    }
    embeddingsInstance = new GoogleGenerativeAIEmbeddings({
      model: 'gemini-embedding-001',
      apiKey
    });
  }
  return embeddingsInstance;
}

// ── In-Memory Document & Chunk Store ───────────────────────────────────

/** Processed file IDs (to prevent re-downloading/re-parsing unchanged files) */
const processedFileIds = new Set();

/** Chunks store: Array of { dealId, fileId, fileName, chunkIndex, text, embedding } */
const chunkStore = [];

// ── Math & Cosine Similarity ───────────────────────────────────────────

function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── Text Chunking ──────────────────────────────────────────────────────

function chunkText(text, chunkSize = 1500, chunkOverlap = 200) {
  if (!text || typeof text !== 'string') return [];
  const cleanText = text.replace(/\r\n/g, '\n').trim();
  if (!cleanText) return [];

  const chunks = [];
  let start = 0;

  while (start < cleanText.length) {
    let end = start + chunkSize;
    if (end < cleanText.length) {
      // Try to break at paragraph or newline
      const lastNewline = cleanText.lastIndexOf('\n', end);
      if (lastNewline > start + chunkSize / 2) {
        end = lastNewline;
      } else {
        // Try space break
        const lastSpace = cleanText.lastIndexOf(' ', end);
        if (lastSpace > start + chunkSize / 2) {
          end = lastSpace;
        }
      }
    }

    const chunk = cleanText.slice(start, end).trim();
    if (chunk.length > 20) {
      chunks.push(chunk);
    }

    start = end - chunkOverlap;
    if (start >= cleanText.length || end >= cleanText.length) break;
  }

  return chunks;
}

// ── File Content Extraction ────────────────────────────────────────────

async function extractTextFromBuffer(fileName, buffer) {
  const lowerName = fileName.toLowerCase();
  let extractedText = '';

  if (lowerName.endsWith('.pdf')) {
    const parsed = await pdfParse(buffer);
    extractedText = parsed.text || '';
  } else if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) {
    const result = await mammoth.extractRawText({ buffer });
    extractedText = result.value || '';
  } else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv')) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetNames = workbook.SheetNames || [];
    const sheetsText = sheetNames.map(s => `--- Sheet: ${s} ---\n` + XLSX.utils.sheet_to_csv(workbook.Sheets[s]));
    extractedText = sheetsText.join('\n\n');
  } else {
    extractedText = buffer.toString('utf-8');
  }

  return extractedText.trim();
}

// ── Index Document ─────────────────────────────────────────────────────

async function indexDocument({ dealId, fileId, fileName, text }) {
  if (!text || text.length < 20) return 0;
  if (processedFileIds.has(fileId)) return 0;

  const chunks = chunkText(text);
  if (chunks.length === 0) return 0;

  const embeddings = getEmbeddings();
  let addedCount = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunkContent = chunks[i];
    try {
      const vec = await embeddings.embedQuery(chunkContent);
      chunkStore.push({
        dealId: String(dealId),
        fileId: String(fileId),
        fileName: fileName || `Attachment_${fileId}`,
        chunkIndex: i,
        text: chunkContent,
        embedding: vec
      });
      addedCount++;
    } catch (err) {
      console.warn(`[documentStore] Embedding error for ${fileName} chunk ${i}:`, err.message);
    }
  }

  processedFileIds.add(String(fileId));
  return addedCount;
}

// ── Search Engine ──────────────────────────────────────────────────────

async function searchDealDocuments(dealId, queryText, topK = 4) {
  if (!queryText || chunkStore.length === 0) {
    return { matches: [], totalIndexedChunks: chunkStore.length };
  }

  const embeddings = getEmbeddings();
  let queryVector;
  try {
    queryVector = await embeddings.embedQuery(queryText);
  } catch (err) {
    console.error('[documentStore] Error embedding search query:', err.message);
    return { matches: [], error: err.message };
  }

  // Filter candidates by dealId if specified
  const cleanDealId = dealId ? String(dealId).replace(/^BITRIX-/, '') : null;
  const candidates = chunkStore.filter(c => {
    if (!cleanDealId) return true;
    const cId = c.dealId.replace(/^BITRIX-/, '');
    return cId === cleanDealId;
  });

  if (candidates.length === 0) {
    return { matches: [], message: `No indexed document chunks found for deal ${dealId}` };
  }

  // Compute similarity
  const scored = candidates.map(c => ({
    fileName: c.fileName,
    chunkIndex: c.chunkIndex,
    similarityScore: Math.round(cosineSimilarity(queryVector, c.embedding) * 100) / 100,
    text: c.text
  }));

  // Sort descending
  scored.sort((a, b) => b.similarityScore - a.similarityScore);
  const topMatches = scored.slice(0, topK);

  return {
    matches: topMatches,
    totalIndexedChunksForDeal: candidates.length
  };
}

// ── Helper: Get Summary of Documents for a Deal ────────────────────────

function getDocumentSummaryForDeal(dealId) {
  const cleanId = String(dealId).replace(/^BITRIX-/, '');
  const chunks = chunkStore.filter(c => c.dealId.replace(/^BITRIX-/, '') === cleanId);
  if (chunks.length === 0) return null;

  const fileNames = Array.from(new Set(chunks.map(c => c.fileName)));
  const previewText = chunks.slice(0, 3).map(c => `[${c.fileName}]: ${c.text.slice(0, 300)}...`).join('\n\n');

  return {
    fileCount: fileNames.length,
    files: fileNames,
    previewText
  };
}

module.exports = {
  extractTextFromBuffer,
  indexDocument,
  searchDealDocuments,
  getDocumentSummaryForDeal,
  processedFileIds,
  chunkStore
};
