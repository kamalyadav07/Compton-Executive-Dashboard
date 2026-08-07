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

    const headers = parseCsvLine(lines[0]);

    for (let i = 1; i <= 10; i++) {
      const row = parseCsvLine(lines[i]);
      console.log(`\n--- ROW ${i} ---`);
      headers.forEach((h, idx) => {
        console.log(`  ${h}: "${row[idx]}"`);
      });
    }
  });
});
