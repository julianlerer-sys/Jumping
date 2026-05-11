import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { exec } from 'child_process';
import { writeFileSync } from 'fs';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'ai-request-handler',
        configureServer(server) {
          server.middlewares.use('/api/ai-request', (req: any, res: any, next: any) => {
            if (req.method !== 'POST') { next(); return; }
            let body = '';
            req.on('data', (chunk: Buffer) => body += chunk);
            req.on('end', () => {
              try {
                const data = JSON.parse(body);
                writeFileSync('pending-request.json', JSON.stringify(
                  { ...data, timestamp: new Date().toISOString() }, null, 2
                ));
                const msg = (data.description || '').substring(0, 80).replace(/'/g, '');
                exec(`osascript -e 'display notification "${msg}" with title "HumanBudget AI — Petición pendiente"'`);
                console.log('\n\x1b[35m🤖 Nueva petición AI:\x1b[0m', data.description);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
              } catch {
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Failed' }));
              }
            });
          });
        }
      }
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
