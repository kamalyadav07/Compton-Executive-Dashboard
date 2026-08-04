import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

function generateDatasets(outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const salesReps = [
    "Vikram Mehta", "Ananya Sharma", "Rahul Verma", "Priya Nair",
    "Rohan Deshmukh", "Neha Kapoor", "Amitabh Sen"
  ];

  const industries = [
    "Banking & Finance", "Healthcare & Life Sciences", "Manufacturing",
    "Retail & E-commerce", "Technology & SaaS", "Energy & Utilities", "Telecommunications"
  ];

  const solutions = [
    "Cloud Infrastructure", "Cybersecurity Suite", "Networking Architecture",
    "Enterprise ERP", "AI Data Platform", "Annual Maintenance Contract (AMC)"
  ];

  const leadSources = [
    "Direct Outreach", "Google Ads", "Partner Referral",
    "LinkedIn Campaign", "Industry Summit", "Inbound Website", "Cold Email"
  ];

  const customers = [
    "Apex Global Financial", "Zenith Health Systems", "Titan Heavy Motors", "Nova Retail Tech", "Starlight Software",
    "Aether Energy Corp", "Vanguard Telecom", "Omega Capital Solutions", "BioPharma Dynamics", "Precision Manufacturing",
    "Horizon Logistics", "Quantum Cloud Labs", "Metro Rail Systems", "Summit Securities", "Pulse MedTech",
    "Silverline Infra", "Hyperion Cyber Sec", "Nexus Data Labs", "Crest Insurance", "Orbital Satellite Tech"
  ];

  const lostReasons = [
    "Pricing / High Cost", "Competitor Selection (Better Features)", "Delayed Quotation / Slow Follow-up",
    "Budget Cut / Project Postponed", "Lack of Specific Feature", "Internal Restructuring", "Unresponsive Stakeholders"
  ];

  const stages = ["Qualification & Discovery", "Solution Architecture", "Commercial Proposal", "Contract Negotiation", "Final Approval"];

  // 1. WON DEALS
  const wonRows = [];
  for (let i = 1; i <= 140; i++) {
    const rep = salesReps[Math.floor(Math.random() * salesReps.length)];
    const ind = industries[Math.floor(Math.random() * industries.length)];
    const sol = solutions[Math.floor(Math.random() * solutions.length)];
    const src = leadSources[Math.floor(Math.random() * leadSources.length)];
    const cust = customers[Math.floor(Math.random() * customers.length)];

    const baseVal = [850000, 1500000, 2800000, 4500000, 7500000, 12000000, 25000000][Math.floor(Math.random() * 7)];
    const grossVal = baseVal + Math.floor(Math.random() * 150000);
    const netVal = Math.round((grossVal / 1.18) * 100) / 100;
    const gstVal = Math.round((grossVal - netVal) * 100) / 100;

    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1;
    const dateStr = `2025-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    wonRows.push({
      "Deal ID": `DEAL-WON-${1000 + i}`,
      "Customer Name": `  ${cust}  `, // extra space for cleaning test
      "Gross Revenue (INR)": grossVal,
      "GST (18%)": gstVal,
      "Net Revenue (INR)": netVal,
      "Sales Representative": rep,
      "Industry Vertical": ind,
      "Solution / Product": sol,
      "Lead Source Channel": src,
      "Close Date": dateStr,
      "Sales Cycle (Days)": Math.floor(Math.random() * 90) + 14,
      "Contract Term (Months)": [12, 24, 36, 48][Math.floor(Math.random() * 4)],
      "Margin %": Math.round((20 + Math.random() * 25) * 10) / 10
    });
  }

  // 2. LOST DEALS
  const lostRows = [];
  for (let i = 1; i <= 75; i++) {
    const rep = salesReps[Math.floor(Math.random() * salesReps.length)];
    const ind = industries[Math.floor(Math.random() * industries.length)];
    const sol = solutions[Math.floor(Math.random() * solutions.length)];
    const src = leadSources[Math.floor(Math.random() * leadSources.length)];
    const cust = customers[Math.floor(Math.random() * customers.length)];
    const reason = lostReasons[Math.floor(Math.random() * lostReasons.length)];

    const grossVal = [600000, 1200000, 2500000, 5000000, 9000000, 18000000][Math.floor(Math.random() * 6)];
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1;
    const dateStr = `2025-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    lostRows.push({
      "Deal Reference ID": `DEAL-LOST-${2000 + i}`,
      "Client Organization": cust,
      "Quoted Gross Value": grossVal,
      "Estimated Net Loss": Math.round((grossVal / 1.18) * 100) / 100,
      "Sales Owner": rep,
      "Industry Sector": ind,
      "Proposed Solution": sol,
      "Acquisition Source": src,
      "Primary Lost Reason": reason,
      "Winning Competitor": ["Acme Enterprise", "TechCorp Global", "InnoSystems", "None / Internal"][Math.floor(Math.random() * 4)],
      "Lost Date": dateStr,
      "Sales Velocity Days": Math.floor(Math.random() * 80) + 10
    });
  }

  // 3. IN PROGRESS DEALS
  const progressRows = [];
  for (let i = 1; i <= 65; i++) {
    const rep = salesReps[Math.floor(Math.random() * salesReps.length)];
    const ind = industries[Math.floor(Math.random() * industries.length)];
    const sol = solutions[Math.floor(Math.random() * solutions.length)];
    const src = leadSources[Math.floor(Math.random() * leadSources.length)];
    const cust = customers[Math.floor(Math.random() * customers.length)];
    const stg = stages[Math.floor(Math.random() * stages.length)];
    const probMap = { "Qualification & Discovery": 20, "Solution Architecture": 40, "Commercial Proposal": 60, "Contract Negotiation": 80, "Final Approval": 90 };
    const prob = probMap[stg];

    const grossVal = [1000000, 2200000, 4800000, 8500000, 15000000, 30000000][Math.floor(Math.random() * 6)];
    const netVal = Math.round((grossVal / 1.18) * 100) / 100;
    const dateStr = `2025-09-15`;

    progressRows.push({
      "Opportunity ID": `DEAL-PIPE-${3000 + i}`,
      "Target Customer": cust,
      "Pipeline Gross Amount": grossVal,
      "Pipeline Net Amount": netVal,
      "Deal Owner": rep,
      "Industry": ind,
      "Solution Package": sol,
      "Lead Channel": src,
      "Current Pipeline Stage": stg,
      "Win Probability (%)": prob,
      "Weighted Forecast Net (INR)": Math.round(netVal * (prob / 100)),
      "Expected Close Date": dateStr,
      "Age in Pipeline (Days)": Math.floor(Math.random() * 100) + 5
    });
  }

  const wbWon = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbWon, XLSX.utils.json_to_sheet(wonRows), "Won Deals");
  XLSX.writeFile(wbWon, path.join(outputDir, "Won Deals.xlsx"));

  const wbLost = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbLost, XLSX.utils.json_to_sheet(lostRows), "Lost Deals");
  XLSX.writeFile(wbLost, path.join(outputDir, "Lost Deals.xlsx"));

  const wbProgress = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbProgress, XLSX.utils.json_to_sheet(progressRows), "In Progress Deals");
  XLSX.writeFile(wbProgress, path.join(outputDir, "In Progress Deals.xlsx"));

  console.log(`Generated 3 Excel datasets in ${outputDir}`);
}

generateDatasets("public/sample_data");
generateDatasets(".");
