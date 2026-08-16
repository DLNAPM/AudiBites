import React, { useState, useRef, useEffect } from 'react';
import { AudioTrack } from '../types';
import {
  Play,
  Pause,
  Download,
  Trash2,
  Clock,
  Music,
  Share2,
  Upload,
  Scissors,
  Search,
  Filter,
  Copy,
  Edit2,
  Check,
  X,
  Volume2,
  Sparkles,
  Layers,
  HardDrive,
  SlidersHorizontal,
  FileText,
} from 'lucide-react';
import { formatTime, formatTimePrecise, formatFileSize, createSampleTrack } from '../utils/audioUtils';

interface LibraryProps {
  tracks: AudioTrack[];
  onDelete: (id: string) => void;
  onBulkDelete?: (ids: string[]) => void;
  onEdit: (track: AudioTrack) => void;
  onUpload: (file: File) => void;
  onDuplicate?: (track: AudioTrack) => void;
  onRename?: (id: string, newName: string) => void;
  onAddSample?: (track: AudioTrack) => void;
  onTranscribe?: (track: AudioTrack) => void;
  onUploadAndTranscribe?: (file: File) => void;
}

const Library: React.FC<LibraryProps> = ({
  tracks,
  onDelete,
  onBulkDelete,
  onEdit,
  onUpload,
  onDuplicate,
  onRename,
  onAddSample,
  onTranscribe,
  onUploadAndTranscribe,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'longest' | 'shortest' | 'name'>('newest');

  // Active audio player
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Renaming state
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [newNameVal, setNewNameVal] = useState('');

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAndTranscribeInputRef = useRef<HTMLInputElement>(null);

  // Audio playback handler
  const handlePlay = (track: AudioTrack) => {
    if (playingId === track.id) {
      if (audioRef.current) {
        if (audioRef.current.paused) {
          audioRef.current.play();
        } else {
          audioRef.current.pause();
          setPlayingId(null);
        }
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(URL.createObjectURL(track.blob));
      audioRef.current = audio;
      setPlayingId(track.id);

      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime);
      };
      audio.onloadedmetadata = () => {
        setAudioDuration(audio.duration);
      };
      audio.onended = () => {
        setPlayingId(null);
        setCurrentTime(0);
      };

      audio.play().catch((err) => {
        console.warn('Playback error:', err);
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleDownload = async (track: AudioTrack) => {
    const cleanName = track.name.replace(/[\\/:*?"<>|]/g, '_');
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: `${cleanName}.wav`,
          types: [
            {
              description: 'WAV Audio File',
              accept: { 'audio/wav': ['.wav'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(track.blob);
        await writable.close();
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    const url = URL.createObjectURL(track.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanName}.wav`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  };

  const handleShare = async (track: AudioTrack) => {
    const file = new File([track.blob], `${track.name}.wav`, { type: 'audio/wav' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: track.name,
          text: `Check out this audio clip: ${track.name}`,
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Error sharing:', err);
        }
      }
    } else {
      handleDownload(track);
    }
  };

  const handleStartRename = (track: AudioTrack) => {
    setEditingNameId(track.id);
    setNewNameVal(track.name);
  };

  const handleSaveRename = (id: string) => {
    if (newNameVal.trim() && onRename) {
      onRename(id, newNameVal.trim());
    }
    setEditingNameId(null);
  };

  const handleSelectToggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredTracks.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTracks.map((t) => t.id));
    }
  };

  const handleGenerateSample = async (style: 'chime' | 'pulse' | 'ambient') => {
    if (!onAddSample) return;
    const sample = await createSampleTrack(style);
    const newTrack: AudioTrack = {
      id: crypto.randomUUID(),
      name: sample.name,
      blob: sample.blob,
      createdAt: Date.now(),
      duration: sample.duration,
      source: 'sample',
      size: sample.blob.size,
    };
    onAddSample(newTrack);
  };

  // Filter & Sort logic
  const filteredTracks = tracks.filter((track) => {
    const matchesSearch =
      track.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (track.transcription && track.transcription.toLowerCase().includes(searchQuery.toLowerCase()));
    
    let matchesSource = true;
    if (filterSource === 'transcribed') {
      matchesSource = !!track.transcription;
    } else if (filterSource !== 'ALL') {
      matchesSource = track.source === filterSource;
    }
    return matchesSearch && matchesSource;
  });

  filteredTracks.sort((a, b) => {
    if (sortBy === 'newest') return b.createdAt - a.createdAt;
    if (sortBy === 'oldest') return a.createdAt - b.createdAt;
    if (sortBy === 'longest') return b.duration - a.duration;
    if (sortBy === 'shortest') return a.duration - b.duration;
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return 0;
  });

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Audio Library</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'} stored locally
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Demo Sound Generator Dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-950 hover:bg-slate-850 text-sky-400 rounded-xl border border-slate-800 text-xs font-semibold shadow-xs transition-colors">
              <Sparkles size={14} />
              <span>Generate Demo</span>
            </button>
            <div className="absolute right-0 mt-1 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-xl p-1 z-30 hidden group-hover:block">
              <button
                onClick={() => handleGenerateSample('chime')}
                className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                🔔 Crystal Chimes
              </button>
              <button
                onClick={() => handleGenerateSample('pulse')}
                className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                ⚡ Synth Pulse
              </button>
              <button
                onClick={() => handleGenerateSample('ambient')}
                className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                🌌 Ambient Drone
              </button>
            </div>
          </div>

          {/* Upload & Transcribe Direct Action */}
          <button
            onClick={() => uploadAndTranscribeInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-950 hover:bg-slate-850 text-purple-400 hover:text-purple-300 border border-purple-500/30 rounded-xl text-xs font-semibold shadow-xs transition-colors"
            title="Upload an audio file and transcribe it immediately to text"
          >
            <FileText size={14} />
            <span>Upload & Transcribe</span>
          </button>
          <input
            type="file"
            ref={uploadAndTranscribeInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                if (onUploadAndTranscribe) {
                  onUploadAndTranscribe(e.target.files[0]);
                } else {
                  onUpload(e.target.files[0]);
                }
              }
            }}
            className="hidden"
            accept="audio/*,video/*"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-semibold shadow-sm shadow-sky-500/20 transition-all"
          >
            <Upload size={14} />
            <span>Upload File</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onUpload(e.target.files[0]);
              }
            }}
            className="hidden"
            accept="audio/*,video/*"
          />
        </div>
      </div>

      {/* Search, Filter, Sort, & Bulk Bar */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-6 space-y-4 shadow-xs">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search audio clips or transcribed text..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Source Filter */}
          <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {['ALL', 'recording', 'upload', 'edited', 'sample', 'transcribed'].map((src) => (
              <button
                key={src}
                onClick={() => setFilterSource(src)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase tracking-wider transition-colors whitespace-nowrap ${
                  filterSource === src
                    ? 'bg-slate-800 text-sky-400 border border-sky-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {src === 'ALL' ? 'All' : src === 'transcribed' ? '📝 Transcribed' : src}
              </button>
            ))}
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-500 hidden sm:inline">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-900 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="longest">Longest Duration</option>
              <option value="shortest">Shortest Duration</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Bulk Action Controls */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">{selectedIds.length}</span>
              <span>selected</span>
            </div>
            <div className="flex items-center gap-2">
              {onBulkDelete && (
                <button
                  onClick={() => {
                    onBulkDelete(selectedIds);
                    setSelectedIds([]);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg transition-colors font-medium"
                >
                  <Trash2 size={13} />
                  <span>Delete Selected</span>
                </button>
              )}
              <button
                onClick={() => setSelectedIds([])}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-lg border border-slate-800 transition-colors"
              >
                Deselect All
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tracks Grid */}
      {filteredTracks.length === 0 ? (
        <div className="bg-slate-950/40 border-2 border-dashed border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
          <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-slate-600 mb-3 border border-slate-800">
            <Music size={28} />
          </div>
          <h3 className="text-base font-bold text-white mb-1">
            {tracks.length === 0 ? 'Your library is empty' : 'No matching audio tracks found'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
            {tracks.length === 0
              ? 'Record new audio clips, upload files, or generate crystal audio samples to start building your library.'
              : 'Try clearing the search query or changing the filter options above.'}
          </p>

          {tracks.length === 0 && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => handleGenerateSample('chime')}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-sky-400 border border-slate-800 rounded-xl text-xs font-semibold transition-colors"
              >
                ✨ Load Demo Sample
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
              >
                Upload File
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTracks.map((track) => {
            const isPlaying = playingId === track.id;
            const isSelected = selectedIds.includes(track.id);

            return (
              <div
                key={track.id}
                className={`group bg-slate-950/80 rounded-2xl p-5 border transition-all shadow-md flex flex-col justify-between ${
                  isSelected
                    ? 'border-sky-500 bg-sky-500/5'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Header & Source Tag */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectToggle(track.id)}
                        className="rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-0 cursor-pointer"
                      />
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          track.source === 'recording'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : track.source === 'edited'
                            ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                            : track.source === 'upload'
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {track.source}
                      </span>
                    </div>

                    {/* Quick Card Actions */}
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      {onTranscribe && (
                        <button
                          onClick={() => onTranscribe(track)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            track.transcription
                              ? 'text-purple-400 hover:text-purple-300 hover:bg-purple-500/10'
                              : 'text-slate-400 hover:text-purple-400 hover:bg-slate-900'
                          }`}
                          title={track.transcription ? 'View Saved Transcript' : 'Transcribe Audio with AI'}
                        >
                          <FileText size={15} />
                        </button>
                      )}

                      <button
                        onClick={() => onEdit(track)}
                        className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-900 rounded-lg transition-colors"
                        title="Open in Studio Editor"
                      >
                        <Scissors size={15} />
                      </button>

                      {onDuplicate && (
                        <button
                          onClick={() => onDuplicate(track)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-colors"
                          title="Duplicate Track"
                        >
                          <Copy size={14} />
                        </button>
                      )}

                      <button
                        onClick={() => onDelete(track.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded-lg transition-colors"
                        title="Delete Track"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Title & Renaming */}
                  {editingNameId === track.id ? (
                    <div className="flex items-center gap-1 mb-2">
                      <input
                        type="text"
                        value={newNameVal}
                        onChange={(e) => setNewNameVal(e.target.value)}
                        className="flex-1 bg-slate-900 border border-sky-500 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(track.id);
                          if (e.key === 'Escape') setEditingNameId(null);
                        }}
                      />
                      <button
                        onClick={() => handleSaveRename(track.id)}
                        className="p-1 text-emerald-400 hover:bg-slate-800 rounded"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setEditingNameId(null)}
                        className="p-1 text-slate-400 hover:bg-slate-800 rounded"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3
                        className="text-sm font-bold text-white truncate cursor-pointer hover:text-sky-400 transition-colors"
                        title={track.name}
                        onClick={() => handleStartRename(track)}
                      >
                        {track.name}
                      </h3>
                      <button
                        onClick={() => handleStartRename(track)}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300 p-0.5 transition-opacity"
                        title="Rename"
                      >
                        <Edit2 size={12} />
                      </button>
                    </div>
                  )}

                  {/* Metadata Chips & Transcript Indicator */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mb-4 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock size={11} className="text-slate-500" />
                      {formatTime(track.duration || 0)}
                    </span>
                    <span>•</span>
                    <span>{formatFileSize(track.size || track.blob.size)}</span>
                    {track.transcription && (
                      <>
                        <span>•</span>
                        <button
                          onClick={() => onTranscribe?.(track)}
                          className="flex items-center gap-1 text-purple-400 hover:text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 text-[10px] font-sans font-medium"
                        >
                          <FileText size={10} />
                          <span>Transcript</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Inline Player & Playback Seeker */}
                <div className="pt-3 border-t border-slate-800/80 space-y-3">
                  {isPlaying && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-slate-400">
                        <span>{formatTimePrecise(currentTime)}</span>
                        <span>{formatTimePrecise(audioDuration || track.duration)}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={audioDuration || track.duration || 1}
                        step="0.05"
                        value={currentTime}
                        onChange={handleSeek}
                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePlay(track)}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-semibold text-xs transition-all ${
                          isPlaying
                            ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/30'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800'
                        }`}
                      >
                        {isPlaying ? (
                          <Pause size={14} fill="currentColor" />
                        ) : (
                          <Play size={14} fill="currentColor" className="ml-0.5" />
                        )}
                        <span>{isPlaying ? 'Pause' : 'Play'}</span>
                      </button>

                      {onTranscribe && (
                        <button
                          onClick={() => onTranscribe(track)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-purple-400 hover:text-purple-300 border border-purple-500/30 transition-colors"
                          title="Transcribe Audio to Text"
                        >
                          <FileText size={13} />
                          <span>{track.transcription ? 'Transcript' : 'Transcribe'}</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDownload(track)}
                        className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-900 rounded-lg border border-transparent hover:border-slate-800 transition-colors"
                        title="Download WAV"
                      >
                        <Download size={15} />
                      </button>
                      <button
                        onClick={() => handleShare(track)}
                        className="p-1.5 text-slate-400 hover:text-pink-400 hover:bg-slate-900 rounded-lg border border-transparent hover:border-slate-800 transition-colors"
                        title="Share Audio Clip"
                      >
                        <Share2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Library;
