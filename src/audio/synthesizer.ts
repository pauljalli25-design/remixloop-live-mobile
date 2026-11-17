/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Procedural audio generator to synthesize pristine, studio-quality loops
// and punchy "Bit Music" beat fills for the Web Audio API.

export function extractWaveformPeaks(buffer: AudioBuffer, numPeaks = 64): number[] {
  const channelData = buffer.getChannelData(0);
  const step = Math.floor(channelData.length / numPeaks);
  const peaks: number[] = [];

  for (let i = 0; i < numPeaks; i++) {
    const start = i * step;
    let max = 0;
    for (let j = 0; j < step; j++) {
      const val = Math.abs(channelData[start + j] || 0);
      if (val > max) max = val;
    }
    peaks.push(Math.min(1, max));
  }
  return peaks;
}

export function synthesizeKick(ctx: AudioContext, time: number, dest: AudioNode, velocity = 1.0) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(38, time + 0.12);

  gain.gain.setValueAtTime(velocity * 0.9, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

  osc.connect(gain);
  gain.connect(dest);

  osc.start(time);
  osc.stop(time + 0.35);

  // Transient click
  const clickOsc = ctx.createOscillator();
  const clickGain = ctx.createGain();
  clickOsc.type = 'triangle';
  clickOsc.frequency.setValueAtTime(300, time);
  clickGain.gain.setValueAtTime(velocity * 0.3, time);
  clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
  clickOsc.connect(clickGain);
  clickGain.connect(dest);
  clickOsc.start(time);
  clickOsc.stop(time + 0.02);
}

export function synthesizeSnare(ctx: AudioContext, time: number, dest: AudioNode, velocity = 1.0) {
  // Tone body
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(190, time);
  osc.frequency.exponentialRampToValueAtTime(110, time + 0.09);
  gain.gain.setValueAtTime(velocity * 0.6, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(time);
  osc.stop(time + 0.15);

  // Noise snap
  const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.22), ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.05));
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(900, time);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(velocity * 0.7, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(dest);
  noise.start(time);
  noise.stop(time + 0.22);
}

export function synthesizeHiHat(ctx: AudioContext, time: number, dest: AudioNode, isOpen = false, velocity = 0.8) {
  const dur = isOpen ? 0.32 : 0.06;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * (isOpen ? 0.12 : 0.025)));
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(7500, time);
  filter.Q.setValueAtTime(3.5, time);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(velocity * 0.5, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  source.start(time);
  source.stop(time + dur);
}

export function synthesizeClap(ctx: AudioContext, time: number, dest: AudioNode, velocity = 0.9) {
  const bursts = [0, 0.012, 0.024];
  bursts.forEach((offset, idx) => {
    const isLast = idx === bursts.length - 1;
    const dur = isLast ? 0.2 : 0.03;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * (isLast ? 0.06 : 0.015)));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, time + offset);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(velocity * (isLast ? 0.8 : 0.5), time + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, time + offset + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(time + offset);
    noise.stop(time + offset + dur);
  });
}

export function synthesizeBassNote(ctx: AudioContext, time: number, dest: AudioNode, freq: number, duration: number, is808 = false) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  if (is808) {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.5, time);
    osc.frequency.exponentialRampToValueAtTime(freq, time + 0.07);
    gain.gain.setValueAtTime(0.9, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
  } else {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 4, time);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.5, time + duration * 0.8);
    filter.Q.setValueAtTime(4, time);

    gain.gain.setValueAtTime(0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + duration);
    return;
  }

  osc.connect(gain);
  gain.connect(dest);
  osc.start(time);
  osc.stop(time + duration);
}

export function synthesizePluckChord(ctx: AudioContext, time: number, dest: AudioNode, freqs: number[], duration: number) {
  freqs.forEach(freq => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 6, time);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.2, time + duration);
    filter.Q.setValueAtTime(3, time);

    gain.gain.setValueAtTime(0.28, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + duration);
  });
}

// Offline render helper to convert synthesized sequences into self-contained AudioBuffers
export async function renderToBuffer(
  duration: number,
  renderSchedule: (offlineCtx: OfflineAudioContext) => void
): Promise<AudioBuffer> {
  const sampleRate = 44100;
  const numSamples = Math.max(1, Math.floor(sampleRate * duration));
  const offlineCtx = new OfflineAudioContext(2, numSamples, sampleRate);
  renderSchedule(offlineCtx);
  return await offlineCtx.startRendering();
}
