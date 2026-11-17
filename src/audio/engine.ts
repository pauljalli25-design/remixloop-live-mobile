/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { extractWaveformPeaks } from './synthesizer';
import { MasterFXState, SoundSample, TrackData } from '../types/audio';

type StateChangeListener = (tracks: TrackData[]) => void;

interface ActiveTrackNodes {
  gainNode: GainNode;
  pannerNode: StereoPannerNode;
  mainSource: AudioBufferSourceNode | null;
  bitSource: AudioBufferSourceNode | null;
  // Streaming HTMLAudioElement support for long (15-20+ min) files
  mainAudioEl: HTMLAudioElement | null;
  mainMediaSource: MediaElementAudioSourceNode | null;
  mainAudioSrc: string | null;
  bitAudioEl: HTMLAudioElement | null;
  bitMediaSource: MediaElementAudioSourceNode | null;
  bitAudioSrc: string | null;

  // Accurate BPM-scaled timing tracking for buffer sources
  accumulatedBufferTime: number;
  lastRateUpdateTime: number;
  currentRate: number;

  bitAccumulatedTime: number;
  bitLastRateUpdateTime: number;
  bitCurrentRate: number;

  pauseOffset: number;
  wasPlayingWhenBitStarted: boolean;
}

export class RemixAudioEngine {
  private static instance: RemixAudioEngine | null = null;

  public audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedbackGain: GainNode | null = null;
  private mediaDest: MediaStreamAudioDestinationNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  private trackNodes: Map<string, ActiveTrackNodes> = new Map();
  private tracks: TrackData[] = [];
  private listeners: Set<StateChangeListener> = new Set();

  private isRecording = false;
  private recordingDuration = 0;
  private recordingInterval: number | null = null;

  private metronomeEnabled = false;
  private metronomeInterval: number | null = null;
  private masterBpm = 128;

  private fxState: MasterFXState = {
    filterType: 'lowpass',
    filterCutoff: 20000,
    filterActive: false,
    delayTime: 0.3,
    delayFeedback: 0.35,
    delayActive: false,
    reverbAmount: 0.3,
    reverbActive: false,
    repeaterDivision: 'off',
  };

  private animationFrameId: number | null = null;

  private constructor() {
    // Lazy init on first user touch
  }

  public static getInstance(): RemixAudioEngine {
    if (!RemixAudioEngine.instance) {
      RemixAudioEngine.instance = new RemixAudioEngine();
    }
    return RemixAudioEngine.instance;
  }

