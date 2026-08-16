import React, { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { Region } from 'wavesurfer.js/dist/plugins/regions.esm.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js';
import {
  Play,
  Pause,
  Scissors,
  Save,
  RotateCcw,
  Download,
  X,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Volume2,
  VolumeX,
  Repeat,
  Sparkles,
  ArrowDownUp,
  Sliders,
  Maximize2,
  Minimize2,
  FileDown,
  Plus,
  HelpCircle,
  Clock,
} from 'lucide-react';
import {
  bufferToWav,
  sliceAudioBuffer,
  cutAudioBuffer,
  applyFade,
  applyGain,
  normalizeAudioBuffer,
  reverseAudioBuffer,
  silenceAudioBuffer,
  cloneAudioBuffer,
  formatTimePrecise,
} from '../utils/audioUtils';

interface EditorProps {
  initialBlob: Blob | null;
  initialName?: string;
  onClose: () => void;
  onSave: (blob: Blob, name: string) => void;
  onSaveAsCopy?: (blob: Blob, name: string) => void;
}

interface HistoryItem {
  buffer: AudioBuffer;
  action: string;
}

const Editor: React.FC<EditorProps> = ({
  initialBlob,
  initialName,
  onClose,
  onSave,
  onSaveAsCopy,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const regionsPlugin = useRef<RegionsPlugin | null>(null);

  // Audio Buffers & Context
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [currentBuffer, setCurrentBuffer] = useState<AudioBuffer | null>(null);

  // History for Undo / Redo
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Playback & State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [activeRegion, setActiveRegion] = useState<Region | null>(null);
  const [fileName, setFileName] = useState(initialName || 'Edited Track');
  const [loading, setLoading] = useState(true);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);

  // Controls & Settings
  const [zoomLevel, setZoomLevel] = useState(50); // minPxPerSec
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [fadeDuration, setFadeDuration] = useState(1.0); // seconds
  const [gainDb, setGainDb] = useState(3); // dB

  // Modals & Panels
  const [showGainModal, setShowGainModal] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Initialize WaveSurfer & AudioContext
  useEffect(() => {
    if (!containerRef.current || !initialBlob || !timelineRef.current) return;

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    setAudioContext(ctx);

    // Decode audio data for manipulation
    initialBlob.arrayBuffer().then((arrayBuffer) => {
      ctx.decodeAudioData(arrayBuffer.slice(0)).then((decoded) => {
        setCurrentBuffer(decoded);
        setHistory([{ buffer: cloneAudioBuffer(decoded, ctx), action: 'Initial Audio' }]);
        setHistoryIndex(0);
      });
    });

    const objectUrl = URL.createObjectURL(initialBlob);
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#38bdf8',
      progressColor: '#0284c7',
      cursorColor: '#f472b6',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      height: 140,
      normalize: true,
      minPxPerSec: 50,
      url: objectUrl,
    });

    const regs = RegionsPlugin.create();
    const timeline = TimelinePlugin.create({
      container: timelineRef.current,
      height: 22,
      timeInterval: 0.5,
      primaryLabelInterval: 5,
      style: {
        fontSize: '11px',
        color: '#64748b',
      },
    });

    ws.registerPlugin(regs);
    ws.registerPlugin(timeline);

    regionsPlugin.current = regs;
    wavesurfer.current = ws;

    ws.on('ready', () => {
      setLoading(false);
      setIsAudioReady(true);
      setTotalDuration(ws.getDuration());
      try {
        ws.zoom(zoomLevel);
        ws.setPlaybackRate(playbackRate);
        ws.setVolume(isMuted ? 0 : volume);
      } catch (err) {
        console.warn('WaveSurfer ready hook config warning:', err);
      }
    });

    ws.on('loading', () => {
      setLoading(true);
      setIsAudioReady(false);
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('timeupdate', (time) => setCurrentTime(time));
    ws.on('interaction', (time) => setCurrentTime(time));

    // Enable drag selection on waveform
    regs.enableDragSelection({
      color: 'rgba(244, 114, 182, 0.22)',
    });

    regs.on('region-created', (region) => {
      regs.getRegions().forEach((r) => {
        if (r.id !== region.id) r.remove();
      });
      setActiveRegion(region);
    });

    regs.on('region-updated', (region) => {
      setActiveRegion(region);
    });

    regs.on('region-clicked', (region, e) => {
      e.stopPropagation();
      region.play();
    });

    regs.on('region-out', (region) => {
      if (isLooping) {
        region.play();
      }
    });

    return () => {
      URL.revokeObjectURL(objectUrl);
      ws.destroy();
      if (ctx.state !== 'closed') {
        ctx.close();
      }
    };
  }, [initialBlob]);

  // Update WaveSurfer Zoom
  useEffect(() => {
    if (wavesurfer.current && isAudioReady && !loading) {
      try {
        wavesurfer.current.zoom(zoomLevel);
      } catch (err) {
        console.warn('Could not zoom waveform:', err);
      }
    }
  }, [zoomLevel, isAudioReady, loading]);

  // Update Playback Rate
  useEffect(() => {
    if (wavesurfer.current && isAudioReady) {
      try {
        wavesurfer.current.setPlaybackRate(playbackRate);
      } catch (err) {
        console.warn('Could not set playback rate:', err);
      }
    }
  }, [playbackRate, isAudioReady]);

  // Update Volume
  useEffect(() => {
    if (wavesurfer.current) {
      try {
        wavesurfer.current.setVolume(isMuted ? 0 : volume);
      } catch (err) {
        console.warn('Could not set volume:', err);
      }
    }
  }, [volume, isMuted]);

  // Commit new buffer to history and update WaveSurfer
  const commitBufferChange = (newBuffer: AudioBuffer, actionName: string) => {
    if (!audioContext) return;

    setCurrentBuffer(newBuffer);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      buffer: cloneAudioBuffer(newBuffer, audioContext),
      action: actionName,
    });

    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);

    const newBlob = bufferToWav(newBuffer);
    setIsAudioReady(false);
    setLoading(true);
    wavesurfer.current?.loadBlob(newBlob);
    regionsPlugin.current?.clearRegions();
    setActiveRegion(null);
    setCurrentTime(0);
  };

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0 && audioContext) {
      const prevIndex = historyIndex - 1;
      const targetBuffer = history[prevIndex].buffer;
      const restored = cloneAudioBuffer(targetBuffer, audioContext);

      setCurrentBuffer(restored);
      setHistoryIndex(prevIndex);

      const newBlob = bufferToWav(restored);
      setIsAudioReady(false);
      setLoading(true);
      wavesurfer.current?.loadBlob(newBlob);
      regionsPlugin.current?.clearRegions();
      setActiveRegion(null);
      setCurrentTime(0);
    }
  }, [historyIndex, history, audioContext]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1 && audioContext) {
      const nextIndex = historyIndex + 1;
      const targetBuffer = history[nextIndex].buffer;
      const restored = cloneAudioBuffer(targetBuffer, audioContext);

      setCurrentBuffer(restored);
      setHistoryIndex(nextIndex);

      const newBlob = bufferToWav(restored);
      setIsAudioReady(false);
      setLoading(true);
      wavesurfer.current?.loadBlob(newBlob);
      regionsPlugin.current?.clearRegions();
      setActiveRegion(null);
      setCurrentTime(0);
    }
  }, [historyIndex, history, audioContext]);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is editing filename input
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        wavesurfer.current?.playPause();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) ||
        ((e.ctrlKey || e.metaKey) && e.key === 'y')
      ) {
        e.preventDefault();
        handleRedo();
      } else if (e.code === 'Escape') {
        regionsPlugin.current?.clearRegions();
        setActiveRegion(null);
      } else if (e.key === 't' && activeRegion) {
        handleTrim();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && activeRegion) {
        handleCut();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, activeRegion]);

  // Tool Operations
  const handleTrim = () => {
    if (!activeRegion || !currentBuffer || !audioContext) return;
    const newBuf = sliceAudioBuffer(currentBuffer, activeRegion.start, activeRegion.end, audioContext);
    commitBufferChange(newBuf, 'Trim Audio');
  };

  const handleCut = () => {
    if (!activeRegion || !currentBuffer || !audioContext) return;
    const newBuf = cutAudioBuffer(currentBuffer, activeRegion.start, activeRegion.end, audioContext);
    commitBufferChange(newBuf, 'Cut Audio');
  };

  const handleSilence = () => {
    if (!activeRegion || !currentBuffer || !audioContext) return;
    const newBuf = silenceAudioBuffer(currentBuffer, activeRegion.start, activeRegion.end, audioContext);
    commitBufferChange(newBuf, 'Silence Region');
  };

  const handleFadeIn = () => {
    if (!currentBuffer || !audioContext) return;
    const regStart = activeRegion ? activeRegion.start : 0;
    const regEnd = activeRegion ? activeRegion.end : currentBuffer.duration;
    const newBuf = applyFade(currentBuffer, 'in', fadeDuration, audioContext, regStart, regEnd);
    commitBufferChange(newBuf, `Fade In (${fadeDuration}s)`);
  };

  const handleFadeOut = () => {
    if (!currentBuffer || !audioContext) return;
    const regStart = activeRegion ? activeRegion.start : 0;
    const regEnd = activeRegion ? activeRegion.end : currentBuffer.duration;
    const newBuf = applyFade(currentBuffer, 'out', fadeDuration, audioContext, regStart, regEnd);
    commitBufferChange(newBuf, `Fade Out (${fadeDuration}s)`);
  };

  const handleNormalize = () => {
    if (!currentBuffer || !audioContext) return;
    const regStart = activeRegion ? activeRegion.start : undefined;
    const regEnd = activeRegion ? activeRegion.end : undefined;
    const newBuf = normalizeAudioBuffer(currentBuffer, audioContext, regStart, regEnd);
    commitBufferChange(newBuf, 'Normalize Peak');
  };

  const handleGainApply = (multiplier: number, label: string) => {
    if (!currentBuffer || !audioContext) return;
    const regStart = activeRegion ? activeRegion.start : undefined;
    const regEnd = activeRegion ? activeRegion.end : undefined;
    const newBuf = applyGain(currentBuffer, multiplier, audioContext, regStart, regEnd);
    commitBufferChange(newBuf, `Gain ${label}`);
    setShowGainModal(false);
  };

  const handleReverse = () => {
    if (!currentBuffer || !audioContext) return;
    const regStart = activeRegion ? activeRegion.start : undefined;
    const regEnd = activeRegion ? activeRegion.end : undefined;
    const newBuf = reverseAudioBuffer(currentBuffer, audioContext, regStart, regEnd);
    commitBufferChange(newBuf, 'Reverse Audio');
  };

  // Direct File Download (WAV)
  const handleDirectDownload = () => {
    if (!currentBuffer) return;
    const blob = bufferToWav(currentBuffer);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.trim() || 'audiotrack'}.wav`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  };

  const handleSave = () => {
    if (!currentBuffer) return;
    const blob = bufferToWav(currentBuffer);
    onSave(blob, fileName.trim() || 'Edited Audio');
  };

  const handleSaveAsCopy = () => {
    if (!currentBuffer) return;
    const blob = bufferToWav(currentBuffer);
    const copyName = `${fileName.trim() || 'Edited Audio'} (Copy)`;
    if (onSaveAsCopy) {
      onSaveAsCopy(blob, copyName);
    } else {
      onSave(blob, copyName);
    }
  };

  const handleManualRegionChange = (key: 'start' | 'end', value: number) => {
    if (!activeRegion) return;
    if (key === 'start') {
      const newStart = Math.max(0, Math.min(value, activeRegion.end - 0.05));
      activeRegion.setOptions({ start: newStart });
      setActiveRegion({ ...activeRegion, start: newStart } as any);
    } else {
      const newEnd = Math.min(totalDuration, Math.max(value, activeRegion.start + 0.05));
      activeRegion.setOptions({ end: newEnd });
      setActiveRegion({ ...activeRegion, end: newEnd } as any);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 p-4 md:p-6 max-w-6xl mx-auto w-full">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sky-500/10 border border-sky-500/20 rounded-xl flex items-center justify-center text-sky-400">
            <Scissors size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="text-lg font-bold text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:border-sky-500 focus:outline-none transition-colors px-1 py-0.5"
                placeholder="Track name..."
              />
            </div>
            <p className="text-xs text-slate-400">
              {history[historyIndex]?.action || 'Audio Editing Suite'}
            </p>
          </div>
        </div>

        {/* Undo / Redo & Save Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Undo (Ctrl/Cmd+Z)"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Redo (Ctrl/Cmd+Shift+Z)"
          >
            <Redo2 size={16} />
          </button>

          <div className="h-5 w-px bg-slate-800 mx-1"></div>

          <button
            onClick={handleDirectDownload}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-950 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors"
            title="Download Lossless WAV"
          >
            <FileDown size={15} />
            <span className="hidden md:inline">Export WAV</span>
          </button>

          <button
            onClick={handleSaveAsCopy}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-950 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors"
            title="Save as a new copy in Library"
          >
            <Plus size={15} />
            <span className="hidden md:inline">Save As Copy</span>
          </button>

          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-500 hover:bg-sky-400 rounded-lg shadow-sm shadow-sky-500/20 transition-all"
          >
            <Save size={15} />
            <span>Save to Library</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-1"
            title="Close Editor"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Waveform Display */}
      <div className="relative bg-slate-950 rounded-2xl border border-slate-800 p-5 shadow-inner mb-4 flex flex-col justify-center min-h-[220px]">
        {loading && (
          <div className="absolute inset-0 bg-slate-950/80 z-20 flex flex-col items-center justify-center backdrop-blur-xs">
            <div className="w-10 h-10 border-3 border-sky-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-xs text-sky-400 font-medium">Processing Audio Waveform...</p>
          </div>
        )}

        {/* WaveSurfer Container */}
        <div ref={containerRef} className="w-full" />
        <div ref={timelineRef} className="w-full mt-2" />

        {/* Zoom & View Controls Overlay */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/80 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ZoomOut size={14} />
            <input
              type="range"
              min="20"
              max="250"
              value={zoomLevel}
              onChange={(e) => setZoomLevel(Number(e.target.value))}
              className="w-24 md:w-32 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
            />
            <ZoomIn size={14} />
            <span className="font-mono text-[10px] text-slate-500">{zoomLevel} px/s</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                isLooping ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'hover:bg-slate-900 text-slate-400'
              }`}
            >
              <Repeat size={13} />
              <span>Loop Region</span>
            </button>

            <button
              onClick={() => setShowShortcuts(true)}
              className="flex items-center gap-1 hover:text-slate-200"
            >
              <HelpCircle size={14} />
              <span className="hidden sm:inline">Shortcuts</span>
            </button>
          </div>
        </div>
      </div>

      {/* Digital Time & Selection Indicator */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 mb-4 flex flex-wrap items-center justify-between gap-4">
        {activeRegion ? (
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-pink-400"></span>
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">Region:</span>
              <div className="flex items-center gap-1 font-mono">
                <input
                  type="number"
                  step="0.01"
                  value={Number(activeRegion.start.toFixed(2))}
                  onChange={(e) => handleManualRegionChange('start', Number(e.target.value))}
                  className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-center text-pink-300 focus:outline-none focus:border-pink-500"
                />
                <span className="text-slate-600">to</span>
                <input
                  type="number"
                  step="0.01"
                  value={Number(activeRegion.end.toFixed(2))}
                  onChange={(e) => handleManualRegionChange('end', Number(e.target.value))}
                  className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-center text-pink-300 focus:outline-none focus:border-pink-500"
                />
                <span className="text-slate-500 ml-1">
                  (Duration: {formatTimePrecise(activeRegion.end - activeRegion.start)})
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                regionsPlugin.current?.clearRegions();
                setActiveRegion(null);
              }}
              className="text-[11px] text-slate-500 hover:text-slate-300 underline"
            >
              Clear Selection
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-xs">
            <Clock size={15} className="text-sky-400" />
            <div className="font-mono text-sm">
              <span className="text-white font-bold">{formatTimePrecise(currentTime)}</span>
              <span className="text-slate-600 mx-1.5">/</span>
              <span className="text-slate-400">{formatTimePrecise(totalDuration)}</span>
            </div>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              (Drag on waveform to select a region)
            </span>
          </div>
        )}

        {/* Playback Rate & Volume */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1 text-slate-400">
            <span>Speed:</span>
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
              <button
                key={rate}
                onClick={() => setPlaybackRate(rate)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                  playbackRate === rate ? 'bg-sky-500 text-white font-bold' : 'hover:bg-slate-800 text-slate-400'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-800"></div>

          <div className="flex items-center gap-1.5 text-slate-400">
            <button onClick={() => setIsMuted(!isMuted)} className="hover:text-white">
              {isMuted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(Number(e.target.value));
                if (isMuted) setIsMuted(false);
              }}
              className="w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Editing Toolbar Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* 1. Playback Transport */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-center gap-3">
          <button
            onClick={() => wavesurfer.current?.stop()}
            className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-colors"
            title="Stop & Return to Start"
          >
            <RotateCcw size={16} />
          </button>
          <button
            onClick={() => wavesurfer.current?.playPause()}
            className="w-11 h-11 rounded-full bg-sky-500 hover:bg-sky-400 text-white flex items-center justify-center shadow-md shadow-sky-500/20 transition-all active:scale-95"
            title="Play/Pause (Space)"
          >
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
          </button>
        </div>

        {/* 2. Selection Cuts & Trims */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-around gap-2">
          <button
            onClick={handleTrim}
            disabled={!activeRegion}
            className="flex flex-col items-center gap-1 p-1.5 text-xs text-sky-400 hover:text-sky-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-900 rounded-lg transition-colors"
            title="Trim: Keep selected region and remove everything else (T)"
          >
            <Scissors size={16} className="rotate-90" />
            <span className="font-semibold text-[11px]">Trim</span>
          </button>

          <div className="w-px h-6 bg-slate-800"></div>

          <button
            onClick={handleCut}
            disabled={!activeRegion}
            className="flex flex-col items-center gap-1 p-1.5 text-xs text-rose-400 hover:text-rose-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-900 rounded-lg transition-colors"
            title="Cut: Delete selected region (Del/Backspace)"
          >
            <Scissors size={16} />
            <span className="font-semibold text-[11px]">Cut</span>
          </button>

          <div className="w-px h-6 bg-slate-800"></div>

          <button
            onClick={handleSilence}
            disabled={!activeRegion}
            className="flex flex-col items-center gap-1 p-1.5 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-900 rounded-lg transition-colors"
            title="Mute/Silence selected region"
          >
            <VolumeX size={16} />
            <span className="font-semibold text-[11px]">Silence</span>
          </button>
        </div>

        {/* 3. Fades & Dynamics */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-around gap-2">
          <div className="flex flex-col items-center">
            <button
              onClick={handleFadeIn}
              className="px-2.5 py-1 text-[11px] font-semibold text-emerald-400 hover:bg-slate-900 rounded-md transition-colors"
              title={`Fade in smoothly over ${fadeDuration}s`}
            >
              Fade In
            </button>
            <button
              onClick={handleFadeOut}
              className="px-2.5 py-1 text-[11px] font-semibold text-amber-400 hover:bg-slate-900 rounded-md transition-colors"
              title={`Fade out smoothly over ${fadeDuration}s`}
            >
              Fade Out
            </button>
          </div>

          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-slate-500">Duration:</span>
            <select
              value={fadeDuration}
              onChange={(e) => setFadeDuration(Number(e.target.value))}
              className="bg-slate-900 border border-slate-800 text-[10px] text-slate-300 rounded px-1.5 py-0.5 focus:outline-none"
            >
              <option value={0.25}>0.25s</option>
              <option value={0.5}>0.5s</option>
              <option value={1.0}>1.0s</option>
              <option value={2.0}>2.0s</option>
            </select>
          </div>
        </div>

        {/* 4. Normalization & Special Audio FX */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-around gap-2">
          <button
            onClick={handleNormalize}
            className="flex flex-col items-center gap-1 p-1.5 text-xs text-sky-400 hover:text-sky-300 hover:bg-slate-900 rounded-lg transition-colors"
            title="Normalize Peak: Maximize volume without distortion"
          >
            <Sparkles size={16} />
            <span className="font-semibold text-[11px]">Normalize</span>
          </button>

          <div className="w-px h-6 bg-slate-800"></div>

          <button
            onClick={() => setShowGainModal(true)}
            className="flex flex-col items-center gap-1 p-1.5 text-xs text-purple-400 hover:text-purple-300 hover:bg-slate-900 rounded-lg transition-colors"
            title="Adjust Gain / Volume level"
          >
            <Sliders size={16} />
            <span className="font-semibold text-[11px]">Gain +/-</span>
          </button>

          <div className="w-px h-6 bg-slate-800"></div>

          <button
            onClick={handleReverse}
            className="flex flex-col items-center gap-1 p-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg transition-colors"
            title="Reverse Audio"
          >
            <ArrowDownUp size={16} />
            <span className="font-semibold text-[11px]">Reverse</span>
          </button>
        </div>
      </div>

      {/* Gain Adjustment Modal */}
      {showGainModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders size={18} className="text-purple-400" />
                Adjust Audio Gain
              </h3>
              <button
                onClick={() => setShowGainModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-6">
              Boost or attenuate audio volume {activeRegion ? 'for selected region' : 'for entire track'}:
            </p>

            <div className="grid grid-cols-2 gap-2 mb-6">
              <button
                onClick={() => handleGainApply(1.41, '+3 dB')}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
              >
                +3 dB (Boost 40%)
              </button>
              <button
                onClick={() => handleGainApply(2.0, '+6 dB')}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
              >
                +6 dB (2x Louder)
              </button>
              <button
                onClick={() => handleGainApply(0.71, '-3 dB')}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
              >
                -3 dB (Quieter)
              </button>
              <button
                onClick={() => handleGainApply(0.5, '-6 dB')}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
              >
                -6 dB (Half Volume)
              </button>
            </div>

            <button
              onClick={() => setShowGainModal(false)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Sheet */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Studio Keyboard Shortcuts</h3>
              <button onClick={() => setShowShortcuts(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span>Play / Pause</span>
                <kbd className="bg-slate-800 px-2 py-0.5 rounded font-mono text-sky-400">Space</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span>Undo change</span>
                <kbd className="bg-slate-800 px-2 py-0.5 rounded font-mono text-sky-400">Ctrl / Cmd + Z</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span>Redo change</span>
                <kbd className="bg-slate-800 px-2 py-0.5 rounded font-mono text-sky-400">Ctrl + Shift + Z / Cmd + Y</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span>Trim selected region</span>
                <kbd className="bg-slate-800 px-2 py-0.5 rounded font-mono text-sky-400">T</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span>Cut selected region</span>
                <kbd className="bg-slate-800 px-2 py-0.5 rounded font-mono text-sky-400">Del / Backspace</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span>Deselect region</span>
                <kbd className="bg-slate-800 px-2 py-0.5 rounded font-mono text-sky-400">Escape</kbd>
              </div>
            </div>

            <button
              onClick={() => setShowShortcuts(false)}
              className="w-full mt-6 py-2.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-semibold"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Editor;
