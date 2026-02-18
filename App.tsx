import React, { useState } from 'react';
import { Mic, ListMusic, Settings, Scissors, HelpCircle } from 'lucide-react';
import Recorder from './components/Recorder';
import Library from './components/Library';
import Editor from './components/Editor';
import Help from './components/Help';
import { AppView, AudioTrack } from './types';
import { APP_NAME } from './constants';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.LIBRARY);
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [editingTrack, setEditingTrack] = useState<AudioTrack | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // Helper to add track
  const addTrack = (blob: Blob, name: string, source: AudioTrack['source']) => {
    const newTrack: AudioTrack = {
      id: crypto.randomUUID(),
      name,
      blob,
      createdAt: Date.now(),
      duration: 0, // Would need metadata parsing to get real duration, skipping for brevity
      source
    };
    setTracks(prev => [newTrack, ...prev]);
    setCurrentView(AppView.LIBRARY);
  };

  const deleteTrack = (id: string) => {
    setTracks(prev => prev.filter(t => t.id !== id));
  };

  const startEditing = (track: AudioTrack) => {
    setEditingTrack(track);
    setCurrentView(AppView.EDITOR);
  };

  const handleEditorSave = (blob: Blob, name: string) => {
    addTrack(blob, name, 'edited');
  };

  const handleFileUpload = (file: File) => {
    const blob = new Blob([file], { type: file.type });
    // Strip extension
    const name = file.name.replace(/\.[^/.]+$/, "");
    addTrack(blob, name, 'upload');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex text-slate-100 font-sans selection:bg-pink-500/30">
      
      {/* Sidebar Navigation */}
      <nav className="w-20 lg:w-64 bg-slate-950 border-r border-slate-800 flex flex-col items-center lg:items-start py-6 fixed h-full z-50 transition-all">
        <div className="px-0 lg:px-6 mb-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-sky-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-sky-900/20">
             <Scissors size={24} className="text-white" />
          </div>
          <h1 className="hidden lg:block text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            {APP_NAME}
          </h1>
        </div>

        <div className="flex-1 w-full px-2 space-y-2">
          <NavButton 
            active={currentView === AppView.LIBRARY} 
            onClick={() => setCurrentView(AppView.LIBRARY)}
            icon={<ListMusic size={24} />}
            label="Library"
          />
          <NavButton 
            active={currentView === AppView.RECORDER} 
            onClick={() => setCurrentView(AppView.RECORDER)}
            icon={<Mic size={24} />}
            label="Recorder"
          />
        </div>

        {/* Bottom Actions */}
        <div className="w-full px-2 mt-auto space-y-4">
          <NavButton 
            active={showHelp} 
            onClick={() => setShowHelp(true)}
            icon={<HelpCircle size={24} />}
            label="Help & Tips"
          />
          
          <div className="hidden lg:block p-4 bg-slate-900 rounded-xl border border-slate-800">
            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Pro Tip</h4>
            <p className="text-xs text-slate-400">
              Use "System Audio" to record music directly from Spotify or YouTube tabs.
            </p>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 ml-20 lg:ml-64 relative overflow-y-auto h-screen">
        <div className="min-h-full flex flex-col">
          {currentView === AppView.RECORDER && (
            <Recorder 
              onSave={(blob, name) => addTrack(blob, name, 'recording')}
              onCancel={() => setCurrentView(AppView.LIBRARY)}
            />
          )}

          {currentView === AppView.LIBRARY && (
            <Library 
              tracks={tracks}
              onPlay={() => {}} 
              onDelete={deleteTrack}
              onEdit={startEditing}
              onUpload={handleFileUpload}
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
            />
          )}
        </div>
      </main>

      {/* Help Modal Overlay */}
      {showHelp && <Help onClose={() => setShowHelp(false)} />}
    </div>
  );
};

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-center lg:justify-start gap-3 px-3 py-3 rounded-xl transition-all ${
      active 
        ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' 
        : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
    }`}
  >
    {icon}
    <span className="hidden lg:block font-medium">{label}</span>
  </button>
);

export default App;