import fetch from 'node-fetch';

async function testGoogleSheet(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    console.log('Status:', res.status);
    console.log('Final URL:', res.url);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testGoogleSheet('https://docs.google.com/spreadsheets/d/1-HRp_m7bQkFUifOEV8wI8Yn2OpAMJtOnu6mH-lxUbfU/gviz/tq?tqx=out:csv&gid=0');
