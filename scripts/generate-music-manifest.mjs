/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.webm']);
const musicDir = path.resolve('public', 'music');

if (!fs.existsSync(musicDir)) {
  fs.mkdirSync(musicDir, { recursive: true });
}

const entries = fs.readdirSync(musicDir, { withFileTypes: true });
const files = entries
  .filter((e) => e.isFile() && AUDIO_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
  .map((e) => {
    const stat = fs.statSync(path.join(musicDir, e.name));
    return {
      fileName: e.name,
      url: `/music/${encodeURIComponent(e.name)}`,
      sizeBytes: stat.size,
      updatedAt: stat.mtime.toISOString(),
    };
  })
  .sort((a, b) => a.fileName.localeCompare(b.fileName));

const manifestPath = path.join(musicDir, 'manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify({ generatedAt: new Date().toISOString(), files }, null, 2));
console.log(`Generated public/music/manifest.json with ${files.length} audio file(s).`);
