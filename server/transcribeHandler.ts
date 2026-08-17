import { GoogleGenAI } from '@google/genai';

const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

export interface TranscribeRequestPayload {
  audioBase64: string;
  mimeType?: string;
  mode?: 'standard' | 'timestamped' | 'summary' | 'translate';
  targetLanguage?: string;
  customPrompt?: string;
}

export interface TranscribeResponsePayload {
  success: boolean;
  transcription: string;
  summary?: string;
  segments?: Array<{
    time?: string;
    speaker?: string;
    text: string;
  }>;
  detectedLanguage?: string;
  error?: string;
}

/**
 * Sniffs the MIME type from the first few bytes of base64 data.
 */
function detectMimeType(audioBase64: string, fallbackMime: string = 'audio/wav'): string {
  try {
    const headChunk = audioBase64.slice(0, 64);
    const buf = Buffer.from(headChunk, 'base64');
    if (buf.length >= 4) {
      // RIFF....WAVE
      if (buf.toString('ascii', 0, 4) === 'RIFF') {
        return 'audio/wav';
      }
      // ID3 or MP3 sync frame (0xFF 0xFB, 0xFF 0xF3, 0xFF 0xF2, 0xFF 0xE3)
      if (buf.toString('ascii', 0, 3) === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) {
        return 'audio/mp3';
      }
      // OggS
      if (buf.toString('ascii', 0, 4) === 'OggS') {
        return 'audio/ogg';
      }
      // fLaC
      if (buf.toString('ascii', 0, 4) === 'fLaC') {
        return 'audio/flac';
      }
      // EBML (WebM) 0x1A 0x45 0xDF 0xA3
      if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
        return 'audio/webm';
      }
      // ISO/IEC 14496-12 (M4A/MP4 ftyp)
      if (buf.length >= 8 && buf.toString('ascii', 4, 8) === 'ftyp') {
        return 'audio/mp4';
      }
    }
  } catch {
    // Ignore sniffing errors
  }

  let clean = (fallbackMime || 'audio/wav').toLowerCase();
  if (clean.includes(';')) {
    clean = clean.split(';')[0].trim();
  }
  if (clean === 'audio/mpeg') return 'audio/mp3';
  if (clean === 'audio/x-wav' || clean === 'audio/wave') return 'audio/wav';
  if (clean === 'audio/x-m4a' || clean === 'audio/aac') return 'audio/aac';
  if (clean.startsWith('audio/') || clean.startsWith('video/')) return clean;
  return 'audio/wav';
}

function parseErrorMessage(err: any): string {
  if (!err) return 'Transcription failed.';
  const msg = typeof err === 'string' ? err : err.message || JSON.stringify(err);
  try {
    const parsed = JSON.parse(msg);
    if (parsed.error?.message) {
      if (parsed.error.code === 503 || parsed.error.status === 'UNAVAILABLE') {
        return 'The transcription service is temporarily busy. Please retry in a few moments.';
      }
      if (parsed.error.code === 429 || parsed.error.status === 'RESOURCE_EXHAUSTED') {
        return 'Transcription rate limit reached. Please wait a moment and try again.';
      }
      return parsed.error.message;
    }
  } catch {
    // Not JSON
  }
  if (msg.includes('503') || msg.includes('high demand') || msg.includes('UNAVAILABLE')) {
    return 'The transcription service is temporarily busy. Please retry in a few moments.';
  }
  if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
    return 'Transcription rate limit reached. Please wait a moment and try again.';
  }
  return msg;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Candidate models in order of priority:
// gemini-3.1-flash-lite has high availability, fast response time, and high audio transcription accuracy
const CANDIDATE_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.7-flash',
  'gemini-flash-latest',
];

