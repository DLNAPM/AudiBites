import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleTranscription } from './server/transcribeHandler';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Audio transcription endpoint
app.post('/api/transcribe', async (req, res) => {
  try {
    const result = await handleTranscription(req.body);
    res.json(result);
  } catch (error: any) {
    console.error('Transcription error:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to transcribe audio. Please verify audio format and try again.',
    });
  }
});

// Serve static assets from dist
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AudiBites full-stack server running on http://0.0.0.0:${PORT}`);
});
