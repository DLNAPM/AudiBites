import { GoogleGenAI } from '@google/genai';
import { TranscriptSegment } from '../types';

export interface TranscribeOptions {
  mode?: 'standard' | 'timestamped' | 'summary' | 'translate';
  targetLanguage?: string;
  customPrompt?: string;
  apiKey?: string;
}

export interface TranscribeResult {
  success: boolean;
  transcription: string;
  summary?: string;
  segments?: TranscriptSegment[];
  detectedLanguage?: string;
  error?: string;
}

const LOCAL_STORAGE_KEY = 'audibites_gemini_api_key';

export function getStoredApiKey(): string {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored && stored.trim()) return stored.trim();
  } catch {
    // Ignore localStorage errors
  }
  // Check env if available
  const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (envKey && typeof envKey === 'string' && envKey.trim()) {
    return envKey.trim();
  }
  return '';
}

export function setStoredApiKey(key: string): void {
  try {
    if (key && key.trim()) {
      localStorage.setItem(LOCAL_STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Converts a Blob to a base64 string
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      if (base64) {
        resolve(base64);
      } else {
        reject(new Error('Failed to encode audio file to base64'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Encodes an AudioBuffer into a compact 16kHz 16-bit Mono WAV Blob for speech recognition
 */
function encodeSpeechWav(audioBuffer: AudioBuffer): Blob {
  const targetSampleRate = 16000;
  // Offline resample to 16kHz mono
  const numberOfChannels = audioBuffer.numberOfChannels;
  const length = Math.ceil(audioBuffer.duration * targetSampleRate);

  // Mix channels to mono
  const monoChannel = new Float32Array(audioBuffer.length);
  for (let c = 0; c < numberOfChannels; c++) {
    const channelData = audioBuffer.getChannelData(c);
    for (let i = 0; i < audioBuffer.length; i++) {
      monoChannel[i] += channelData[i] / numberOfChannels;
    }
  }

  // Resample
  const resampled = new Float32Array(length);
  const ratio = audioBuffer.length / length;
  for (let i = 0; i < length; i++) {
    const srcIndex = Math.min(audioBuffer.length - 1, Math.floor(i * ratio));
    resampled[i] = monoChannel[srcIndex];
  }

  // Build WAV
  const wavBuffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(wavBuffer);

  // RIFF header
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + length * 2, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // fmt chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // SubChunk1Size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono (1 channel)
  view.setUint32(24, targetSampleRate, true); // SampleRate
  view.setUint32(28, targetSampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign (1 * 2)
  view.setUint16(34, 16, true); // BitsPerSample (16-bit)

  // data chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, length * 2, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    let s = Math.max(-1, Math.min(1, resampled[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, Math.floor(s), true);
    offset += 2;
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

/**
 * Sniffs the MIME type from the first few bytes of base64 data.
 */
function detectMimeType(audioBase64: string, fallbackMime: string = 'audio/wav'): string {
  try {
    const headChunk = audioBase64.slice(0, 64);
    const binary = atob(headChunk.slice(0, 32));
    const buf = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      buf[i] = binary.charCodeAt(i);
    }
    if (buf.length >= 4) {
      if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) {
        return 'audio/wav';
      }
      if (
        (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) ||
        (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)
      ) {
        return 'audio/mp3';
      }
      if (buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) {
        return 'audio/ogg';
      }
      if (buf[0] === 0x66 && buf[1] === 0x4c && buf[2] === 0x61 && buf[3] === 0x43) {
        return 'audio/flac';
      }
      if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
        return 'audio/webm';
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

/**
 * Optimizes audio for transcription (downsamples large raw audio to 16kHz mono WAV for instant transfer)
 */
async function optimizeAudioForTranscription(blob: Blob): Promise<{ blob: Blob; mimeType: string }> {
  const type = (blob.type || '').toLowerCase();
  const isCompressed =
    type.includes('mp3') ||
    type.includes('mpeg') ||
    type.includes('aac') ||
    type.includes('m4a') ||
    type.includes('ogg') ||
    type.includes('webm') ||
    type.includes('flac');

  if (isCompressed && blob.size < 8 * 1024 * 1024) {
    return { blob, mimeType: type || 'audio/mp3' };
  }

  if (type.includes('wav') && blob.size < 2 * 1024 * 1024) {
    return { blob, mimeType: 'audio/wav' };
  }

  try {
    const arrayBuf = await blob.arrayBuffer();
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      const decodedBuffer = await ctx.decodeAudioData(arrayBuf);
      if (ctx.state !== 'closed') {
        await ctx.close();
      }
      const compactBlob = encodeSpeechWav(decodedBuffer);
      return { blob: compactBlob, mimeType: 'audio/wav' };
    }
  } catch (err) {
    console.warn('Could not downsample audio with WebAudio, falling back to original blob:', err);
  }

  return { blob, mimeType: type || 'audio/wav' };
}

/**
 * Direct client-side Gemini transcription fallback
 */
async function transcribeClientDirect(
  audioBase64: string,
  mimeType: string,
  apiKey: string,
  options: TranscribeOptions
): Promise<TranscribeResult> {
  const ai = new GoogleGenAI({ apiKey });
  const cleanMime = detectMimeType(audioBase64, mimeType);

  let promptInstruction = `Listen to the attached audio file and transcribe all spoken words directly into text.
If there are multiple speakers, label them as Speaker 1, Speaker 2, etc.
Maintain proper punctuation and formatting.
If no spoken words are detected, output [No speech detected] or describe the audio sound in brackets.`;

  if (options.mode === 'timestamped') {
    promptInstruction = `Listen to the attached audio file and transcribe all spoken words into text with timestamps in brackets at the beginning of each major phrase or sentence, for example:
[00:00] Speaker 1: Hello and welcome to the show.
[00:04] Speaker 2: Great to be here.
If no speech is detected, output [No speech detected].`;
  } else if (options.mode === 'summary') {
    promptInstruction = `Listen to the attached audio file. Transcribe the audio and generate an Executive Summary, Key Highlights, and full transcript formatted as:
# Executive Summary
[Brief 2-3 sentence overview]

### Key Highlights
- Key highlight 1
- Key highlight 2

### Full Transcript
[Complete verbatim transcript]
If no speech is detected, provide a summary of the audio contents and indicate [No speech detected].`;
  } else if (options.mode === 'translate') {
    const lang = options.targetLanguage || 'English';
    promptInstruction = `Listen to the attached audio file. Transcribe all spoken words and translate them into ${lang}:
# Translation (${lang})
[Translated transcript here]

### Original Audio Transcript
[Original spoken audio transcript here]
If no speech is detected, output [No speech detected].`;
  }

  if (options.customPrompt && options.customPrompt.trim()) {
    promptInstruction += `\n\nAdditional user guidelines:\n${options.customPrompt.trim()}`;
  }

  const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-flash-latest'];
  let lastError: any = null;

  for (const modelName of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            parts: [
              {
                inlineData: {
                  data: audioBase64,
                  mimeType: cleanMime,
                },
              },
              {
                text: promptInstruction,
              },
            ],
          },
        ],
      });

      const rawText = (response.text || '').trim() || '[Audio processed - No audible speech detected]';

      const segments: TranscriptSegment[] = [];
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
    } catch (err: any) {
      lastError = err;
      console.warn(`Direct client transcription model ${modelName} error:`, err?.message);
    }
  }

  throw lastError || new Error('Direct transcription failed.');
}

/**
 * Sends audio to server /api/transcribe with intelligent client-side fallback
 */
export async function transcribeAudio(
  blob: Blob,
  options: TranscribeOptions = {}
): Promise<TranscribeResult> {
  try {
    const { blob: optimizedBlob, mimeType } = await optimizeAudioForTranscription(blob);
    const audioBase64 = await blobToBase64(optimizedBlob);
    const userApiKey = options.apiKey || getStoredApiKey();

    let serverError: string | null = null;

    // First attempt: Call the full-stack server endpoint
    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          audioBase64,
          mimeType,
          mode: options.mode || 'standard',
          targetLanguage: options.targetLanguage,
          customPrompt: options.customPrompt,
          apiKey: userApiKey || undefined,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      const responseText = await response.text();

      if (contentType.includes('text/html') || responseText.startsWith('<!DOCTYPE') || responseText.startsWith('<html')) {
        // Returned HTML (e.g. SPA index.html fallback from a static hosting setup)
        serverError = 'Server API endpoint returned HTML. Attempting direct connection...';
      } else if (responseText && responseText.trim()) {
        try {
          const data = JSON.parse(responseText);
          if (response.ok && data && data.success !== false) {
            return data;
          }
          serverError = data?.error || `Server responded with status ${response.status}`;
        } catch {
          serverError = `Server returned invalid JSON (${response.status}): ${responseText.slice(0, 100)}`;
        }
      } else {
        serverError = `Server responded with empty body (${response.status}).`;
      }
    } catch (fetchErr: any) {
      serverError = `Network connection error: ${fetchErr?.message || 'Failed to reach server'}`;
    }

    // If server succeeded, we already returned. If it failed or missing key and user has key:
    if (userApiKey) {
      console.log('Server endpoint unavailable or reported error, falling back to direct client API with user key...');
      try {
        const directResult = await transcribeClientDirect(audioBase64, mimeType, userApiKey, options);
        return directResult;
      } catch (directErr: any) {
        throw new Error(directErr?.message || serverError || 'Direct transcription failed.');
      }
    }

    // If no user API key configured and server failed
    throw new Error(
      serverError || 'Failed to transcribe audio. Please ensure your Gemini API key is configured.'
    );
  } catch (error: any) {
    console.error('Transcription error in client:', error);
    return {
      success: false,
      transcription: '',
      error: error?.message || 'Failed to transcribe audio.',
    };
  }
}

/**
 * Download transcription as plain text file (.txt)
 */
export function downloadTranscriptTxt(filename: string, content: string) {
  const cleanName = filename.replace(/\.[^/.]+$/, '').replace(/[\\/:*?"<>|]/g, '_');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${cleanName}_transcript.txt`;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
}

/**
 * Download transcription as SubRip subtitle (.srt)
 */
export function downloadTranscriptSrt(filename: string, text: string, segments?: TranscriptSegment[]) {
  const cleanName = filename.replace(/\.[^/.]+$/, '').replace(/[\\/:*?"<>|]/g, '_');
  let srtContent = '';

  if (segments && segments.length > 0) {
    segments.forEach((seg, idx) => {
      const startTime = seg.time ? convertTimestampToSrt(seg.time) : '00:00:00,000';
      const endTime = '00:00:05,000';
      srtContent += `${idx + 1}\n${startTime} --> ${endTime}\n${seg.speaker ? `${seg.speaker}: ` : ''}${seg.text}\n\n`;
    });
  } else {
    const paragraphs = text.split('\n\n').filter((p) => p.trim().length > 0);
    paragraphs.forEach((p, idx) => {
      const startSec = idx * 5;
      const endSec = startSec + 4;
      srtContent += `${idx + 1}\n${formatSecondsToSrt(startSec)} --> ${formatSecondsToSrt(endSec)}\n${p.trim()}\n\n`;
    });
  }

  const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${cleanName}_subtitles.srt`;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
}

function convertTimestampToSrt(ts: string): string {
  const parts = ts.split(':').map(Number);
  if (parts.length === 2) {
    const [min, sec] = parts;
    const hStr = '00';
    const mStr = String(min).padStart(2, '0');
    const sStr = String(sec).padStart(2, '0');
    return `${hStr}:${mStr}:${sStr},000`;
  }
  if (parts.length === 3) {
    const [hr, min, sec] = parts;
    const hStr = String(hr).padStart(2, '0');
    const mStr = String(min).padStart(2, '0');
    const sStr = String(sec).padStart(2, '0');
    return `${hStr}:${mStr}:${sStr},000`;
  }
  return '00:00:00,000';
}

function formatSecondsToSrt(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},000`;
}
