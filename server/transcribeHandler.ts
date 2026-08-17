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
 * Sniffs the MIME type from the first few bytes of base64 data if possible.
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
        return 'The transcription service is currently experiencing high demand. Please try again shortly.';
      }
      if (parsed.error.code === 429) {
        return 'Transcription rate limit reached. Please wait a few moments and try again.';
      }
      return parsed.error.message;
    }
  } catch {
    // Not JSON
  }
  if (msg.includes('503') || msg.includes('high demand') || msg.includes('UNAVAILABLE')) {
    return 'The transcription service is currently experiencing high demand. Please try again shortly.';
  }
  if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
    return 'Transcription rate limit reached. Please wait a few moments and try again.';
  }
  return msg;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Candidate models in order of priority: modern fast models with fallback resilience
const CANDIDATE_MODELS = ['gemini-3.7-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

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

  // Instruction prompt
  let promptText = `You are a high-accuracy automated speech-to-text transcription engine.
The attached input is an audio recording.
Carefully listen to the attached audio recording and transcribe all spoken dialogue and words accurately and verbatim.

Strict Output Rules:
- Output ONLY the transcription text.
- Do NOT provide conversational filler (e.g. do not say "Here is the transcription", "Certainly", or ask for links/files).
- Maintain proper capitalization, punctuation, and paragraph breaks.
- If multiple speakers are detected, prefix their lines with speaker labels (e.g., Speaker 1, Speaker 2, or by name if introduced).
- If the audio contains only music, instrumental sounds, or sound effects with no spoken words, describe the audio in brackets, for example: "[Instrumental music with upbeat acoustic guitar and percussion - No spoken words detected]".`;

  if (mode === 'timestamped') {
    promptText += `\n- Format the transcript with timestamps at the beginning of each major phrase or sentence, e.g.:
[00:00] Speaker 1: Hello and welcome to today's recording.
[00:04] Speaker 2: Great to be here.`;
  } else if (mode === 'summary') {
    promptText += `\n- Format your output with an Executive Summary and Key Takeaways at the top:
# Executive Summary
[Brief 2-3 sentence overview of the conversation or topic]

### Key Highlights
- Key highlight 1
- Key highlight 2

### Full Transcript
[Complete verbatim transcript]`;
  } else if (mode === 'translate') {
    const lang = targetLanguage || 'English';
    promptText += `\n- Translate the spoken audio into ${lang}. Output format:
# Translation (${lang})
[Translated transcript here]

### Original Audio Transcript
[Original spoken audio transcript here]`;
  }

  if (customPrompt && customPrompt.trim()) {
    promptText += `\n\nAdditional user guidelines:\n${customPrompt.trim()}`;
  }

  const audioPart = {
    inlineData: {
      data: audioBase64,
      mimeType: cleanMimeType,
    },
  };

  const textPart = {
    text: promptText,
  };

  let lastError: any = null;

  // Try candidate models with graceful fallback on high demand (503 / 429)
  for (const modelName of CANDIDATE_MODELS) {
    const attempts = modelName === CANDIDATE_MODELS[0] ? 2 : 1;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [audioPart, textPart],
          },
        });

        let rawText = (response.text || '').trim();

        // If the model somehow returned empty text, provide a fallback
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
          errorMsg.includes('RESOURCE_EXHAUSTED');

        if (attempt < attempts && isTransient) {
          await sleep(800 * attempt);
          continue;
        }
        // Move to next model in candidate list
        break;
      }
    }
  }

  const humanReadableError = parseErrorMessage(lastError);
  throw new Error(humanReadableError);
}
