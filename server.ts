import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { handleTranscription } from './server/transcribeHandler';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(
      process.env.GEMINI_API_KEY ||
      process.env.API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      process.env.VITE_API_KEY
    ),
    timestamp: new Date().toISOString(),
  });
});

// Explicit favicon handlers
app.get('/favicon.ico', (req, res) => {
  const icoPath = path.join(__dirname, 'public', 'favicon.ico');
  const distIco = path.join(__dirname, 'dist', 'favicon.ico');
  if (fs.existsSync(icoPath)) {
    return res.sendFile(icoPath);
  }
  if (fs.existsSync(distIco)) {
    return res.sendFile(distIco);
  }
  res.status(204).end();
});

app.get('/favicon.svg', (req, res) => {
  const svgPath = path.join(__dirname, 'public', 'favicon.svg');
  if (fs.existsSync(svgPath)) {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.sendFile(svgPath);
  }
  res.status(204).end();
});

// Audio transcription endpoint
app.post('/api/transcribe', async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body. Expected JSON with audioBase64.',
      });
    }

    const result = await handleTranscription(req.body);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(result);
  } catch (error: any) {
    console.error('Transcription error:', error);
    res.status(500).setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json({
      success: false,
      error: error?.message || 'Failed to transcribe audio. Please verify audio format and try again.',
    });
  }
});

// Serve static assets from public and dist
const publicPath = path.join(__dirname, 'public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
}

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// SPA fallback for frontend routes
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('AudiBites app is compiling. Please refresh in a moment.');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AudiBites full-stack server running on http://0.0.0.0:${PORT}`);
});
