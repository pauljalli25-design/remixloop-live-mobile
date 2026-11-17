/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TrackCategory = 'drums' | 'bass' | 'melody' | 'vocals' | 'percussion' | 'fx';

export type LoopPlayState = 'stopped' | 'playing' | 'paused-for-bit';

export interface SoundSample {
  id: string;
  name: string;
  duration: number; // in seconds (supports 4s loops up to 20+ minute tracks)
  bpm: number; // native BPM of this audio sample
  buffer: AudioBuffer | null;
  objectUrl?: string; // streaming URL for long audio files (e.g. 15-20+ min)
  isStreaming?: boolean;
  waveform: number[]; // normalized peaks 0..1
  isCustom?: boolean;
  fileName?: string;
}

export interface TrackData {
  id: string;
  name: string;
  category: TrackCategory;
  color: string;
  mainLoop: SoundSample;
  bitMusic: SoundSample; // Beat fill / break that pauses loop and auto-resumes it on completion
  volume: number; // 0 to 1
  pan: number; // -1 to 1
  isMuted: boolean;
  isSolo: boolean;
  loopState: LoopPlayState;
  bitPlaying: boolean;
  bitProgress: number; // 0 to 100
  loopProgress: number; // 0 to 100
  pauseOffset: number; // in seconds
  assignedSongs?: string[]; // Songs suitable for this music track
  notes?: string; // Optional notes / style description
  sourceType?: 'folder' | 'preset' | 'custom';
  folderFileName?: string; // Stable file key inside public/music/
}

export interface SoundPack {
  id: string;
  name: string;
  genre: string;
  bpm: number;
  description: string;
  tracks: Omit<TrackData, 'loopState' | 'bitPlaying' | 'bitProgress' | 'loopProgress' | 'pauseOffset'>[];
}

export interface MasterFXState {
  filterType: 'lowpass' | 'highpass';
  filterCutoff: number;
  filterActive: boolean;
  delayTime: number;
  delayFeedback: number;
  delayActive: boolean;
  reverbAmount: number;
  reverbActive: boolean;
  repeaterDivision: 'off' | '1/4' | '1/8' | '1/16';
}
