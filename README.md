# Compton Executive & Operations Dashboard

A real-time executive operations platform built for **Compton**, unifying sales performance, service desk operations, and project delivery into a single, interactive dashboard.

Instead of logging into separate CRM portals, checking spreadsheets, or chasing status updates over email, leadership and department heads use this dashboard to track revenue targets, catch delayed customer tickets, and monitor client projects in real time.

---

## What’s Inside

### 1. Sales & Revenue Dashboard
- **Target vs. Actuals**: Monthly and financial year target tracking at both company and individual sales representative levels.
- **Billed vs. Unbilled Pipeline**: Live visibility into won deals awaiting invoicing versus revenue already realized.
- **Inbound Lead Acquisition**: Donut breakdown of actual lead sources (Google Ads, Existing Clients, Self Generated, References) — filtered strictly for inbound leads so deal conversions don't skew acquisition metrics.
- **Sales Rep Leaderboard**: Real-time ranking of sales reps by net revenue, deal count, and target achievement rate.
- **1-Click Excel Drill-Downs**: Every KPI card and chart element opens an interactive modal with full table registers and instant `.xlsx` exports.

### 2. Service & Helpdesk Dashboard
- **Burning Tickets Detector**: Automatically isolates high-risk customer tickets that need immediate escalation:
  - Ticket is currently *In Progress*
  - Estimated resolution time is *OVER*
  - No comments or updates for more than *2 days*
  - High severity or active escalation flag
  - Automatically filters out tickets marked *On Hold* or *Under Observation*
- **CSAT Score & Feedback**: Customer satisfaction rating tracker tied dynamically to month filters based on ticket close date, including full customer feedback and multi-line issue descriptions.
- **Service Incident Queue**: Live count of open, escalated, and resolved tickets synced directly from our service MySQL database.

### 3. Deal & Revenue Forecasting
- **Pipeline Velocity**: Visual conversion funnel showing deal movement across stages.
- **Predictive Win Scoring**: Statistical weighting and deal intelligence models to forecast month-end and fiscal-year closure revenue.
- **GST & Net Value Calculations**: Automatic normalization between gross deal values and 18% GST net figures.

### 4. Project Delivery Dashboard
- **Active Project Health**: Live milestone completion tracking, budget utilization, and risk indicators for ongoing client infrastructure deployments.
- **Google Sheets Integration**: Pulls operational delivery sheets automatically with fallback offline caching.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4
- **Charts & Visuals**: Apache ECharts (`echarts-for-react`), Recharts, Lucide Icons, Framer Motion
- **Data Exporting**: SheetJS (`xlsx`) for client-side Excel exports, jsPDF
- **Backend API**: Node.js & Express (`server/dashboard-server.js`)
- **Database & Integrations**: MySQL (`mysql2` connection pool), Bitrix24 REST API, Google Sheets CSV Engine
- **Hosting**: Hostinger Static Web Hosting (frontend) + Ubuntu VPS reverse-proxied via Nginx & PM2 (backend API)

---

## Project Structure

```text
├── public/                     # Static assets & offline fallback data caches
├── server/                     # Express backend API & sync services
│   ├── dashboard-server.js     # Main server entrypoint (routes, proxy, cache)
│   ├── routes/                 # Service & analytics API routes
│   └── services/               # MySQL service database connection pool
├── src/
│   ├── components/             # Reusable UI cards, search bars, modals
│   ├── config/                 # API endpoints, targets, and sheet configurations
│   │   ├── apiConfig.ts        # Smart environment-aware API URL resolver
│   │   ├── salesTargets.ts     # Sales targets for FY & individual reps
│   │   └── sheetsConfig.ts     # Google Sheets source mappings
│   ├── dashboards/             # Core dashboard pages
│   │   ├── sales/              # SalesDashboard & SalesAnalyticsDetailModal
│   │   ├── service/            # ServiceDashboard, BurningTicketsTable & modals
│   │   ├── deal/               # Pipeline & deal analytics
│   │   ├── dealForecast/       # Predictive win-rate & forecast views
│   │   └── project/            # Operations & project delivery tracking
│   ├── engine/                 # Client-side business logic & API services
│   │   ├── bitrixService.ts    # Bitrix24 deal/lead fetching & normalization
│   │   └── serviceService.ts   # Helpdesk tickets & CSAT data engine
│   └── index.css               # Design tokens & glassmorphism theme
├── package.json
└── vite.config.ts
```

---

## Getting Started Locally

### Prerequisites
- Node.js 18+ installed
- npm or yarn

### 1. Clone the repository
```bash
git clone https://github.com/kamalyadav07/Compton-Executive-Dashboard.git
cd Compton-Executive-Dashboard
```

### 2. Install dependencies
```bash
npm install
cd server && npm install && cd ..
```

### 3. Configure environment variables
Create a `.env` file in the root directory (or in `server/.env`):
```env
PORT=4000
NODE_ENV=development
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=compton
BITRIX_WEBHOOK_URL=https://your-domain.bitrix24.in/rest/...
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

### 4. Run the development server
```bash
npm run dev
```
This runs both the Express backend on port `4000` and the Vite dev server on port `3000`. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Production Build & Deployment

To generate an optimized production bundle:
```bash
npm run build
```
This compiles TypeScript and outputs the minified static build to `dist/`.

- **Frontend**: Upload the contents of `dist/` to your web server (e.g. Hostinger `public_html/`).
- **Backend**: Run the Express server on your VPS with PM2:
  ```bash
  pm2 start server/dashboard-server.js --name "compton-dashboard-server"
  pm2 save
  ```

---

## License

Internal proprietary software developed for Compton. All rights reserved.
