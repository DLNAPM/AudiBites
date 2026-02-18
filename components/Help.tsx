import React from 'react';
import { X, Monitor, Smartphone, Scissors, FileAudio, CheckCircle2 } from 'lucide-react';

interface HelpProps {
  onClose: () => void;
}

const Help: React.FC<HelpProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 sticky top-0 bg-slate-900/95 backdrop-blur z-10">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="bg-sky-500 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-lg shadow-sky-500/20">?</span>
            How to use AudiBites
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 space-y-8">
          {/* Section 1: Recording Source */}
          <section>
            <h3 className="text-xl font-semibold text-sky-400 mb-4 flex items-center gap-2">
              <Monitor size={20} /> Recording Audio Sources
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700/50">
                <h4 className="font-bold text-white mb-3 text-lg">Windows PC</h4>
                <ul className="space-y-3">
                  <li className="flex gap-3 text-slate-400 text-sm">
                    <span className="bg-slate-700 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">1</span>
                    <span>Click <strong>System / Tab</strong> in the Recorder.</span>
                  </li>
                  <li className="flex gap-3 text-slate-400 text-sm">
                    <span className="bg-slate-700 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">2</span>
                    <span>Select "Entire Screen" or a specific "Tab".</span>
                  </li>
                  <li className="flex gap-3 text-slate-300 text-sm font-medium bg-sky-500/10 p-2 rounded-lg border border-sky-500/20">
                    <CheckCircle2 size={16} className="text-sky-500 flex-shrink-0 mt-0.5" />
                    <span>Important: Check the "Share System Audio" box in the browser popup.</span>
                  </li>
                </ul>
              </div>
              <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700/50">
                <h4 className="font-bold text-white mb-3 text-lg">MacOS</h4>
                <ul className="space-y-3">
                  <li className="flex gap-3 text-slate-400 text-sm">
                    <span className="bg-slate-700 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">1</span>
                    <span>Click <strong>System / Tab</strong> in the Recorder.</span>
                  </li>
                  <li className="flex gap-3 text-slate-400 text-sm">
                    <span className="bg-slate-700 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">2</span>
                    <span>Select the <strong>"Chrome Tab"</strong> option.</span>
                  </li>
                  <li className="flex gap-3 text-slate-400 text-sm">
                    <span className="bg-slate-700 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">3</span>
                    <span>MacOS cannot capture "Entire System" audio due to security restrictions. You must pick a specific tab (e.g., Spotify, YouTube).</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 2: Mobile/iOS */}
          <section>
             <h3 className="text-xl font-semibold text-indigo-400 mb-4 flex items-center gap-2">
              <Smartphone size={20} /> iPhone & iPad Users
            </h3>
            <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700/50 flex flex-col md:flex-row gap-6 items-center">
               <div className="flex-1 text-slate-300 text-sm">
                  <p className="mb-4 text-base">Browsers on iOS cannot record system audio directly. Use the <strong>Import</strong> feature:</p>
                  <ol className="space-y-3">
                    <li className="flex gap-3 text-slate-400">
                        <span className="font-bold text-indigo-400">Step 1:</span>
                        <span>Open your <strong>Control Center</strong> and start a <strong>Screen Recording</strong>.</span>
                    </li>
                    <li className="flex gap-3 text-slate-400">
                        <span className="font-bold text-indigo-400">Step 2:</span>
                        <span>Switch to YouTube/Spotify and play your audio.</span>
                    </li>
                    <li className="flex gap-3 text-slate-400">
                        <span className="font-bold text-indigo-400">Step 3:</span>
                        <span>Stop recording. The video saves to your Photos app.</span>
                    </li>
                    <li className="flex gap-3 text-slate-400">
                        <span className="font-bold text-indigo-400">Step 4:</span>
                        <span>In AudiBites, select <strong>Import / iOS</strong> and upload that video. We'll strip the audio for you.</span>
                    </li>
                  </ol>
               </div>
            </div>
          </section>

          {/* Section 3: Editing */}
           <section>
             <h3 className="text-xl font-semibold text-pink-400 mb-4 flex items-center gap-2">
              <Scissors size={20} /> Editing & Saving
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                <h4 className="font-bold text-white mb-2">1. Select Region</h4>
                <p className="text-sm text-slate-400">Click and drag on the waveform to create a region. Drag edges to adjust start/end times.</p>
              </div>
               <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                <h4 className="font-bold text-white mb-2">2. Apply Edit</h4>
                <p className="text-sm text-slate-400">
                  <strong>Trim:</strong> Deletes everything <em>outside</em> the selection.<br/>
                  <strong>Cut:</strong> Deletes the selected region itself.
                </p>
              </div>
               <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                <h4 className="font-bold text-white mb-2">3. Save & Share</h4>
                <p className="text-sm text-slate-400">Save to Library to enable sharing. Use the Share icon to send via WhatsApp, iMessage, or Email.</p>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/50 text-center rounded-b-2xl">
          <button 
            onClick={onClose}
            className="bg-slate-700 hover:bg-slate-600 text-white px-12 py-3 rounded-xl font-medium transition-colors shadow-lg"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
};

export default Help;