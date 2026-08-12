# Compton Executive Dashboard & AI Sales Intelligence Platform

A state-of-the-art, enterprise-grade executive analytics dashboard and AI sales intelligence platform built with **React 19**, **TypeScript**, **Vite**, **Tailwind CSS v4**, **ECharts**, and **Google Gemini 2.5 Flash**.

This system seamlessly unifies CRM sales data from **Bitrix24 REST APIs** and operational data from **Google Sheets**, processing them through a robust **10-Stage Event-Driven Data Platform**. It features dynamic KPI calculation engines, predictive deal scoring models, real-time data drift detection, and an executive **Retrieval-Augmented Generation (RAG) AI Chatbot** with multimodal file inspection capabilities.

---

## 📋 Table of Contents

1. [Executive Overview ("What I Am Making")](#1-executive-overview-what-i-am-making)
2. [Technology Stack ("What Tech Stack We Have Used")](#2-technology-stack-what-tech-stack-we-have-used)
3. [System Architecture & Core Platform ("How I Am Making It")](#3-system-architecture--core-platform-how-i-am-making-it)
4. [API Integration & External Data Fetching ("How I Am Calling the API")](#4-api-integration--external-data-fetching-how-i-am-calling-the-api)
5. [Data Persistence & Refresh Lifecycle ("How Data is Fetched When We Refresh")](#5-data-persistence--refresh-lifecycle-how-data-is-fetched-when-we-refresh)
6. [AI RAG Chatbot Architecture & Workflow ("How My Chatbot Works")](#6-ai-rag-chatbot-architecture--workflow-how-my-chatbot-works)
7. [Algorithms & Mathematical Models ("What Algos We Have Used")](#7-algorithms--mathematical-models-what-algos-we-have-used)
8. [Comprehensive Function Registry ("What Functions We Have Used")](#8-comprehensive-function-registry-what-functions-we-have-used)
9. [Installation & Project Setup](#9-installation--project-setup)

---

## 1. Executive Overview ("What I Am Making")

The **Compton Executive Dashboard** is a centralized decision-support system tailored for C-suite executives, Vice Presidents, Sales Directors, and Operations Managers. It provides real-time visibility into sales funnels, financial targets, project deliverables, and operational health.

```
+-----------------------------------------------------------------------------------+
|                            COMPTON EXECUTIVE DASHBOARD                            |
+-----------------------------------------------------------------------------------+
|  [Deal Dashboard]  |  [Sales Dashboard]  |  [Project Dashboard]  | [Service Dash]  |
+-----------------------------------------------------------------------------------+
|                           EVENT-DRIVEN DATA PLATFORM                              |
|   Ingestion -> Validation -> Dedup -> Rules -> Feature Store -> Database Store    |
+-----------------------------------------------------------------------------------+
|         INTEGRATION LAYER        |                 AI & PREDICTIVE LAYER          |
|  - Bitrix24 CRM REST API         |  - RAG Chatbot (Gemini 2.5 Flash)             |
|  - Google Sheets CSV Engine      |  - AI Deal Command Center (Win Probabilities)  |
|  - Local Cache & SWR Pipeline    |  - Anomaly & Data Drift Detector             |
+-----------------------------------------------------------------------------------+
```

### Key Modules & Capabilities:
* **Deal Analytics Dashboard ([DealDashboard.tsx](file:///c:/Users/Kamal/Desktop/Dashboard/src/dashboards/deal/DealDashboard.tsx)):** Real-time monitoring of Won, Lost, and In-Progress pipeline deals, win rates, sales cycles, customer distribution, and gross vs. net revenue (adjusted for 18% GST).
* **Sales & Operations Dashboard ([SalesDashboard.tsx](file:///c:/Users/Kamal/Desktop/Dashboard/src/dashboards/sales/SalesDashboard.tsx)):** Performance tracking against monthly sales targets (`INDIVIDUAL_REP_MONTHLY_TARGETS`), billed vs. unbilled figures, solution-wise breakdown, and sales representative leaderboards.
* **Project Delivery Dashboard ([ProjectDashboard.tsx](file:///c:/Users/Kamal/Desktop/Dashboard/src/dashboards/project/ProjectDashboard.tsx)):** Active project status monitoring, budget tracking, milestone completion rates, and delay risk flags ingested directly from Google Sheets.
* **Service Dashboard ([ServiceDashboard.tsx](file:///c:/Users/Kamal/Desktop/Dashboard/src/dashboards/service/ServiceDashboard.tsx)):** Service ticket volumes, resolution SLA compliance, AMC warranty coverage, and customer support metrics.
* **Predictive AI Deal Command Center ([AIDealCommandCenterModal.tsx](file:///c:/Users/Kamal/Desktop/Dashboard/src/components/predictive/AIDealCommandCenterModal.tsx)):** Multi-engine deal evaluation supplying win probabilities, risk flags, recommended win-back strategies, ROI opportunity rankings, and real-time deal simulation scenarios.
* **Executive RAG AI Chatbot ([AIChatbotDrawer.tsx](file:///c:/Users/Kamal/Desktop/Dashboard/src/components/chatbot/AIChatbotDrawer.tsx)):** A natural language assistant that retrieves structured CRM records, fetches live Bitrix comments and product rows on-demand, processes attached PDF/image quote documents, and delivers jargon-free strategic executive answers.
* **Platform Control Center ([PlatformControlCenter.tsx](file:///c:/Users/Kamal/Desktop/Dashboard/src/components/platform/PlatformControlCenter.tsx)):** Infrastructure monitoring displaying Data Quality Index (DQI) scores, Dead-Letter Queue (DLQ) quarantined records, data drift alerts, and pipeline execution logs.

---

## 2. Technology Stack ("What Tech Stack We Have Used")

### Frontend Framework & Core Libraries
* **React 19 (`react`, `react-dom`):** Modern component architecture utilizing hooks (`useState`, `useEffect`, `useMemo`, `useCallback`).
* **TypeScript 6 (`typescript`):** Strict type safety across records, filters, platform events, and API payloads.
* **Vite 8 (`vite`):** Next-generation lightning-fast frontend tooling and development server.

### Styling & Visual Design
* **Tailwind CSS v4 (`@tailwindcss/vite`, `tailwindcss`):** Utility-first styling engine tuned with a custom executive dark mode palette (`#0a0e1a` base).
* **Framer Motion (`framer-motion`):** Smooth drawer slide-ins, modal transitions, and dynamic list micro-animations.
* **Lucide React (`lucide-react`):** Comprehensive icon suite for visual clarity across navigational headers and KPI metric cards.
* **Canvas Confetti (`canvas-confetti`):** Interactive visual animations for target celebrations and sync confirmations.
* **Clsx & Tailwind Merge (`clsx`, `tailwind-merge`):** Dynamic class string construction without utility conflicts.

### Data Visualization & Graphics
* **Apache ECharts (`echarts`, `echarts-for-react`):** High-performance interactive charts for pipeline conversion funnels, monthly trends, and industry distribution.
* **Recharts (`recharts`):** Responsive SVG charts for revenue distribution and leaderboard progress bars.

### Artificial Intelligence & Machine Learning
* **Google GenAI SDK (`@google/genai`):** Official SDK integration targeting the `gemini-2.5-flash` model with support for text generation and inline multimodal binary attachments (PDF, PNG, JPEG).
* **TF-IDF & Cosine Vector Retriever:** Custom in-browser vector scoring and context extraction module (`src/ai/geminiRAG.ts`).

### Data Export & Parsing Engine
* **SheetJS / XLSX (`xlsx`):** In-browser parsing and generation of Microsoft Excel spreadsheets.
* **jsPDF & html2canvas (`jspdf`, `html2canvas`):** Dynamic PDF report generation and UI visual snapshots.

### Infrastructure & Server Tools (in `server/`)
* **Node.js Helper Scripts ([parse_user_data.js](file:///c:/Users/Kamal/Desktop/Dashboard/server/parse_user_data.js)):** Backend ETL scripts to sanitize, structure, and pre-aggregate complex CRM dumps.
* **Python Utilities ([generate_excel.py](file:///c:/Users/Kamal/Desktop/Dashboard/server/generate_excel.py)):** Pandas and OpenPyXL scripts for automated report generation.

---

## 3. System Architecture & Core Platform ("How I Am Making It")

The application is built on top of a **Layered Event-Driven Platform Architecture** located in [src/platform/](file:///c:/Users/Kamal/Desktop/Dashboard/src/platform/). Incoming raw records pass through a deterministic **10-Stage Pipeline** managed by the [EventDrivenPlatform](file:///c:/Users/Kamal/Desktop/Dashboard/src/platform/EventDrivenPlatform.ts) and orchestrated by a central [DIContainer](file:///c:/Users/Kamal/Desktop/Dashboard/src/platform/DIContainer.ts).

```
 Raw Data Ingestion (Bitrix24 / Google Sheets)
                       │
                       ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ STAGE 1: Ingestion & Circuit Breaker Check                  │
 ├─────────────────────────────────────────────────────────────┤
 │ STAGE 2: Validation Service (DQI Score Calculation)         │
 ├─────────────────────────────────────────────────────────────┤
 │ STAGE 3: Transformation Service & Provenance Tagging        │
 ├─────────────────────────────────────────────────────────────┤
 │ STAGE 4: Business Rule Engine & Dead-Letter Queue (DLQ)     │
 ├─────────────────────────────────────────────────────────────┤
 │ STAGE 5: Feature Engineering & Feature Store Computation    │
 ├─────────────────────────────────────────────────────────────┤
 │ STAGE 6 & 7: Database Store Commit & Materialized Views     │
 ├─────────────────────────────────────────────────────────────┤
 │ STAGE 8: Data Drift Detector (Z-Score Variance Alerts)      │
 ├─────────────────────────────────────────────────────────────┤
 │ STAGE 9: AI Readiness & RAG Vector Cache Generation         │
 ├─────────────────────────────────────────────────────────────┤
 │ STAGE 10: Dependency Graph Node Invalidation                │
 └─────────────────────────────────────────────────────────────┘
                       │
                       ▼
 Materialized Views & UI Component State Hydration
```

### Breakdown of the 10 Execution Stages:

1. **Ingestion & Circuit Breaker Stage:** Receives raw records, logs the start timestamp, computes a cryptographic payload checksum, and checks if the dataset has changed since the last poll.
2. **Validation & Data Quality Index (DQI) Stage:** Evaluates record completeness, checks required schema constraints, and assigns an aggregate DQI percentage score (0-100%).
3. **Transformation & Provenance Stage:** Attaches metadata (source URI, worksheet ID, row offset, sync job ID) to every record and executes deduplication algorithm matching record hashes and customer tokens (threshold $\ge 95\%$).
4. **Business Rule Engine Stage:** Validates records against domain policies (e.g., negative values, valid date bounds). Invalid rows are quarantined into the **Dead-Letter Queue (DLQService)** for manual review.
5. **Feature Engineering Stage:** Computes derived attributes such as `salesCycleDays`, `discountPct`, `revenueTier`, `historicalCustomerWinRate`, and updates the central **FeatureStore**.
6. **Database Commit Stage:** Writes transformed `EnhancedDealRecord` structures to [DatabaseStore.ts](file:///c:/Users/Kamal/Desktop/Dashboard/src/platform/DatabaseStore.ts) and logs an immutable audit event (`DealCreated` / `DealUpdated`).
7. **Materialized Views Refresh Stage:** Synchronously recalculates in-memory analytical views:
   * `CustomerHealthView` (Customer health scores, lifetime net value, risk level)
   * `SalespersonKPIView` (Rep win rates, total revenue, average sales cycle)
   * `IndustryKPIView` (Industry distribution, deal counts, sector win rates)
   * `DealPredictionView` (Win probabilities, expected values)
   * `PipelineView` (Stage-by-stage pipeline volume and net revenue)
8. **Data Drift Detection Stage:** Analyzes current incoming numerical distributions against historical baseline distributions using standard deviation drift detection.
9. **AI Readiness & Embeddings Stage:** Formats clean textual document chunks for each deal, pre-indexes vector terms, and updates the local RAG context cache.
10. **Dependency Graph Invalidation Stage:** Triggers topological dependency graph propagation via [DependencyGraph.ts](file:///c:/Users/Kamal/Desktop/Dashboard/src/platform/DependencyGraph.ts), invalidating cached UI views downstream and marking nodes as clean.

---

## 4. API Integration & External Data Fetching ("How I Am Calling the API")

### A. Bitrix24 CRM REST API Integration ([bitrixService.ts](file:///c:/Users/Kamal/Desktop/Dashboard/src/engine/bitrixService.ts))

Data is pulled directly from Bitrix24 Cloud CRM webhooks using native `fetch()` calls.

#### Key Bitrix Endpoints Utilized:
* `crm.deal.list.json`: Queries deals with custom filters (`FILTER[>DATE_CREATE]=2019-01-01`, `SELECT[]=*`, `SELECT[]=UF_*`).
* `crm.lead.list.json`: Ingests top-of-funnel leads to track lead qualification rates.
* `crm.deal.get.json`: Dynamically retrieves deep deal metadata for a specific ID.
* `crm.timeline.comment.list.json`: Fetches historical timeline comments added by sales representatives.
* `crm.deal.productrows.get.json`: Retrieves quoted line-item products, item quantities, and pricing.
* `batch.json`: Executes high-speed batch requests combining up to 50 REST operations into a single HTTP POST request.

#### High-Speed Parallel Batch Algorithm:
To ensure ultra-fast load times (< 1.5 seconds across hundreds of deals), `fetchBitrixDetailsBatch` groups deal IDs into chunks of 25 deals (making 50 internal REST commands: 25 timeline comment lookups + 25 product row lookups) and executes all batch HTTP requests concurrently using `Promise.all`:

```typescript
// Constructing Bitrix batch payload
const bodyParams = new URLSearchParams();
chunk.forEach(id => {
  bodyParams.append(`cmd[c_${id}]`, `crm.timeline.comment.list?filter[ENTITY_TYPE]=deal&filter[ENTITY_ID]=${id}`);
  bodyParams.append(`cmd[p_${id}]`, `crm.deal.productrows.get?id=${id}`);
});

const response = await fetch(`${baseUrl}batch.json`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: bodyParams.toString()
});
```

#### Field Normalization Rules:
* **Tax Normalization:** Bitrix stores gross deal amounts including 18% GST. For Won deals, the engine automatically extracts the net revenue without tax:
  $$\text{Net Revenue} = \text{Math.round}\left(\frac{\text{Gross Opportunity}}{1.18}\right)$$
* **Industry Mapping:** Custom user fields (`UF_CRM_67E4FF8E84730`) store numerical enum IDs. `normalizeBitrixIndustry()` maps these IDs to human-readable names (e.g., `'240'` $\rightarrow$ `'Banking and Finance'`, `'288'` $\rightarrow$ `'IT & Software'`).
* **Solution Mapping:** Parses `UF_CRM_1744361655612` or deal titles into standard categories (e.g., `'Passive Networking solution'`, `'CCTV Solution'`, `'Desktops/ Laptops'`).
* **Lost Reason Extraction:** Inspects custom field `UF_CRM_1742536927863` or timeline notes to isolate reasons for loss (e.g., `"Lost to AWS"`, `"Budget constraints"`).

---

### B. Google Sheets Operational Data Sync ([googleSheetsService.ts](file:///c:/Users/Kamal/Desktop/Dashboard/src/engine/googleSheetsService.ts))

Project management and order data are fetched live from public or shared Google Sheets.

#### Data Ingestion Pipeline:
1. **CSV Export URL Transformation:** Converts standard edit links (`https://docs.google.com/spreadsheets/d/{ID}/edit#gid={GID}`) into direct CSV export endpoints:
   ```typescript
   export const convertToCsvExportUrl = (url: string): string => {
     const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
     if (!match) return url;
     const docId = match[1];
     const gidMatch = url.match(/gid=([0-9]+)/);
     const gid = gidMatch ? gidMatch[1] : '0';
     return `https://docs.google.com/spreadsheets/d/${docId}/export?format=csv&gid=${gid}`;
   };
   ```
2. **Permission Guard:** Checks if Google returns HTML login pages (indicating private access) and gracefully surfaces a `permission_error` banner instructing the user to set link sharing to "Anyone with link can view".
3. **CSV Line Parser:** Splits raw CSV text, handles string quotes, normalizes header titles, and constructs typed JavaScript project objects.

---

## 5. Data Persistence & Refresh Lifecycle ("How Data is Fetched When We Refresh")

To prevent blank loading screens or layout shifts during network re-fetches, the application implements a strict **Stale-While-Revalidate (SWR)** caching pattern combined with local storage persistence.

```
                              PAGE REFRESH / MOUNT
                                       │
                                       ▼
                       Read from LocalStorage Cache
                     (`sales_dashboard_bitrix_data_cache_v10`)
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
         Instant UI Render                      Trigger Async Background
     (Won, Lost, Progress Deals)                   API Sync Operations
                                                          │
                                                          ▼
                                              Fetch Bitrix & Sheets APIs
                                                          │
                                                          ▼
                                             Run 10-Stage Platform Pipeline
                                                          │
                                                          ▼
                                              Update State & LocalStorage
```

### Complete Refresh Sequence:

1. **Synchronous Hydration (Instant Render):**
   When the user refreshes the browser, `App.tsx` initializes state via `getStoredBitrixCache()`:
   ```typescript
   const initialCache = getStoredBitrixCache();
   const [wonRecords, setWonRecords] = useState<DealRecord[]>(initialCache?.won || []);
   const [lostRecords, setLostRecords] = useState<DealRecord[]>(initialCache?.lost || []);
   const [progressRecords, setProgressRecords] = useState<DealRecord[]>(initialCache?.progress || []);
   ```
   This ensures that charts, KPIs, and deal tables render **instantly (0ms delay)** using cached data.

2. **Asynchronous Background Synchronization:**
   Immediately following initial render, the `useEffect` hook triggers background fetch handlers:
   ```typescript
   useEffect(() => {
     handleSyncBitrix();
     handleSyncProjectsSheet();
   }, []);
   ```

3. **Incremental Checksum Validation:**
   The incoming raw dataset is hashed. If the computed checksum matches the previously processed checksum and the sync was triggered by background polling, execution stops early (`rows_skipped`), preserving resources.

4. **Pipeline Processing & State Atomic Update:**
   When fresh network data arrives, `globalPlatform.processSheetIngestion(...)` processes the payload, updates [DatabaseStore.ts](file:///c:/Users/Kamal/Desktop/Dashboard/src/platform/DatabaseStore.ts), refreshes materialized views, updates local storage (`CACHE_KEY`), and updates component state smoothly without UI interruption.

---

## 6. AI RAG Chatbot Architecture & Workflow ("How My Chatbot Works")

The Executive AI Chatbot ([AIChatbotDrawer.tsx](file:///c:/Users/Kamal/Desktop/Dashboard/src/components/chatbot/AIChatbotDrawer.tsx) & [geminiRAG.ts](file:///c:/Users/Kamal/Desktop/Dashboard/src/ai/geminiRAG.ts)) acts as an automated sales analyst. It combines **Retrieval-Augmented Generation (RAG)**, live API queries, and multimodal document inspection.

```
 USER QUESTION / PROMPT ("Tell me about BITRIX-54 or Panacea deal")
                               │
                               ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ STEP 1: RAG Vector Retriever (TF-IDF Relevance Scoring)     │
 │ Scans all deals in memory -> Extracts Top 45-55 Records      │
 └─────────────────────────────────────────────────────────────┘
                               │
                               ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ STEP 2: Live Bitrix Dynamic REST Fetcher                    │
 │ IF Deal ID or Customer detected:                            │
 │ -> Fetches Live Comments (crm.timeline.comment.list)        │
 │ -> Fetches Quoted Products (crm.deal.productrows.get)       │
 │ -> Fetches Custom Lost Reasons & Attachment Links           │
 └─────────────────────────────────────────────────────────────┘
                               │
                               ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ STEP 3: Multimodal File Attachment Inspection               │
 │ IF PDF or Image attached: Convert to Base64 `inlineData`    │
 └─────────────────────────────────────────────────────────────┘
                               │
                               ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ STEP 4: Prompt Construction & System Directive Injection    │
 │ Applies executive formatting rules (No technical jargon)     │
 └─────────────────────────────────────────────────────────────┘
                               │
                               ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ STEP 5: Model Inference (`gemini-2.5-flash`)                │
 │ Output: Markdown with Overview, Lost Reasons, Scenarios     │
 └─────────────────────────────────────────────────────────────┘
                               │ (Fallback if API fails)
                               ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ Local Fallback Engine (`computeExecutiveDealAnalysis`)      │
 └─────────────────────────────────────────────────────────────┘
```

### Detailed Chatbot Workflow:

#### Step 1: Context Retrieval via TF-IDF Vector Scoring (`retrieveRelevantContext`)
When the user submits a question, the retriever converts the query into lowercase tokens and scores all deal records in memory:
$$\text{Score}(R) = \sum_{t \in Q} 2 \cdot \mathbb{I}(t \in R) + 100 \cdot \mathbb{I}(\text{Exact ID Match}) + 80 \cdot \mathbb{I}(\text{Customer Match}) + 10 \cdot \mathbb{I}(\text{Rep Match})$$
The top 45 to 55 highest-scoring records are formatted into structured text strings and injected into the prompt.

#### Step 2: Live On-Demand Bitrix Data Fetching (`fetchLiveBitrixDealInfo`)
If the prompt references a specific Deal ID (e.g., `BITRIX-54`, `3724`) or customer name, the system bypasses cache and fires dynamic REST API calls in parallel:
* Retrieves exact lost reason fields (`UF_CRM_1742536927863`).
* Extracts all historical timeline comments written by sales reps.
* Fetches quoted product line items, item quantities, and quoted total prices.
* Detects attached quotation PDF files uploaded to Bitrix deal records.

#### Step 3: Multimodal File Payload Processing
Users can attach quotation PDFs, invoices, spreadsheets, or screenshots directly into the chat drawer.
* **Text/Excel/Word Files:** Text content is extracted and appended (up to 12,000 characters).
* **Images & PDFs:** Binary data is encoded into Base64 strings and passed natively to Google Gemini 2.5 Flash using the `inlineData` structure:
  ```typescript
  contents = [
    systemInstructions,
    {
      inlineData: {
        data: base64Data,
        mimeType: attachedFile.mimeType || 'application/pdf'
      }
    }
  ];
  ```

#### Step 4: System Prompt Directives & Executive Output Generation
The LLM is constrained by strict executive formatting instructions:
* **No Technical Jargon:** Terms like "Layer 1", "weighted scores", or raw formulas are strictly forbidden.
* **Structured Sections:** Responses must include:
  1. **📊 Deal Overview:** (Deal ID, Customer, Sales Rep, Net Revenue, Stage)
  2. **❌ Deal Status & Lost Reason:** Prominently displays the exact recorded loss reason if closed-lost.
  3. **💬 Recorded Comments & Customer Timeline Notes:** Bulleted historical rep notes.
  4. **🛍️ Quoted Products & Uploaded Quotations:** Lists line items or uploaded quote PDF availability.
  5. **🎯 Win Probability & Closing Chances:** Percentage win probability with executive justification.
  6. **⚖️ Decision Scenario Analysis Table:** Markdown table comparing strategic win-back options.

#### Step 5: Executive Local Fallback Engine (`computeExecutiveDealAnalysis`)
If the Gemini API key is missing or network connectivity is unavailable, the chatbot seamlessly switches to a local deterministic analytics engine. It computes win probabilities based on pipeline stage rules and constructs structured response cards without throwing errors or crashing the application.

---

## 7. Algorithms & Mathematical Models ("What Algos We Have Used")

### 1. TF-IDF Context Vector Scoring Algorithm ([geminiRAG.ts](file:///c:/Users/Kamal/Desktop/Dashboard/src/ai/geminiRAG.ts))
Used to identify relevant deals for LLM prompt augmentation.
```
Score = (Token Frequency Matches * 2) + Exact_ID_Bonus(100) + Customer_Match_Bonus(80) + Rep_Bonus(10)
```

### 2. Multi-Factor Deal Win Probability & Scoring Model ([aiDealCommandCenter.ts](file:///c:/Users/Kamal/Desktop/Dashboard/src/engine/aiDealCommandCenter.ts))
Calculates predictive win probability $P(\text{Win})$ for in-progress deals:

$$P(\text{Win}) = \text{BaseStageProb} - (\text{DaysInStage} \times 1.5\%) + \text{RepWinRateBonus} + \text{CustomerHealthBonus} - \text{DiscountPenalty}$$

Where:
* $\text{BaseStageProb}$: Stage-specific base odds (`Negotiation` $= 75\%$, `Quote Approval` $= 65\%$, `Solution Design` $= 50\%$, `Need Analysis` $= 35\%$).
* **Stagnation Penalty:** $-1.5\%$ deducted for every day the deal remains stuck past 14 days in the same stage.
* **Rep Win Rate Bonus:** $\pm 10\%$ adjustment based on historical conversion performance of the assigned representative.
* **Customer Health Bonus:** Up to $+15\%$ for recurring clients with past Won deal history.

### 3. Opportunity ROI Ranking Algorithm ([aiDealCommandCenter.ts](file:///c:/Users/Kamal/Desktop/Dashboard/src/engine/aiDealCommandCenter.ts))
Prioritizes sales team efforts based on expected monetary return per hour invested:

$$\text{Expected Value} = \text{Net Revenue} \times P(\text{Win})$$

$$\text{ROI Gain Per Hour} = \frac{\text{Expected Value}}{\text{Estimated Effort Hours}}$$

Deals are ranked into five tiers: `'Highest'`, `'Very High'`, `'High'`, `'Medium'`, `'Low'`.

### 4. Data Quality Index (DQI) & Validation Score ([ValidationService.ts](file:///c:/Users/Kamal/Desktop/Dashboard/src/platform/ValidationService.ts))
Measures the overall health of ingested CRM data on a 0-100 scale:

$$\text{DQI} = 100 - \left( \frac{\text{Missing Critical Fields}}{\text{Total Rows}} \times 40 \right) - \left( \frac{\text{Schema Violations}}{\text{Total Rows}} \times 30 \right) - \left( \frac{\text{Out-of-Bound Values}}{\text{Total Rows}} \times 30 \right)$$

### 5. Z-Score Data Drift Detection Algorithm ([DriftDetector.ts](file:///c:/Users/Kamal/Desktop/Dashboard/src/platform/DriftDetector.ts))
Detects statistical anomaly shifts in deal distribution sizes:

$$Z = \frac{X_i - \mu}{\sigma}$$

If $|Z| > 2.5$, the platform raises a data drift alert in the Platform Control Center, flagging potential currency entry errors or unusual enterprise deal spikes.

### 6. Target Pacing & Achievement Run-Rate Forecast ([kpiEngine.ts](file:///c:/Users/Kamal/Desktop/Dashboard/src/engine/kpiEngine.ts))
Calculates monthly sales rep progress against defined quotas (`INDIVIDUAL_REP_MONTHLY_TARGETS`):

$$\text{Achievement \%} = \left( \frac{\text{Total Won Net Revenue}}{\text{Target Quota}} \right) \times 100$$

$$\text{Projected Month-End Revenue} = \left( \frac{\text{Current Won Net Revenue}}{\text{Days Elapsed}} \right) \times \text{Total Days in Month}$$

### 7. Directed Acyclic Graph (DAG) Topological Invalidation ([DependencyGraph.ts](file:///c:/Users/Kamal/Desktop/Dashboard/src/platform/DependencyGraph.ts))
Maintains a node-edge dependency tree connecting data sources to materialized views and UI dashboards. When a source changes, a Depth-First Search (DFS) traversal recursively marks downstream nodes as dirty to force selective re-computation.

---

## 8. Comprehensive Function Registry ("What Functions We Have Used")

### A. Bitrix CRM Engine ([src/engine/bitrixService.ts](file:///c:/Users/Kamal/Desktop/Dashboard/src/engine/bitrixService.ts))
| Function Name | Signature & Parameters | Description |
|---|---|---|
| `fetchBitrixDeals` | `(customConfig?: BitrixConfig) => Promise<BitrixSyncResult>` | Primary async worker fetching deals & leads concurrently, executing batch detail queries, normalizing GST, mapping industries/solutions, and returning classified won/lost/progress arrays. |
| `fetchBitrixLeads` | `(config: BitrixConfig) => Promise<BitrixLeadRecord[]>` | Fetches top-of-funnel leads from Bitrix with parallel pagination handling datasets $>50$ records. |
| `fetchBitrixDetailsBatch` | `(baseUrl: string, dealIds: string[]) => Promise<{ commentsMap, productsMap }>` | High-speed batch processing function utilizing `batch.json` to query timeline comments and quoted products for 25 deals simultaneously per HTTP call. |
| `normalizeBitrixIndustry` | `(val: any, rawRecord?: any) => string` | Maps numerical industry IDs (`240`, `288`, etc.) to human-readable industry names using `BITRIX_INDUSTRY_ENUM_MAP`. |
| `normalizeBitrixSolutionType`| `(val: any, rawRecord?: any) => string` | Maps custom field text or titles into standard solution categories (e.g., CCTV, Laptops, Passive Networking). |
| `getStoredBitrixCache` | `() => BitrixSyncResult \| null` | Reads cached Bitrix dataset synchronously from local storage (`sales_dashboard_bitrix_data_cache_v10`). |
| `saveBitrixCache` | `(data: BitrixSyncResult) => void` | Writes current Bitrix sync result payload to local storage. |

---

### B. RAG AI Chatbot Engine ([src/ai/geminiRAG.ts](file:///c:/Users/Kamal/Desktop/Dashboard/src/ai/geminiRAG.ts))
| Function Name | Signature & Parameters | Description |
|---|---|---|
| `processGeminiRAGQuery` | `(query, records, kpis, apiKeyOverride?, attachedFile?) => Promise<ChatMessage>` | Main RAG orchestrator. Prepares TF-IDF vector context, triggers live Bitrix queries, encodes multimodal attachments, calls Google Gemini 2.5 Flash API, and handles fallback logic. |
| `retrieveRelevantContext` | `(query: string, records: DealRecord[], topK = 45) => string` | Vector retrieval engine scoring deal records against user query tokens and returning top-matching deal summaries. |
| `fetchLiveBitrixDealInfo` | `(query: string) => Promise<string>` | Inspects query for Deal IDs or rep names and executes live API calls to retrieve real-time comments, line-item products, custom loss reasons, and quote files. |
| `computeExecutiveDealAnalysis` | `(query: string, records: DealRecord[]) => ExecutiveAnalysis` | Fallback engine computing win probabilities and decision scenarios locally if LLM API calls fail or API key is absent. |
| `getStoredGeminiKey` | `() => string` | Retrieves configured Gemini API key from `localStorage` (`compton_gemini_api_key`) or `.env` fallback (`VITE_GEMINI_API_KEY`). |

---

### C. KPI Calculation Engine ([src/engine/kpiEngine.ts](file:///c:/Users/Kamal/Desktop/Dashboard/src/engine/kpiEngine.ts))
| Function Name | Signature & Parameters | Description |
|---|---|---|
| `calculateKPIs` | `(records: DealRecord[], filters?, targetOverride?, allUnfilteredRecords?) => KPIMetrics` | Aggregates gross revenue, GST-adjusted net revenue, win/loss deal counts, win rates %, average deal size, sales cycles, and monthly target achievements. |
| `filterRecords` | `(records: DealRecord[], filters: GlobalFilterState) => DealRecord[]` | Filters deals by date ranges, selected months, quarters, years, sales reps, industries, solutions, lead sources, stages, and deal value bounds. |

---

### D. Predictive AI Deal Command Center ([src/engine/aiDealCommandCenter.ts](file:///c:/Users/Kamal/Desktop/Dashboard/src/engine/aiDealCommandCenter.ts))
| Function Name | Signature & Parameters | Description |
|---|---|---|
| `analyzeAllInProgressDeals` | `(records: DealRecord[]) => { analyses: AIDealAnalysis[], summary: CommandCenterExecutiveSummary }` | Master evaluation method analyzing all active deals, calculating multi-engine scores, ranking ROI gains per hour, identifying stuck deals ($>14$ days), and generating executive summaries. |
| `simulateDealScenario` | `(deal: DealRecord, scenario: SimulatorScenario) => SimulatedResult` | Interactive deal simulator estimating updated win probabilities based on rep re-assignment, price discounts, or AMC warranty bundling. |

---

### E. Event-Driven Platform Core ([src/platform/EventDrivenPlatform.ts](file:///c:/Users/Kamal/Desktop/Dashboard/src/platform/EventDrivenPlatform.ts))
| Function Name | Signature & Parameters | Description |
|---|---|---|
| `processSheetIngestion` | `(sheetName: string, rawRecords: DealRecord[], initiatedBy?: string) => Promise<SyncPipelineResult>` | Executes the primary 10-stage pipeline: ingestion check $\rightarrow$ DQI validation $\rightarrow$ provenance tagging $\rightarrow$ deduplication $\rightarrow$ rule validation $\rightarrow$ feature engineering $\rightarrow$ database commit $\rightarrow$ drift detection $\rightarrow$ AI embeddings $\rightarrow$ dependency DAG invalidation. |
| `replayCheckpoint` | `(jobId: string, resumeStage: PipelineStageKey) => Promise<boolean>` | Re-runs pipeline execution from a specific historical stage checkpoint for failure recovery. |

---

### F. Google Sheets & Operational Services ([src/engine/googleSheetsService.ts](file:///c:/Users/Kamal/Desktop/Dashboard/src/engine/googleSheetsService.ts))
| Function Name | Signature & Parameters | Description |
|---|---|---|
| `fetchProjectsSheet` | `(rawUrl: string) => Promise<{ projects: any[], status: SheetFetchStatus }>` | Downloads Google Sheets CSV data, validates public sharing permissions, parses rows, and returns typed project records. |
| `convertToCsvExportUrl` | `(url: string) => string` | Converts standard Google Sheets browser URLs into direct `/export?format=csv&gid=...` endpoints. |

---

## 9. Installation & Project Setup

### Prerequisites
* **Node.js:** v18.0.0 or higher
* **npm:** v9.0.0 or higher

### 1. Clone & Install Dependencies
```bash
# Clone the repository
git clone https://github.com/kamalyadav07/Compton-Executive-Dashboard.git

# Navigate into project directory
cd Compton-Executive-Dashboard

# Install node dependencies
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory (or use `.env.example` as a template):
```env
VITE_GEMINI_API_KEY="your_google_gemini_api_key_here"
VITE_BITRIX_WEBHOOK_URL="https://your-domain.bitrix24.com/rest/user/webhook_key/"
```

### 3. Start Development Server
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:5173`.

### 4. Build for Production & Linting
```bash
# Run Oxlint linter
npm run lint

# Build production bundle (TypeScript compile + Vite build)
npm run build

# Preview production build
npm run preview
```

---

## 📄 License & Attribution

Developed for **Compton Executive Management**. Built with React 19, Vite, Tailwind CSS, ECharts, and Google Gemini GenAI. All rights reserved.
