import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import express from 'express';
import cors from 'cors';
import { handleTranscription } from './server/transcribeHandler';

function createApiExpressApp(env: Record<string, string>) {
  const app = express();

  // Ensure API keys from env are accessible
  if (!process.env.GEMINI_API_KEY && env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  }
  if (!process.env.API_KEY && env.API_KEY) {
    process.env.API_KEY = env.API_KEY;
  }

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.post('/api/transcribe', async (req, res) => {
    try {
      const result = await handleTranscription(req.body);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.json(result);
    } catch (error: any) {
      console.error('API Error in /api/transcribe:', error);
      res.status(500).setHeader('Content-Type', 'application/json; charset=utf-8');
      res.json({
        success: false,
        error: error?.message || 'Transcription failed. Please try again.',
      });
    }
  });

  return app;
}

function apiPlugin(env: Record<string, string>): Plugin {
  const apiApp = createApiExpressApp(env);

  return {
    name: 'api-server-middleware',
    configureServer(server) {
      server.middlewares.use(apiApp);
    },
    configurePreviewServer(server) {
      server.middlewares.use(apiApp);
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
