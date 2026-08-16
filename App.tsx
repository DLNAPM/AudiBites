import React, { useState, useEffect } from 'react';
import { Mic, ListMusic, Scissors, HelpCircle, Plus, Music2, Sparkles, Check } from 'lucide-react';
import Recorder from './components/Recorder';
import Library from './components/Library';
import Editor from './components/Editor';
import Help from './components/Help';
import { AppView, AudioTrack } from './types';
import { APP_NAME } from './constants';
import {
  getAllTracksFromStorage,
  saveTrackToStorage,
  deleteTrackFromStorage,
  updateTrackInStorage,
} from './utils/storage';
import { getAudioMetadata, createSampleTrack } from './utils/audioUtils';

interface ToastNotification {
  id: string;
  message: string;
  type?: 'success' | 'info';
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.LIBRARY);
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [editingTrack, setEditingTrack] = useState<AudioTrack | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load tracks from IndexedDB on startup
  useEffect(() => {
    async function loadData() {
      try {
        const storedTracks = await getAllTracksFromStorage();
        if (storedTracks && storedTracks.length > 0) {
          setTracks(storedTracks);
        } else {
          // Initialize with a melodic starter demo track if empty
          const sample = await createSampleTrack('chime');
          const starterTrack: AudioTrack = {
            id: crypto.randomUUID(),
            name: sample.name,
            blob: sample.blob,
            createdAt: Date.now(),
            duration: sample.duration,
            source: 'sample',
            size: sample.blob.size,
          };
          await saveTrackToStorage(starterTrack);
          setTracks([starterTrack]);
        }
      } catch (err) {
        console.warn('Failed to read from IndexedDB storage:', err);
      } finally {
        setIsLoaded(true);
      }
    }

    loadData();
  }, []);

  // Toast notification helper
  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  };

  // Add new track with real metadata calculation
  const addTrack = async (
    blob: Blob,
    name: string,
    source: AudioTrack['source'],
    providedDuration?: number
  ) => {
    let duration = providedDuration || 0;
    let sampleRate = 44100;
    let channels = 2;

    if (!duration || duration <= 0) {
      const meta = await getAudioMetadata(blob);
      duration = meta.duration;
      sampleRate = meta.sampleRate;
      channels = meta.channels;
    }

    const newTrack: AudioTrack = {
      id: crypto.randomUUID(),
      name: name.trim() || `Audio_${Date.now()}`,
      blob,
      createdAt: Date.now(),
      duration,
      source,
      size: blob.size,
      sampleRate,
      channels,
    };

    setTracks((prev) => [newTrack, ...prev]);
    await saveTrackToStorage(newTrack);
    setCurrentView(AppView.LIBRARY);
    showToast(`"${newTrack.name}" added to Library`);
  };

  // Delete track
  const deleteTrack = async (id: string) => {
    const track = tracks.find((t) => t.id === id);
    setTracks((prev) => prev.filter((t) => t.id !== id));
    await deleteTrackFromStorage(id);
    if (track) {
      showToast(`"${track.name}" deleted`);
    }
  };

  // Bulk delete tracks
  const bulkDeleteTracks = async (ids: string[]) => {
    setTracks((prev) => prev.filter((t) => !ids.includes(t.id)));
    for (const id of ids) {
      await deleteTrackFromStorage(id);
    }
    showToast(`${ids.length} tracks deleted`);
  };

  // Duplicate track
  const duplicateTrack = async (track: AudioTrack) => {
    const newTrack: AudioTrack = {
      ...track,
      id: crypto.randomUUID(),
      name: `${track.name} (Copy)`,
      createdAt: Date.now(),
    };
    setTracks((prev) => [newTrack, ...prev]);
    await saveTrackToStorage(newTrack);
    showToast(`Created copy of "${track.name}"`);
  };

  // Rename track
  const renameTrack = async (id: string, newName: string) => {
    const target = tracks.find((t) => t.id === id);
    if (!target) return;
    const updated = { ...target, name: newName };
    setTracks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    await updateTrackInStorage(updated);
    showToast(`Renamed to "${newName}"`);
  };

  // Open audio studio editor
  const startEditing = (track: AudioTrack) => {
    setEditingTrack(track);
    setCurrentView(AppView.EDITOR);
  };

  // Save changes from editor (overwriting current track entry)
  const handleEditorSave = async (blob: Blob, name: string) => {
    if (editingTrack) {
      const meta = await getAudioMetadata(blob);
      const updated: AudioTrack = {
        ...editingTrack,
        name,
        blob,
        duration: meta.duration > 0 ? meta.duration : editingTrack.duration,
        size: blob.size,
        source: 'edited',
      };
      setTracks((prev) => prev.map((t) => (t.id === editingTrack.id ? updated : t)));
      await updateTrackInStorage(updated);
      showToast(`Saved changes to "${name}"`);
    } else {
      await addTrack(blob, name, 'edited');
    }
    setEditingTrack(null);
    setCurrentView(AppView.LIBRARY);
  };

  // Save as new copy from editor
  const handleEditorSaveAsCopy = async (blob: Blob, name: string) => {
    await addTrack(blob, name, 'edited');
    setEditingTrack(null);
    setCurrentView(AppView.LIBRARY);
  };

  // Upload handler
  const handleFileUpload = async (file: File) => {
    const blob = new Blob([file], { type: file.type || 'audio/wav' });
    const name = file.name.replace(/\.[^/.]+$/, '');
    await addTrack(blob, name, 'upload');
  };

  // Direct transition from Recorder to Editor
  const handleOpenRecordedInEditor = async (blob: Blob, name: string) => {
    const meta = await getAudioMetadata(blob);
    const tempTrack: AudioTrack = {
      id: crypto.randomUUID(),
      name,
      blob,
      createdAt: Date.now(),
      duration: meta.duration,
      source: 'recording',
      size: blob.size,
    };
    // Save to tracks first
    setTracks((prev) => [tempTrack, ...prev]);
    await saveTrackToStorage(tempTrack);
    setEditingTrack(tempTrack);
    setCurrentView(AppView.EDITOR);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col selection:bg-sky-500/30">
      {/* Universal Top Bar Contract: [Brand title] — [Nav links] — [Primary action] */}
      <header className="h-16 bg-slate-950 border-b border-slate-800 px-4 md:px-8 flex items-center justify-between sticky top-0 z-40">
        {/* Brand Title Zone */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-sky-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-sky-500/20">
            <Music2 size={20} />
          </div>
          <span className="text-xl font-bold tracking-tight text-white whitespace-nowrap">
            {APP_NAME}
          </span>
        </div>

        {/* Navigation Zone */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => {
              setEditingTrack(null);
              setCurrentView(AppView.LIBRARY);
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              currentView === AppView.LIBRARY
                ? 'bg-slate-800 text-sky-400 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <ListMusic size={15} />
            <span className="hidden sm:inline">Library</span>
          </button>

          <button
            onClick={() => {
              setEditingTrack(null);
              setCurrentView(AppView.RECORDER);
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              currentView === AppView.RECORDER
                ? 'bg-slate-800 text-sky-400 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Mic size={15} />
            <span className="hidden sm:inline">Recorder</span>
          </button>

          {editingTrack && (
            <button
              onClick={() => setCurrentView(AppView.EDITOR)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                currentView === AppView.EDITOR
                  ? 'bg-slate-800 text-pink-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Scissors size={15} />
              <span className="hidden sm:inline">Studio</span>
            </button>
          )}

          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors whitespace-nowrap"
          >
            <HelpCircle size={15} />
            <span className="hidden md:inline">Help</span>
          </button>
        </nav>

        {/* Primary Action Zone */}
        <div className="flex items-center gap-2">
          {currentView !== AppView.RECORDER ? (
            <button
              onClick={() => {
                setEditingTrack(null);
                setCurrentView(AppView.RECORDER);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-semibold shadow-sm shadow-sky-500/20 transition-all whitespace-nowrap"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">New Recording</span>
              <span className="sm:hidden">Record</span>
            </button>
          ) : (
            <button
              onClick={() => setCurrentView(AppView.LIBRARY)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors whitespace-nowrap"
            >
              View Library
            </button>
          )}
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 overflow-y-auto">
        {currentView === AppView.RECORDER && (
          <Recorder
            onSave={(blob, name, source, dur) => addTrack(blob, name, source, dur)}
            onOpenInEditor={handleOpenRecordedInEditor}
            onCancel={() => setCurrentView(AppView.LIBRARY)}
          />
        )}

        {currentView === AppView.LIBRARY && (
          <Library
            tracks={tracks}
            onDelete={deleteTrack}
            onBulkDelete={bulkDeleteTracks}
            onEdit={startEditing}
            onUpload={handleFileUpload}
            onDuplicate={duplicateTrack}
            onRename={renameTrack}
            onAddSample={(sampleTrack) => {
              setTracks((prev) => [sampleTrack, ...prev]);
              saveTrackToStorage(sampleTrack);
              showToast(`Loaded "${sampleTrack.name}"`);
            }}
          />
        )}

        {currentView === AppView.EDITOR && editingTrack && (
          <Editor
            initialBlob={editingTrack.blob}
            initialName={editingTrack.name}
            onClose={() => {
              setEditingTrack(null);
              setCurrentView(AppView.LIBRARY);
            }}
            onSave={handleEditorSave}
            onSaveAsCopy={handleEditorSaveAsCopy}
          />
        )}
      </main>

      {/* Help Modal */}
      {showHelp && <Help onClose={() => setShowHelp(false)} />}

      {/* Toast Notification Stack */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex items-center gap-2.5 px-4 py-3 bg-slate-950 border border-slate-800 text-white text-xs font-medium rounded-xl shadow-2xl animate-in slide-in-from-bottom-3 duration-200 pointer-events-auto"
          >
            <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Check size={12} />
            </div>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
