/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TrackData } from '../types/audio';
import { extractWaveformPeaks, renderToBuffer, synthesizeSnare } from './synthesizer';

export interface FolderMusicFile {
  fileName: string;
  url: string;
  sizeBytes: number;
  updatedAt: string;
}

export interface SongMetaEntry {
  assignedSongs: string[];
  notes?: string;
  bpm?: number;
}

export type SongMetadataMap = Record<string, SongMetaEntry>;

const LOCAL_STORAGE_KEY = 'remixloop_song_metadata_v1';

const FOLDER_COLORS = ['#38bdf8', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function getLocalSongMetadata(): SongMetadataMap {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function setLocalSongMetadata(key: string, entry: SongMetaEntry) {
  const map = getLocalSongMetadata();
  map[key] = entry;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

export async function saveSongMetadata(key: string, entry: SongMetaEntry): Promise<void> {
  // Always save to browser localStorage immediately
  setLocalSongMetadata(key, entry);

  // Also persist to server public/music/songs-metadata.json if available (laptop/writable server)
  try {
    await fetch('/api/music-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, ...entry }),
    });
  } catch {
    // Static hosting fallback: localStorage already saved
  }
}

function generateWaveform(seedStr: string, size: number, numPeaks = 64): number[] {
  let seed = size || 98765;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed * 31 + seedStr.charCodeAt(i)) % 1000003;
  }
  const peaks: number[] = [];
  for (let i = 0; i < numPeaks; i++) {
    seed = (seed * 16807) % 2147483647;
    const base = 0.25 + ((seed % 100) / 100) * 0.65;
    const accent = i % 4 === 0 ? 0.1 : 0;
    peaks.push(Math.min(1, base + accent));
  }
  return peaks;
}

function probeUrlDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';

    const cleanup = () => {
      audio.onloadedmetadata = null;
      audio.onerror = null;
    };

    const timer = window.setTimeout(() => {
      cleanup();
      resolve(0);
    }, 5000);

    audio.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
      cleanup();
      resolve(dur);
    };

    audio.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      resolve(0);
    };

    audio.src = url;
  });
}

let cachedDefaultBitBuffer: AudioBuffer | null = null;
let cachedDefaultBitWaveform: number[] | null = null;

async function getDefaultFolderBitMusic(bpm = 120) {
  const dur = (60 / bpm) * 4;
  if (!cachedDefaultBitBuffer) {
    cachedDefaultBitBuffer = await renderToBuffer(dur, (ctx) => {
      for (let i = 0; i < 16; i++) {
        synthesizeSnare(ctx as unknown as AudioContext, i * (dur / 16), ctx.destination, 0.45 + (i / 16) * 0.55);
      }
    });
    cachedDefaultBitWaveform = extractWaveformPeaks(cachedDefaultBitBuffer);
  }
  return {
    buffer: cachedDefaultBitBuffer,
    waveform: cachedDefaultBitWaveform || new Array(48).fill(0.4),
    duration: cachedDefaultBitBuffer.duration,
  };
}

export async function fetchFolderMusicLibrary(): Promise<{
  tracks: TrackData[];
  metadata: SongMetadataMap;
}> {
  let files: FolderMusicFile[] = [];
  let serverMeta: SongMetadataMap = {};

  // 1. Try live Express API first (dev & Render Web Service)
  try {
    const res = await fetch('/api/music-library', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      files = Array.isArray(data.files) ? data.files : [];
      serverMeta = data.metadata && typeof data.metadata === 'object' ? data.metadata : {};
    } else {
      throw new Error('API unavailable');
    }
  } catch {
    // 2. Fallback to static manifest.json & songs-metadata.json (Render Static Site)
    try {
      const [manifestRes, metaRes] = await Promise.all([
        fetch('/music/manifest.json', { cache: 'no-store' }),
        fetch('/music/songs-metadata.json', { cache: 'no-store' }),
      ]);
      if (manifestRes.ok) {
        const m = await manifestRes.json();
        files = Array.isArray(m.files) ? m.files : [];
      }
      if (metaRes.ok) {
        serverMeta = await metaRes.json();
      }
    } catch {
      // No folder files available
    }
  }

  const localMeta = getLocalSongMetadata();
  const mergedMeta: SongMetadataMap = { ...serverMeta, ...localMeta };
  const defaultBit = await getDefaultFolderBitMusic(120);

  const tracks: TrackData[] = await Promise.all(
    files.map(async (f, index) => {
      const meta = mergedMeta[f.fileName] || { assignedSongs: [], notes: '' };
      const baseBpm = meta.bpm || 120;
      const cleanTitle = f.fileName.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
      const probedDuration = await probeUrlDuration(f.url);

      return {
        id: `folder-${f.fileName}`,
        name: cleanTitle,
        category: 'melody',
        color: FOLDER_COLORS[index % FOLDER_COLORS.length],
        volume: 0.9,
        pan: 0,
        isMuted: false,
        isSolo: false,
        loopState: 'stopped',
        bitPlaying: false,
        bitProgress: 0,
        loopProgress: 0,
        pauseOffset: 0,
        assignedSongs: Array.isArray(meta.assignedSongs) ? meta.assignedSongs : [],
        notes: meta.notes || '',
        sourceType: 'folder',
        folderFileName: f.fileName,
        mainLoop: {
          id: `folder-loop-${f.fileName}`,
          name: f.fileName,
          duration: probedDuration > 0 ? probedDuration : 4.0,
          bpm: baseBpm,
          buffer: null,
          objectUrl: f.url,
          isStreaming: true,
          waveform: generateWaveform(f.fileName, f.sizeBytes, 64),
          isCustom: false,
          fileName: f.fileName,
        },
        bitMusic: {
          id: `folder-bit-${f.fileName}`,
          name: 'Beat Fill Roll',
          duration: defaultBit.duration,
          bpm: baseBpm,
          buffer: defaultBit.buffer,
          waveform: defaultBit.waveform,
        },
      };
    })
  );

  return { tracks, metadata: mergedMeta };
}
