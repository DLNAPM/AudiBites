import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleTranscription } from './server/transcribeHandler';

function setupApiMiddleware(middlewares: any, env: Record<string, string>) {
  // Ensure API keys from env are accessible
  if (!process.env.GEMINI_API_KEY && env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  }
  if (!process.env.API_KEY && env.API_KEY) {
    process.env.API_KEY = env.API_KEY;
  }

  middlewares.use(async (req: any, res: any, next: any) => {
    const rawUrl = req.url || '';
    const pathname = rawUrl.split('?')[0];

    if (pathname === '/api/transcribe') {
      // CORS & Cache Headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      if (req.method !== 'POST') {
        const errorJson = JSON.stringify({ success: false, error: 'Method Not Allowed' });
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Length', Buffer.byteLength(errorJson, 'utf-8'));
        res.end(errorJson);
        return;
      }

      try {
        let payload: any = {};
        if (req.body && typeof req.body === 'object') {
          payload = req.body;
        } else {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
          }
          const bodyStr = Buffer.concat(chunks).toString('utf-8');
          payload = bodyStr ? JSON.parse(bodyStr) : {};
        }

        const result = await handleTranscription(payload);
        const jsonStr = JSON.stringify(result);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Length', Buffer.byteLength(jsonStr, 'utf-8'));
        res.end(jsonStr);
      } catch (err: any) {
        console.error('API Error in dev/preview server:', err);
        const errorJson = JSON.stringify({
          success: false,
          error: err?.message || 'Transcription failed. Please check audio format and try again.',
        });
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Length', Buffer.byteLength(errorJson, 'utf-8'));
        res.end(errorJson);
      }
      return;
    }

    next();
  });
}

function apiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'api-server-middleware',
    configureServer(server) {
      setupApiMiddleware(server.middlewares, env);
    },
    configurePreviewServer(server) {
      setupApiMiddleware(server.middlewares, env);
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
    preview: {
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
