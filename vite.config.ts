import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleTranscription } from './server/transcribeHandler';

function apiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'api-server-middleware',
    configureServer(server) {
      // Ensure API keys from env are accessible
      if (!process.env.GEMINI_API_KEY && env.GEMINI_API_KEY) {
        process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
      }
      if (!process.env.API_KEY && env.API_KEY) {
        process.env.API_KEY = env.API_KEY;
      }

      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url || '';
        const pathname = rawUrl.split('?')[0];

        if (pathname === '/api/transcribe') {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
            return;
          }

          try {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            }
            const bodyStr = Buffer.concat(chunks).toString('utf-8');
            const payload = bodyStr ? JSON.parse(bodyStr) : {};

            const result = await handleTranscription(payload);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(result));
          } catch (err: any) {
            console.error('API Error in dev server:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                success: false,
                error: err?.message || 'Transcription failed. Please check audio format and try again.',
              })
            );
          }
          return;
        }

        next();
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

