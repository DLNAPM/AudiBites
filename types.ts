export enum AppView {
  LIBRARY = 'LIBRARY',
  RECORDER = 'RECORDER',
  EDITOR = 'EDITOR',
}

export interface AudioTrack {
  id: string;
  name: string;
  blob: Blob;
  createdAt: number;
  duration: number; // in seconds
  source: 'recording' | 'upload' | 'edited';
}

export interface AudioRecorderState {
  isRecording: boolean;
  duration: number;
  audioBlob: Blob | null;
  mode: 'MIC' | 'SYSTEM';
}

export type AudioContextType = AudioContext | null;