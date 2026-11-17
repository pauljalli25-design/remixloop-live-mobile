/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.webm']);
const MUSIC_DIR = path.resolve(__dirname, 'public', 'music');
const METADATA_FILE = path.join(MUSIC_DIR, 'songs-metadata.json');

interface SongMetaEntry {
  assignedSongs: string[];
  notes?: string;
  bpm?: number;
}

type SongMetadataMap = Record<string, SongMetaEntry>;

function ensureMusicDir() {
  if (!fs.existsSync(MUSIC_DIR)) {
    fs.mkdirSync(MUSIC_DIR, { recursive: true });
  }
}

function readMetadata(): SongMetadataMap {
  ensureMusicDir();
  if (!fs.existsSync(METADATA_FILE)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(METADATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as SongMetadataMap) : {};
  } catch {
    return {};
  }
}

function writeMetadata(data: SongMetadataMap) {
  ensureMusicDir();
  fs.writeFileSync(METADATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function scanMusicFolder() {
  ensureMusicDir();
  const entries = fs.readdirSync(MUSIC_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => {
      const fullPath = path.join(MUSIC_DIR, entry.name);
      const stat = fs.statSync(fullPath);
      return {
        fileName: entry.name,
        url: `/music/${encodeURIComponent(entry.name)}`,
        sizeBytes: stat.size,
        updatedAt: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Serve music files directly from public/music so pasted files work immediately
  ensureMusicDir();
  app.use('/music', express.static(MUSIC_DIR));

  // API: Scan public/music folder + return saved song-name assignments
  app.get('/api/music-library', (_req, res) => {
    try {
      const files = scanMusicFolder();
      const metadata = readMetadata();
      res.json({ files, metadata });
    } catch (err) {
      console.error('Error scanning music folder:', err);
      res.status(500).json({ error: 'Failed to scan music folder' });
    }
  });

  // API: Save song-name assignments & notes for a track
  app.post('/api/music-metadata', (req, res) => {
    try {
      const { key, assignedSongs, notes, bpm } = req.body as {
        key?: string;
        assignedSongs?: string[];
        notes?: string;
        bpm?: number;
      };

      if (!key || typeof key !== 'string') {
        res.status(400).json({ error: 'Missing track key' });
        return;
      }

      const current = readMetadata();
      const cleanedSongs = Array.isArray(assignedSongs)
        ? assignedSongs.map((s) => String(s).trim()).filter(Boolean)
        : [];

      current[key] = {
        assignedSongs: cleanedSongs,
        notes: typeof notes === 'string' ? notes.trim() : current[key]?.notes || '',
        bpm: typeof bpm === 'number' && bpm >= 40 && bpm <= 240 ? bpm : current[key]?.bpm,
      };

      writeMetadata(current);
      res.json({ ok: true, metadata: current });
    } catch (err) {
      console.error('Error saving song metadata:', err);
      res.status(500).json({ error: 'Failed to save song metadata' });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`RemixLoop Live server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
