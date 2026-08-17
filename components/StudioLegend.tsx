import React, { useState, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Scissors,
  VolumeX,
  Volume2,
  Sparkles,
  Sliders,
  ArrowDownUp,
  Undo2,
  Redo2,
  FileDown,
  FileText,
  Save,
  Plus,
  Repeat,
  ZoomIn,
  ZoomOut,
  HelpCircle,
  Clock,
  Search,
  CheckCircle2,
  ChevronRight,
  Info,
  Layers,
  ArrowRight,
} from 'lucide-react';

export type StudioButtonKey =
  | 'play-pause'
  | 'stop'
  | 'trim'
  | 'cut'
  | 'silence'
  | 'fade-in'
  | 'fade-out'
  | 'normalize'
  | 'gain'
  | 'reverse'
  | 'undo'
  | 'redo'
  | 'export-wav'
  | 'transcribe'
  | 'save-copy'
  | 'save-library'
  | 'loop'
  | 'zoom'
  | 'speed'
  | 'volume'
  | 'region-select'
  | 'shortcuts';

export interface ButtonGuideItem {
  id: StudioButtonKey;
  name: string;
  category: 'Transport & Playback' | 'Editing & Slicing' | 'FX & Dynamics' | 'History & Project' | 'View & Navigation';
  icon: React.ComponentType<{ size?: number; className?: string }>;
  shortcut?: string;
  badgeColor: string;
  whatItDoes: string;
  howToUse: string[];
  proTip: string;
  sampleUse: string;
}

