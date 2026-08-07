const https = require('https');

const url = 'https://docs.google.com/spreadsheets/d/1-HRp_m7bQkFUifOEV8wI8Yn2OpAMJtOnu6mH-lxUbfU/gviz/tq?tqx=out:csv&gid=0';

https.get(url, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const lines = data.split(/\r?\n/).filter(l => l.trim());

    function parseCsvLine(line) {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      return result;
    }

    const rawHeaders = parseCsvLine(lines[0]);

    const findHeaderIdx = (exactTargets, fallbackSubstrings) => {
      for (const target of exactTargets) {
        const targetNorm = target.toLowerCase().replace(/[^a-z0-9]/g, '');
        const idx = rawHeaders.findIndex(h => h.toLowerCase().replace(/[^a-z0-9]/g, '') === targetNorm);
        if (idx !== -1) return idx;
      }
      for (const sub of fallbackSubstrings) {
        const subNorm = sub.toLowerCase().replace(/[^a-z0-9]/g, '');
        const idx = rawHeaders.findIndex(h => h.toLowerCase().replace(/[^a-z0-9]/g, '').includes(subNorm));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const sNoIdx = findHeaderIdx(['id', 'sno', 's.no', 's no', 'serial', 'number', 'deal id'], ['id', 'sno', 'serial']);
    const custIdx = findHeaderIdx(['company', 'customername', 'customer name', 'customer', 'client', 'company name'], ['company', 'customer', 'client']);
    const projIdx = findHeaderIdx(['deal name', 'dealname', 'projectname', 'project name', 'project', 'opportunity'], ['deal', 'project', 'opportunity']);
    const statusIdx = findHeaderIdx(['stage', 'status', 'state'], ['stage', 'status']);
    const typeIdx = findHeaderIdx(['solution type', 'solutiontype', 'projecttype', 'project type', 'type'], ['solution', 'type']);
    const startIdx = findHeaderIdx(['created', 'startdate', 'start date', 'start'], ['created', 'start']);
    const plannedEndIdx = findHeaderIdx(['end date', 'enddate', 'plannedenddate', 'planned end date'], ['end', 'plannedend']);
    const actualEndIdx = findHeaderIdx(['end date', 'enddate', 'actualenddate', 'actual end date'], ['end', 'actualend']);
    const plannedBudgetIdx = findHeaderIdx(['income', 'plannedbudget', 'planned budget', 'budget'], ['income', 'budget']);
    const actualCostIdx = findHeaderIdx(['billed value', 'actualcost', 'actual cost', 'cost'], ['billed', 'cost']);

    const records = [];

    for (let i = 1; i < lines.length; i++) {
      const row = parseCsvLine(lines[i]);
      if (row.length < 3) continue;

      const cleanCell = (idx) => (idx >= 0 && idx < row.length ? row[idx].trim() : '');
      const sNoStr = cleanCell(sNoIdx) || String(i);
      const sNo = parseInt(sNoStr, 10) || sNoStr;
      const customerName = cleanCell(custIdx) || 'Unknown Client';
      const projectName = cleanCell(projIdx) || 'Project ' + i;
      const rawStatus = cleanCell(statusIdx) || 'Running';
      const projectType = cleanCell(typeIdx) || 'General';
      const startDate = cleanCell(startIdx) || '-';
      const plannedEndDate = cleanCell(plannedEndIdx) || '-';
      const actualEndDate = cleanCell(actualEndIdx) || '-';

      const parseNum = (str) => {
        const cleaned = str.replace(/[^0-9.]/g, '');
        return parseFloat(cleaned) || 0;
      };

      const rawBudget = parseNum(cleanCell(plannedBudgetIdx));
      const rawCost = actualCostIdx !== -1 ? parseNum(cleanCell(actualCostIdx)) : rawBudget;

      let status = 'Running';
      const sLower = rawStatus.toLowerCase();
      if (sLower.includes('complete') || sLower.includes('done') || sLower.includes('won') || sLower.includes('billed')) {
        status = 'Completed';
      } else if (sLower.includes('delay') || sLower.includes('late')) {
        status = 'Delayed';
      } else if (sLower.includes('hold') || sLower.includes('pause')) {
        status = 'On Hold';
      } else if (sLower.includes('plan')) {
        status = 'Planning';
      }

      records.push({
        id: `proj-${i}`,
        sNo,
        customerName,
        projectName,
        status,
        projectType,
        startDate,
        plannedEndDate,
        actualEndDate,
        plannedBudget: rawBudget,
        actualCost: rawCost,
        timelineStatus: 'On Time',
        budgetStatus: 'On Budget',
        budgetVariance: 0,
        budgetVariancePct: 0,
        delayDays: 0
      });
    }

    console.log('\n--- KPI CALCULATIONS SUMMARY ---');
    console.log('Total Projects:', records.length);
    console.log('Running Projects:', records.filter(r => r.status === 'Running').length);
    console.log('Completed Projects:', records.filter(r => r.status === 'Completed').length);
    console.log('Total Planned Budget / Income:', records.reduce((sum, r) => sum + r.plannedBudget, 0));
    console.log('Sample Record 1:', records[0]);
    console.log('Sample Record 100:', records[99]);
  });
});
