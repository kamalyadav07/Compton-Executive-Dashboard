# Swappable Semantic Embedding Architecture

This module provides a vendor-agnostic dense vector embedding layer for document attachments and semantic queries, backed by **PostgreSQL pgvector** with an **HNSW cosine index**.

---

## 1. Active Provider: Google Gemini

The active provider is **`GeminiEmbeddingProvider`**, which utilizes the existing Google GenAI SDK:
- **Model:** `text-embedding-004` (or `gemini-embedding-001`)
- **Dimension:** **768** dimensions
- **Storage Column:** `document_chunks.embedding` (`vector(768)`)
- **Database Index:** `idx_doc_chunks_embedding_hnsw` (`vector_cosine_ops`, $M=16, EF=64$)

---

## 2. Single-Embedding Storage Policy

Only **one embedding vector** is stored per row in `document_chunks.embedding`. Multiple provider vectors are not duplicated across columns, preserving storage efficiency and keeping query latency sub-10ms.

---

## 3. How to Switch or Add a Second Provider

The architecture is designed to prevent vendor lock-in. Switching to a new provider (e.g. OpenAI, Cohere, or local SentenceTransformers) requires zero refactoring of application logic:

### Step 1: Implement the `EmbeddingProvider` Interface
Create your provider class extending `EmbeddingProvider.js`:

```javascript
const { EmbeddingProvider } = require('./EmbeddingProvider');
const { OpenAI } = require('openai');

class OpenAIEmbeddingProvider extends EmbeddingProvider {
  constructor(options = {}) {
    super();
    this.modelName = options.modelName || 'text-embedding-3-small';
    this.dimension = 1536;
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async embed(text) {
    const res = await this.client.embeddings.create({
      model: this.modelName,
      input: text.slice(0, 8000)
    });
    return res.data[0].embedding;
  }

  getDimension() {
    return this.dimension;
  }

  getProviderName() {
    return 'openai';
  }
}
```

### Step 2: Set the Configuration Flag
In `server/.env`:
```env
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=your_key_here
```

### Step 3: Run Vector Dimension Migration (if dimensions differ)
If switching from 768 dimensions (Gemini) to 1536 dimensions (OpenAI):
```sql
DROP INDEX IF EXISTS idx_doc_chunks_embedding_hnsw;
ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector(1536);
CREATE INDEX idx_doc_chunks_embedding_hnsw ON document_chunks USING hnsw (embedding vector_cosine_ops);
```

### Step 4: Run the Embeddings Backfill Script
Execute the backfill utility to re-embed existing document chunks in PostgreSQL:
```bash
node server/scripts/backfill-embeddings.js
```

---

## 4. Usage in Code

```javascript
const { searchSemantic, indexChunkEmbedding } = require('./server/services/embeddings');

// Query semantic search
const results = await searchSemantic("CCTV installation warranty terms", "BITRIX-2886", 5);

// Index new chunk
await indexChunkEmbedding(chunkId, textContent);
```
