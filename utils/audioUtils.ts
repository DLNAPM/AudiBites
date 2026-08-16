// Format time in MM:SS or HH:MM:SS
export const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Format time in MM:SS.m (Precise to 1 or 2 decimals)
export const formatTimePrecise = (seconds: number, decimals: number = 2): string => {
  if (isNaN(seconds) || seconds < 0) return '0:00.00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const fraction = Math.floor((seconds % 1) * Math.pow(10, decimals));
  return `${mins}:${secs.toString().padStart(2, '0')}.${fraction.toString().padStart(decimals, '0')}`;
};

// Format file size in bytes to human-readable string
export const formatFileSize = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return '0 KB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

// Extract metadata (duration, sampleRate, channels) from audio Blob
export const getAudioMetadata = async (
  blob: Blob
): Promise<{ duration: number; sampleRate: number; channels: number }> => {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const duration = audioBuffer.duration;
    const sampleRate = audioBuffer.sampleRate;
    const channels = audioBuffer.numberOfChannels;
    if (ctx.state !== 'closed') {
      await ctx.close();
    }
    return { duration, sampleRate, channels };
  } catch (err) {
    // Fallback using HTMLAudioElement if WebAudio decoding fails
    return new Promise((resolve) => {
      const audio = new Audio();
      const url = URL.createObjectURL(blob);
      audio.src = url;
      audio.onloadedmetadata = () => {
        const duration = isFinite(audio.duration) ? audio.duration : 0;
        URL.revokeObjectURL(url);
        resolve({ duration, sampleRate: 44100, channels: 2 });
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ duration: 0, sampleRate: 44100, channels: 2 });
      };
    });
  }
};

// Convert AudioBuffer to 16-bit PCM WAV Blob
export const bufferToWav = (buffer: AudioBuffer): Blob => {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  let offset = 0;
  let pos = 0;

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }
  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // write interleaved audio data
  const channels: Float32Array[] = [];
  for (let i = 0; i < numOfChan; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (pos < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][pos]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(44 + offset, sample, true);
      offset += 2;
    }
    pos++;
  }

  return new Blob([bufferArray], { type: 'audio/wav' });
};

// Slice AudioBuffer (Keep only region from start to end)
export const sliceAudioBuffer = (
  buffer: AudioBuffer,
  start: number,
  end: number,
  audioContext: AudioContext
): AudioBuffer => {
  const channels = buffer.numberOfChannels;
  const rate = buffer.sampleRate;
  const startOffset = Math.max(0, Math.floor(start * rate));
  const endOffset = Math.min(buffer.length, Math.floor(end * rate));
  const frameCount = Math.max(1, endOffset - startOffset);

  const newBuffer = audioContext.createBuffer(channels, frameCount, rate);

  for (let i = 0; i < channels; i++) {
    const channelData = buffer.getChannelData(i);
    const newChannelData = newBuffer.getChannelData(i);
    for (let j = 0; j < frameCount; j++) {
      newChannelData[j] = channelData[startOffset + j];
    }
  }
  return newBuffer;
};

// Cut AudioBuffer (Remove region from start to end, joining remaining parts)
export const cutAudioBuffer = (
  buffer: AudioBuffer,
  start: number,
  end: number,
  audioContext: AudioContext
): AudioBuffer => {
  const channels = buffer.numberOfChannels;
  const rate = buffer.sampleRate;
  const startOffset = Math.max(0, Math.floor(start * rate));
  const endOffset = Math.min(buffer.length, Math.floor(end * rate));
  const totalLength = buffer.length;
  const removedLength = endOffset - startOffset;
  const newLength = Math.max(1, totalLength - removedLength);

  const newBuffer = audioContext.createBuffer(channels, newLength, rate);

  for (let i = 0; i < channels; i++) {
    const oldData = buffer.getChannelData(i);
    const newData = newBuffer.getChannelData(i);

    // Copy first part (before startOffset)
    if (startOffset > 0) {
      newData.set(oldData.subarray(0, startOffset), 0);
    }
    // Copy second part (after endOffset)
    if (endOffset < totalLength) {
      newData.set(oldData.subarray(endOffset), startOffset);
    }
  }

  return newBuffer;
};

