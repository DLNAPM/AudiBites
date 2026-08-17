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
 * Sends audio to server /api/transcribe
 */
export async function transcribeAudio(
  blob: Blob,
  options: TranscribeOptions = {}
): Promise<TranscribeResult> {
  try {
    const audioBase64 = await blobToBase64(blob);
    const mimeType = blob.type || 'audio/wav';

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
    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch {
      // Body is not JSON (e.g. HTML or empty string)
      throw new Error(
        `Server returned an invalid response (${response.status} ${response.statusText}): ${
          responseText ? responseText.slice(0, 120) : 'Empty response'
        }`
      );
    }

    if (!response.ok || !data) {
      throw new Error(data?.error || `Server responded with status ${response.status}`);
    }

    if (!data.success && data.error) {
      throw new Error(data.error);
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
      const endTime = '00:00:05,000'; // fallback duration segment
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
