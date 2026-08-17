import { TranscriptSegment } from '../types';

export interface TranscribeOptions {
  mode?: 'standard' | 'timestamped' | 'summary' | 'translate';
  targetLanguage?: string;
  customPrompt?: string;
}

export interface TranscribeResult {
  success: boolean;
  transcription: string;
  summary?: string;
  segments?: TranscriptSegment[];
  detectedLanguage?: string;
  error?: string;
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
 * Optimizes audio for transcription (downsamples large raw audio to 16kHz mono WAV for instant transfer)
 */
async function optimizeAudioForTranscription(blob: Blob): Promise<{ blob: Blob; mimeType: string }> {
  // If compressed audio format (MP3, M4A, AAC, OGG, WebM, FLAC) and size is under 8MB, use directly
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

  // If small WAV (< 2MB), send directly
  if (type.includes('wav') && blob.size < 2 * 1024 * 1024) {
    return { blob, mimeType: 'audio/wav' };
  }

  // Otherwise downsample via Web Audio API to 16kHz mono WAV
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
 * Sends audio to server /api/transcribe
 */
export async function transcribeAudio(
  blob: Blob,
  options: TranscribeOptions = {}
): Promise<TranscribeResult> {
  try {
    const { blob: optimizedBlob, mimeType } = await optimizeAudioForTranscription(blob);
    const audioBase64 = await blobToBase64(optimizedBlob);

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
      }),
    });

    const responseText = await response.text();
    let data: any = null;
    if (responseText && responseText.trim()) {
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          `Server returned an invalid response (${response.status}): ${responseText.slice(0, 120)}`
        );
      }
    }

    if (!response.ok) {
      const errMsg = data?.error || `Server responded with error status ${response.status}`;
      throw new Error(errMsg);
    }

    if (!data || typeof data !== 'object') {
      throw new Error('Server returned an empty transcription response. Please try again.');
    }

    if (data.success === false) {
      throw new Error(data.error || 'Failed to transcribe audio.');
    }

    return data;
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
    // Generate SRT from paragraphs
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
