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

export async function handleTranscription(payload: TranscribeRequestPayload): Promise<TranscribeResponsePayload> {
  let { audioBase64, mimeType = 'audio/wav', mode = 'standard', targetLanguage, customPrompt } = payload;

  if (!audioBase64 || typeof audioBase64 !== 'string' || audioBase64.trim().length === 0) {
    throw new Error('No audio data provided for transcription.');
  }

  // Strip any data: URL scheme prefix
  if (audioBase64.includes(',')) {
    audioBase64 = audioBase64.split(',')[1];
  }
  audioBase64 = audioBase64.replace(/\s+/g, '');

  const ai = getAiClient();

  // Normalize mime type
  let cleanMimeType = (mimeType || 'audio/wav').toLowerCase();
  if (cleanMimeType.includes(';')) {
    cleanMimeType = cleanMimeType.split(';')[0].trim();
  }
  if (!cleanMimeType.startsWith('audio/') && !cleanMimeType.startsWith('video/')) {
    cleanMimeType = 'audio/wav';
  }

  let promptText = `You are a professional audio transcriptionist and audio engineer. 
Carefully listen to this audio recording and transcribe it accurately.
Guidelines:
- Transcribe verbatim while cleaning up false starts unless context is crucial.
- Maintain appropriate punctuation, capitalization, and paragraph spacing.
- If multiple speakers are speaking, label them clearly (e.g. Speaker 1, Speaker 2, or by name if introduced).
- If background sounds, music, or key audio events occur, note them in brackets (e.g. [Upbeat acoustic guitar intro], [Applause], [Silence]).`;

  if (mode === 'timestamped') {
    promptText += `\n- Format the transcript with timestamps at the beginning of each major sentence or phrase in brackets, e.g.:
[00:00] Speaker 1: Hello and welcome to today's session.
[00:05] Speaker 2: Thanks for having me.`;
  } else if (mode === 'summary') {
    promptText += `\n\nIn addition to the full verbatim transcript, please provide an Executive Summary and Key Takeaways section at the top formatted in markdown:
# Executive Summary
[Brief overview of what was discussed or heard]

### Key Highlights
- Bullet point 1
- Bullet point 2

### Full Transcript
[Verbatim transcript here]`;
  } else if (mode === 'translate') {
    const lang = targetLanguage || 'English';
    promptText += `\n\nPlease transcribe the audio and translate the transcript into ${lang}.
Provide both the original language transcription and the translated transcript:
# Translation (${lang})
[Translated transcript here]

### Original Audio Transcript
[Original transcript here]`;
  }

  if (customPrompt && customPrompt.trim()) {
    promptText += `\n\nAdditional user instructions:\n${customPrompt.trim()}`;
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

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: {
        parts: [audioPart, textPart],
      },
    });

    const rawText = response.text || '';

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
    console.error('Gemini API generateContent error:', apiError);
    throw new Error(apiError?.message || 'Gemini API failed to process the audio.');
  }
}
