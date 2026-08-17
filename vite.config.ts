import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import express from 'express';
import cors from 'cors';
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

      const apiApp = express();
      apiApp.use(cors());
      apiApp.use(express.json({ limit: '50mb' }));
      apiApp.use(express.urlencoded({ limit: '50mb', extended: true }));

      apiApp.post('/api/transcribe', async (req, res) => {
        try {
          const result = await handleTranscription(req.body);
          res.status(200).json(result);
        } catch (err: any) {
          console.error('API Error in dev server:', err);
          res.status(500).json({
            success: false,
            error: err?.message || 'Transcription failed. Please check audio format.',
          });
        }
      });

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
    plugins: [react(), apiPlugin(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});

