// Utility to format time in MM:SS
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Utility to format time in MM:SS.m (Precise)
export const formatTimePrecise = (seconds: number): string => {
  if (isNaN(seconds)) return "0:00.0";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 10); // One decimal place
  return `${mins}:${secs.toString().padStart(2, '0')}.${millis}`;
};

// Convert AudioBuffer to WAV Blob
export const bufferToWav = (buffer: AudioBuffer): Blob => {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded in this simplistic example)

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // write interleaved data
  for (i = 0; i < buffer.numberOfChannels; i++)
    channels.push(buffer.getChannelData(i));

  while (pos < buffer.length) {
    for (i = 0; i < numOfChan; i++) {
      // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
      view.setInt16(44 + offset, sample, true);
      offset += 2;
    }
    pos++;
  }

  // helper to set uint16
  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }
  // helper to set uint32
  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }

  return new Blob([bufferArray], { type: 'audio/wav' });
};

// Slice AudioBuffer (for cutting/trimming)
export const sliceAudioBuffer = (
  buffer: AudioBuffer,
  start: number,
  end: number,
  audioContext: AudioContext
): AudioBuffer => {
  const channels = buffer.numberOfChannels;
  const rate = buffer.sampleRate;
  const startOffset = Math.floor(start * rate);
  const endOffset = Math.floor(end * rate);
  const frameCount = endOffset - startOffset;

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

// Splice (Cut out middle)
export const cutAudioBuffer = (
  buffer: AudioBuffer,
  start: number,
  end: number,
  audioContext: AudioContext
): AudioBuffer => {
  const channels = buffer.numberOfChannels;
  const rate = buffer.sampleRate;
  const startOffset = Math.floor(start * rate);
  const endOffset = Math.floor(end * rate);
  const totalLength = buffer.length;
  const removedLength = endOffset - startOffset;
  const newLength = totalLength - removedLength;

  if (newLength <= 0) return audioContext.createBuffer(channels, 1, rate);

  const newBuffer = audioContext.createBuffer(channels, newLength, rate);

  for (let i = 0; i < channels; i++) {
    const oldData = buffer.getChannelData(i);
    const newData = newBuffer.getChannelData(i);
    
    // Copy first part
    newData.set(oldData.subarray(0, startOffset), 0);
    // Copy second part
    newData.set(oldData.subarray(endOffset), startOffset);
  }

  return newBuffer;
};