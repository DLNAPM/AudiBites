import React from 'react';
import {
  X,
  Monitor,
  Smartphone,
  Scissors,
  Sparkles,
  CheckCircle2,
  Sliders,
  Keyboard,
  Info,
} from 'lucide-react';

interface HelpProps {
  onClose: () => void;
}

const Help: React.FC<HelpProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm">
              ?
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">AudiBites Studio Guide</h2>
              <p className="text-xs text-slate-400">Master audio recording, waveform trimming, and audio processing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 text-slate-300 text-xs">
          {/* Section 1: Recording System Audio & Tabs */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-sky-400 flex items-center gap-2">
              <Monitor size={16} />
              1. Capturing Music & Tab Audio (Spotify, YouTube, SoundCloud)
            </h3>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-semibold text-white text-xs">Chrome / Edge / Brave (Windows & Mac)</h4>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-400">
                  <li>Click <strong>System / Tab</strong> in the Recorder tab.</li>
                  <li>In the browser screen-picker popup, select the <strong>Chrome Tab</strong> (or Window) tab.</li>
                  <li>Check the toggle for <strong>"Share tab audio"</strong> at the bottom left.</li>
                  <li>Select the Spotify or YouTube tab and start recording!</li>
                </ol>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-semibold text-white text-xs">iPhone & iPad (iOS Direct Import)</h4>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-400">
                  <li>Swipe down from top right to open iOS <strong>Control Center</strong>.</li>
                  <li>Tap <strong>Screen Recording</strong> and switch to your music/video app.</li>
                  <li>When finished, stop screen recording (saved to Photos).</li>
                  <li>In AudiBites, click <strong>Import File</strong> to extract the pure audio.</li>
                </ol>
              </div>
            </div>
          </section>

          {/* Section 2: Audio Studio Editing Features */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-pink-400 flex items-center gap-2">
              <Scissors size={16} />
              2. Waveform Editing Suite
            </h3>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <h4 className="font-semibold text-white text-xs">Trim & Cut</h4>
                <p className="text-slate-400">
                  Drag on the waveform to select a region. Click <strong>Trim</strong> to keep only the selected snippet, or <strong>Cut</strong> to delete it.
                </p>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <h4 className="font-semibold text-white text-xs">Fade In & Fade Out</h4>
                <p className="text-slate-400">
                  Apply smooth volume transitions (0.25s to 2s) to prevent audio clicks and create studio-grade intros and outros.
                </p>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <h4 className="font-semibold text-white text-xs">Normalize & Gain</h4>
                <p className="text-slate-400">
                  <strong>Normalize</strong> maximizes loudness automatically without distortion. <strong>Gain +/-</strong> lets you boost or reduce volume in decibels.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: Keyboard Shortcuts */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-purple-400 flex items-center gap-2">
              <Keyboard size={16} />
              3. Studio Keyboard Shortcuts
            </h3>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-slate-400 block mb-0.5">Play / Pause</span>
                  <kbd className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded font-mono text-sky-400 text-[11px]">
                    Space
                  </kbd>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Undo Action</span>
                  <kbd className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded font-mono text-sky-400 text-[11px]">
                    Ctrl / Cmd + Z
                  </kbd>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Redo Action</span>
                  <kbd className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded font-mono text-sky-400 text-[11px]">
                    Ctrl + Shift + Z
                  </kbd>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Trim Selection</span>
                  <kbd className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded font-mono text-sky-400 text-[11px]">
                    T
                  </kbd>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Cut Selection</span>
                  <kbd className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded font-mono text-sky-400 text-[11px]">
                    Del / Backspace
                  </kbd>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Clear Selection</span>
                  <kbd className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded font-mono text-sky-400 text-[11px]">
                    Escape
                  </kbd>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-semibold shadow-xs transition-all"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};

export default Help;