// Apply Fade In or Fade Out to entire buffer or selected region
export const applyFade = (
  buffer: AudioBuffer,
  type: 'in' | 'out',
  fadeDurationSec: number,
  audioContext: AudioContext,
  regionStart?: number,
  regionEnd?: number
): AudioBuffer => {
  const channels = buffer.numberOfChannels;
  const rate = buffer.sampleRate;
  const totalFrames = buffer.length;

  const startFrame = regionStart !== undefined ? Math.max(0, Math.floor(regionStart * rate)) : 0;
  const endFrame = regionEnd !== undefined ? Math.min(totalFrames, Math.floor(regionEnd * rate)) : totalFrames;
  const regionFrames = endFrame - startFrame;
  const fadeFrames = Math.min(regionFrames, Math.max(1, Math.floor(fadeDurationSec * rate)));

  const newBuffer = audioContext.createBuffer(channels, totalFrames, rate);

  for (let c = 0; c < channels; c++) {
    const oldData = buffer.getChannelData(c);
    const newData = newBuffer.getChannelData(c);
    newData.set(oldData);

    if (type === 'in') {
      for (let i = 0; i < fadeFrames; i++) {
        const factor = i / fadeFrames; // 0 -> 1
        const targetIdx = startFrame + i;
        if (targetIdx < totalFrames) {
          newData[targetIdx] = oldData[targetIdx] * factor;
        }
      }
    } else {
      for (let i = 0; i < fadeFrames; i++) {
        const factor = 1 - (i / fadeFrames); // 1 -> 0
        const targetIdx = endFrame - fadeFrames + i;
        if (targetIdx >= 0 && targetIdx < totalFrames) {
          newData[targetIdx] = oldData[targetIdx] * factor;
        }
      }
    }
  }

  return newBuffer;
};

// Apply Gain (volume boost or attenuation)
export const applyGain = (
  buffer: AudioBuffer,
  gainMultiplier: number,
  audioContext: AudioContext,
  regionStart?: number,
  regionEnd?: number
): AudioBuffer => {
  const channels = buffer.numberOfChannels;
  const rate = buffer.sampleRate;
  const totalFrames = buffer.length;

  const startFrame = regionStart !== undefined ? Math.max(0, Math.floor(regionStart * rate)) : 0;
  const endFrame = regionEnd !== undefined ? Math.min(totalFrames, Math.floor(regionEnd * rate)) : totalFrames;

  const newBuffer = audioContext.createBuffer(channels, totalFrames, rate);

  for (let c = 0; c < channels; c++) {
    const oldData = buffer.getChannelData(c);
    const newData = newBuffer.getChannelData(c);
    newData.set(oldData);

    for (let i = startFrame; i < endFrame; i++) {
      newData[i] = Math.max(-1, Math.min(1, oldData[i] * gainMultiplier));
    }
  }

  return newBuffer;
};

// Normalize audio buffer (maximizes peak amplitude without clipping)
export const normalizeAudioBuffer = (
  buffer: AudioBuffer,
  audioContext: AudioContext,
  regionStart?: number,
  regionEnd?: number
): AudioBuffer => {
  const channels = buffer.numberOfChannels;
  const rate = buffer.sampleRate;
  const totalFrames = buffer.length;

  const startFrame = regionStart !== undefined ? Math.max(0, Math.floor(regionStart * rate)) : 0;
  const endFrame = regionEnd !== undefined ? Math.min(totalFrames, Math.floor(regionEnd * rate)) : totalFrames;

  // Find peak amplitude in target region
  let maxPeak = 0;
  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = startFrame; i < endFrame; i++) {
      const abs = Math.abs(data[i]);
      if (abs > maxPeak) maxPeak = abs;
    }
  }

  if (maxPeak === 0 || maxPeak >= 0.999) {
    // Already normalized or silent
    return cloneAudioBuffer(buffer, audioContext);
  }

  const multiplier = 0.98 / maxPeak; // Normalize to -0.17 dB peak
  return applyGain(buffer, multiplier, audioContext, regionStart, regionEnd);
};

// Reverse audio buffer in region
export const reverseAudioBuffer = (
  buffer: AudioBuffer,
  audioContext: AudioContext,
  regionStart?: number,
  regionEnd?: number
): AudioBuffer => {
  const channels = buffer.numberOfChannels;
  const rate = buffer.sampleRate;
  const totalFrames = buffer.length;

  const startFrame = regionStart !== undefined ? Math.max(0, Math.floor(regionStart * rate)) : 0;
  const endFrame = regionEnd !== undefined ? Math.min(totalFrames, Math.floor(regionEnd * rate)) : totalFrames;
  const regionLength = endFrame - startFrame;

  const newBuffer = audioContext.createBuffer(channels, totalFrames, rate);

  for (let c = 0; c < channels; c++) {
    const oldData = buffer.getChannelData(c);
    const newData = newBuffer.getChannelData(c);
    newData.set(oldData);

    for (let i = 0; i < regionLength; i++) {
      newData[startFrame + i] = oldData[endFrame - 1 - i];
    }
  }

  return newBuffer;
};