  public async initAudio(): Promise<AudioContext> {
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass();

      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(0.9, this.audioCtx.currentTime);

      this.filterNode = this.audioCtx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.setValueAtTime(20000, this.audioCtx.currentTime);
      this.filterNode.Q.setValueAtTime(2.0, this.audioCtx.currentTime);

      this.delayNode = this.audioCtx.createDelay();
      this.delayNode.delayTime.setValueAtTime(this.fxState.delayTime, this.audioCtx.currentTime);

      this.delayFeedbackGain = this.audioCtx.createGain();
      this.delayFeedbackGain.gain.setValueAtTime(0, this.audioCtx.currentTime);

      this.delayNode.connect(this.delayFeedbackGain);
      this.delayFeedbackGain.connect(this.delayNode);

      this.mediaDest = this.audioCtx.createMediaStreamDestination();

      this.filterNode.connect(this.masterGain);
      this.filterNode.connect(this.delayNode);
      this.delayNode.connect(this.masterGain);

      this.masterGain.connect(this.audioCtx.destination);
      this.masterGain.connect(this.mediaDest);

      this.startProgressTicker();
    }

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    return this.audioCtx;
  }

  public subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    listener([...this.tracks]);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const cloned = this.tracks.map((t) => ({ ...t }));
    this.listeners.forEach((fn) => fn(cloned));
  }

  public setTracks(tracks: TrackData[]) {
    this.stopAll();
    this.tracks = tracks;
    this.setupTrackNodes();
    this.notify();
  }

  public replaceTracksBySource(sourceType: 'folder' | 'preset' | 'custom', incoming: TrackData[]) {
    // Stop tracks of this sourceType cleanly
    this.tracks
      .filter((t) => (t.sourceType || 'preset') === sourceType)
      .forEach((t) => this.stopSingleTrackCompletely(t));

    const remaining = this.tracks.filter((t) => (t.sourceType || 'preset') !== sourceType);

    if (sourceType === 'folder') {
      this.tracks = [...incoming, ...remaining];
    } else {
      this.tracks = [...remaining, ...incoming];
    }

    this.setupTrackNodes();
    this.notify();
  }

  public updateTrackMetadata(
    trackId: string,
    assignedSongs: string[],
    notes: string,
    baseBpm?: number
  ) {
    const track = this.tracks.find((t) => t.id === trackId);
    if (!track) return;

    track.assignedSongs = assignedSongs;
    track.notes = notes;
    if (typeof baseBpm === 'number' && baseBpm >= 40 && baseBpm <= 240) {
      track.mainLoop.bpm = baseBpm;
      track.bitMusic.bpm = baseBpm;
      // Refresh live playback rate if playing
      this.setMasterBpm(this.masterBpm);
    }
    this.notify();
  }

  private setupTrackNodes() {
    if (!this.audioCtx || !this.filterNode) return;

    this.tracks.forEach((track) => {
      if (!this.trackNodes.has(track.id)) {
        const gainNode = this.audioCtx!.createGain();
        gainNode.gain.setValueAtTime(track.isMuted ? 0 : track.volume, this.audioCtx!.currentTime);

        const pannerNode = this.audioCtx!.createStereoPanner();
        pannerNode.pan.setValueAtTime(track.pan, this.audioCtx!.currentTime);

        pannerNode.connect(gainNode);
        gainNode.connect(this.filterNode!);

        this.trackNodes.set(track.id, {
          gainNode,
          pannerNode,
          mainSource: null,
          bitSource: null,
          mainAudioEl: null,
          mainMediaSource: null,
          mainAudioSrc: null,
          bitAudioEl: null,
          bitMediaSource: null,
          bitAudioSrc: null,
          accumulatedBufferTime: 0,
          lastRateUpdateTime: 0,
          currentRate: 1,
          bitAccumulatedTime: 0,
          bitLastRateUpdateTime: 0,
          bitCurrentRate: 1,
          pauseOffset: 0,
          wasPlayingWhenBitStarted: false,
        });
      }
    });
  }

  private getPlaybackRate(sampleBpm: number): number {
    const base = sampleBpm > 0 ? sampleBpm : 128;
    return Math.max(0.25, Math.min(4.0, this.masterBpm / base));
  }

  // Stop every track EXCEPT optional excludedTrackId (enforces single-file exclusive playback)
  private stopOtherTracks(excludedTrackId?: string) {
    this.tracks.forEach((t) => {
      if (t.id === excludedTrackId) return;
      this.stopSingleTrackCompletely(t);
    });
  }

  private stopSingleTrackCompletely(track: TrackData) {
    this.stopTrackMainLoop(track.id);
    this.stopTrackBitMusic(track.id);
    const nodes = this.trackNodes.get(track.id);
    if (nodes) {
      nodes.wasPlayingWhenBitStarted = false;
      nodes.pauseOffset = 0;
      nodes.accumulatedBufferTime = 0;
    }
    track.loopState = 'stopped';
    track.bitPlaying = false;
    track.bitProgress = 0;
    track.loopProgress = 0;
    track.pauseOffset = 0;
  }

  // --- TOGGLE MAIN LOOP (Exclusive: stops any other playing track) ---
  public async toggleMainLoop(trackId: string) {
    await this.initAudio();
    this.setupTrackNodes();

    const track = this.tracks.find((t) => t.id === trackId);
    const nodes = this.trackNodes.get(trackId);
    if (!track || !nodes || !this.audioCtx) return;

    if (track.loopState === 'playing') {
      // Stop this track
      this.stopSingleTrackCompletely(track);
    } else {
      // Stop any OTHER playing track first (only 1 file plays at a time)
      this.stopOtherTracks(trackId);

      // If this track was playing its own bit music or paused-for-bit, clear bit music and start loop cleanly
      if (track.bitPlaying) {
        this.stopTrackBitMusic(trackId);
        track.bitPlaying = false;
        track.bitProgress = 0;
      }

      this.startTrackMainLoop(trackId, 0);
      track.loopState = 'playing';
      track.pauseOffset = 0;
    }

    this.notify();
  }

  private startTrackMainLoop(trackId: string, offset = 0) {
    if (!this.audioCtx) return;
    const track = this.tracks.find((t) => t.id === trackId);
    const nodes = this.trackNodes.get(trackId);
    if (!track || !nodes) return;

    const sample = track.mainLoop;
    const rate = this.getPlaybackRate(sample.bpm);
    const safeOffset = sample.duration > 0 ? offset % sample.duration : 0;

    // 1. Streaming mode for long files (e.g., 15-20+ min)
    if (sample.isStreaming && sample.objectUrl) {
      this.stopTrackMainLoop(trackId);

      if (!nodes.mainAudioEl) {
        const audioEl = new Audio();
        audioEl.crossOrigin = 'anonymous';
        audioEl.preload = 'auto';
        const mediaSrc = this.audioCtx.createMediaElementSource(audioEl);
        mediaSrc.connect(nodes.pannerNode);
        nodes.mainAudioEl = audioEl;
        nodes.mainMediaSource = mediaSrc;
      }

      const el = nodes.mainAudioEl;
      if (nodes.mainAudioSrc !== sample.objectUrl) {
        el.src = sample.objectUrl;
        nodes.mainAudioSrc = sample.objectUrl;
      }

      el.loop = true;
      el.playbackRate = rate;
      try {
        el.currentTime = safeOffset;
      } catch {
        // Ignore if not yet seekable; will play from 0
      }

      el.play().catch((err) => console.warn('Audio element play blocked:', err));
      nodes.currentRate = rate;
      nodes.pauseOffset = safeOffset;
      return;
    }

    // 2. Sample-accurate AudioBuffer mode for loops
    if (!sample.buffer) return;

    if (nodes.mainSource) {
      try {
        nodes.mainSource.stop();
        nodes.mainSource.disconnect();
      } catch {
        // ignore
      }
    }

    const source = this.audioCtx.createBufferSource();
    source.buffer = sample.buffer;
    source.loop = true;
    source.playbackRate.setValueAtTime(rate, this.audioCtx.currentTime);
    source.connect(nodes.pannerNode);

    source.start(0, safeOffset);

    nodes.mainSource = source;
    nodes.accumulatedBufferTime = safeOffset;
    nodes.lastRateUpdateTime = this.audioCtx.currentTime;
    nodes.currentRate = rate;
    nodes.pauseOffset = safeOffset;
  }

  private stopTrackMainLoop(trackId: string) {
    const nodes = this.trackNodes.get(trackId);
    if (!nodes) return;

    if (nodes.mainSource) {
      try {
        nodes.mainSource.stop();
        nodes.mainSource.disconnect();
      } catch {
        // ignore
      }
      nodes.mainSource = null;
    }

    if (nodes.mainAudioEl && !nodes.mainAudioEl.paused) {
      nodes.mainAudioEl.pause();
    }
  }

  private stopTrackBitMusic(trackId: string) {
    const nodes = this.trackNodes.get(trackId);
    if (!nodes) return;

    if (nodes.bitSource) {
      nodes.bitSource.onended = null;
      try {
        nodes.bitSource.stop();
        nodes.bitSource.disconnect();
      } catch {
        // ignore
      }
      nodes.bitSource = null;
    }

    if (nodes.bitAudioEl) {
      nodes.bitAudioEl.onended = null;
      if (!nodes.bitAudioEl.paused) {
        nodes.bitAudioEl.pause();
      }
    }
  }

  // --- TRIGGER "BIT MUSIC" (BEAT FILL / BREAK) ---
  // Exclusive playback across different tracks; pauses own Main Loop and resumes it on completion!
  public async triggerBitMusic(trackId: string) {
    await this.initAudio();
    this.setupTrackNodes();

    const track = this.tracks.find((t) => t.id === trackId);
    const nodes = this.trackNodes.get(trackId);
    if (!track || !nodes || !this.audioCtx) return;

    const bitSample = track.bitMusic;
    if (!bitSample.buffer && !(bitSample.isStreaming && bitSample.objectUrl)) return;

    // 1. Stop any OTHER tracks so two files never play at the same time
    this.stopOtherTracks(trackId);

    // 2. If THIS track's main loop is currently playing, pause it and save offset!
    const isCurrentlyPlaying = track.loopState === 'playing';
    if (isCurrentlyPlaying) {
      let elapsed = 0;
      if (track.mainLoop.isStreaming && nodes.mainAudioEl) {
        elapsed = nodes.mainAudioEl.currentTime;
        nodes.mainAudioEl.pause();
      } else if (nodes.mainSource) {
        const now = this.audioCtx.currentTime;
        const dur = track.mainLoop.duration || 1;
        elapsed =
          (nodes.accumulatedBufferTime + (now - nodes.lastRateUpdateTime) * nodes.currentRate) % dur;
        this.stopTrackMainLoop(trackId);
      }
      nodes.pauseOffset = elapsed;
      track.pauseOffset = elapsed;
      track.loopState = 'paused-for-bit';
      nodes.wasPlayingWhenBitStarted = true;
    } else if (track.loopState !== 'paused-for-bit') {
      nodes.wasPlayingWhenBitStarted = false;
    }

    // 3. Stop any previous bit music on this track cleanly before re-triggering
    this.stopTrackBitMusic(trackId);

    const rate = this.getPlaybackRate(bitSample.bpm);
    track.bitPlaying = true;
    track.bitProgress = 0;

    const handleBitComplete = () => {
      track.bitPlaying = false;
      track.bitProgress = 0;
      nodes.bitSource = null;

      // Auto-resume own main loop if it was paused for this bit
      if (nodes.wasPlayingWhenBitStarted && track.loopState === 'paused-for-bit') {
        nodes.wasPlayingWhenBitStarted = false;
        this.startTrackMainLoop(trackId, nodes.pauseOffset);
        track.loopState = 'playing';
      }

      this.notify();
    };

    // 4a. Streaming Bit Music
    if (bitSample.isStreaming && bitSample.objectUrl) {
      if (!nodes.bitAudioEl) {
        const audioEl = new Audio();
        audioEl.crossOrigin = 'anonymous';
        audioEl.preload = 'auto';
        const mediaSrc = this.audioCtx.createMediaElementSource(audioEl);
        mediaSrc.connect(nodes.pannerNode);
        nodes.bitAudioEl = audioEl;
        nodes.bitMediaSource = mediaSrc;
      }

      const el = nodes.bitAudioEl;
      if (nodes.bitAudioSrc !== bitSample.objectUrl) {
        el.src = bitSample.objectUrl;
        nodes.bitAudioSrc = bitSample.objectUrl;
      }

      el.loop = false;
      el.playbackRate = rate;
      try {
        el.currentTime = 0;
      } catch {
        // ignore
      }
      el.onended = handleBitComplete;
      el.play().catch((err) => console.warn('Bit audio play blocked:', err));

      nodes.bitCurrentRate = rate;
      this.notify();
      return;
    }

    // 4b. Buffer Bit Music
    if (!bitSample.buffer) return;
    const bitSource = this.audioCtx.createBufferSource();
    bitSource.buffer = bitSample.buffer;
    bitSource.loop = false;
    bitSource.playbackRate.setValueAtTime(rate, this.audioCtx.currentTime);
    bitSource.connect(nodes.pannerNode);

    nodes.bitSource = bitSource;
    nodes.bitAccumulatedTime = 0;
    nodes.bitLastRateUpdateTime = this.audioCtx.currentTime;
    nodes.bitCurrentRate = rate;

    bitSource.onended = handleBitComplete;
    bitSource.start(0);
    this.notify();
  }

  // Master Stop All
  public stopAll() {
    this.tracks.forEach((track) => {
      this.stopSingleTrackCompletely(track);
    });
    this.notify();
  }

  // Progress ticker for waveforms and bit progress
  private startProgressTicker() {
    if (this.animationFrameId) return;

    const tick = () => {
      if (!this.audioCtx) {
        this.animationFrameId = requestAnimationFrame(tick);
        return;
      }

      let hasActive = false;
      const now = this.audioCtx.currentTime;

      this.tracks.forEach((track) => {
        const nodes = this.trackNodes.get(track.id);
        if (!nodes) return;

        // Main loop progress
        if (track.loopState === 'playing' && track.mainLoop.duration > 0) {
          if (track.mainLoop.isStreaming && nodes.mainAudioEl) {
            const dur = nodes.mainAudioEl.duration || track.mainLoop.duration;
            track.loopProgress = Math.min(100, (nodes.mainAudioEl.currentTime / dur) * 100);
          } else {
            const elapsed =
              (nodes.accumulatedBufferTime +
                (now - nodes.lastRateUpdateTime) * nodes.currentRate) %
              track.mainLoop.duration;
            track.loopProgress = Math.min(100, (elapsed / track.mainLoop.duration) * 100);
          }
          hasActive = true;
        } else if (track.loopState === 'paused-for-bit' && track.mainLoop.duration > 0) {
          track.loopProgress = Math.min(100, (nodes.pauseOffset / track.mainLoop.duration) * 100);
        }

        // Bit progress
        if (track.bitPlaying && track.bitMusic.duration > 0) {
          if (track.bitMusic.isStreaming && nodes.bitAudioEl) {
            const dur = nodes.bitAudioEl.duration || track.bitMusic.duration;
            track.bitProgress = Math.min(100, (nodes.bitAudioEl.currentTime / dur) * 100);
          } else {
            const bitElapsed =
              nodes.bitAccumulatedTime +
              (now - nodes.bitLastRateUpdateTime) * nodes.bitCurrentRate;
            track.bitProgress = Math.min(100, (bitElapsed / track.bitMusic.duration) * 100);
          }
          hasActive = true;
        }
      });

      if (hasActive) {
        this.notify();
      }

      this.animationFrameId = requestAnimationFrame(tick);
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  public setTrackVolume(trackId: string, volume: number) {
    const track = this.tracks.find((t) => t.id === trackId);
    const nodes = this.trackNodes.get(trackId);
    if (!track || !nodes || !this.audioCtx) return;

    track.volume = volume;
    if (!track.isMuted) {
      nodes.gainNode.gain.setValueAtTime(volume, this.audioCtx.currentTime);
    }
    this.notify();
  }

  public setTrackPan(trackId: string, pan: number) {
    const track = this.tracks.find((t) => t.id === trackId);
    const nodes = this.trackNodes.get(trackId);
    if (!track || !nodes || !this.audioCtx) return;

    track.pan = pan;
    nodes.pannerNode.pan.setValueAtTime(pan, this.audioCtx.currentTime);
    this.notify();
  }

  public toggleTrackMute(trackId: string) {
    const track = this.tracks.find((t) => t.id === trackId);
    const nodes = this.trackNodes.get(trackId);
    if (!track || !nodes || !this.audioCtx) return;

    track.isMuted = !track.isMuted;
    const targetGain = track.isMuted ? 0 : track.volume;
    nodes.gainNode.gain.setValueAtTime(targetGain, this.audioCtx.currentTime);
    this.notify();
  }

  public toggleTrackSolo(trackId: string) {
    const target = this.tracks.find((t) => t.id === trackId);
    if (!target) return;

    target.isSolo = !target.isSolo;
    const anySolo = this.tracks.some((t) => t.isSolo);

    this.tracks.forEach((t) => {
      const n = this.trackNodes.get(t.id);
      if (!n || !this.audioCtx) return;

      if (anySolo) {
        const gainVal = t.isSolo && !t.isMuted ? t.volume : 0;
        n.gainNode.gain.setValueAtTime(gainVal, this.audioCtx.currentTime);
      } else {
        const gainVal = t.isMuted ? 0 : t.volume;
        n.gainNode.gain.setValueAtTime(gainVal, this.audioCtx.currentTime);
      }
    });

    this.notify();
  }

  // Probe duration lightweightly using HTMLAudioElement metadata so 15-20+ min files never crash mobile RAM
  private probeMediaDuration(objectUrl: string): Promise<number> {
    return new Promise((resolve) => {
      const tempAudio = new Audio();
      tempAudio.preload = 'metadata';

      const cleanup = () => {
        tempAudio.onloadedmetadata = null;
        tempAudio.onerror = null;
      };

      const timeout = window.setTimeout(() => {
        cleanup();
        resolve(0);
      }, 4000);

      tempAudio.onloadedmetadata = () => {
        window.clearTimeout(timeout);
        const dur = Number.isFinite(tempAudio.duration) ? tempAudio.duration : 0;
        cleanup();
        resolve(dur);
      };

      tempAudio.onerror = () => {
        window.clearTimeout(timeout);
        cleanup();
        resolve(0);
      };

      tempAudio.src = objectUrl;
    });
  }

  // Generate clean deterministic waveform for long streaming files without decoding hundreds of MB of PCM
  private generateStreamingWaveform(seedStr: string, size: number, numPeaks = 64): number[] {
    let seed = size || 12345;
    for (let i = 0; i < seedStr.length; i++) {
      seed = (seed * 31 + seedStr.charCodeAt(i)) % 1000003;
    }
    const peaks: number[] = [];
    for (let i = 0; i < numPeaks; i++) {
      seed = (seed * 16807) % 2147483647;
      const base = 0.25 + ((seed % 100) / 100) * 0.65;
      // Add slight rhythmic pulsing shape
      const beatAccent = i % 4 === 0 ? 0.12 : 0;
      peaks.push(Math.min(1, base + beatAccent));
    }
    return peaks;
  }

  // --- CUSTOM AUDIO INSERTION (Supports 4s loops AND 15-20+ minute tracks) ---
  public async decodeAudioFile(file: File, baseBpm?: number): Promise<SoundSample> {
    await this.initAudio();
    const objectUrl = URL.createObjectURL(file);
    const sampleBpm = baseBpm || this.masterBpm;

    // Inspect duration via lightweight metadata probe first
    const probedDuration = await this.probeMediaDuration(objectUrl);

    // If file is longer than 45 seconds (e.g. 5m, 15m, 20m) or larger than 6MB, use low-memory streaming
    const shouldStream = probedDuration > 45 || file.size > 6 * 1024 * 1024;

    if (shouldStream) {
      const duration = probedDuration > 0 ? probedDuration : 60;
      return {
        id: 'stream-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        name: file.name.replace(/\.[^/.]+$/, ''),
        duration,
        bpm: sampleBpm,
        buffer: null,
        objectUrl,
        isStreaming: true,
        waveform: this.generateStreamingWaveform(file.name, file.size, 64),
        isCustom: true,
        fileName: file.name,
      };
    }

    // Short loop: decode into sample-accurate AudioBuffer for zero-gap looping
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await this.audioCtx!.decodeAudioData(arrayBuffer);
      URL.revokeObjectURL(objectUrl);
      const peaks = extractWaveformPeaks(audioBuffer, 64);

      return {
        id: 'custom-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        name: file.name.replace(/\.[^/.]+$/, ''),
        duration: audioBuffer.duration,
        bpm: sampleBpm,
        buffer: audioBuffer,
        isStreaming: false,
        waveform: peaks,
        isCustom: true,
        fileName: file.name,
      };
    } catch {
      // Fallback to streaming if decodeAudioData fails on a codec supported by <audio>
      return {
        id: 'stream-fb-' + Date.now(),
        name: file.name.replace(/\.[^/.]+$/, ''),
        duration: probedDuration > 0 ? probedDuration : 10,
        bpm: sampleBpm,
        buffer: null,
        objectUrl,
        isStreaming: true,
        waveform: this.generateStreamingWaveform(file.name, file.size, 64),
        isCustom: true,
        fileName: file.name,
      };
    }
  }

  public updateTrackSound(trackId: string, type: 'mainLoop' | 'bitMusic', sample: SoundSample) {
    const track = this.tracks.find((t) => t.id === trackId);
    if (!track) return;

    if (type === 'mainLoop') {
      const wasPlaying = track.loopState === 'playing';
      if (wasPlaying) {
        this.stopTrackMainLoop(trackId);
      }
      track.mainLoop = sample;
      if (wasPlaying) {
        this.startTrackMainLoop(trackId, 0);
      }
    } else {
      if (track.bitPlaying) {
        this.stopTrackBitMusic(trackId);
        track.bitPlaying = false;
      }
      track.bitMusic = sample;
    }

    this.notify();
  }

  public addCustomTrack(newTrack: TrackData) {
    this.tracks.push(newTrack);
    this.setupTrackNodes();
    this.notify();
  }

  public removeTrack(trackId: string) {
    this.stopTrackMainLoop(trackId);
    this.stopTrackBitMusic(trackId);
    const nodes = this.trackNodes.get(trackId);
    if (nodes) {
      nodes.gainNode.disconnect();
      nodes.pannerNode.disconnect();
      this.trackNodes.delete(trackId);
    }
    this.tracks = this.tracks.filter((t) => t.id !== trackId);
    this.notify();
  }

  // --- MASTER DJ FX CONTROLS ---
  public setDJFilter(cutoff: number, type: 'lowpass' | 'highpass' = 'lowpass', active = true) {
    this.fxState.filterCutoff = cutoff;
    this.fxState.filterType = type;
    this.fxState.filterActive = active;

    if (this.filterNode && this.audioCtx) {
      this.filterNode.type = type;
      this.filterNode.frequency.setValueAtTime(active ? cutoff : 20000, this.audioCtx.currentTime);
    }
  }

  public setDJDelay(time: number, feedback: number, active: boolean) {
    this.fxState.delayTime = time;
    this.fxState.delayFeedback = feedback;
    this.fxState.delayActive = active;

    if (this.delayNode && this.delayFeedbackGain && this.audioCtx) {
      this.delayNode.delayTime.setValueAtTime(time, this.audioCtx.currentTime);
      this.delayFeedbackGain.gain.setValueAtTime(active ? feedback : 0, this.audioCtx.currentTime);
    }
  }

  // --- MASTER BPM APPLIED TO BOTH METRONOME AND BEATS (LOOPS + BIT MUSIC) ---
  public setMasterBpm(bpm: number) {
    const clampedBpm = Math.max(40, Math.min(240, bpm));
    this.masterBpm = clampedBpm;

    // 1. Update metronome timing if running
    if (this.metronomeEnabled) {
      this.startMetronome();
    }

    // 2. Apply BPM speed change immediately to any playing loops or bit music!
    if (this.audioCtx) {
      const now = this.audioCtx.currentTime;

      this.tracks.forEach((track) => {
        const nodes = this.trackNodes.get(track.id);
        if (!nodes) return;

        // Update Main Loop playback speed
        const mainRate = this.getPlaybackRate(track.mainLoop.bpm);
        if (track.loopState === 'playing') {
          if (track.mainLoop.isStreaming && nodes.mainAudioEl) {
            nodes.mainAudioEl.playbackRate = mainRate;
            nodes.currentRate = mainRate;
          } else if (nodes.mainSource) {
            const dur = track.mainLoop.duration || 1;
            nodes.accumulatedBufferTime =
              (nodes.accumulatedBufferTime +
                (now - nodes.lastRateUpdateTime) * nodes.currentRate) %
              dur;
            nodes.lastRateUpdateTime = now;
            nodes.currentRate = mainRate;
            nodes.mainSource.playbackRate.setValueAtTime(mainRate, now);
          }
        }

        // Update Bit Music playback speed
        const bitRate = this.getPlaybackRate(track.bitMusic.bpm);
        if (track.bitPlaying) {
          if (track.bitMusic.isStreaming && nodes.bitAudioEl) {
            nodes.bitAudioEl.playbackRate = bitRate;
            nodes.bitCurrentRate = bitRate;
          } else if (nodes.bitSource) {
            nodes.bitAccumulatedTime +=
              (now - nodes.bitLastRateUpdateTime) * nodes.bitCurrentRate;
            nodes.bitLastRateUpdateTime = now;
            nodes.bitCurrentRate = bitRate;
            nodes.bitSource.playbackRate.setValueAtTime(bitRate, now);
          }
        }
      });
    }
  }

  public getMasterBpm(): number {
    return this.masterBpm;
  }

  public toggleMetronome(): boolean {
    this.metronomeEnabled = !this.metronomeEnabled;
    if (this.metronomeEnabled) {
      this.initAudio().then(() => {
        this.startMetronome();
      });
    } else {
      this.stopMetronome();
    }
    return this.metronomeEnabled;
  }

  private startMetronome() {
    this.stopMetronome();
    const intervalMs = (60 / this.masterBpm) * 1000;
    this.playMetronomeClick();
    this.metronomeInterval = window.setInterval(() => {
      this.playMetronomeClick();
    }, intervalMs);
  }

  private stopMetronome() {
    if (this.metronomeInterval) {
      clearInterval(this.metronomeInterval);
      this.metronomeInterval = null;
    }
  }

  private playMetronomeClick() {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, this.audioCtx.currentTime);
    gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(this.masterGain || this.audioCtx.destination);
    osc.start(this.audioCtx.currentTime);
    osc.stop(this.audioCtx.currentTime + 0.05);
  }

  // --- LIVE REMIX RECORDING ---
  public async startLiveRecording(): Promise<boolean> {
    await this.initAudio();
    if (!this.mediaDest) return false;

    this.recordedChunks = [];
    try {
      this.mediaRecorder = new MediaRecorder(this.mediaDest.stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : '',
      });
    } catch {
      this.mediaRecorder = new MediaRecorder(this.mediaDest.stream);
    }

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };

    this.mediaRecorder.start(100);
    this.isRecording = true;
    this.recordingDuration = 0;

    this.recordingInterval = window.setInterval(() => {
      this.recordingDuration += 1;
    }, 1000);

    return true;
  }

  public stopLiveRecording(): Promise<{ blob: Blob; url: string; duration: number } | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || !this.isRecording) {
        resolve(null);
        return;
      }

      if (this.recordingInterval) {
        clearInterval(this.recordingInterval);
        this.recordingInterval = null;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const dur = this.recordingDuration;
        this.isRecording = false;
        this.recordingDuration = 0;
        resolve({ blob, url, duration: dur });
      };

      this.mediaRecorder.stop();
    });
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  public getRecordingDuration(): number {
    return this.recordingDuration;
  }

  public getTracks(): TrackData[] {
    return this.tracks;
  }
}
