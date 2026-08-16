import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Monitor,
  Upload,
  Square,
  Play,
  Pause,
  RotateCcw,
  Save,
  Scissors,
  Volume2,
  Sliders,
  Sparkles,
  Info,
  CheckCircle2,
  FileAudio,
  Smartphone,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { formatTime, formatTimePrecise, formatFileSize, extractAudioFromFile, getAudioMetadata } from '../utils/audioUtils';

interface RecorderProps {
  onSave: (blob: Blob, name: string, source: 'recording' | 'upload', duration?: number) => void;
  onOpenInEditor?: (blob: Blob, name: string) => void;
  onTranscribe?: (blob: Blob, name: string) => void;
  onCancel: () => void;
}

const Recorder: React.FC<RecorderProps> = ({ onSave, onOpenInEditor, onTranscribe, onCancel }) => {
  const [mode, setMode] = useState<'MIC' | 'SYSTEM' | 'IMPORT'>('MIC');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);

  // Audio stream & recording
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [recordingName, setRecordingName] = useState('');

  // Audio settings
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [visualizerType, setVisualizerType] = useState<'bars' | 'wave'>('bars');
  const [inputGain, setInputGain] = useState(1.0);
  const [peakLevel, setPeakLevel] = useState(0); // 0 to 1

  // Post-recording preview playback
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Import mode
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Canvas & Audio Context
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllMedia();
    };
  }, []);

  const stopAllMedia = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  // Setup Visualizer & Gain
  const setupAudioGraph = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = inputGain;
      gainNodeRef.current = gainNode;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      source.connect(gainNode);
      gainNode.connect(analyser);

      drawVisualizer();
    } catch (err) {
      console.warn('Could not setup audio visualizer graph:', err);
    }
  };

  // Update gain when slider changes
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = inputGain;
    }
  }, [inputGain]);

  // Visualizer loop
  const drawVisualizer = () => {
    if (!canvasRef.current || !analyserRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animFrameRef.current = requestAnimationFrame(render);
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Background subtle grid
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      if (visualizerType === 'bars') {
        analyser.getByteFrequencyData(dataArray);

        // Calculate peak level for VU meter
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength / 255;
        setPeakLevel(Math.min(1, avg * 1.8));

        const barCount = 48;
        const barWidth = (width / barCount) - 3;
        const step = Math.floor(bufferLength / barCount);

        for (let i = 0; i < barCount; i++) {
          const val = dataArray[i * step] || 0;
          const barHeight = (val / 255) * (height - 16);
          const x = i * (barWidth + 3) + 4;
          const y = height - barHeight - 8;

          // Color gradient logic: sky to cyan/pink
          const ratio = i / barCount;
          const r = Math.floor(14 + ratio * 220);
          const g = Math.floor(165 - ratio * 40);
          const b = Math.floor(233 + ratio * 20);

          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.beginPath();
          ctx.roundRect(x, y, Math.max(2, barWidth), Math.max(3, barHeight), [3, 3, 0, 0]);
          ctx.fill();
        }
      } else {
        // Oscilloscope Waveform mode
        analyser.getByteTimeDomainData(dataArray);

        // Peak estimation
        let maxDev = 0;
        for (let i = 0; i < bufferLength; i++) {
          const dev = Math.abs(dataArray[i] - 128);
          if (dev > maxDev) maxDev = dev;
        }
        setPeakLevel(Math.min(1, maxDev / 128));

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#38bdf8';
        ctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.stroke();
      }
    };

    render();
  };

  const startRecording = async () => {
    try {
      let sourceStream: MediaStream;
      let streamToRecord: MediaStream;

      if (mode === 'SYSTEM') {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
          alert('Screen/System audio capture is not supported in this browser.');
          return;
        }

        try {
          sourceStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            },
          });
        } catch {
          return; // User cancelled display media dialog
        }

        const audioTracks = sourceStream.getAudioTracks();
        if (audioTracks.length === 0) {
          sourceStream.getTracks().forEach((t) => t.stop());
          alert('No audio track detected! Please check "Share tab audio" or "Share system audio" in the screen picker dialog.');
          return;
        }

        streamToRecord = new MediaStream(audioTracks);
      } else {
        // Microphone
        const constraints: MediaStreamConstraints = {
          audio: {
            echoCancellation,
            noiseSuppression,
            autoGainControl: true,
            sampleRate: 48000,
          },
        };
        sourceStream = await navigator.mediaDevices.getUserMedia(constraints);
        streamToRecord = sourceStream;
      }

      streamRef.current = sourceStream;
      setupAudioGraph(streamToRecord);

      // Determine supported mime type
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/aac',
      ];
      const selectedMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || '';

      const recorder = new MediaRecorder(streamToRecord, selectedMime ? { mimeType: selectedMime } : undefined);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const finalBlob = new Blob(chunks, { type: selectedMime || 'audio/webm' });
        setRecordedChunks(chunks);
        setRecordedBlob(finalBlob);

        const metadata = await getAudioMetadata(finalBlob);
        const finalDuration = metadata.duration > 0 ? metadata.duration : duration;
        setRecordedDuration(finalDuration);

        const defaultName = `Recording_${new Date().toISOString().slice(0, 19).replace('T', '_')}`;
        setRecordingName(defaultName);
      };

      recorder.start(100);
      setMediaRecorder(recorder);
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);

      // Timer
      const startTime = Date.now();
      timerRef.current = window.setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      // Listen for stream ended (e.g. user clicks "Stop Sharing" on Chrome tab)
      sourceStream.getTracks().forEach((track) => {
        track.onended = () => {
          stopRecording();
        };
      });
    } catch (err: any) {
      console.error('Recording initialization error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('Permission denied. Please grant audio/mic access in your browser settings.');
      } else {
        alert(`Could not start recording: ${err.message || err}`);
      }
    }
  };

  const togglePauseResume = () => {
    if (!mediaRecorder) return;
    if (mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    } else if (mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      setIsPaused(false);
      const resumeTime = Date.now() - duration * 1000;
      timerRef.current = window.setInterval(() => {
        setDuration(Math.floor((Date.now() - resumeTime) / 1000));
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    setIsRecording(false);
    setIsPaused(false);
    setPeakLevel(0);
  };

  const handleReset = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setRecordedBlob(null);
    setRecordedChunks([]);
    setDuration(0);
    setRecordedDuration(0);
    setIsPreviewPlaying(false);
    setPreviewTime(0);
  };

  const handleSaveToLibrary = () => {
    if (!recordedBlob) return;
    const name = recordingName.trim() || `Recording_${Date.now()}`;
    onSave(recordedBlob, name, 'recording', recordedDuration);
  };

  const handleOpenStudio = () => {
    if (!recordedBlob) return;
    const name = recordingName.trim() || `Recording_${Date.now()}`;
    if (onOpenInEditor) {
      onOpenInEditor(recordedBlob, name);
    } else {
      onSave(recordedBlob, name, 'recording', recordedDuration);
    }
  };

  const togglePreviewPlayback = () => {
    if (!recordedBlob) return;

    if (isPreviewPlaying && previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
    } else {
      if (!previewAudioRef.current) {
        const audio = new Audio(URL.createObjectURL(recordedBlob));
        previewAudioRef.current = audio;

        audio.ontimeupdate = () => {
          setPreviewTime(audio.currentTime);
        };
        audio.onended = () => {
          setIsPreviewPlaying(false);
          setPreviewTime(0);
        };
      }
      previewAudioRef.current.play();
      setIsPreviewPlaying(true);
    }
  };

  const processFile = async (file: File) => {
    setIsProcessingFile(true);
    try {
      const { blob, duration: fileDuration } = await extractAudioFromFile(file);
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      onSave(blob, cleanName, 'upload', fileDuration);
    } catch (err: any) {
      alert(err.message || 'Failed to extract audio from file.');
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 p-4 md:p-8 max-w-5xl mx-auto w-full">
      {/* Top Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Audio Studio Recorder</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Capture crystal-clear microphone, browser tabs, or extract audio from videos
          </p>
        </div>

        {/* Mode Selector */}
        {!recordedBlob && !isRecording && (
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => setMode('MIC')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold tracking-wide uppercase transition-all ${
                mode === 'MIC'
                  ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Mic size={15} />
              <span>Microphone</span>
            </button>

            {!isIOS && (
              <button
                onClick={() => setMode('SYSTEM')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold tracking-wide uppercase transition-all ${
                  mode === 'SYSTEM'
                    ? 'bg-pink-500 text-white shadow-sm shadow-pink-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Monitor size={15} />
                <span>System / Tab</span>
              </button>
            )}

            <button
              onClick={() => setMode('IMPORT')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold tracking-wide uppercase transition-all ${
                mode === 'IMPORT'
                  ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Upload size={15} />
              <span>Import File</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Container */}
      {mode === 'IMPORT' && !recordedBlob ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          className={`flex-1 bg-slate-950/60 rounded-2xl border-2 border-dashed p-8 md:p-12 flex flex-col items-center justify-center text-center transition-all ${
            dragOver ? 'border-sky-500 bg-sky-500/5' : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          {isProcessingFile ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-3 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-center">
                <p className="font-semibold text-white">Extracting Audio Track...</p>
                <p className="text-xs text-slate-400 mt-1">Decoding audio frames into lossless PCM</p>
              </div>
            </div>
          ) : (
            <>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer group flex flex-col items-center max-w-md"
              >
                <div className="w-16 h-16 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-center text-sky-400 group-hover:scale-105 group-hover:border-sky-500/50 transition-all shadow-md mb-4">
                  <FileAudio size={32} />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Upload Audio or Video</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-6">
                  Drop MP4, MOV, WEBM, MP3, WAV, AAC, or screen recording files here to extract high-fidelity audio.
                </p>
                <button
                  type="button"
                  className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-sm font-semibold shadow-md shadow-sky-500/20 transition-all"
                >
                  Choose File
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      processFile(e.target.files[0]);
                    }
                  }}
                  accept="audio/*,video/*"
                  className="hidden"
                />
              </div>

              {isIOS && (
                <div className="mt-8 max-w-md p-4 bg-slate-900/80 rounded-xl border border-slate-800 text-left text-xs">
                  <div className="flex items-center gap-2 text-indigo-400 font-semibold mb-2">
                    <Smartphone size={16} />
                    <span>How to capture Spotify / YouTube on iOS:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-400">
                    <li>Swipe down for <strong>Control Center</strong> & start <strong>Screen Recording</strong>.</li>
                    <li>Play your desired music or video tab.</li>
                    <li>Stop screen recording (saved to Photos).</li>
                    <li>Tap <strong>Choose File</strong> above and select the video!</li>
                  </ol>
                </div>
              )}
            </>
          )}
        </div>
      ) : recordedBlob ? (
        /* Post-Recording Review State */
        <div className="flex-1 bg-slate-950/70 border border-slate-800 rounded-2xl p-6 md:p-8 flex flex-col justify-between shadow-xl">
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Recording Completed</h3>
                  <p className="text-xs text-slate-400">
                    Duration: {formatTime(recordedDuration)} • Size: {formatFileSize(recordedBlob.size)}
                  </p>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors"
              >
                <RotateCcw size={14} />
                <span>Discard</span>
              </button>
            </div>

            {/* Name Input */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Track Name
              </label>
              <input
                type="text"
                value={recordingName}
                onChange={(e) => setRecordingName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 focus:border-sky-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-colors"
                placeholder="Enter recording title..."
              />
            </div>

            {/* Inline Preview Player */}
            <div className="bg-slate-900/90 rounded-xl p-5 border border-slate-800">
              <div className="flex items-center justify-between gap-4">
                <button
                  onClick={togglePreviewPlayback}
                  className="w-12 h-12 rounded-full bg-sky-500 hover:bg-sky-400 text-white flex items-center justify-center shadow-lg shadow-sky-500/20 transition-all shrink-0"
                >
                  {isPreviewPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                </button>
                <div className="flex-1">
                  <div className="flex justify-between text-xs font-mono text-slate-400 mb-1.5">
                    <span>{formatTimePrecise(previewTime)}</span>
                    <span>{formatTimePrecise(recordedDuration)}</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-sky-500 h-full transition-all"
                      style={{
                        width: `${recordedDuration > 0 ? (previewTime / recordedDuration) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-6 border-t border-slate-800 mt-6">
            {onTranscribe && (
              <button
                onClick={() => {
                  if (recordedBlob) {
                    const name = recordingName.trim() || `Recording_${Date.now()}`;
                    onTranscribe(recordedBlob, name);
                  }
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-purple-400 hover:text-purple-300 rounded-xl text-sm font-semibold border border-purple-500/30 transition-all"
              >
                <FileText size={16} />
                <span>Transcribe to Text</span>
              </button>
            )}
            <button
              onClick={handleSaveToLibrary}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold border border-slate-700 transition-all"
            >
              <Save size={16} />
              <span>Save to Library</span>
            </button>
            <button
              onClick={handleOpenStudio}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-sm font-semibold shadow-lg shadow-sky-500/20 transition-all"
            >
              <Scissors size={16} />
              <span>Open in Studio Editor</span>
            </button>
          </div>
        </div>
      ) : (
        /* Live Recording / Ready State */
        <div className="flex-1 flex flex-col gap-6">
          {/* Visualizer Canvas & Peak Meter */}
          <div className="relative flex-1 bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden min-h-[220px] flex flex-col justify-end p-4">
            <canvas ref={canvasRef} width={800} height={200} className="absolute inset-0 w-full h-full object-cover" />

            {!isRecording && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-6 bg-slate-950/70 backdrop-blur-xs">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-sky-400 mb-3 shadow-inner">
                  {mode === 'SYSTEM' ? <Monitor size={28} /> : <Mic size={28} />}
                </div>
                <h3 className="text-base font-bold text-white mb-1">
                  {mode === 'SYSTEM' ? 'Ready to Capture System / Tab Audio' : 'Microphone Ready'}
                </h3>
                <p className="text-xs text-slate-400 text-center max-w-sm">
                  {mode === 'SYSTEM'
                    ? 'Press record and select the browser tab (Spotify, YouTube, Soundcloud) you wish to record.'
                    : 'Press the record button below to begin recording studio-quality voice and audio.'}
                </p>
              </div>
            )}

            {/* Peak Meter Bar at bottom */}
            {isRecording && (
              <div className="relative z-20 flex items-center gap-3 bg-slate-900/90 backdrop-blur-sm px-4 py-2 rounded-xl border border-slate-800/80 mt-auto">
                <Volume2 size={16} className="text-slate-400 shrink-0" />
                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden flex gap-0.5">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-75"
                    style={{ width: `${Math.min(70, peakLevel * 100)}%` }}
                  />
                  {peakLevel > 0.7 && (
                    <div
                      className="h-full bg-amber-400 transition-all duration-75"
                      style={{ width: `${Math.min(20, (peakLevel - 0.7) * 100)}%` }}
                    />
                  )}
                  {peakLevel > 0.9 && (
                    <div
                      className="h-full bg-rose-500 transition-all duration-75"
                      style={{ width: `${Math.min(10, (peakLevel - 0.9) * 100)}%` }}
                    />
                  )}
                </div>
                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                  {peakLevel > 0.9 ? 'PEAK' : `${Math.round(peakLevel * 100)}%`}
                </span>
              </div>
            )}
          </div>

          {/* Timer Display */}
          <div className="flex flex-col items-center">
            <div className="font-mono text-4xl md:text-5xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>{formatTime(duration)}</span>
              {isPaused && (
                <span className="text-xs uppercase px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-md font-sans">
                  Paused
                </span>
              )}
            </div>
            {isRecording && (
              <div className="flex items-center gap-2 mt-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                <span className="text-xs text-rose-400 font-medium">
                  {isPaused ? 'Recording Paused' : 'Live Recording...'}
                </span>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="group relative flex items-center justify-center w-16 h-16 bg-rose-500 hover:bg-rose-400 rounded-full shadow-lg shadow-rose-500/30 transition-transform active:scale-95"
                title="Start Recording"
              >
                <div className="w-6 h-6 bg-white rounded-full transition-transform group-hover:scale-110" />
              </button>
            ) : (
              <>
                <button
                  onClick={togglePauseResume}
                  className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-semibold border border-slate-700 transition-all flex items-center gap-2"
                >
                  {isPaused ? <Play size={16} /> : <Pause size={16} />}
                  <span>{isPaused ? 'Resume' : 'Pause'}</span>
                </button>

                <button
                  onClick={stopRecording}
                  className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2"
                >
                  <Square size={16} className="fill-white" />
                  <span>Stop Recording</span>
                </button>
              </>
            )}
          </div>

          {/* Recording Options & System Notice */}
          <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-200">
                <input
                  type="checkbox"
                  checked={noiseSuppression}
                  onChange={(e) => setNoiseSuppression(e.target.checked)}
                  disabled={isRecording}
                  className="rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-0"
                />
                <span>Noise Suppression</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-200">
                <input
                  type="checkbox"
                  checked={echoCancellation}
                  onChange={(e) => setEchoCancellation(e.target.checked)}
                  disabled={isRecording}
                  className="rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-0"
                />
                <span>Echo Cancellation</span>
              </label>
            </div>

            <div className="flex items-center gap-3 text-slate-400">
              <span>Visualizer:</span>
              <button
                onClick={() => setVisualizerType('bars')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  visualizerType === 'bars' ? 'bg-slate-800 text-sky-400' : 'hover:bg-slate-900'
                }`}
              >
                Spectrum
              </button>
              <button
                onClick={() => setVisualizerType('wave')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  visualizerType === 'wave' ? 'bg-slate-800 text-sky-400' : 'hover:bg-slate-900'
                }`}
              >
                Oscilloscope
              </button>
            </div>
          </div>

          {mode === 'SYSTEM' && !isRecording && (
            <div className="flex items-start gap-2.5 text-amber-400 bg-amber-500/10 border border-amber-500/20 px-4 py-3 rounded-xl text-xs">
              <Info size={16} className="shrink-0 mt-0.5" />
              <span>
                <strong>Chrome / Edge / Brave:</strong> In the popup, choose the <strong>"Chrome Tab"</strong> tab and
                ensure <strong>"Share tab audio"</strong> toggle is enabled to record direct digital music.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Recorder;
