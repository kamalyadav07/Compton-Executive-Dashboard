import { spawn } from 'child_process';

console.log('🚀 Starting Compton Dashboard (Backend Server + Vite Dev Server)...');

const server = spawn('node', ['server/dashboard-server.js'], { stdio: 'inherit', shell: true });
const vite = spawn('npx', ['vite'], { stdio: 'inherit', shell: true });

const cleanup = () => {
  console.log('\nStopping servers...');
  server.kill();
  vite.kill();
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