export const STUDIO_BUTTON_GUIDES: Record<StudioButtonKey, ButtonGuideItem> = {
  'play-pause': {
    id: 'play-pause',
    name: 'Play / Pause',
    category: 'Transport & Playback',
    icon: Play,
    shortcut: 'Space',
    badgeColor: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
    whatItDoes: 'Starts or pauses audio playback from the playhead cursor position or inside an active region.',
    howToUse: [
      'Click the round Play button (or press Spacebar) to preview your audio.',
      'Click anywhere on the waveform or timeline to move the playhead to that exact moment.',
      'If a region is highlighted on the waveform, Play will focus playback within that selection.',
    ],
    proTip: 'Use Spacebar as your primary hotkey for instant preview and stopping.',
    sampleUse: 'Auditioning edits before saving or checking region boundaries.',
  },
  'stop': {
    id: 'stop',
    name: 'Stop & Reset',
    category: 'Transport & Playback',
    icon: RotateCcw,
    shortcut: 'Stop button',
    badgeColor: 'text-slate-300 bg-slate-800 border-slate-700',
    whatItDoes: 'Stops playback immediately and rewinds the cursor back to the start (0:00.00).',
    howToUse: [
      'Click the counter-clockwise arrow icon next to the Play button.',
      'The audio stops and the playhead returns to the beginning of the timeline.',
    ],
    proTip: 'Great for quickly restarting a full listen-through of your audio bite.',
    sampleUse: 'Returning to the start after inspecting a cut later in the file.',
  },
  'trim': {
    id: 'trim',
    name: 'Trim Region',
    category: 'Editing & Slicing',
    icon: Scissors,
    shortcut: 'T',
    badgeColor: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
    whatItDoes: 'Keeps only the highlighted audio region and deletes everything before and after it.',
    howToUse: [
      '1. Click and drag horizontally across the waveform to highlight your desired sound snippet.',
      '2. Fine-tune the pink boundary handles on the left and right.',
      '3. Click Trim (or press "T" on your keyboard) to keep only the selected snippet.',
    ],
    proTip: 'Trim is perfect for isolating a quote, bite-sized sound effect, or chorus from a long recording.',
    sampleUse: 'Extracting a 5-second voice quote out of a 20-minute podcast recording.',
  },
  'cut': {
    id: 'cut',
    name: 'Cut Selection',
    category: 'Editing & Slicing',
    icon: Scissors,
    shortcut: 'Delete / Backspace',
    badgeColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    whatItDoes: 'Deletes the highlighted region from the track and joins the left and right sections seamlessly.',
    howToUse: [
      '1. Drag across the waveform to select unwanted audio (such as dead air, a cough, or an error).',
      '2. Press the Cut button or hit Delete/Backspace on your keyboard.',
      '3. The selected slice is removed and the timeline contracts seamlessly.',
    ],
    proTip: 'Zoom in (slider above waveform) for surgical precision when cutting out breaths or clicks.',
    sampleUse: 'Removing awkward pauses, filler words ("um/uh"), or background chair squeaks.',
  },
  'silence': {
    id: 'silence',
    name: 'Silence Region',
    category: 'Editing & Slicing',
    icon: VolumeX,
    shortcut: 'Silence button',
    badgeColor: 'text-slate-300 bg-slate-800 border-slate-700',
    whatItDoes: 'Mutes the selected region to total zero volume while preserving the overall track duration and timing.',
    howToUse: [
      '1. Drag to highlight a noisy or unwanted section on the waveform.',
      '2. Click Silence to replace that region with digital zero amplitude.',
      '3. Unlike Cut, Silence does NOT shorten the track or move other sounds out of sync.',
    ],
    proTip: 'Use Silence instead of Cut when timing must remain synchronized with video or a backing beat.',
    sampleUse: 'Muting background noise during speaking pauses without shifting track duration.',
  },
  'fade-in': {
    id: 'fade-in',
    name: 'Fade In',
    category: 'FX & Dynamics',
    icon: Sparkles,
    shortcut: 'Fade In button',
    badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    whatItDoes: 'Applies a smooth logarithmic volume curve starting from silence (0%) up to full volume (100%).',
    howToUse: [
      '1. Choose your desired fade duration from the dropdown (0.25s, 0.5s, 1.0s, or 2.0s).',
      '2. If a region is highlighted, the fade is applied to that region; otherwise it applies to the start of the track.',
      '3. Click Fade In to apply the smooth entry.',
    ],
    proTip: 'A quick 0.25s fade-in prevents audio "pops" and clicks at the beginning of abruptly sliced audio.',
    sampleUse: 'Creating smooth musical intro transitions or gentle voice entrances.',
  },
  'fade-out': {
    id: 'fade-out',
    name: 'Fade Out',
    category: 'FX & Dynamics',
    icon: Sparkles,
    shortcut: 'Fade Out button',
    badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    whatItDoes: 'Applies a smooth volume decay curve from 100% down to complete silence (0%).',
    howToUse: [
      '1. Select your target fade duration in seconds (e.g. 1.0s or 2.0s).',
      '2. Click Fade Out to smoothly taper the ending of your track or selected region.',
    ],
    proTip: 'Apply a 1.0s fade-out at the end of ringtones or sound effects to avoid abrupt cutoffs.',
    sampleUse: 'Gently ending music tracks, voiceover endings, or ambient soundbeds.',
  },
  'normalize': {
    id: 'normalize',
    name: 'Normalize Peak',
    category: 'FX & Dynamics',
    icon: Sparkles,
    shortcut: 'Normalize button',
    badgeColor: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
    whatItDoes: 'Analyzes the audio and scales the volume upward so the loudest peak hits the maximum digital ceiling (0 dB) without clipping.',
    howToUse: [
      '1. Click Normalize Peak in the toolbar.',
      '2. If a region is selected, only that region is normalized. If no region is active, the entire track is optimized.',
      '3. AudiBites recalibrates the waveform instantly with zero harmonic distortion.',
    ],
    proTip: 'Always normalize quiet phone recordings or voice notes before exporting for broadcast clarity.',
    sampleUse: 'Boosting a quiet microphone recording to full commercial volume cleanly.',
  },
  'gain': {
    id: 'gain',
    name: 'Gain +/- (Volume Adjust)',
    category: 'FX & Dynamics',
    icon: Sliders,
    shortcut: 'Gain +/- button',
    badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    whatItDoes: 'Increases or decreases audio amplitude by specific decibel (dB) amounts (+3dB, +6dB, -3dB, -6dB).',
    howToUse: [
      '1. Click the Gain +/- button to open the dB adjustment dialog.',
      '2. Choose +3 dB (+40% volume boost), +6 dB (2x louder), -3 dB (quieter), or -6 dB (half volume).',
      '3. Applies directly to the highlighted region or the entire audio buffer.',
    ],
    proTip: 'Use +3 dB increments to boost vocals gently without causing digital clipping.',
    sampleUse: 'Leveling out a speaker whose voice was significantly quieter than others.',
  },
  'reverse': {
    id: 'reverse',
    name: 'Reverse Audio',
    category: 'FX & Dynamics',
    icon: ArrowDownUp,
    shortcut: 'Reverse button',
    badgeColor: 'text-slate-300 bg-slate-800 border-slate-700',
    whatItDoes: 'Reverses the sequence of audio samples in time so the sound plays backwards.',
    howToUse: [
      '1. Highlight a section of audio (e.g. a cymbal crash or vocal word) or leave empty for full track.',
      '2. Click Reverse in the audio FX section.',
      '3. Hit Play to hear the backwards sound.',
    ],
    proTip: 'Reversing a cymbal hit or vocal reverb tail creates an iconic build-up riser effect.',
    sampleUse: 'Creating backward sound effects, risers, and psychedelic audio transitions.',
  },
  'undo': {
    id: 'undo',
    name: 'Undo',
    category: 'History & Project',
    icon: Undo2,
    shortcut: 'Ctrl + Z / Cmd + Z',
    badgeColor: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
    whatItDoes: 'Reverts the most recent edit or audio processing operation and restores previous waveform state.',
    howToUse: [
      'Click the curved left arrow button in the top bar or press Ctrl+Z (Cmd+Z on Mac).',
      'You can undo multiple consecutive edits all the way back to the original audio.',
    ],
    proTip: 'All editing in AudiBites is non-destructive in memory; you can safely experiment and undo anytime.',
    sampleUse: 'Instantly recovering audio after accidentally cutting the wrong section.',
  },
  'redo': {
    id: 'redo',
    name: 'Redo',
    category: 'History & Project',
    icon: Redo2,
    shortcut: 'Ctrl+Shift+Z / Cmd+Y',
    badgeColor: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
    whatItDoes: 'Reapplies an edit that was previously undone.',
    howToUse: [
      'Click the curved right arrow button in the top bar or press Ctrl+Shift+Z (Cmd+Y).',
      'Steps forward in your edit history stack.',
    ],
    proTip: 'Use Undo and Redo back-and-forth to A/B test an effect (like Normalize or Fade) against the raw audio.',
    sampleUse: 'Restoring a trim or normalization that you had temporarily undone.',
  },
  'export-wav': {
    id: 'export-wav',
    name: 'Export WAV',
    category: 'History & Project',
    icon: FileDown,
    shortcut: 'Export button',
    badgeColor: 'text-slate-300 bg-slate-800 border-slate-700',
    whatItDoes: 'Renders the currently edited waveform into an uncompressed, studio-grade 16-bit PCM .wav file and triggers a browser download.',
    howToUse: [
      '1. Type your desired file name in the top left title box.',
      '2. Click "Export WAV".',
      '3. Your browser immediately downloads the studio-quality .wav file to your computer/device.',
    ],
    proTip: 'WAV format preserves 100% audio fidelity with zero compression artifacts.',
    sampleUse: 'Downloading edited sound bites for video editing software, DAWs, or DJ apps.',
  },
  'transcribe': {
    id: 'transcribe',
    name: 'Transcribe with AI',
    category: 'History & Project',
    icon: FileText,
    shortcut: 'Transcribe button',
    badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    whatItDoes: 'Opens the AI Speech-to-Text modal to generate high-accuracy transcripts, timestamps, subtitles (.srt), or translations.',
    howToUse: [
      '1. Click "Transcribe" in the studio header.',
      '2. Choose your preferred output mode (Standard, Timestamped [MM:SS], Summary & Notes, or Translate).',
      '3. Click Generate to transcribe spoken words into editable text with 1-click copy and export.',
    ],
    proTip: 'Use the "Timestamped" mode to generate captions and subtitles for video reels and podcasts.',
    sampleUse: 'Converting voice recordings, interviews, and meetings into text notes.',
  },
  'save-copy': {
    id: 'save-copy',
    name: 'Save As Copy',
    category: 'History & Project',
    icon: Plus,
    shortcut: 'Save As Copy',
    badgeColor: 'text-slate-300 bg-slate-800 border-slate-700',
    whatItDoes: 'Stores your edited audio as a brand-new separate item in your local AudiBites Library without overwriting the original file.',
    howToUse: [
      '1. Click "Save As Copy" in the top bar.',
      '2. A new entry with "(Copy)" added to its title is saved to your persistent browser storage.',
    ],
    proTip: 'Use Save As Copy when creating multiple snippet variations from a single recording.',
    sampleUse: 'Saving 3 different bite-sized ringtones from one master recording.',
  },
  'save-library': {
    id: 'save-library',
    name: 'Save to Library',
    category: 'History & Project',
    icon: Save,
    shortcut: 'Save button',
    badgeColor: 'text-white bg-sky-500 hover:bg-sky-400',
    whatItDoes: 'Commits all waveform edits and metadata updates directly to this track in your persistent Library.',
    howToUse: [
      'Click the glowing blue "Save to Library" button in the top right.',
      'Your changes are permanently indexed in your browser’s IndexedDB database and you return to the Library.',
    ],
    proTip: 'Edits saved to the Library persist across page refreshes and browser restarts.',
    sampleUse: 'Finalizing an audio cleanup session and returning to your track collection.',
  },
  'loop': {
    id: 'loop',
    name: 'Loop Region',
    category: 'View & Navigation',
    icon: Repeat,
    shortcut: 'Loop toggle',
    badgeColor: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
    whatItDoes: 'Enables continuous looped playback within the boundaries of the currently selected region.',
    howToUse: [
      '1. Drag on the waveform to select a musical phrase, beat, or dialogue section.',
      '2. Toggle "Loop Region" on (the button will highlight blue).',
      '3. Hit Play; the audio repeats seamlessly each time it reaches the region end.',
    ],
    proTip: 'Essential for finding clean drum loop points and zero-crossing edit seams without clicks.',
    sampleUse: 'Testing if a musical drum loop repeats seamlessly without stutter.',
  },
  'zoom': {
    id: 'zoom',
    name: 'Waveform Zoom',
    category: 'View & Navigation',
    icon: ZoomIn,
    shortcut: 'Zoom slider',
    badgeColor: 'text-slate-300 bg-slate-800 border-slate-700',
    whatItDoes: 'Scales the horizontal pixel density (20 to 250 px/second) of the visual waveform.',
    howToUse: [
      'Drag the Zoom slider below the waveform left to see the entire overview, or right for micro-second precision.',
      'Zooming in lets you place region markers between individual spoken syllables.',
    ],
    proTip: 'Zoom in to max (250 px/s) to catch microscopic mouth clicks and pops.',
    sampleUse: 'Accurately placing cuts right before the attack transient of a word.',
  },
  'speed': {
    id: 'speed',
    name: 'Playback Speed',
    category: 'View & Navigation',
    icon: Clock,
    shortcut: 'Speed buttons (0.5x - 2x)',
    badgeColor: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
    whatItDoes: 'Adjusts the speed of preview playback from 0.5x (slow-motion) up to 2.0x (double speed) without permanently changing the saved file.',
    howToUse: [
      'Click any speed pill: 0.5x, 0.75x, 1x, 1.25x, 1.5x, or 2x.',
      'Playback adjusts instantly in real time.',
    ],
    proTip: '0.5x slow-motion is great for transcribing fast speech or finding tiny audio glitches.',
    sampleUse: 'Speeding through long recordings at 1.5x to find key soundbites faster.',
  },
  'volume': {
    id: 'volume',
    name: 'Volume & Mute',
    category: 'View & Navigation',
    icon: Volume2,
    shortcut: 'Speaker icon / Slider',
    badgeColor: 'text-slate-300 bg-slate-800 border-slate-700',
    whatItDoes: 'Controls the preview monitoring output volume or instantly mutes speaker audio.',
    howToUse: [
      'Click the speaker icon to toggle Mute on/off.',
      'Drag the slider to adjust headphone/speaker listening volume.',
    ],
    proTip: 'This adjusts your immediate listening level and does not alter the underlying audio data.',
    sampleUse: 'Tuning playback volume to match your environment and headphone sensitivity.',
  },
  'region-select': {
    id: 'region-select',
    name: 'Region Selection & Timecode',
    category: 'Editing & Slicing',
    icon: Clock,
    shortcut: 'Drag on waveform / Escape to clear',
    badgeColor: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
    whatItDoes: 'Highlights a specific time span [Start → End] on the waveform to apply targeted operations.',
    howToUse: [
      '1. Click and drag across the waveform with your mouse to create a pink selection.',
      '2. You can drag the left and right border handles to adjust timing.',
      '3. You can also type exact seconds into the Start and End input boxes.',
      '4. Click "Clear Selection" or press Escape to deselect.',
    ],
    proTip: 'All editing tools (Trim, Cut, Silence, Fade, Gain, Reverse) automatically target the active region when one is selected.',
    sampleUse: 'Marking a 3.4-second quote with millisecond accuracy.',
  },
  'shortcuts': {
    id: 'shortcuts',
    name: 'Studio Keyboard Shortcuts',
    category: 'View & Navigation',
    icon: HelpCircle,
    shortcut: 'Shortcuts button',
    badgeColor: 'text-slate-300 bg-slate-800 border-slate-700',
    whatItDoes: 'Displays the full quick-reference hotkey cheat sheet for supercharged audio editing.',
    howToUse: [
      'Click "Shortcuts" below the waveform to view all keyboard mappings at a glance.',
    ],
    proTip: 'Memorizing Space (Play/Pause), T (Trim), and Del (Cut) speeds up editing tenfold.',
    sampleUse: 'Quickly looking up hotkey bindings while editing.',
  },
};

