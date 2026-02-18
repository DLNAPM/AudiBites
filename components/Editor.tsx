import React, { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { Region } from 'wavesurfer.js/dist/plugins/regions.esm.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js';
import { Play, Pause, Scissors, Save, RotateCcw, Download, X } from 'lucide-react';
import { AudioTrack } from '../types';
import { bufferToWav, sliceAudioBuffer, cutAudioBuffer, formatTimePrecise } from '../utils/audioUtils';

interface EditorProps {
  initialBlob: Blob | null;
  initialName?: string;
  onClose: () => void;
  onSave: (blob: Blob, name: string) => void;
}

const Editor: React.FC<EditorProps> = ({ initialBlob, initialName, onClose, onSave }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const regionsPlugin = useRef<RegionsPlugin | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeRegion, setActiveRegion] = useState<Region | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [fileName, setFileName] = useState(initialName || "Edited Audio");
  const [loading, setLoading] = useState(true);
  
  // Timer States
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!containerRef.current || !initialBlob || !timelineRef.current) return;

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    setAudioContext(ctx);

    // Decode audio data immediately once (Fix for bug where edits were lost)
    initialBlob.arrayBuffer().then(arrayBuffer => {
      ctx.decodeAudioData(arrayBuffer).then(decodedBuffer => {
        setAudioBuffer(decodedBuffer);
      });
    });

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#38bdf8',
      progressColor: '#0ea5e9',
      cursorColor: '#f472b6',
      barWidth: 2,
      barGap: 3,
      barRadius: 3,
      height: 128,
      normalize: true,
      minPxPerSec: 50,
      url: URL.createObjectURL(initialBlob),
    });

    // Register Plugins
    const regs = RegionsPlugin.create();
    const timeline = TimelinePlugin.create({
      container: timelineRef.current,
      height: 20,
      timeInterval: 0.5,
      primaryLabelInterval: 5,
      style: {
        fontSize: '10px',
        color: '#64748b',
      },
    });

    ws.registerPlugin(regs);
    ws.registerPlugin(timeline);

    regionsPlugin.current = regs;
    wavesurfer.current = ws;

    // Events
    ws.on('ready', () => {
      setLoading(false);
      setTotalDuration(ws.getDuration());
      // Note: We do NOT setAudioBuffer here anymore, as 'ready' fires after every loadBlob()
      // which happens after every edit, effectively undoing the edit if we used initialBlob here.
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    
    ws.on('timeupdate', (time) => {
      setCurrentTime(time);
    });
    
    ws.on('interaction', (time) => {
      setCurrentTime(time);
    });

    // Region Events
    regs.enableDragSelection({
      color: 'rgba(244, 114, 182, 0.2)', // Pink with opacity
    });

    regs.on('region-created', (region) => {
      // Remove other regions to keep it simple (single selection)
      regs.getRegions().forEach(r => {
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
      // Logic to loop or stop if needed, optional
    });

    // Clean up
    return () => {
      ws.destroy();
      ctx.close();
    };
  }, [initialBlob]);

  const togglePlay = () => {
    wavesurfer.current?.playPause();
  };

  const handleTrim = async () => {
    if (!activeRegion || !audioBuffer || !audioContext) return;
    
    setLoading(true);
    const newBuffer = sliceAudioBuffer(
      audioBuffer,
      activeRegion.start,
      activeRegion.end,
      audioContext
    );
    
    updateAudioFromBuffer(newBuffer);
  };

  const handleCut = async () => {
    if (!activeRegion || !audioBuffer || !audioContext) return;

    setLoading(true);
    const newBuffer = cutAudioBuffer(
      audioBuffer,
      activeRegion.start,
      activeRegion.end,
      audioContext
    );

    updateAudioFromBuffer(newBuffer);
  };

  const updateAudioFromBuffer = (newBuffer: AudioBuffer) => {
    setAudioBuffer(newBuffer);
    const newBlob = bufferToWav(newBuffer);
    
    // Reload WaveSurfer
    wavesurfer.current?.loadBlob(newBlob);
    regionsPlugin.current?.clearRegions();
    setActiveRegion(null);
    setLoading(false);
    
    // Reset timer
    setCurrentTime(0);
    // Duration will update on 'ready'
  };

  const handleSave = () => {
    if (!audioBuffer) return;
    const blob = bufferToWav(audioBuffer);
    // Use the filename from input, assume user will name it appropriately
    onSave(blob, fileName);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 p-6 w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Audio Studio</h2>
          <input 
            type="text" 
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            className="bg-transparent text-slate-400 border-b border-slate-700 focus:border-sky-500 outline-none w-64"
          />
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
          <X size={24} />
        </button>
      </div>

      {/* Main Editor Area */}
      <div className="bg-slate-800 rounded-2xl p-6 shadow-xl mb-6 flex-1 flex flex-col justify-center relative">
        {loading && (
          <div className="absolute inset-0 bg-slate-800/80 z-10 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
          </div>
        )}
        
        {/* Waveform Container */}
        <div ref={containerRef} className="w-full" />
        
        {/* Timeline Container */}
        <div ref={timelineRef} className="w-full mt-1" />
      </div>

      {/* Digital Timer Display */}
      <div className="text-center mb-6 font-mono h-16 flex items-center justify-center">
        {activeRegion ? (
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-200">
            <span className="text-xs text-pink-400 uppercase tracking-widest mb-1 font-semibold">Selection</span>
            <div className="text-2xl text-white font-bold">
              <span className="text-pink-300">{formatTimePrecise(activeRegion.start)}</span>
              <span className="mx-2 text-slate-600">-</span>
              <span className="text-pink-300">{formatTimePrecise(activeRegion.end)}</span>
            </div>
            <div className="text-sm text-slate-500 mt-1">
              Duration: {formatTimePrecise(activeRegion.end - activeRegion.start)}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
             <span className="text-xs text-sky-400 uppercase tracking-widest mb-1 font-semibold">Current Time</span>
             <div className="text-3xl font-bold text-white">
               {formatTimePrecise(currentTime)} <span className="text-slate-600 text-xl font-normal">/ {formatTimePrecise(totalDuration)}</span>
             </div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Playback Controls */}
        <div className="bg-slate-800 p-4 rounded-xl flex items-center justify-center gap-4">
          <button 
            onClick={() => wavesurfer.current?.stop()}
            className="p-3 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <RotateCcw size={20} />
          </button>
          <button 
            onClick={togglePlay}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isPlaying 
              ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/30' 
              : 'bg-sky-500 text-white shadow-lg shadow-sky-500/30'
            }`}
          >
            {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
          </button>
        </div>

        {/* Edit Tools */}
        <div className="bg-slate-800 p-4 rounded-xl flex items-center justify-center gap-4">
          <button 
            onClick={handleTrim}
            disabled={!activeRegion}
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 text-sky-400"
          >
            <Scissors size={20} className="rotate-90" />
            <span>Trim (Keep)</span>
          </button>
          <div className="w-px h-8 bg-slate-700"></div>
          <button 
             onClick={handleCut}
             disabled={!activeRegion}
             className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 text-pink-400"
          >
            <Scissors size={20} />
            <span>Cut (Remove)</span>
          </button>
        </div>

        {/* Actions */}
        <div className="bg-slate-800 p-4 rounded-xl flex items-center justify-center gap-4">
          <button 
             onClick={handleSave}
             className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium shadow-md transition-colors"
          >
            <Save size={18} />
            <span>Save to Library</span>
          </button>
        </div>
      </div>
      
      <div className="mt-4 text-center text-slate-500 text-sm">
        <p>Tip: Drag on the waveform to select a region to Edit.</p>
      </div>
    </div>
  );
};

export default Editor;