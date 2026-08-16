import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleTranscription } from './server/transcribeHandler';

function apiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'api-server-middleware',
    configureServer(server) {
      server.middlewares.use('/api/transcribe', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        if (!process.env.GEMINI_API_KEY && env.GEMINI_API_KEY) {
          process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
        }
        if (!process.env.API_KEY && env.API_KEY) {
          process.env.API_KEY = env.API_KEY;
        }

        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', async () => {
          try {
            const payload = JSON.parse(body || '{}');
            const result = await handleTranscription(payload);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (err: any) {
            console.error('API Error in dev server:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: false,
                error: err?.message || 'Transcription failed',
              })
            );
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), apiPlugin(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});

