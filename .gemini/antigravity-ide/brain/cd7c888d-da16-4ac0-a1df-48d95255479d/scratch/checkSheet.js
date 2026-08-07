const https = require('https');

const url = 'https://docs.google.com/spreadsheets/d/1-HRp_m7bQkFUifOEV8wI8Yn2OpAMJtOnu6mH-lxUbfU/gviz/tq?tqx=out:csv&gid=0';

https.get(url, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const lines = data.split(/\r?\n/).filter(l => l.trim());
    console.log('Total Lines:', lines.length);
    console.log('Headers Line:', lines[0]);

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

    const headers = parseCsvLine(lines[0]);
    console.log('Parsed Headers:', headers);

    const stages = {};
    const solutions = {};
    let sampleRows = [];

    for (let i = 1; i < lines.length; i++) {
      const row = parseCsvLine(lines[i]);
      const stage = row[1] || 'EMPTY';
      const solution = row[13] || 'EMPTY';
      stages[stage] = (stages[stage] || 0) + 1;
      solutions[solution] = (solutions[solution] || 0) + 1;
      if (i <= 5) sampleRows.push(row);
    }

    console.log('\n--- STAGES SUMMARY ---');
    console.log(stages);

    console.log('\n--- SOLUTION TYPES ---');
    console.log(solutions);

    console.log('\n--- FIRST 5 ROWS ---');
    sampleRows.forEach((r, idx) => {
      console.log(`Row ${idx+1}: ID=${r[0]}, Stage=${r[1]}, Company=${r[2]}, Responsible=${r[3]}, DealName=${r[4]}, Income=${r[6]}, Created=${r[7]}, EndDate=${r[8]}, Solution=${r[13]}`);
    });
  });
});