export async function handleTranscription(payload: TranscribeRequestPayload): Promise<TranscribeResponsePayload> {
  let { audioBase64, mimeType = 'audio/wav', mode = 'standard', targetLanguage, customPrompt } = payload;

  if (!audioBase64 || typeof audioBase64 !== 'string' || audioBase64.trim().length === 0) {
    throw new Error('No audio data provided for transcription.');
  }

  // Strip any data: URL scheme prefix and whitespace
  if (audioBase64.includes(',')) {
    audioBase64 = audioBase64.split(',')[1];
  }
  audioBase64 = audioBase64.replace(/\s+/g, '');

  const cleanMimeType = detectMimeType(audioBase64, mimeType);
  const ai = getAiClient();

  let promptInstruction = `Listen to the attached audio file and transcribe all spoken words directly into text.
If there are multiple speakers, label them as Speaker 1, Speaker 2, etc.
Maintain proper punctuation and formatting.
If no spoken words are detected, output [No speech detected] or describe the audio sound in brackets.`;

  if (mode === 'timestamped') {
    promptInstruction = `Listen to the attached audio file and transcribe all spoken words into text with timestamps in brackets at the beginning of each major phrase or sentence, for example:
[00:00] Speaker 1: Hello and welcome to the show.
[00:04] Speaker 2: Great to be here.
If no speech is detected, output [No speech detected].`;
  } else if (mode === 'summary') {
    promptInstruction = `Listen to the attached audio file. Transcribe the audio and generate an Executive Summary, Key Highlights, and full transcript formatted as:
# Executive Summary
[Brief 2-3 sentence overview]

### Key Highlights
- Key highlight 1
- Key highlight 2

### Full Transcript
[Complete verbatim transcript]
If no speech is detected, provide a summary of the audio contents and indicate [No speech detected].`;
  } else if (mode === 'translate') {
    const lang = targetLanguage || 'English';
    promptInstruction = `Listen to the attached audio file. Transcribe all spoken words and translate them into ${lang}:
# Translation (${lang})
[Translated transcript here]

### Original Audio Transcript
[Original spoken audio transcript here]
If no speech is detected, output [No speech detected].`;
  }

  if (customPrompt && customPrompt.trim()) {
    promptInstruction += `\n\nAdditional user guidelines:\n${customPrompt.trim()}`;
  }

  const audioPart = {
    inlineData: {
      data: audioBase64,
      mimeType: cleanMimeType,
    },
  };

  const textPart = {
    text: promptInstruction,
  };

  let lastError: any = null;

  // Try candidate models with graceful fallback on high demand (503 / 429)
  for (const modelName of CANDIDATE_MODELS) {
    const maxAttemptsForModel = 2;
    for (let attempt = 1; attempt <= maxAttemptsForModel; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              parts: [audioPart, textPart],
            },
          ],
        });

        let rawText = (response.text || '').trim();

        // If the model returned empty text, provide a sensible indicator
        if (!rawText) {
          rawText = '[Audio processed - No audible speech detected]';
        }

        // Extract timestamps/segments if present
        const segments: Array<{ time?: string; speaker?: string; text: string }> = [];
        const lines = rawText.split('\n');
        const timestampRegex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(?:([^:]+):\s*)?(.*)/;

        for (const line of lines) {
          const match = line.match(timestampRegex);
          if (match) {
            segments.push({
              time: match[1],
              speaker: match[2]?.trim(),
              text: match[3]?.trim() || line,
            });
          }
        }

        return {
          success: true,
          transcription: rawText,
          segments: segments.length > 0 ? segments : undefined,
        };
      } catch (apiError: any) {
        lastError = apiError;
        const errorMsg = apiError?.message || '';
        console.warn(`Model ${modelName} (attempt ${attempt}) error:`, errorMsg.slice(0, 180));

        const isTransient =
          errorMsg.includes('503') ||
          errorMsg.includes('UNAVAILABLE') ||
          errorMsg.includes('high demand') ||
          errorMsg.includes('429') ||
          errorMsg.includes('RESOURCE_EXHAUSTED') ||
          errorMsg.includes('quota');

        if (attempt < maxAttemptsForModel && isTransient) {
          await sleep(600 * attempt);
          continue;
        }
        // Fallback to next candidate model
        break;
      }
    }
  }

  const humanReadableError = parseErrorMessage(lastError);
  throw new Error(humanReadableError);
}
