/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  renderToBuffer,
  extractWaveformPeaks,
  synthesizeKick,
  synthesizeSnare,
  synthesizeHiHat,
  synthesizeClap,
  synthesizeBassNote,
  synthesizePluckChord,
} from './synthesizer';
import { TrackData } from '../types/audio';

export interface PresetPackDefinition {
  id: string;
  name: string;
  genre: string;
  bpm: number;
  description: string;
  generateTracks: () => Promise<TrackData[]>;
}

// 1. EDM Mainstage Generator
async function createEdmPack(): Promise<TrackData[]> {
  const bpm = 128;
  const beatSec = 60 / bpm; // 0.46875s
  const loopDuration = beatSec * 8; // 2 bars = 3.75s (approx 4 seconds)

  // Track 1: Drums
  const drumBuffer = await renderToBuffer(loopDuration, (ctx) => {
    for (let bar = 0; bar < 2; bar++) {
      const base = bar * beatSec * 4;
      // 4-on-the-floor Kick
      for (let b = 0; b < 4; b++) {
        synthesizeKick(ctx as unknown as AudioContext, base + b * beatSec, ctx.destination, 1.0);
      }
      // Claps on 2 and 4
      synthesizeClap(ctx as unknown as AudioContext, base + 1 * beatSec, ctx.destination, 0.95);
      synthesizeClap(ctx as unknown as AudioContext, base + 3 * beatSec, ctx.destination, 0.95);
      // Offbeat Hi-hats
      for (let b = 0; b < 4; b++) {
        synthesizeHiHat(ctx as unknown as AudioContext, base + (b + 0.5) * beatSec, ctx.destination, true, 0.7);
      }
    }
  });

  // Track 1 Bit Music: 2-bar Snare Build Roll (1.875s)
  const drumBitBuffer = await renderToBuffer(beatSec * 4, (ctx) => {
    // Accelerating snare roll fill: 1/4 -> 1/8 -> 1/16 -> 1/32 + crash
    const steps = [
      0, beatSec * 0.5, beatSec * 1.0, beatSec * 1.5,
      beatSec * 2.0, beatSec * 2.25, beatSec * 2.5, beatSec * 2.75,
      beatSec * 3.0, beatSec * 3.125, beatSec * 3.25, beatSec * 3.375,
      beatSec * 3.5, beatSec * 3.625, beatSec * 3.75, beatSec * 3.875,
    ];
    steps.forEach((t, i) => {
      const vel = 0.5 + (i / steps.length) * 0.5;
      synthesizeSnare(ctx as unknown as AudioContext, t, ctx.destination, vel);
    });
    // Crash at the end
    synthesizeHiHat(ctx as unknown as AudioContext, beatSec * 3.75, ctx.destination, true, 1.0);
  });

  // Track 2: Saw Bass
  const bassBuffer = await renderToBuffer(loopDuration, (ctx) => {
    // Driving 1/8 note bass line: F -> G -> A -> F
    const rootNotes = [43.65, 43.65, 48.99, 55.0]; // F1, G1, A1
    for (let b = 0; b < 8; b++) {
      const note = rootNotes[Math.floor(b / 2) % rootNotes.length];
      synthesizeBassNote(ctx as unknown as AudioContext, b * beatSec, ctx.destination, note, beatSec * 0.45, false);
      synthesizeBassNote(ctx as unknown as AudioContext, (b + 0.5) * beatSec, ctx.destination, note, beatSec * 0.35, false);
    }
  });

  // Track 2 Bit Music: Sub Bass Pitch Dive (1.4s)
  const bassBitBuffer = await renderToBuffer(beatSec * 3, (ctx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, 0);
    osc.frequency.exponentialRampToValueAtTime(30, beatSec * 2.5);
    gain.gain.setValueAtTime(0.9, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, beatSec * 2.8);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0);
    osc.stop(beatSec * 3);
  });

  // Track 3: Lead Melody
  const melodyBuffer = await renderToBuffer(loopDuration, (ctx) => {
    const chords = [
      [349.23, 440.0, 523.25], // F major
      [392.0, 493.88, 587.33], // G major
      [440.0, 523.25, 659.25], // A minor
      [329.63, 392.0, 493.88], // E minor
    ];
    for (let i = 0; i < 8; i++) {
      const chord = chords[Math.floor(i / 2)];
      synthesizePluckChord(ctx as unknown as AudioContext, i * beatSec, ctx.destination, chord, beatSec * 0.6);
      synthesizePluckChord(ctx as unknown as AudioContext, (i + 0.75) * beatSec, ctx.destination, chord, beatSec * 0.2);
    }
  });

  // Track 3 Bit Music: Staccato Laser Synth Break (1.5s)
  const melodyBitBuffer = await renderToBuffer(beatSec * 3, (ctx) => {
    const riffs = [659.25, 783.99, 880.0, 1046.5];
    riffs.forEach((f, idx) => {
      synthesizePluckChord(ctx as unknown as AudioContext, idx * (beatSec * 0.5), ctx.destination, [f, f * 1.5], beatSec * 0.3);
    });
  });

  // Track 4: Vocal / Percussion Hype
  const vocalBuffer = await renderToBuffer(loopDuration, (ctx) => {
    for (let bar = 0; bar < 2; bar++) {
      const t = bar * beatSec * 4;
      // Synthesize rhythmic vocal chop formant burst
      [0, 1.5, 2.5, 3.25].forEach((pos, idx) => {
        const osc = ctx.createOscillator();
        const filt = ctx.createBiquadFilter();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(261.63 * (1 + idx * 0.2), t + pos * beatSec);
        filt.type = 'bandpass';
        filt.frequency.setValueAtTime(1200 + idx * 400, t + pos * beatSec);
        filt.Q.setValueAtTime(5, t + pos * beatSec);
        g.gain.setValueAtTime(0.5, t + pos * beatSec);
        g.gain.exponentialRampToValueAtTime(0.001, t + pos * beatSec + 0.25);
        osc.connect(filt);
        filt.connect(g);
        g.connect(ctx.destination);
        osc.start(t + pos * beatSec);
        osc.stop(t + pos * beatSec + 0.25);
      });
    }
  });

  // Track 4 Bit Music: "Drop It!" Staccato Stinger (1.4s)
  const vocalBitBuffer = await renderToBuffer(beatSec * 3, (ctx) => {
    [0, 0.25, 0.5, 0.85].forEach((time, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440 + i * 110, time);
      g.gain.setValueAtTime(0.8, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.2);
    });
  });

  // Track 5: FX Riser & Sweep
  const fxBuffer = await renderToBuffer(loopDuration, (ctx) => {
    const dur = loopDuration;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(i / data.length, 1.8);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, 0);
    filter.frequency.exponentialRampToValueAtTime(8000, dur);
    filter.Q.setValueAtTime(3, 0);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.05, 0);
    gain.gain.linearRampToValueAtTime(0.4, dur * 0.95);
    gain.gain.exponentialRampToValueAtTime(0.001, dur);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(0);
    noise.stop(dur);
  });

  // Track 5 Bit Music: Tape Stop Effect (1.2s)
  const fxBitBuffer = await renderToBuffer(beatSec * 2.5, (ctx) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(350, 0);
    osc.frequency.exponentialRampToValueAtTime(20, beatSec * 2);
    g.gain.setValueAtTime(0.6, 0);
    g.gain.exponentialRampToValueAtTime(0.001, beatSec * 2.2);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(0);
    osc.stop(beatSec * 2.4);
  });

  return [
    {
      id: 'edm-track-1',
      name: 'Main Kick & Clap Beat',
      category: 'drums',
      color: '#00f2fe',
      volume: 0.9,
      pan: 0,
      isMuted: false,
      isSolo: false,
      loopState: 'stopped',
      bitPlaying: false,
      bitProgress: 0,
      loopProgress: 0,
      pauseOffset: 0,
      mainLoop: {
        id: 'edm-loop-1',
        name: 'Electro 4/4 Beat (3.8s)',
        duration: loopDuration,
        bpm,
        buffer: drumBuffer,
        waveform: extractWaveformPeaks(drumBuffer),
      },
      bitMusic: {
        id: 'edm-bit-1',
        name: 'Snare Build Roll (1.9s)',
        duration: beatSec * 4,
        bpm,
        buffer: drumBitBuffer,
        waveform: extractWaveformPeaks(drumBitBuffer),
      },
    },
    {
      id: 'edm-track-2',
      name: 'Club Saw Bassline',
      category: 'bass',
      color: '#10b981',
      volume: 0.85,
      pan: 0,
      isMuted: false,
      isSolo: false,
      loopState: 'stopped',
      bitPlaying: false,
      bitProgress: 0,
      loopProgress: 0,
      pauseOffset: 0,
      mainLoop: {
        id: 'edm-loop-2',
        name: 'Pumping Saw Bass (3.8s)',
        duration: loopDuration,
        bpm,
        buffer: bassBuffer,
        waveform: extractWaveformPeaks(bassBuffer),
      },
      bitMusic: {
        id: 'edm-bit-2',
        name: '808 Pitch Dive (1.4s)',
        duration: beatSec * 3,
        bpm,
        buffer: bassBitBuffer,
        waveform: extractWaveformPeaks(bassBitBuffer),
      },
    },
    {
      id: 'edm-track-3',
      name: 'Euphoric Synth Chords',
      category: 'melody',
      color: '#ff007f',
      volume: 0.8,
      pan: 0,
      isMuted: false,
      isSolo: false,
      loopState: 'stopped',
      bitPlaying: false,
      bitProgress: 0,
      loopProgress: 0,
      pauseOffset: 0,
      mainLoop: {
        id: 'edm-loop-3',
        name: 'Anthem Pluck Progression (3.8s)',
        duration: loopDuration,
        bpm,
        buffer: melodyBuffer,
        waveform: extractWaveformPeaks(melodyBuffer),
      },
      bitMusic: {
        id: 'edm-bit-3',
        name: 'Staccato Laser Solo (1.4s)',
        duration: beatSec * 3,
        bpm,
        buffer: melodyBitBuffer,
        waveform: extractWaveformPeaks(melodyBitBuffer),
      },
    },
    {
      id: 'edm-track-4',
      name: 'Vocal Chop Grooves',
      category: 'vocals',
      color: '#f59e0b',
      volume: 0.85,
      pan: 0,
      isMuted: false,
      isSolo: false,
      loopState: 'stopped',
      bitPlaying: false,
      bitProgress: 0,
      loopProgress: 0,
      pauseOffset: 0,
      mainLoop: {
        id: 'edm-loop-4',
        name: 'Vocal Hook Chops (3.8s)',
        duration: loopDuration,
        bpm,
        buffer: vocalBuffer,
        waveform: extractWaveformPeaks(vocalBuffer),
      },
      bitMusic: {
        id: 'edm-bit-4',
        name: 'Breakdown "Drop!" Stinger (1.4s)',
        duration: beatSec * 3,
        bpm,
        buffer: vocalBitBuffer,
        waveform: extractWaveformPeaks(vocalBitBuffer),
      },
    },
    {
      id: 'edm-track-5',
      name: 'White Noise Riser & FX',
      category: 'fx',
      color: '#a855f7',
      volume: 0.65,
      pan: 0,
      isMuted: false,
      isSolo: false,
      loopState: 'stopped',
      bitPlaying: false,
      bitProgress: 0,
      loopProgress: 0,
      pauseOffset: 0,
      mainLoop: {
        id: 'edm-loop-5',
        name: 'Build-up Noise Riser (3.8s)',
        duration: loopDuration,
        bpm,
        buffer: fxBuffer,
        waveform: extractWaveformPeaks(fxBuffer),
      },
      bitMusic: {
        id: 'edm-bit-5',
        name: 'Vinyl Tape Stop Break (1.2s)',
        duration: beatSec * 2.5,
        bpm,
        buffer: fxBitBuffer,
        waveform: extractWaveformPeaks(fxBitBuffer),
      },
    },
  ];
}

