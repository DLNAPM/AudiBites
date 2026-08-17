import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  FileText,
  Copy,
  Check,
  Download,
  Sparkles,
  Clock,
  Globe,
  ListOrdered,
  Play,
  Pause,
  AlertCircle,
  RefreshCw,
  Search,
  BookOpen,
  Key,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AudioTrack } from '../types';
import {
  transcribeAudio,
  downloadTranscriptTxt,
  downloadTranscriptSrt,
  getStoredApiKey,
  setStoredApiKey,
  TranscribeOptions,
} from '../utils/transcribeClient';
import { formatTime, formatTimePrecise } from '../utils/audioUtils';

interface TranscribeModalProps {
  track: AudioTrack | { blob: Blob; name: string; duration?: number; id?: string };
  isOpen: boolean;
  onClose: () => void;
  onSaveToTrack?: (id: string, transcription: string) => void;
}

const SUPPORTED_LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Chinese (Mandarin)',
  'Japanese',
  'Korean',
  'Arabic',
  'Hindi',
  'Dutch',
  'Russian',
];

const TranscribeModal: React.FC<TranscribeModalProps> = ({
  track,
  isOpen,
  onClose,
  onSaveToTrack,
}) => {
  const [mode, setMode] = useState<'standard' | 'timestamped' | 'summary' | 'translate'>('standard');
  const [targetLanguage, setTargetLanguage] = useState<string>('English');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Optional custom API key support
  const [apiKey, setApiKey] = useState<string>(() => getStoredApiKey());
  const [showKeySettings, setShowKeySettings] = useState<boolean>(false);
  const [apiKeySaved, setApiKeySaved] = useState<boolean>(false);

  // Transcription output state
  const [transcriptText, setTranscriptText] = useState<string>(
    'transcription' in track && track.transcription ? track.transcription : ''
  );
  const [copied, setCopied] = useState<boolean>(false);
  const [searchInTranscript, setSearchInTranscript] = useState<string>('');

  // Audio preview playback inside modal
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Initialize or cleanup audio
  useEffect(() => {
    if (isOpen && track.blob) {
      const url = URL.createObjectURL(track.blob);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };

      // If track already has saved transcription, populate it
      if ('transcription' in track && track.transcription) {
        setTranscriptText(track.transcription);
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, [isOpen, track]);

  if (!isOpen) return null;

  const togglePlayAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(console.warn);
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleSaveApiKey = (keyVal: string) => {
    setApiKey(keyVal);
    setStoredApiKey(keyVal);
    setApiKeySaved(true);
    setTimeout(() => setApiKeySaved(false), 2000);
  };

  const handleStartTranscription = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const options: TranscribeOptions = {
      mode,
      targetLanguage: mode === 'translate' ? targetLanguage : undefined,
      customPrompt: customPrompt.trim() || undefined,
      apiKey: apiKey.trim() || undefined,
    };

    try {
      const result = await transcribeAudio(track.blob, options);

      if (result.success && result.transcription) {
        setTranscriptText(result.transcription);
        // Automatically save to track if ID exists and handler provided
        if (track.id && onSaveToTrack) {
          onSaveToTrack(track.id, result.transcription);
        }
      } else {
        const err = result.error || 'Failed to transcribe audio. Please try again.';
        setErrorMessage(err);
        if (err.toLowerCase().includes('api key') || err.toLowerCase().includes('gemini_api_key')) {
          setShowKeySettings(true);
        }
      }
    } catch (err: any) {
      const msg = err?.message || 'An unexpected error occurred during transcription.';
      setErrorMessage(msg);
      if (msg.toLowerCase().includes('api key') || msg.toLowerCase().includes('gemini_api_key')) {
        setShowKeySettings(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!transcriptText) return;
    try {
      await navigator.clipboard.writeText(transcriptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (err) {
      console.warn('Failed to copy to clipboard:', err);
    }
  };

  const handleDownloadTxt = () => {
    if (!transcriptText) return;
    downloadTranscriptTxt(track.name, transcriptText);
  };

  const handleDownloadSrt = () => {
    if (!transcriptText) return;
    downloadTranscriptSrt(track.name, transcriptText);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
              <FileText size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Audio Transcription</h2>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  AI Powered
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-md">
                {track.name} ({formatTime(track.duration || 0)})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowKeySettings(!showKeySettings)}
              className={`p-2 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                showKeySettings || apiKey
                  ? 'bg-slate-800 border-slate-700 text-sky-400'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="API Key Settings"
            >
              <Key size={14} />
              <span className="hidden sm:inline">API Key</span>
              {showKeySettings ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Optional API Key Configuration Banner/Collapsible */}
          {showKeySettings && (
            <div className="bg-slate-950 border border-sky-500/30 rounded-xl p-4 space-y-2.5 animate-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
                  <Key size={14} />
                  <span>Gemini API Key Configuration</span>
                </div>
                {apiKeySaved && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <Check size={12} /> Saved locally
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                If hosting independently (e.g. on Render, Vercel, or custom servers), provide your Gemini API key below. It is stored securely in your browser and used for speech transcription.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => handleSaveApiKey(e.target.value)}
                  placeholder="Paste your Gemini API key (AIzaSy...)"
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                />
                {apiKey && (
                  <button
                    onClick={() => handleSaveApiKey('')}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Mini Audio Player Bar */}
          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={togglePlayAudio}
              className={`p-2.5 rounded-xl font-semibold transition-all shrink-0 ${
                isPlaying
                  ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/30'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800'
              }`}
            >
              {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
            </button>

            <div className="flex-1 w-full space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>{formatTimePrecise(currentTime)}</span>
                <span>{formatTimePrecise(track.duration || 0)}</span>
              </div>
              <input
                type="range"
                min="0"
                max={track.duration || 1}
                step="0.05"
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
            </div>
          </div>

          {/* Mode Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">Transcription Format</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setMode('standard')}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                  mode === 'standard'
                    ? 'bg-sky-500/10 border-sky-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-sky-400 mb-1">
                  <FileText size={14} />
                  <span>Standard</span>
                </div>
                <span className="text-[11px] text-slate-400 leading-tight">
                  High-fidelity speech-to-text with paragraphs
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMode('timestamped')}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                  mode === 'timestamped'
                    ? 'bg-sky-500/10 border-sky-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-purple-400 mb-1">
                  <Clock size={14} />
                  <span>Timestamped</span>
                </div>
                <span className="text-[11px] text-slate-400 leading-tight">
                  Timecode markers [MM:SS] for subtitles & clips
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMode('summary')}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                  mode === 'summary'
                    ? 'bg-sky-500/10 border-sky-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-emerald-400 mb-1">
                  <ListOrdered size={14} />
                  <span>Summary & Notes</span>
                </div>
                <span className="text-[11px] text-slate-400 leading-tight">
                  Key takeaways, highlights & action items
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMode('translate')}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                  mode === 'translate'
                    ? 'bg-sky-500/10 border-sky-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-pink-400 mb-1">
                  <Globe size={14} />
                  <span>Translate</span>
                </div>
                <span className="text-[11px] text-slate-400 leading-tight">
                  Transcribe & translate to target language
                </span>
              </button>
            </div>
          </div>

          {/* Translation Language Selector */}
          {mode === 'translate' && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                <Globe size={14} className="text-pink-400" />
                Target Language:
              </span>
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-xs text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-sky-500"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Custom Prompt Context (Optional) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Custom Instructions / Vocabulary (Optional)
              </label>
              <span className="text-[10px] text-slate-500">e.g. specialized terms, speaker names</span>
            </div>
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g., Focus on technical terms like DAW, bit depth, and label speakers as Alex and Maya"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          {/* Action Trigger Button */}
          <div>
            <button
              onClick={handleStartTranscription}
              disabled={isLoading}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl font-semibold text-xs text-white shadow-md transition-all ${
                isLoading
                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                  : 'bg-sky-500 hover:bg-sky-400 shadow-sky-500/20'
              }`}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={14} className="animate-spin text-sky-400" />
                  <span>Transcribing Audio with Gemini AI...</span>
                </>
              ) : transcriptText ? (
                <>
                  <RefreshCw size={14} />
                  <span>Re-Transcribe Audio</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Generate Transcription</span>
                </>
              )}
            </button>
          </div>

          {/* Error Message with Retry & API Key prompt */}
          {errorMessage && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-200">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={16} className="shrink-0 text-rose-400 mt-0.5" />
                <div className="space-y-1">
                  <span className="leading-relaxed block">{errorMessage}</span>
                  {!apiKey && (
                    <button
                      type="button"
                      onClick={() => setShowKeySettings(true)}
                      className="text-[11px] text-sky-400 hover:underline flex items-center gap-1 font-medium"
                    >
                      <Key size={11} /> Enter your Gemini API key
                    </button>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleStartTranscription}
                disabled={isLoading}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 rounded-lg text-xs font-semibold transition-colors"
              >
                <RefreshCw size={12} />
                <span>Retry</span>
              </button>
            </div>
          )}

          {/* Output Transcript Container */}
          {transcriptText && (
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen size={14} className="text-sky-400" />
                    Transcription Result
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {transcriptText.split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>

                {/* Toolbar actions */}
                <div className="flex items-center gap-2">
                  {/* Search within transcript */}
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={searchInTranscript}
                      onChange={(e) => setSearchInTranscript(e.target.value)}
                      placeholder="Find words..."
                      className="bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-2.5 py-1 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 w-28 sm:w-36"
                    />
                  </div>

                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
                    title="Copy to Clipboard"
                  >
                    {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>

                  <div className="relative group">
                    <button className="flex items-center gap-1 px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors">
                      <Download size={12} />
                      <span>Export</span>
                    </button>
                    <div className="absolute right-0 mt-1 w-36 bg-slate-900 border border-slate-800 rounded-xl shadow-xl p-1 z-30 hidden group-hover:block">
                      <button
                        onClick={handleDownloadTxt}
                        className="w-full text-left px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        Text (.txt)
                      </button>
                      <button
                        onClick={handleDownloadSrt}
                        className="w-full text-left px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        Subtitles (.srt)
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Formatted Text Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 max-h-72 overflow-y-auto font-mono text-xs text-slate-200 whitespace-pre-wrap leading-relaxed select-text">
                {searchInTranscript ? (
                  transcriptText.split(new RegExp(`(${searchInTranscript})`, 'gi')).map((part, i) =>
                    part.toLowerCase() === searchInTranscript.toLowerCase() ? (
                      <mark key={i} className="bg-sky-500/40 text-white rounded px-0.5">
                        {part}
                      </mark>
                    ) : (
                      part
                    )
                  )
                ) : (
                  transcriptText
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            {transcriptText && '✓ Saved to your local sound library'}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-800 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscribeModal;
