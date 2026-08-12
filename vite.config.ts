import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';

function sheetsConfigApiPlugin(): Plugin {
  const configPath = path.resolve(import.meta.dirname, 'server/sheets_config.json');

  return {
    name: 'sheets-config-api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/sheets-config', (req, res) => {
        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'GET') {
          try {
            if (fs.existsSync(configPath)) {
              const data = fs.readFileSync(configPath, 'utf8');
              res.statusCode = 200;
              res.end(data);
            } else {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'Config file not found' }));
            }
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        } else if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              parsed.lastUpdated = new Date().toISOString();
              fs.writeFileSync(configPath, JSON.stringify(parsed, null, 2), 'utf8');
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, config: parsed }));
            } catch (err: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        }
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), sheetsConfigApiPlugin()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      }
    },
    watch: {
      ignored: [
        '**/server/**',
        '**/scratch/**',
        '**/*.json',
        '**/*.log'
      ]
    }
  }
});

