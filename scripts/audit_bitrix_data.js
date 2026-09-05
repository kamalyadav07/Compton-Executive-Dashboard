// scripts/audit_bitrix_data.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SOLUTION_ENUM_MAP = {
  '1188': 'CCTV Solution',
  '1190': 'Passive Networking solution',
  '1192': 'Passive Networking solution',
  '1194': 'Server solution',
  '1196': 'Storage solution',
  '1198': 'Backup solution',
  '1200': 'Data center solution',
  '1202': 'Desktops/ Laptops',
  '1204': 'Printers',
  '1206': 'Power backup',
  '1208': 'Video Conferencing',
  '1210': 'Data security solution',
  '1212': 'Liscense',
  '1214': 'Application development',
  '1216': 'Data center solution',
  '1218': 'Services',
  '1220': 'Others'
};

function classify(text, enumId) {
  if (enumId && SOLUTION_ENUM_MAP[enumId] && SOLUTION_ENUM_MAP[enumId] !== 'Others') {
    return SOLUTION_ENUM_MAP[enumId];
  }

  const lower = (text || '').toLowerCase();
  if (lower.includes('switch') || lower.includes('passive') || lower.includes('netw') || lower.includes('router') || lower.includes('cable') || lower.includes('rack') || lower.includes('patch cord') || lower.includes('connector') || lower.includes('access point') || lower.includes('wifi') || lower.includes('wi fi') || lower.includes('qn-i') || lower.includes('cat-6') || lower.includes('cat6') || lower.includes('cat 6') || lower.includes('crimping') || lower.includes('io box') || lower.includes('patch panel')) {
    return 'Passive Networking solution';
  }
  if (lower.includes('laptop') || lower.includes('desktop') || lower.includes('pc') || lower.includes('all in one') || lower.includes('lenovo') || lower.includes('hp') || lower.includes('dell') || lower.includes('macbook') || lower.includes('mac book') || lower.includes('workstation') || lower.includes('thinkpad')) {
    return 'Desktops/ Laptops';
  }
  if (lower.includes('cctv') || lower.includes('surveillance') || lower.includes('camera') || lower.includes('dvr') || lower.includes('nvr') || lower.includes('door') || lower.includes('access control') || lower.includes('ptz') || lower.includes('vms') || lower.includes('biometric')) {
    return 'CCTV Solution';
  }
  if (lower.includes('server')) return 'Server solution';
  if (lower.includes('storage') || lower.includes('san') || lower.includes('nas') || lower.includes('qnap') || lower.includes('synology')) return 'Storage solution';
  if (lower.includes('backup') || lower.includes('back up') || lower.includes('veeam')) return lower.includes('data') ? 'Data back up solution' : 'Backup solution';
  if (lower.includes('security') || lower.includes('firewall') || lower.includes('sophos') || lower.includes('fortinet') || lower.includes('cyber') || lower.includes('antivirus') || lower.includes('edr') || lower.includes('mdm')) return 'Data security solution';
  if (lower.includes('datacenter') || lower.includes('data center') || lower.includes('cloud') || lower.includes('aws') || lower.includes('azure')) return 'Data center solution';
  if (lower.includes('license') || lower.includes('licence') || lower.includes('liscense') || lower.includes('subscription') || lower.includes('o365') || lower.includes('m365') || lower.includes('office 365') || lower.includes('microsoft 365')) return 'Liscense';
  if (lower.includes('service') || lower.includes('amc') || lower.includes('installation') || lower.includes('support') || lower.includes('maintenance') || lower.includes('manpower') || lower.includes('repair') || lower.includes('site survey') || lower.includes('survey')) return 'Services';
  if (lower.includes('printer') || lower.includes('scanner') || lower.includes('toner') || lower.includes('cartridge')) return 'Printers';
  if (lower.includes('power') || lower.includes('ups') || lower.includes('battery') || lower.includes('inverter')) return 'Power backup';
  if (lower.includes('accessory') || lower.includes('accessories') || lower.includes('mouse') || lower.includes('keyboard') || lower.includes('bag') || lower.includes('headset') || lower.includes('adapter')) return 'Accessories';
  if (lower.includes('video') || lower.includes('conferencing') || lower.includes('vc ') || lower.includes('vc solution') || lower.includes('polycom') || lower.includes('logitech') || lower.includes('meet')) return 'Video Conferencing';
  if (lower.includes('software') || lower.includes('tally') || lower.includes('os') || lower.includes('windows')) return 'Softwares';
  if (lower.includes('app') || lower.includes('development') || lower.includes('web') || lower.includes('code')) return 'Application development';

  if (enumId && SOLUTION_ENUM_MAP[enumId]) {
    return SOLUTION_ENUM_MAP[enumId];
  }
  return 'Others';
}

function run() {
  const cachePath = path.resolve(__dirname, '../server/cached_bitrix_deals.json');
  const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  const allDeals = [...cache.won, ...cache.lost, ...cache.progress];

  let othersCount = 0;
  const counts = {};
  allDeals.forEach(d => {
    const text = (d.rawRecord?.UF_CRM_1744361655612 || '') + ' ' + (d.rawRecord?.TITLE || '');
    const enumId = String(d.rawRecord?.UF_CRM_1782977521393 || '').trim();
    const sol = classify(text, enumId);
    counts[sol] = (counts[sol] || 0) + 1;
    if (sol === 'Others') othersCount++;
  });

  console.log('Resulting solution distribution:');
  console.log(counts);
  console.log('\nOthers reduced from 303 down to:', othersCount);
}

run();
