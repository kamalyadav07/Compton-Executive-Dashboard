"""
Sample Excel Dataset Generator for Enterprise AI Sales Intelligence Platform
Generates 3 enterprise Excel files:
1. Won Deals.xlsx
2. Lost Deals.xlsx
3. In Progress Deals.xlsx
"""

import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

def generate_datasets(output_dir="."):
    os.makedirs(output_dir, exist_ok=True)
    
    np.random.seed(42)
    
    sales_reps = [
        "Vikram Mehta", "Ananya Sharma", "Rahul Verma", "Priya Nair", 
        "Rohan Deshmukh", "Neha Kapoor", "Amitabh Sen"
    ]
    
    industries = [
        "Banking & Finance", "Healthcare & Life Sciences", "Manufacturing", 
        "Retail & E-commerce", "Technology & SaaS", "Energy & Utilities", "Telecommunications"
    ]
    
    solutions = [
        "Cloud Infrastructure", "Cybersecurity Suite", "Networking Architecture", 
        "Enterprise ERP", "AI Data Platform", "Annual Maintenance Contract (AMC)"
    ]
    
    lead_sources = [
        "Direct Outreach", "Google Ads", "Partner Referral", 
        "LinkedIn Campaign", "Industry Summit", "Inbound Website", "Cold Email"
    ]
    
    customers = [
        "Apex Global Financial", "Zenith Health Systems", "Titan Heavy Motors", "Nova Retail Tech", "Starlight Software",
        "Aether Energy Corp", "Vanguard Telecom", "Omega Capital Solutions", "BioPharma Dynamics", "Precision Manufacturing",
        "Horizon Logistics", "Quantum Cloud Labs", "Metro Rail Systems", "Summit Securities", "Pulse MedTech",
        "Silverline Infra", "Hyperion Cyber Sec", "Nexus Data Labs", "Crest Insurance", "Orbital Satellite Tech"
    ]
    
    lost_reasons = [
        "Pricing / High Cost", "Competitor Selection (Better Features)", "Delayed Quotation / Slow Follow-up",
        "Budget Cut / Project Postponed", "Lack of Specific Feature", "Internal Restructuring", "Unresponsive Stakeholders"
    ]
    
    stages = ["Qualification & Discovery", "Solution Architecture", "Commercial Proposal", "Contract Negotiation", "Final Approval"]
    
    start_date = datetime(2025, 1, 1)
    
    # 1. WON DEALS DATASET
    won_records = []
    for i in range(1, 140):
        rep = np.random.choice(sales_reps)
        ind = np.random.choice(industries)
        sol = np.random.choice(solutions)
        src = np.random.choice(lead_sources)
        cust = np.random.choice(customers)
        
        base_val = np.random.choice([850000, 1500000, 2800000, 4500000, 7500000, 12000000, 25000000])
        gross_val = float(base_val + np.random.randint(-50000, 100000))
        gst_amount = round(gross_val - (gross_val / 1.18), 2)
        net_val = round(gross_val / 1.18, 2)
        
        close_dt = start_date + timedelta(days=int(np.random.randint(0, 540)))
        sales_cycle = int(np.random.randint(14, 120))
        
        won_records.append({
            "Deal ID": f"DEAL-WON-{1000 + i}",
            "Customer Name": f"  {cust}  ", # extra space for cleaning test
            "Gross Revenue (INR)": gross_val,
            "GST (18%)": gst_amount,
            "Net Revenue (INR)": net_val,
            "Sales Representative": rep,
            "Industry Vertical": ind,
            "Solution / Product": sol,
            "Lead Source Channel": src,
            "Close Date": close_dt.strftime("%Y-%m-%d"),
            "Sales Cycle (Days)": sales_cycle,
            "Contract Term (Months)": np.random.choice([12, 24, 36, 48]),
            "Margin %": round(float(np.random.uniform(22.0, 48.0)), 1)
        })
        
    df_won = pd.DataFrame(won_records)
    
    # 2. LOST DEALS DATASET
    lost_records = []
    for i in range(1, 75):
        rep = np.random.choice(sales_reps)
        ind = np.random.choice(industries)
        sol = np.random.choice(solutions)
        src = np.random.choice(lead_sources)
        cust = np.random.choice(customers)
        reason = np.random.choice(lost_reasons, p=[0.38, 0.22, 0.15, 0.10, 0.08, 0.04, 0.03])
        
        gross_val = float(np.random.choice([600000, 1200000, 2500000, 5000000, 9000000, 18000000]))
        close_dt = start_date + timedelta(days=int(np.random.randint(0, 540)))
        competitor = np.random.choice(["Acme Enterprise", "TechCorp Global", "InnoSystems", "None / Internal", "Legacy Vendor"])
        
        lost_records.append({
            "Deal Reference ID": f"DEAL-LOST-{2000 + i}",
            "Client Organization": cust,
            "Quoted Gross Value": gross_val,
            "Estimated Net Loss": round(gross_val / 1.18, 2),
            "Sales Owner": rep,
            "Industry Sector": ind,
            "Proposed Solution": sol,
            "Acquisition Source": src,
            "Primary Lost Reason": reason,
            "Winning Competitor": competitor,
            "Lost Date": close_dt.strftime("%Y-%m-%d"),
            "Sales Velocity Days": np.random.randint(10, 90)
        })
        
    df_lost = pd.DataFrame(lost_records)
    
    # 3. IN PROGRESS DEALS DATASET
    progress_records = []
    for i in range(1, 65):
        rep = np.random.choice(sales_reps)
        ind = np.random.choice(industries)
        sol = np.random.choice(solutions)
        src = np.random.choice(lead_sources)
        cust = np.random.choice(customers)
        stg = np.random.choice(stages)
        prob = {"Qualification & Discovery": 20, "Solution Architecture": 40, "Commercial Proposal": 60, "Contract Negotiation": 80, "Final Approval": 90}[stg]
        
        gross_val = float(np.random.choice([1000000, 2200000, 4800000, 8500000, 15000000, 30000000]))
        est_close_dt = datetime.now() + timedelta(days=int(np.random.randint(5, 180)))
        
        progress_records.append({
            "Opportunity ID": f"DEAL-PIPE-{3000 + i}",
            "Target Customer": cust,
            "Pipeline Gross Amount": gross_val,
            "Pipeline Net Amount": round(gross_val / 1.18, 2),
            "Deal Owner": rep,
            "Industry": ind,
            "Solution Package": sol,
            "Lead Channel": src,
            "Current Pipeline Stage": stg,
            "Win Probability (%)": prob,
            "Weighted Forecast Net (INR)": round((gross_val / 1.18) * (prob / 100.0), 2),
            "Expected Close Date": est_close_dt.strftime("%Y-%m-%d"),
            "Age in Pipeline (Days)": np.random.randint(5, 120)
        })
        
    df_progress = pd.DataFrame(progress_records)
    
    won_path = os.path.join(output_dir, "Won Deals.xlsx")
    lost_path = os.path.join(output_dir, "Lost Deals.xlsx")
    progress_path = os.path.join(output_dir, "In Progress Deals.xlsx")
    
    df_won.to_excel(won_path, index=False, sheet_name="Won Deals")
    df_lost.to_excel(lost_path, index=False, sheet_name="Lost Deals")
    df_progress.to_excel(progress_path, index=False, sheet_name="In Progress Deals")
    
    print(f"Generated Excel datasets:\n - {won_path}\n - {lost_path}\n - {progress_path}")

if __name__ == "__main__":
    generate_datasets("public/sample_data")
    generate_datasets(".")
