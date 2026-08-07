const https = require('https');

const url = 'https://docs.google.com/spreadsheets/d/1HUkXoXIBgEBghfoVvazgunX-Cq66YTEHd96ke1scugo/gviz/tq?tqx=out:csv&gid=1388928136';

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
    console.log('Orders Sheet Headers:', headers);
  });
});
