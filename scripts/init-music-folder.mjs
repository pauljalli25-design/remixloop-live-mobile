/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';

const musicDir = path.resolve('public', 'music');
fs.mkdirSync(musicDir, { recursive: true });

// Generate a clean 16-bit PCM WAV file from a float sample generator
function writeWavFile(filePath, durationSec, sampleRate, sampleFn) {
  const numSamples = Math.floor(durationSec * sampleRate);
  const numChannels = 1;
  const bytesPerSample = 2;
  const dataSize = numSamples * numChannels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const val = Math.max(-1, Math.min(1, sampleFn(t, durationSec)));
    buffer.writeInt16LE(Math.floor(val * 32767), 44 + i * 2);
  }

  fs.writeFileSync(filePath, buffer);
}

// 1. Sample Drum & Percussion Groove (4 seconds, 120 BPM)
writeWavFile(path.join(musicDir, 'Afro_Groove_Beat.wav'), 4.0, 22050, (t) => {
  const beat = t % 0.5; // 120 BPM = 0.5s per beat
  const sub = t % 0.25;
  // Kick on beat
  const kick = Math.exp(-beat * 18) * Math.sin(2 * Math.PI * (120 * Math.exp(-beat * 10) + 42) * beat);
  // Shaker / perc on offbeat
  const perc = sub > 0.12 ? Math.exp(-(sub - 0.12) * 35) * (Math.sin(t * 2400) * 0.25) : 0;
  return (kick * 0.7 + perc) * 0.8;
});

// 2. Sample Warm Worship / Melody Pad (4 seconds, 120 BPM)
writeWavFile(path.join(musicDir, 'Warm_Chord_Pad.wav'), 4.0, 22050, (t) => {
  const freqs = t < 2.0 ? [261.63, 329.63, 392.0] : [220.0, 261.63, 329.63]; // C major -> A minor
  let sum = 0;
  for (const f of freqs) {
    sum += Math.sin(2 * Math.PI * f * t) * 0.22;
  }
  const env = Math.min(1, (t % 2.0) * 6) * Math.min(1, (2.0 - (t % 2.0)) * 6);
  return sum * env;
});

// Write README.txt
fs.writeFileSync(
  path.join(musicDir, 'README.txt'),
  `REMIXLOOP MUSIC FOLDER
======================
Paste your music files (.mp3, .wav, .ogg, .m4a, .aac, .flac) directly into this folder (public/music/).
Supports short 4s-30s loops as well as long 15-20+ minute tracks!

When you push this folder to GitHub and deploy to Render:
- All music files in this folder appear automatically in the "Folder" tab of the app.
- Any song names and notes you assign in the app are saved to "songs-metadata.json" in this folder.
- Commit "songs-metadata.json" along with your music files so your song search database is live on Render!
`
);

// Write initial songs-metadata.json if it doesn't exist
const metaPath = path.join(musicDir, 'songs-metadata.json');
if (!fs.existsSync(metaPath)) {
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        'Afro_Groove_Beat.wav': {
          assignedSongs: ['Celebration Groove', 'Sunday Dance Intro'],
          notes: 'Upbeat percussion groove · 120 BPM',
          bpm: 120,
        },
        'Warm_Chord_Pad.wav': {
          assignedSongs: ['Acoustic Ballad', 'Opening Prayer Pad'],
          notes: 'Warm C major to A minor pad · 120 BPM',
          bpm: 120,
        },
      },
      null,
      2
    )
  );
}

console.log('Initialized public/music/ with sample tracks and metadata.');