// Silence selected region
export const silenceAudioBuffer = (
  buffer: AudioBuffer,
  start: number,
  end: number,
  audioContext: AudioContext
): AudioBuffer => {
  const channels = buffer.numberOfChannels;
  const rate = buffer.sampleRate;
  const startFrame = Math.max(0, Math.floor(start * rate));
  const endFrame = Math.min(buffer.length, Math.floor(end * rate));

  const newBuffer = audioContext.createBuffer(channels, buffer.length, rate);

  for (let c = 0; c < channels; c++) {
    const oldData = buffer.getChannelData(c);
    const newData = newBuffer.getChannelData(c);
    newData.set(oldData);

    for (let i = startFrame; i < endFrame; i++) {
      newData[i] = 0;
    }
  }

  return newBuffer;
};

// Helper: Clone AudioBuffer
export const cloneAudioBuffer = (
  buffer: AudioBuffer,
  audioContext: AudioContext
): AudioBuffer => {
  const newBuffer = audioContext.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    newBuffer.getChannelData(i).set(buffer.getChannelData(i));
  }
  return newBuffer;
};

// Extract audio from video or audio file
export const extractAudioFromFile = async (
  file: File
): Promise<{ blob: Blob; duration: number; sampleRate: number; channels: number }> => {
  const arrayBuffer = await file.arrayBuffer();
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioContextClass();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const wavBlob = bufferToWav(audioBuffer);
    const duration = audioBuffer.duration;
    const sampleRate = audioBuffer.sampleRate;
    const channels = audioBuffer.numberOfChannels;
    return { blob: wavBlob, duration, sampleRate, channels };
  } catch (error) {
    throw new Error('Could not decode audio from file. Please ensure the file contains a valid audio stream.');
  } finally {
    if (audioContext.state !== 'closed') {
      await audioContext.close();
    }
  }
};

// Create a synthetic sample tone for quick test/demo
export const createSampleTrack = async (
  style: 'chime' | 'pulse' | 'ambient'
): Promise<{ blob: Blob; name: string; duration: number }> => {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const sampleRate = 44100;
  const duration = style === 'chime' ? 4 : style === 'pulse' ? 5 : 6;
  const offlineCtx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

  if (style === 'chime') {
    // Multi-tone melodic chime
    const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
    notes.forEach((freq, idx) => {
      const osc = offlineCtx.createOscillator();
      const gain = offlineCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, offlineCtx.currentTime);

      const startTime = idx * 0.4;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.3 / (idx + 1), startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 2.5);

      osc.connect(gain);
      gain.connect(offlineCtx.destination);

      osc.start(startTime);
      osc.stop(startTime + 2.5);
    });
  } else if (style === 'pulse') {
    // Electronic synth rhythmic pulse
    for (let i = 0; i < 8; i++) {
      const osc = offlineCtx.createOscillator();
      const gain = offlineCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(i % 2 === 0 ? 220 : 330, offlineCtx.currentTime);

      const time = i * 0.5;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.25, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.45);

      osc.connect(gain);
      gain.connect(offlineCtx.destination);

      osc.start(time);
      osc.stop(time + 0.48);
    }
  } else {
    // Ambient warm drone
    const freqs = [110, 164.81, 220, 329.63];
    freqs.forEach((freq) => {
      const osc = offlineCtx.createOscillator();
      const gain = offlineCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, offlineCtx.currentTime);

      gain.gain.setValueAtTime(0, 0);
      gain.gain.linearRampToValueAtTime(0.12, 1.5);
      gain.gain.setValueAtTime(0.12, 4.0);
      gain.gain.linearRampToValueAtTime(0.001, duration);

      osc.connect(gain);
      gain.connect(offlineCtx.destination);

      osc.start(0);
      osc.stop(duration);
    });
  }

  const renderedBuffer = await offlineCtx.startRendering();
  const blob = bufferToWav(renderedBuffer);
  const name = style === 'chime' ? 'Crystal Chimes (Demo)' : style === 'pulse' ? 'Synth Pulse (Demo)' : 'Ambient Drone (Demo)';

  return { blob, name, duration };
};
