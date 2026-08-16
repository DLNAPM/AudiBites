export enum AppView {
  LIBRARY = 'LIBRARY',
  RECORDER = 'RECORDER',
  EDITOR = 'EDITOR',
}

export type TrackSource = 'recording' | 'upload' | 'edited' | 'sample';

export interface TranscriptSegment {
  time?: string;
  speaker?: string;
  text: string;
}

export interface AudioTrack {
  id: string;
  name: string;
  blob: Blob;
  createdAt: number;
  duration: number; // in seconds
  source: TrackSource;
  size?: number; // size in bytes
  sampleRate?: number;
  channels?: number;
  transcription?: string;
  transcriptTimestamps?: TranscriptSegment[];
  transcriptSummary?: string;
  transcriptLanguage?: string;
  transcriptCreatedAt?: number;
}

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioBlob: Blob | null;
  mode: 'MIC' | 'SYSTEM' | 'IMPORT';
}

export type AudioContextType = AudioContext | null;

export interface AudioEditAction {
  label: string;
  timestamp: number;
}
