import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleTranscription } from './server/transcribeHandler';

function parseRequestBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') {
      return resolve(req.body);
    }
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer | string) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    });
    req.on('end', () => {
      try {
        const bodyStr = Buffer.concat(chunks).toString('utf-8');
        if (!bodyStr || !bodyStr.trim()) {
          resolve({});
        } else {
          resolve(JSON.parse(bodyStr));
        }
      } catch (err: any) {
        reject(new Error('Invalid JSON request body: ' + err.message));
      }
    });
    req.on('error', (err: any) => {
      reject(err);
    });
  });
}

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
    const pathname = (rawUrl.split('?')[0] || '').replace(/\/+$/, '');

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
        const payload = await parseRequestBody(req);
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
