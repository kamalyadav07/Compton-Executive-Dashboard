const sheets = [
  { name: 'Won', id: '1-HRp_m7bQkFUifOEV8wI8Yn2OpAMJtOnu6mH-lxUbfU' },
  { name: 'Lost', id: '16fuiVZUB5GC-RvVicpeieicVg7KmQAX2UNiQ3Fo5l0Q' },
  { name: 'Progress', id: '1vLQAbqhtNGZQSX_Vs5OA6d9HWXrA5zg_JS6wjKTZQeQ' }
];

async function checkSheet(s) {
  const url1 = `https://docs.google.com/spreadsheets/d/${s.id}/export?format=csv&gid=0`;
  const url2 = `https://docs.google.com/spreadsheets/d/${s.id}/gviz/tq?tqx=out:csv&gid=0`;
  
  console.log(`Checking ${s.name}:`);
  for (const url of [url1, url2]) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      const text = await res.text();
      console.log(`  URL: ${url}`);
      console.log(`  Status: ${res.status}`);
      console.log(`  Is CSV?`, text.startsWith('"') || text.includes(',') || text.includes('Deal') || text.includes('ID'));
      console.log(`  Content snippet:`, text.slice(0, 200).replace(/\n/g, ' '));
    } catch (e) {
      console.error(`  Err: ${e.message}`);
    }
  }
}

async function run() {
  for (const s of sheets) {
    await checkSheet(s);
  }
}

run();
