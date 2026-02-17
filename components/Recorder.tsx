import React, { useState, useRef, useEffect } from 'react';
import { Mic, Globe, Square, Play, Pause, AlertCircle, Save } from 'lucide-react';
import { formatTime } from '../utils/audioUtils';

interface RecorderProps {
  onSave: (blob: Blob, name: string, source: 'recording') => void;
  onCancel: () => void;
}

const Recorder: React.FC<RecorderProps> = ({ onSave, onCancel }) => {
  const [mode, setMode] = useState<'MIC' | 'SYSTEM'>('MIC');
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [dataArray, setDataArray] = useState<Uint8Array | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);

  // Setup Audio Visualization
  useEffect(() => {
    if (!stream) return;

    // Use a try-catch for AudioContext creation as browsers impose limits
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      
      // For system audio which might include video tracks, we explicitly grab audio tracks
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        // This might happen momentarily during setup or if no audio track exists
        return;
      }
      
      // Create a new stream just for the analyser to avoid issues with video tracks
      const audioOnlyStream = new MediaStream(audioTracks);
      const source = audioContext.createMediaStreamSource(audioOnlyStream);
      const analyserNode = audioContext.createAnalyser();
      
      analyserNode.fftSize = 256;
      source.connect(analyserNode);
      
      const bufferLength = analyserNode.frequencyBinCount;
      const dataArrayUint8 = new Uint8Array(bufferLength);
      
      setAnalyser(analyserNode);
      setDataArray(dataArrayUint8);

      return () => {
        if (audioContext.state !== 'closed') {
          audioContext.close();
        }
      };
    } catch (e) {
      console.error("Error setting up visualization:", e);
    }
  }, [stream]);

  // Draw Waveform
  useEffect(() => {
    if (!analyser || !dataArray || !canvasRef.current || !isRecording) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = '#0f172a'; // Clear with background color
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / dataArray.length) * 2.5;
      let barHeight;
      let x = 0;

      for(let i = 0; i < dataArray.length; i++) {
        barHeight = dataArray[i] / 2;
        
        const r = barHeight + 25 * (i/dataArray.length);
        const g = 250 * (i/dataArray.length);
        const b = 50;

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [analyser, dataArray, isRecording]);

  const startRecording = async () => {
    try {
      let sourceStream: MediaStream;
      let streamToRecord: MediaStream;

      if (mode === 'SYSTEM') {
        // System audio via getDisplayMedia
        // NOTE: We must request video: true for getDisplayMedia, but we only care about audio.
        // User must select "Share tab audio" or "Share system audio" in the browser prompt.
        try {
            sourceStream = await navigator.mediaDevices.getDisplayMedia({
                video: true, 
                audio: true 
            });
        } catch (err) {
             // User likely cancelled the prompt
             return;
        }

        // Check if user actually shared audio
        if (sourceStream.getAudioTracks().length === 0) {
          // Stop stream immediately if no audio
          sourceStream.getTracks().forEach(t => t.stop());
          alert("No system audio detected. Please ensure you check 'Share tab audio' or 'Share system audio' in the popup.");
          return;
        }
        
        // Fix: MediaRecorder with audio mimeType will fail if stream has video tracks.
        // Extract only audio tracks for the recorder.
        streamToRecord = new MediaStream(sourceStream.getAudioTracks());

      } else {
        // Mic/Aux audio
        sourceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamToRecord = sourceStream;
      }

      setStream(sourceStream); // Store full stream to stop everything later (including video indicator)

      // Determine optimal mimeType
      let mimeType = '';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }
        
      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(streamToRecord, options);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          setRecordedChunks((prev) => [...prev, e.data]);
        }
      };

      recorder.start(100); // Collect 100ms chunks
      setMediaRecorder(recorder);
      setIsRecording(true);

      // Timer
      const startTime = Date.now();
      timerRef.current = window.setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      // Handle stream end (user stops sharing screen or clicks "Stop sharing" native browser UI)
      sourceStream.getTracks().forEach(track => {
        track.onended = () => {
          stopRecording();
        };
      });

    } catch (err: any) {
      console.error("Error starting recording:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert("Permission denied. Please allow microphone or screen recording permissions in your browser settings.");
      } else if (err.toString().includes('display-capture')) {
        alert("Screen recording is not supported or permitted in this environment.");
      } else {
        alert(`Could not start recording: ${err.message || err}`);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    // Stop all tracks on the source stream (this stops the "Sharing..." banner)
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsRecording(false);
  };

  const handleSave = () => {
    const blob = new Blob(recordedChunks, { type: 'audio/webm' });
    const name = `Recording_${new Date().toISOString().slice(0, 19).replace('T', '_')}`;
    onSave(blob, name, 'recording');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white p-6 max-w-4xl mx-auto w-full">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-pink-500 mb-2">
          New Recording
        </h2>
        <p className="text-slate-400">Capture system audio or microphone input</p>
      </div>

      {/* Mode Selection */}
      <div className="flex justify-center gap-4 mb-8">
        <button
          onClick={() => !isRecording && setMode('MIC')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all ${
            mode === 'MIC' 
              ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30' 
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          } ${isRecording ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Mic size={20} />
          <span>Microphone / Aux</span>
        </button>
        <button
          onClick={() => !isRecording && setMode('SYSTEM')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all ${
            mode === 'SYSTEM' 
              ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/30' 
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          } ${isRecording ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Globe size={20} />
          <span>System Audio / URL</span>
        </button>
      </div>

      {/* Visualization Canvas */}
      <div className="flex-1 bg-slate-800 rounded-2xl p-4 mb-8 relative overflow-hidden border border-slate-700 shadow-inner">
        <canvas 
          ref={canvasRef} 
          width={800} 
          height={200} 
          className="w-full h-full object-cover rounded-xl"
        />
        {!isRecording && recordedChunks.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500 pointer-events-none">
            <span className="bg-slate-900/80 px-4 py-2 rounded-lg">Ready to Record</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-6">
        <div className="text-4xl font-mono font-bold tracking-wider text-slate-200">
          {formatTime(duration)}
        </div>

        <div className="flex items-center gap-4">
          {!isRecording && recordedChunks.length === 0 && (
            <button
              onClick={startRecording}
              className="w-16 h-16 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center shadow-lg shadow-red-500/40 transition-transform hover:scale-105 active:scale-95"
            >
              <div className="w-6 h-6 bg-white rounded-full"></div>
            </button>
          )}

          {isRecording && (
            <button
              onClick={stopRecording}
              className="w-16 h-16 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center border-2 border-slate-500 transition-transform hover:scale-105 active:scale-95"
            >
              <Square size={24} className="fill-white text-white" />
            </button>
          )}

          {!isRecording && recordedChunks.length > 0 && (
            <div className="flex gap-4">
               <button
                onClick={() => {
                  setRecordedChunks([]);
                  setDuration(0);
                  startRecording();
                }}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors"
              >
                Discard & Retry
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-8 py-3 bg-green-500 hover:bg-green-400 text-white rounded-xl font-medium shadow-lg shadow-green-500/30 transition-transform hover:scale-105"
              >
                <Save size={20} />
                Save Recording
              </button>
            </div>
          )}
        </div>
        
        {mode === 'SYSTEM' && !isRecording && (
           <div className="flex items-center gap-2 text-yellow-500 text-sm bg-yellow-500/10 px-4 py-2 rounded-lg">
             <AlertCircle size={16} />
             <span>To record a URL (YouTube, Spotify), play it in another tab and select that tab when prompted.</span>
           </div>
        )}
      </div>
    </div>
  );
};

export default Recorder;