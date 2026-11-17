/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { X, Upload, Plus } from 'lucide-react';
import { TrackCategory, TrackData, SoundSample } from '../types/audio';
import { extractWaveformPeaks, renderToBuffer, synthesizeSnare, synthesizeBassNote } from '../audio/synthesizer';
import { formatDuration } from '../utils/format';

interface AddTrackModalProps {
  isOpen: boolean;
  defaultBpm: number;
  onClose: () => void;
  onAddTrack: (track: TrackData) => void;
  decodeAudioFile: (file: File, baseBpm?: number) => Promise<SoundSample>;
}

const CATEGORY_COLORS: Record<TrackCategory, string> = {
  drums: '#38bdf8',
  bass: '#10b981',
  melody: '#ef4444',
  vocals: '#f59e0b',
  percussion: '#8b5cf6',
  fx: '#ec4899',
};

export const AddTrackModal: React.FC<AddTrackModalProps> = ({
  isOpen,
  defaultBpm,
  onClose,
  onAddTrack,
  decodeAudioFile,
}) => {
  const [name, setName] = useState('New Loop Track');
  const [songsText, setSongsText] = useState('');
  const [notesText, setNotesText] = useState('');
  const [category, setCategory] = useState<TrackCategory>('melody');
  const [baseBpm, setBaseBpm] = useState<number>(defaultBpm || 128);
  const [mainLoopSample, setMainLoopSample] = useState<SoundSample | null>(null);
  const [bitMusicSample, setBitMusicSample] = useState<SoundSample | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mainInputRef = useRef<HTMLInputElement | null>(null);
  const bitInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleMainFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setIsProcessing(true);
    try {
      const sample = await decodeAudioFile(file, baseBpm);
      setMainLoopSample(sample);
      if (!name || name === 'New Loop Track') {
        setName(sample.name);
      }
    } catch {
      setErrorMsg('Could not load audio file. Try MP3, WAV, OGG, or M4A.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBitFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setIsProcessing(true);
    try {
      const sample = await decodeAudioFile(file, baseBpm);
      setBitMusicSample(sample);
    } catch {
      setErrorMsg('Could not load bit audio file. Try MP3, WAV, OGG, or M4A.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreate = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      let main = mainLoopSample;
      if (!main) {
        const beatSec = 60 / (baseBpm || 128);
        const dur = beatSec * 8;
        const buffer = await renderToBuffer(dur, (ctx) => {
          for (let i = 0; i < 8; i++) {
            synthesizeBassNote(ctx as unknown as AudioContext, i * beatSec, ctx.destination, 48.99, beatSec * 0.8, false);
          }
        });
        main = {
          id: 'synth-loop-' + Date.now(),
          name: `${name} Synth`,
          duration: dur,
          bpm: baseBpm || 128,
          buffer,
          waveform: extractWaveformPeaks(buffer),
        };
      } else {
        main = { ...main, bpm: baseBpm || main.bpm };
      }

      let bit = bitMusicSample;
      if (!bit) {
        const beatSec = 60 / (baseBpm || 128);
        const bitDur = beatSec * 4;
        const bitBuffer = await renderToBuffer(bitDur, (ctx) => {
          for (let i = 0; i < 16; i++) {
            synthesizeSnare(ctx as unknown as AudioContext, i * (bitDur / 16), ctx.destination, 0.5 + (i / 16) * 0.5);
          }
        });
        bit = {
          id: 'synth-bit-' + Date.now(),
          name: 'Snare Break Fill',
          duration: bitDur,
          bpm: baseBpm || 128,
          buffer: bitBuffer,
          waveform: extractWaveformPeaks(bitBuffer),
        };
      } else {
        bit = { ...bit, bpm: baseBpm || bit.bpm };
      }

      const assignedSongs = songsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const newTrack: TrackData = {
        id: 'track-' + Date.now(),
        name: name.trim() || 'Custom Track',
        category,
        color: CATEGORY_COLORS[category],
        volume: 0.85,
        pan: 0,
        isMuted: false,
        isSolo: false,
        loopState: 'stopped',
        bitPlaying: false,
        bitProgress: 0,
        loopProgress: 0,
        pauseOffset: 0,
        assignedSongs,
        notes: notesText.trim(),
        sourceType: 'custom',
        mainLoop: main,
        bitMusic: bit,
      };

      onAddTrack(newTrack);
      setName('New Loop Track');
      setSongsText('');
      setNotesText('');
      setMainLoopSample(null);
      setBitMusicSample(null);
      onClose();
    } catch {
      setErrorMsg('Failed to create track. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full sm:max-w-md bg-[#022654] border border-white/20 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/15 bg-[#011d42]">
          <div className="flex items-center gap-2 min-w-0">
            <Plus className="w-5 h-5 text-sky-300 shrink-0" />
            <h2 className="text-base font-bold text-white truncate">Insert Music Track</h2>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl text-sky-200 hover:text-white flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3.5 text-xs overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-400/50 text-rose-100 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Track Name & Base BPM */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="col-span-2 space-y-1">
              <label className="font-semibold text-sky-100">Music Track Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., 20 Min Backing Track"
                className="w-full min-h-[44px] px-3 rounded-xl bg-[#011836] border border-white/20 text-white font-medium focus:outline-none focus:border-sky-400"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-sky-100">Base BPM</label>
              <input
                type="number"
                min="40"
                max="240"
                value={baseBpm}
                onChange={(e) => setBaseBpm(Math.max(40, Math.min(240, parseInt(e.target.value) || 128)))}
                className="w-full min-h-[44px] px-2 rounded-xl bg-[#011836] border border-white/20 text-sky-300 font-mono font-bold text-center focus:outline-none focus:border-sky-400"
              />
            </div>
          </div>

          {/* Suitable Song Names & Notes */}
          <div className="space-y-1">
            <label className="font-semibold text-amber-200">
              Suitable Song Names (comma-separated)
            </label>
            <input
              type="text"
              value={songsText}
              onChange={(e) => setSongsText(e.target.value)}
              placeholder="e.g., Song Name 1, Song Name 2"
              className="w-full min-h-[44px] px-3 rounded-xl bg-[#011836] border border-white/20 text-white placeholder:text-sky-200/45 focus:outline-none focus:border-amber-300"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-sky-100">Notes (Optional)</label>
            <input
              type="text"
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="e.g., Suitable for fast chorus or intro"
              className="w-full min-h-[44px] px-3 rounded-xl bg-[#011836] border border-white/20 text-white placeholder:text-sky-200/45 focus:outline-none focus:border-sky-400"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="font-semibold text-sky-100">Category</label>
            <div className="grid grid-cols-3 gap-2">
              {(['drums', 'bass', 'melody', 'vocals', 'percussion', 'fx'] as TrackCategory[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`min-h-[40px] px-2 rounded-xl font-semibold capitalize text-xs border transition ${
                    category === cat
                      ? 'bg-sky-500/30 text-white border-sky-300'
                      : 'bg-[#011836] border-white/15 text-sky-200/80'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Main Audio Upload */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-sky-100">Main Loop / Song Audio</label>
              <span className="text-[11px] text-sky-300">4s up to 20+ min</span>
            </div>
            <input
              ref={mainInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
              onChange={handleMainFileUpload}
              className="hidden"
            />
            <button
              onClick={() => mainInputRef.current?.click()}
              disabled={isProcessing}
              className="w-full min-h-[48px] px-3 py-2.5 rounded-xl border border-dashed border-sky-300/50 hover:border-sky-300 bg-[#011836] flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <Upload className="w-4 h-4 text-sky-300 shrink-0" />
              <span className="text-white truncate font-medium">
                {mainLoopSample
                  ? `${mainLoopSample.name} (${formatDuration(mainLoopSample.duration)})`
                  : 'Choose Audio File (MP3, WAV, M4A)'}
              </span>
            </button>
          </div>

          {/* Bit Music Upload */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-amber-200">Bit Music (Beat Fill)</label>
              <span className="text-[11px] text-amber-300/80">Pauses & auto-resumes</span>
            </div>
            <input
              ref={bitInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
              onChange={handleBitFileUpload}
              className="hidden"
            />
            <button
              onClick={() => bitInputRef.current?.click()}
              disabled={isProcessing}
              className="w-full min-h-[48px] px-3 py-2.5 rounded-xl border border-dashed border-amber-400/50 hover:border-amber-300 bg-[#011836] flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <Upload className="w-4 h-4 text-amber-300 shrink-0" />
              <span className="text-amber-100 truncate font-medium">
                {bitMusicSample
                  ? `${bitMusicSample.name} (${formatDuration(bitMusicSample.duration)})`
                  : 'Choose Bit Music Fill (or Default Roll)'}
              </span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-white/15 bg-[#011d42] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-xl text-sky-200 hover:text-white font-medium text-xs"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isProcessing}
            className="min-h-[44px] px-5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-md transition active:scale-95 disabled:opacity-60"
          >
            {isProcessing ? 'Loading Audio...' : 'Insert Track'}
          </button>
        </div>
      </div>
    </div>
  );
};