// 2. Trap & Urban 808 Pack Generator
async function createTrapPack(): Promise<TrackData[]> {
  const bpm = 140;
  const beatSec = 60 / bpm; // 0.4285s
  const loopDuration = beatSec * 8; // 3.43s

  // Trap Drum loop
  const drumBuffer = await renderToBuffer(loopDuration, (ctx) => {
    // Heavy 808 Kick on 0, 1.75, 2.5
    synthesizeKick(ctx as unknown as AudioContext, 0, ctx.destination, 1.0);
    synthesizeKick(ctx as unknown as AudioContext, beatSec * 1.75, ctx.destination, 0.9);
    synthesizeKick(ctx as unknown as AudioContext, beatSec * 2.5, ctx.destination, 0.95);
    synthesizeKick(ctx as unknown as AudioContext, beatSec * 4, ctx.destination, 1.0);
    synthesizeKick(ctx as unknown as AudioContext, beatSec * 5.75, ctx.destination, 0.9);
    synthesizeKick(ctx as unknown as AudioContext, beatSec * 6.5, ctx.destination, 0.95);

    // Trap Snares on beats 2 and 6 (half-time 3rd beat)
    synthesizeSnare(ctx as unknown as AudioContext, beatSec * 2, ctx.destination, 1.0);
    synthesizeSnare(ctx as unknown as AudioContext, beatSec * 6, ctx.destination, 1.0);

    // Skittering Hi-Hats with rolls
    for (let i = 0; i < 16; i++) {
      synthesizeHiHat(ctx as unknown as AudioContext, i * (beatSec * 0.5), ctx.destination, false, 0.6);
    }
  });

  // Trap Bit Music: Triplet Snare Machine Gun Roll (1.5s)
  const trapBitBuffer = await renderToBuffer(beatSec * 3.5, (ctx) => {
    for (let i = 0; i < 21; i++) {
      const t = i * (beatSec / 6);
      synthesizeSnare(ctx as unknown as AudioContext, t, ctx.destination, 0.5 + (i / 21) * 0.5);
    }
  });

  // 808 Sub Bass
  const bassBuffer = await renderToBuffer(loopDuration, (ctx) => {
    synthesizeBassNote(ctx as unknown as AudioContext, 0, ctx.destination, 36.7, beatSec * 2, true); // D1
    synthesizeBassNote(ctx as unknown as AudioContext, beatSec * 2.5, ctx.destination, 41.2, beatSec * 1.5, true); // E1
    synthesizeBassNote(ctx as unknown as AudioContext, beatSec * 4, ctx.destination, 32.7, beatSec * 2.5, true); // C1
    synthesizeBassNote(ctx as unknown as AudioContext, beatSec * 6.5, ctx.destination, 36.7, beatSec * 1.5, true); // D1
  });

  // 808 Sub Bit Music: 808 Slide Drop (1.5s)
  const bassBitBuffer = await renderToBuffer(beatSec * 3.5, (ctx) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, 0);
    osc.frequency.exponentialRampToValueAtTime(25, beatSec * 3);
    g.gain.setValueAtTime(1.0, 0);
    g.gain.exponentialRampToValueAtTime(0.001, beatSec * 3.3);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(0);
    osc.stop(beatSec * 3.5);
  });

  // Dark Trap Piano / Bells
  const bellsBuffer = await renderToBuffer(loopDuration, (ctx) => {
    const notes = [293.66, 349.23, 440.0, 523.25, 440.0];
    notes.forEach((freq, idx) => {
      synthesizePluckChord(ctx as unknown as AudioContext, idx * (beatSec * 1.5), ctx.destination, [freq, freq * 2], beatSec * 1.2);
    });
  });

  // Bells Bit Music: Staccato Trap Break (1.5s)
  const bellsBitBuffer = await renderToBuffer(beatSec * 3.5, (ctx) => {
    [523.25, 493.88, 440.0, 392.0].forEach((freq, idx) => {
      synthesizePluckChord(ctx as unknown as AudioContext, idx * (beatSec * 0.75), ctx.destination, [freq], beatSec * 0.4);
    });
  });

  return [
    {
      id: 'trap-track-1',
      name: '808 Kick & Trap Snare',
      category: 'drums',
      color: '#f43f5e',
      volume: 0.9,
      pan: 0,
      isMuted: false,
      isSolo: false,
      loopState: 'stopped',
      bitPlaying: false,
      bitProgress: 0,
      loopProgress: 0,
      pauseOffset: 0,
      mainLoop: {
        id: 'trap-loop-1',
        name: 'Trap Half-Time Beat (3.4s)',
        duration: loopDuration,
        bpm,
        buffer: drumBuffer,
        waveform: extractWaveformPeaks(drumBuffer),
      },
      bitMusic: {
        id: 'trap-bit-1',
        name: 'Machine Gun Snare Roll (1.5s)',
        duration: beatSec * 3.5,
        bpm,
        buffer: trapBitBuffer,
        waveform: extractWaveformPeaks(trapBitBuffer),
      },
    },
    {
      id: 'trap-track-2',
      name: 'Gliding 808 Sub Bass',
      category: 'bass',
      color: '#8b5cf6',
      volume: 0.9,
      pan: 0,
      isMuted: false,
      isSolo: false,
      loopState: 'stopped',
      bitPlaying: false,
      bitProgress: 0,
      loopProgress: 0,
      pauseOffset: 0,
      mainLoop: {
        id: 'trap-loop-2',
        name: 'Sub 808 Boom Roll (3.4s)',
        duration: loopDuration,
        bpm,
        buffer: bassBuffer,
        waveform: extractWaveformPeaks(bassBuffer),
      },
      bitMusic: {
        id: 'trap-bit-2',
        name: 'Sub Bass Drop Slide (1.5s)',
        duration: beatSec * 3.5,
        bpm,
        buffer: bassBitBuffer,
        waveform: extractWaveformPeaks(bassBitBuffer),
      },
    },
    {
      id: 'trap-track-3',
      name: 'Dark Trap Bells & Keys',
      category: 'melody',
      color: '#06b6d4',
      volume: 0.8,
      pan: 0,
      isMuted: false,
      isSolo: false,
      loopState: 'stopped',
      bitPlaying: false,
      bitProgress: 0,
      loopProgress: 0,
      pauseOffset: 0,
      mainLoop: {
        id: 'trap-loop-3',
        name: 'Minor Bells Melody (3.4s)',
        duration: loopDuration,
        bpm,
        buffer: bellsBuffer,
        waveform: extractWaveformPeaks(bellsBuffer),
      },
      bitMusic: {
        id: 'trap-bit-3',
        name: 'Staccato Keys Break (1.5s)',
        duration: beatSec * 3.5,
        bpm,
        buffer: bellsBitBuffer,
        waveform: extractWaveformPeaks(bellsBitBuffer),
      },
    },
  ];
}