interface StudioLegendProps {
  activeButtonKey: StudioButtonKey | null;
  onSelectButton: (key: StudioButtonKey) => void;
  lastActionTimestamp?: number;
}

export const StudioLegend: React.FC<StudioLegendProps> = ({
  activeButtonKey,
  onSelectButton,
  lastActionTimestamp,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Default to play-pause if none is selected yet
  const currentKey: StudioButtonKey = activeButtonKey || 'play-pause';
  const currentGuide = STUDIO_BUTTON_GUIDES[currentKey] || STUDIO_BUTTON_GUIDES['play-pause'];

  const categories = [
    'All',
    'Transport & Playback',
    'Editing & Slicing',
    'FX & Dynamics',
    'History & Project',
    'View & Navigation',
  ];

  const allGuideItems = useMemo(() => Object.values(STUDIO_BUTTON_GUIDES), []);

  const filteredItems = useMemo(() => {
    return allGuideItems.filter((item) => {
      const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.whatItDoes.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.shortcut && item.shortcut.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCat && matchesSearch;
    });
  }, [allGuideItems, selectedCategory, searchQuery]);

  return (
    <aside className="w-full lg:w-88 xl:w-96 flex flex-col bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl shrink-0 h-full max-h-[850px]">
      {/* Legend Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
            <Info size={16} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white tracking-tight uppercase flex items-center gap-1.5">
              Studio Button Legend
              <span className="text-[9px] bg-sky-500/20 text-sky-300 font-semibold px-1.5 py-0.5 rounded border border-sky-500/30">
                Interactive
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">Click any control to learn What & How to use it</p>
          </div>
        </div>
      </div>

      {/* Dynamic "What & How to Use" Spotlight Card */}
      <div className="p-4 bg-gradient-to-b from-slate-900/80 to-slate-950 border-b border-slate-800 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-300 flex items-center justify-center shrink-0">
              <currentGuide.icon size={18} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white">{currentGuide.name}</span>
                {activeButtonKey && (
                  <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded animate-pulse">
                    Active / Pressed
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-slate-400">{currentGuide.category}</span>
                {currentGuide.shortcut && (
                  <span className="text-[10px] font-mono text-sky-300 bg-slate-800 px-1.5 py-0.2 rounded border border-slate-700">
                    {currentGuide.shortcut}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* What it does */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-1">
          <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 size={12} />
            <span>What It Does</span>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed">{currentGuide.whatItDoes}</p>
        </div>

        {/* How to use */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-1.5">
          <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
            <ArrowRight size={12} />
            <span>How To Use It</span>
          </div>
          <ul className="space-y-1 text-xs text-slate-300">
            {currentGuide.howToUse.map((step, idx) => (
              <li key={idx} className="flex items-start gap-1.5 text-[11px] leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Pro Tip */}
        <div className="bg-sky-950/40 border border-sky-500/20 rounded-xl p-2.5 flex items-start gap-2 text-[11px] text-sky-200">
          <Sparkles size={13} className="text-sky-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-sky-300">Pro Tip: </span>
            <span className="text-slate-300">{currentGuide.proTip}</span>
          </div>
        </div>
      </div>

      {/* Interactive Button Directory & Search */}
      <div className="p-3 border-b border-slate-800 space-y-2 bg-slate-950">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
            Button Catalog & Explorer ({filteredItems.length})
          </span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter buttons (e.g. Trim, Fade, Loop)..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-[10px]">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2 py-0.5 rounded-md whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-sky-500 text-white font-semibold'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Button List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-slate-900">
        {filteredItems.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No buttons matching "{searchQuery}".
          </div>
        ) : (
          filteredItems.map((item) => {
            const isSelected = item.id === currentKey;
            const ItemIcon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectButton(item.id)}
                className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${
                  isSelected
                    ? 'bg-sky-500/15 border border-sky-500/40 text-white shadow-sm'
                    : 'hover:bg-slate-900/80 text-slate-300 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                      isSelected
                        ? 'bg-sky-500 text-white border-sky-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    <ItemIcon size={14} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold truncate">{item.name}</span>
                      {item.shortcut && (
                        <span className="text-[9px] font-mono text-slate-400 bg-slate-800/80 px-1 rounded border border-slate-700/60 hidden sm:inline truncate">
                          {item.shortcut}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">{item.whatItDoes}</p>
                  </div>
                </div>

                <ChevronRight
                  size={14}
                  className={`shrink-0 transition-transform ${
                    isSelected ? 'text-sky-400 translate-x-0.5' : 'text-slate-600'
                  }`}
                />
              </button>
            );
          })
        )}
      </div>

      {/* Legend Footer */}
      <div className="p-3 bg-slate-900/90 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
        <span>💡 Tip: Press any button in the studio to update this guide</span>
        <span className="font-mono text-slate-500">AudiBites Studio</span>
      </div>
    </aside>
  );
};
