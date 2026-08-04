import type { VectorDocument, SemanticObject, FeatureStoreState, EnhancedDealRecord } from './types';

export class AIReadinessService {
  private vectorStore: VectorDocument[] = [];
  private aiContextCache: { timestamp: string; summary: string; contextJson: any } | null = null;

  // Item 21: Embedding Generation & Vector Store (pgvector simulation)
  public generateAndStoreEmbeddings(records: EnhancedDealRecord[]): VectorDocument[] {
    const documents: VectorDocument[] = [];

    records.forEach((r, idx) => {
      // 1. Proposal Embedding
      if (r.solution) {
        const propText = `Proposal for ${r.customer} in ${r.industry}: Solution ${r.solution}, Revenue ₹${r.grossRevenue}, Stage ${r.stage || r.type}`;
        documents.push({
          id: `doc_prop_${r.id}`,
          type: 'proposal',
          entityId: r.id,
          title: `${r.customer} - ${r.solution} Proposal`,
          textSnippet: propText,
          embedding: this.mockEmbeddingVector(propText),
          metadata: { customer: r.customer, industry: r.industry, revenue: r.grossRevenue },
          createdAt: new Date().toISOString()
        });
      }

      // 2. BOM Embedding
      const bomText = `Bill of Materials / Services for ${r.customer}: Industry ${r.industry}, Contract ${r.contractTermMonths || 12} Months, Margin ${r.marginPct || 25}%`;
      documents.push({
        id: `doc_bom_${r.id}`,
        type: 'bom',
        entityId: r.id,
        title: `${r.customer} BOM Specification`,
        textSnippet: bomText,
        embedding: this.mockEmbeddingVector(bomText),
        metadata: { customer: r.customer, margin: r.marginPct || 25 },
        createdAt: new Date().toISOString()
      });

      // 3. Customer Summary Embedding
      if (idx % 3 === 0) {
        const summaryText = `Customer Summary: ${r.customer} (${r.industry}), Salesperson ${r.salesRep}, Primary Solution: ${r.solution || 'General Software'}`;
        documents.push({
          id: `doc_cust_${r.id}`,
          type: 'customer_summary',
          entityId: r.customer,
          title: `${r.customer} Executive Dossier`,
          textSnippet: summaryText,
          embedding: this.mockEmbeddingVector(summaryText),
          metadata: { customer: r.customer, salesRep: r.salesRep },
          createdAt: new Date().toISOString()
        });
      }
    });

    this.vectorStore = documents;
    return documents;
  }

  // Cosine Similarity Search for RAG & Similar Deals
  public searchSimilarDocuments(query: string, limit = 5): { document: VectorDocument; score: number }[] {
    if (this.vectorStore.length === 0) return [];

    const queryVec = this.mockEmbeddingVector(query);

    const scored = this.vectorStore.map(doc => {
      const dotProduct = doc.embedding.reduce((sum, val, i) => sum + val * (queryVec[i] || 0), 0);
      const magDoc = Math.sqrt(doc.embedding.reduce((sum, val) => sum + val * val, 0));
      const magQ = Math.sqrt(queryVec.reduce((sum, val) => sum + val * val, 0));
      const score = (magDoc && magQ) ? dotProduct / (magDoc * magQ) : 0;
      return { document: doc, score: Number(score.toFixed(4)) };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  // Item 20: Pre-Cache AI Context
  public buildAIContextCache(features: FeatureStoreState, records: EnhancedDealRecord[]) {
    const totalWonRev = records.filter(r => r.type === 'won').reduce((sum, r) => sum + r.netRevenue, 0);
    const wonCount = records.filter(r => r.type === 'won').length;
    const lostCount = records.filter(r => r.type === 'lost').length;
    const winRate = (wonCount + lostCount) > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0;

    const topCustomers = Object.values(features.customerFeatures)
      .sort((a, b) => b.totalLifetimeRevenue - a.totalLifetimeRevenue)
      .slice(0, 5)
      .map(c => `${c.customerName} (₹${(c.totalLifetimeRevenue/100000).toFixed(1)}L, Health ${c.healthScore})`);

    const summary = `Event Platform AI Context Cache updated: ${records.length} records processed. Total Won Revenue: ₹${(totalWonRev/100000).toFixed(2)} Lakh (${wonCount} deals, ${winRate}% Win Rate). Top Customers: ${topCustomers.join(', ')}.`;

    this.aiContextCache = {
      timestamp: new Date().toISOString(),
      summary,
      contextJson: {
        totalWonRev,
        wonCount,
        lostCount,
        winRate,
        topCustomers,
        vectorStoreSize: this.vectorStore.length
      }
    };
  }

  public getAIContextCache() {
    return this.aiContextCache;
  }

  public getVectorStore(): VectorDocument[] {
    return this.vectorStore;
  }

  // Item 24: Semantic Layer Definitions
  public getSemanticObjects(): SemanticObject[] {
    return [
      {
        name: 'Revenue',
        description: 'Net and Gross revenue aggregated across deals, excluding GST (18%).',
        type: 'metric',
        formula: 'SUM(GrossRevenue) - SUM(GST)',
        sampleQuery: 'What is our total net revenue this month?',
        getSummary: (_, records) => {
          const gross = records.reduce((s, r) => s + r.grossRevenue, 0);
          const net = records.reduce((s, r) => s + r.netRevenue, 0);
          return { gross, net };
        }
      },
      {
        name: 'Customer',
        description: 'Customer entities with lifetime revenue, health score, and deal history.',
        type: 'dimension',
        sampleQuery: 'Show me at-risk customers with low health score.',
        getSummary: (features) => Object.values(features.customerFeatures)
      },
      {
        name: 'Industry',
        description: 'Industry sector grouping with win percentages and average deal sizing.',
        type: 'dimension',
        sampleQuery: 'Which industry has the highest win rate?',
        getSummary: (features) => Object.values(features.industryFeatures)
      },
      {
        name: 'Pipeline',
        description: 'Active open deals categorized by pipeline stage with win probabilities.',
        type: 'hierarchy',
        sampleQuery: 'What is the weighted pipeline value for Q3?',
        getSummary: (_, records) => records.filter(r => r.type === 'in_progress')
      },
      {
        name: 'Salesperson',
        description: 'Sales representative performance metrics, rank, and closing speed.',
        type: 'dimension',
        sampleQuery: 'Who is the top performing sales rep?',
        getSummary: (features) => Object.values(features.salespersonFeatures)
      },
      {
        name: 'Forecast',
        description: 'Predictive revenue forecasting incorporating probability weights.',
        type: 'metric',
        formula: 'SUM(DealValue * WinProbability)',
        sampleQuery: 'What is the forecasted revenue for next month?',
        getSummary: (_, records) => {
          const forecast = records
            .filter(r => r.type === 'in_progress')
            .reduce((s, r) => s + (r.grossRevenue * ((r.winProbability || 50) / 100)), 0);
          return { forecastRevenue: Math.round(forecast) };
        }
      },
      {
        name: 'Target',
        description: 'Monthly and quarterly revenue quotas and achievement percentages.',
        type: 'metric',
        sampleQuery: 'Did we reach our monthly target?',
        getSummary: () => ({ target: 5000000, currentAchievement: 88 })
      }
    ];
  }

  private mockEmbeddingVector(text: string): number[] {
    const vec: number[] = new Array(16).fill(0);
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      vec[i % 16] = (vec[i % 16] + code * 0.01) % 1;
    }
    return vec;
  }
}

export const globalAIReadinessService = new AIReadinessService();