// 3. Synthwave / Cyberpunk 80s Pack
async function createSynthwavePack(): Promise<TrackData[]> {
  const bpm = 115;
  const beatSec = 60 / bpm; // 0.5217s
  const loopDuration = beatSec * 8; // 4.17s

  const drumBuffer = await renderToBuffer(loopDuration, (ctx) => {
    for (let b = 0; b < 8; b++) {
      // 80s Linndrum style kick on 1, 3, 5, 7
      if (b % 2 === 0) synthesizeKick(ctx as unknown as AudioContext, b * beatSec, ctx.destination, 0.95);
      // Gated Snare on 2, 4, 6, 8
      if (b % 2 === 1) synthesizeSnare(ctx as unknown as AudioContext, b * beatSec, ctx.destination, 1.0);
      // Closed 1/8 hats
      synthesizeHiHat(ctx as unknown as AudioContext, b * beatSec, ctx.destination, false, 0.6);
      synthesizeHiHat(ctx as unknown as AudioContext, (b + 0.5) * beatSec, ctx.destination, false, 0.5);
    }
  });

  const drumBitBuffer = await renderToBuffer(beatSec * 4, (ctx) => {
    // 80s Gated Tom Fill
    const freqs = [180, 150, 120, 90];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, idx * beatSec);
      osc.frequency.exponentialRampToValueAtTime(f * 0.7, idx * beatSec + 0.25);
      g.gain.setValueAtTime(0.9, idx * beatSec);
      g.gain.exponentialRampToValueAtTime(0.001, idx * beatSec + 0.35);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(idx * beatSec);
      osc.stop(idx * beatSec + 0.4);
    });
  });

  const bassBuffer = await renderToBuffer(loopDuration, (ctx) => {
    // Fast 1/16 running arp bass
    for (let i = 0; i < 32; i++) {
      const note = i < 16 ? 55.0 : 48.99; // A1 then G1
      synthesizeBassNote(ctx as unknown as AudioContext, i * (beatSec * 0.25), ctx.destination, note, beatSec * 0.18, false);
    }
  });

  const bassBitBuffer = await renderToBuffer(beatSec * 4, (ctx) => {
    // Filtered bass chug break
    for (let i = 0; i < 8; i++) {
      synthesizeBassNote(ctx as unknown as AudioContext, i * (beatSec * 0.5), ctx.destination, 41.2, beatSec * 0.3, false);
    }
  });

  const synthBuffer = await renderToBuffer(loopDuration, (ctx) => {
    // Neon retro chords
    const chords = [
      [220.0, 261.63, 329.63], // Am
      [196.0, 246.94, 293.66], // G
      [174.61, 220.0, 261.63], // F
      [196.0, 246.94, 293.66], // G
    ];
    chords.forEach((c, idx) => {
      synthesizePluckChord(ctx as unknown as AudioContext, idx * (beatSec * 2), ctx.destination, c, beatSec * 1.8);
    });
  });

  const synthBitBuffer = await renderToBuffer(beatSec * 4, (ctx) => {
    // Cyber solo riff
    [440, 554.37, 659.25, 880].forEach((f, idx) => {
      synthesizePluckChord(ctx as unknown as AudioContext, idx * (beatSec * 0.9), ctx.destination, [f], beatSec * 0.7);
    });
  });

  return [
    {
      id: 'synth-track-1',
      name: 'Retro Linndrum Beat',
      category: 'drums',
      color: '#ec4899',
      volume: 0.9,
      pan: 0,
      isMuted: false,
      isSolo: false,
      loopState: 'stopped',
      bitPlaying: false,
      bitProgress: 0,
      loopProgress: 0,
      pauseOffset: 0,
      mainLoop: {
        id: 'synth-loop-1',
        name: 'Gated 80s Drums (4.2s)',
        duration: loopDuration,
        bpm,
        buffer: drumBuffer,
        waveform: extractWaveformPeaks(drumBuffer),
      },
      bitMusic: {
        id: 'synth-bit-1',
        name: 'Gated Tom Roll (2.1s)',
        duration: beatSec * 4,
        bpm,
        buffer: drumBitBuffer,
        waveform: extractWaveformPeaks(drumBitBuffer),
      },
    },
    {
      id: 'synth-track-2',
      name: 'Running Arp Bass',
      category: 'bass',
      color: '#3b82f6',
      volume: 0.85,
      pan: 0,
      isMuted: false,
      isSolo: false,
      loopState: 'stopped',
      bitPlaying: false,
      bitProgress: 0,
      loopProgress: 0,
      pauseOffset: 0,
      mainLoop: {
        id: 'synth-loop-2',
        name: '16th Running Bass (4.2s)',
        duration: loopDuration,
        bpm,
        buffer: bassBuffer,
        waveform: extractWaveformPeaks(bassBuffer),
      },
      bitMusic: {
        id: 'synth-bit-2',
        name: 'Filtered Bass Chug (2.1s)',
        duration: beatSec * 4,
        bpm,
        buffer: bassBitBuffer,
        waveform: extractWaveformPeaks(bassBitBuffer),
      },
    },
    {
      id: 'synth-track-3',
      name: 'Neon Cyber Chords',
      category: 'melody',
      color: '#14b8a6',
      volume: 0.8,
      pan: 0,
      isMuted: false,
      isSolo: false,
      loopState: 'stopped',
      bitPlaying: false,
      bitProgress: 0,
      loopProgress: 0,
      pauseOffset: 0,
      mainLoop: {
        id: 'synth-loop-3',
        name: 'Vintage Polysynth (4.2s)',
        duration: loopDuration,
        bpm,
        buffer: synthBuffer,
        waveform: extractWaveformPeaks(synthBuffer),
      },
      bitMusic: {
        id: 'synth-bit-3',
        name: 'Neon Lead Solo (2.1s)',
        duration: beatSec * 4,
        bpm,
        buffer: synthBitBuffer,
        waveform: extractWaveformPeaks(synthBitBuffer),
      },
    },
  ];
}

export const PRESET_PACKS: PresetPackDefinition[] = [
  {
    id: 'edm-mainstage',
    name: 'EDM Mainstage & Electro',
    genre: 'Electronic / Dance',
    bpm: 128,
    description: 'Pumping festival kicks, saw basslines, euphoric plucks, and snare roll build fills.',
    generateTracks: createEdmPack,
  },
  {
    id: 'trap-808-beats',
    name: 'Trap & 808 Anthems',
    genre: 'Hip-Hop / Trap',
    bpm: 140,
    description: 'Heavy 808 booms, half-time trap snares, machine-gun fills, and dark minor bell chords.',
    generateTracks: createTrapPack,
  },
  {
    id: 'synthwave-80s',
    name: '80s Synthwave & Cyber',
    genre: 'Retro / Synthwave',
    bpm: 115,
    description: 'Gated Linndrums, running 16th arp bass, vintage analog brass, and gated tom fills.',
    generateTracks: createSynthwavePack,
  },
];
