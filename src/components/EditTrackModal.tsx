/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Music, Zap, Trash2, Sparkles, Music2, Plus, Check } from 'lucide-react';
import { TrackData, SoundSample } from '../types/audio';
import { extractWaveformPeaks, renderToBuffer, synthesizeSnare } from '../audio/synthesizer';
import { formatDuration } from '../utils/format';

interface EditTrackModalProps {
  track: TrackData | null;
  initialTab?: 'songs' | 'mainloop' | 'bitmusic';
  isOpen: boolean;
  onClose: () => void;
  onUpdateSound: (trackId: string, type: 'mainLoop' | 'bitMusic', sample: SoundSample) => void;
  onUpdateSongs: (trackId: string, assignedSongs: string[], notes: string, baseBpm?: number) => Promise<void>;
  onDeleteTrack: (trackId: string) => void;
  decodeAudioFile: (file: File, baseBpm?: number) => Promise<SoundSample>;
}

export const EditTrackModal: React.FC<EditTrackModalProps> = ({
  track,
  initialTab = 'songs',
  isOpen,
  onClose,
  onUpdateSound,
  onUpdateSongs,
  onDeleteTrack,
  decodeAudioFile,
}) => {
  const [activeTab, setActiveTab] = useState<'songs' | 'mainloop' | 'bitmusic'>(initialTab);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Song assignment state
  const [songInput, setSongInput] = useState('');
  const [songsList, setSongsList] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [baseBpm, setBaseBpm] = useState<number>(128);
  const [savedBanner, setSavedBanner] = useState(false);

  const mainFileInputRef = useRef<HTMLInputElement | null>(null);
  const bitFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (track && isOpen) {
      setActiveTab(initialTab);
      setSongsList(track.assignedSongs || []);
      setNotes(track.notes || '');
      setBaseBpm(track.mainLoop.bpm || 128);
      setSongInput('');
      setConfirmDelete(false);
      setSavedBanner(false);
      setErrorMsg(null);
    }
  }, [track, initialTab, isOpen]);

  if (!isOpen || !track) return null;

  const handleAddSongName = async () => {
    const trimmed = songInput.trim();
    if (!trimmed) return;
    const parts = trimmed
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const updated = Array.from(new Set([...songsList, ...parts]));
    setSongsList(updated);
    setSongInput('');
    await onUpdateSongs(track.id, updated, notes, baseBpm);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 1800);
  };

  const handleRemoveSong = async (songToRemove: string) => {
    const updated = songsList.filter((s) => s !== songToRemove);
    setSongsList(updated);
    await onUpdateSongs(track.id, updated, notes, baseBpm);
  };

  const handleSaveDetails = async () => {
    let finalSongs = songsList;
    if (songInput.trim()) {
      const extra = songInput
        .trim()
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      finalSongs = Array.from(new Set([...songsList, ...extra]));
      setSongsList(finalSongs);
      setSongInput('');
    }
    await onUpdateSongs(track.id, finalSongs, notes, baseBpm);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2000);
  };

  const handleMainFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setIsProcessing(true);
    try {
      const sample = await decodeAudioFile(file, baseBpm);
      onUpdateSound(track.id, 'mainLoop', sample);
    } catch {
      setErrorMsg('Could not decode audio file. Please select MP3, WAV, OGG, or M4A.');
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
      onUpdateSound(track.id, 'bitMusic', sample);
    } catch {
      setErrorMsg('Could not decode bit audio file. Please select MP3, WAV, OGG, or M4A.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickBitFillPreset = async (type: 'snare-roll' | 'sub-dive') => {
    setIsProcessing(true);
    try {
      if (type === 'snare-roll') {
        const buffer = await renderToBuffer(1.6, (ctx) => {
          for (let i = 0; i < 16; i++) {
            synthesizeSnare(ctx as unknown as AudioContext, i * 0.1, ctx.destination, 0.4 + (i / 16) * 0.6);
          }
        });
        onUpdateSound(track.id, 'bitMusic', {
          id: 'bit-snare-' + Date.now(),
          name: 'Snare Build Roll',
          duration: 1.6,
          bpm: baseBpm || 128,
          buffer,
          waveform: extractWaveformPeaks(buffer),
        });
      } else {
        const buffer = await renderToBuffer(1.4, (ctx) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(140, 0);
          osc.frequency.exponentialRampToValueAtTime(25, 1.2);
          g.gain.setValueAtTime(0.8, 0);
          g.gain.exponentialRampToValueAtTime(0.001, 1.35);
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start(0);
          osc.stop(1.4);
        });
        onUpdateSound(track.id, 'bitMusic', {
          id: 'bit-sub-' + Date.now(),
          name: 'Sub Bass Dive',
          duration: 1.4,
          bpm: baseBpm || 128,
          buffer,
          waveform: extractWaveformPeaks(buffer),
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full sm:max-w-lg bg-[#022654] border border-white/20 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/15 bg-[#011d42]">
          <div className="min-w-0 pr-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2 truncate">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: track.color }} />
              <span className="truncate">{track.name}</span>
            </h2>
            <p className="text-xs text-sky-200/80 truncate">
              Assign song names, notes, or replace audio
            </p>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl text-sky-200 hover:text-white flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-3 border-b border-white/15 bg-[#011836]">
          <button
            onClick={() => setActiveTab('songs')}
            className={`min-h-[44px] text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition ${
              activeTab === 'songs'
                ? 'border-amber-300 text-amber-200 bg-[#022654]'
                : 'border-transparent text-sky-200/70'
            }`}
          >
            <Music2 className="w-3.5 h-3.5" />
            <span>Songs</span>
          </button>
          <button
            onClick={() => setActiveTab('mainloop')}
            className={`min-h-[44px] text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition ${
              activeTab === 'mainloop'
                ? 'border-sky-300 text-white bg-[#022654]'
                : 'border-transparent text-sky-200/70'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Audio</span>
          </button>
          <button
            onClick={() => setActiveTab('bitmusic')}
            className={`min-h-[44px] text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition ${
              activeTab === 'bitmusic'
                ? 'border-amber-300 text-amber-200 bg-[#022654]'
                : 'border-transparent text-sky-200/70'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Bit Fill</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-400/50 text-rose-100">
              {errorMsg}
            </div>
          )}

          {savedBanner && (
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-100 flex items-center gap-2 font-semibold">
              <Check className="w-4 h-4 text-emerald-300" />
              <span>Saved song assignment to library</span>
            </div>
          )}

          {/* TAB 1: SONGS & INFO */}
          {activeTab === 'songs' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="font-bold text-white block">
                  Add Suitable Song Name(s) for This Music
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={songInput}
                    onChange={(e) => setSongInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSongName();
                      }
                    }}
                    placeholder="e.g., Song Name 1, Song Name 2"
                    className="flex-1 min-h-[44px] px-3 rounded-xl bg-[#011836] border border-white/20 text-white placeholder:text-sky-200/45 focus:outline-none focus:border-amber-300"
                  />
                  <button
                    onClick={handleAddSongName}
                    className="min-h-[44px] px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Assigned Songs List */}
              <div className="space-y-1.5">
                <div className="text-sky-200/80 font-semibold">
                  Assigned Songs ({songsList.length})
                </div>
                {songsList.length === 0 ? (
                  <div className="p-3 rounded-xl bg-[#011836] border border-white/10 text-sky-200/60">
                    No songs assigned yet. Add a song name above so you can find this music from the top Search icon.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {songsList.map((song) => (
                      <div
                        key={song}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#011836] border border-white/15"
                      >
                        <span className="font-semibold text-amber-200 truncate">{song}</span>
                        <button
                          onClick={() => handleRemoveSong(song)}
                          className="min-h-[32px] min-w-[32px] rounded-lg text-sky-200/70 hover:text-rose-300 flex items-center justify-center"
                          aria-label={`Remove ${song}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes & Base BPM */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2 space-y-1">
                  <label className="font-semibold text-sky-100 block">Notes / Music Style</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g., Fast chorus, Key of C"
                    className="w-full min-h-[44px] px-3 rounded-xl bg-[#011836] border border-white/20 text-white focus:outline-none focus:border-sky-300"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-sky-100 block">Base BPM</label>
                  <input
                    type="number"
                    min="40"
                    max="240"
                    value={baseBpm}
                    onChange={(e) => setBaseBpm(Math.max(40, Math.min(240, parseInt(e.target.value) || 128)))}
                    className="w-full min-h-[44px] px-2 rounded-xl bg-[#011836] border border-white/20 text-sky-300 font-mono font-bold text-center focus:outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveDetails}
                className="w-full min-h-[44px] rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold transition"
              >
                Save Song Info & Notes
              </button>
            </div>
          )}

          {/* TAB 2: MAIN AUDIO */}
          {activeTab === 'mainloop' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-[#011836] rounded-xl border border-white/15 space-y-1">
                <div className="text-sky-200/80">Current Audio</div>
                <div className="font-bold text-white text-sm truncate">{track.mainLoop.name}</div>
                <div className="font-mono text-sky-300 tabular-nums">
                  {formatDuration(track.mainLoop.duration)} · {track.mainLoop.bpm} BPM base
                  {track.mainLoop.isStreaming ? ' · Streaming Mode' : ''}
                </div>
              </div>

              <div className="space-y-2">
                <input
                  ref={mainFileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
                  onChange={handleMainFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => mainFileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="w-full py-6 px-4 rounded-xl border-2 border-dashed border-sky-300/50 hover:border-sky-300 bg-[#011836] flex flex-col items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Upload className="w-6 h-6 text-sky-300" />
                  <span className="font-bold text-white">
                    {isProcessing ? 'Loading Audio...' : 'Upload Main Audio (.mp3, .wav, .ogg, .m4a)'}
                  </span>
                  <span className="text-[11px] text-sky-200/70">
                    Supports 4s loops as well as 15–20+ minute tracks
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: BIT MUSIC */}
          {activeTab === 'bitmusic' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-[#2a1d06]/70 rounded-xl border border-amber-400/35 space-y-1">
                <div className="text-amber-200/80">Current Bit Music</div>
                <div className="font-bold text-white text-sm truncate">{track.bitMusic.name}</div>
                <div className="font-mono text-amber-300 tabular-nums">
                  {formatDuration(track.bitMusic.duration)} · Pauses loop and auto-resumes
                </div>
              </div>

              <div>
                <input
                  ref={bitFileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
                  onChange={handleBitFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => bitFileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="w-full min-h-[52px] px-4 py-3 rounded-xl border-2 border-dashed border-amber-400/50 hover:border-amber-300 bg-[#011836] flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Upload className="w-5 h-5 text-amber-300" />
                  <span className="font-bold text-white">
                    {isProcessing ? 'Loading...' : 'Upload Custom Bit Fill (.mp3, .wav)'}
                  </span>
                </button>
              </div>

              <div className="space-y-2 pt-2 border-t border-white/15">
                <div className="font-semibold text-sky-100">Quick Beat Fill Presets</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleQuickBitFillPreset('snare-roll')}
                    className="min-h-[44px] p-2.5 rounded-xl bg-[#011836] hover:bg-[#022048] text-white border border-white/15 flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Snare Roll</span>
                  </button>
                  <button
                    onClick={() => handleQuickBitFillPreset('sub-dive')}
                    className="min-h-[44px] p-2.5 rounded-xl bg-[#011836] hover:bg-[#022048] text-white border border-white/15 flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Sub 808 Dive</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-white/15 bg-[#011d42] flex items-center justify-between gap-2">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="min-h-[44px] px-3 rounded-xl flex items-center gap-1.5 text-xs text-rose-300 hover:text-rose-200 font-semibold"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
          ) : (
            <button
              onClick={() => {
                onDeleteTrack(track.id);
                onClose();
              }}
              className="min-h-[44px] px-3 rounded-xl bg-rose-600 text-white text-xs font-bold"
            >
              Confirm Delete
            </button>
          )}

          <button
            onClick={onClose}
            className="min-h-[44px] px-5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
