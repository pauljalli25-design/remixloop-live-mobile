/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Play, Square, Zap, Volume2, VolumeX, Sliders, Music2 } from 'lucide-react';
import { TrackData } from '../types/audio';
import { WaveformDisplay } from './WaveformDisplay';
import { formatDuration } from '../utils/format';

interface TrackRowProps {
  track: TrackData;
  masterBpm: number;
  onToggleLoop: (id: string) => void;
  onTriggerBit: (id: string) => void;
  onSetVolume: (id: string, vol: number) => void;
  onToggleMute: (id: string) => void;
  onOpenEdit: (track: TrackData, tab?: 'songs' | 'mainloop' | 'bitmusic') => void;
}

export const TrackRow: React.FC<TrackRowProps> = ({
  track,
  masterBpm,
  onToggleLoop,
  onTriggerBit,
  onSetVolume,
  onToggleMute,
  onOpenEdit,
}) => {
  const isPlaying = track.loopState === 'playing';
  const isPausedForBit = track.loopState === 'paused-for-bit';
  const isBitPlaying = track.bitPlaying;

  const baseBpm = track.mainLoop.bpm > 0 ? track.mainLoop.bpm : 128;
  const speedRatio = Math.max(0.25, Math.min(4.0, masterBpm / baseBpm));
  const songs = track.assignedSongs || [];

  return (
    <div
      className={`rounded-2xl border p-3 transition-colors duration-150 backdrop-blur-md w-full overflow-hidden ${
        isPlaying
          ? 'bg-[#023878]/90 border-sky-300/70 shadow-lg shadow-sky-950/40'
          : isPausedForBit
          ? 'bg-[#2a2409]/85 border-amber-400/80 shadow-lg shadow-amber-950/40'
          : 'bg-[#022654]/85 border-white/15 hover:border-white/25'
      }`}
    >
      {/* Top Row: Track Title + Clean Unboxed Metadata + Actions */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span
            className="w-3 h-3 rounded-full shrink-0 ring-2 ring-white/20"
            style={{ backgroundColor: track.color }}
          />
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-sm text-white truncate leading-tight" title={track.name}>
              {track.name}
            </h3>
            <div className="flex items-center gap-1.5 text-[11px] text-sky-200/80 font-medium truncate mt-0.5 tabular-nums">
              <span>{track.sourceType === 'folder' ? 'Folder' : track.category}</span>
              <span aria-hidden="true">·</span>
              <span>{formatDuration(track.mainLoop.duration)}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-sky-200">{speedRatio.toFixed(2)}x</span>
            </div>
          </div>
        </div>

        {/* Compact Touch Actions (44px hitbox) */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onOpenEdit(track, 'songs')}
            className="min-h-[44px] px-2.5 rounded-xl bg-white/10 text-amber-200 hover:bg-white/20 flex items-center justify-center gap-1 text-xs font-semibold transition active:scale-95"
            title="Assign song names to this music"
          >
            <Music2 className="w-3.5 h-3.5 shrink-0" />
            <span>Songs</span>
          </button>

          <button
            onClick={() => onToggleMute(track.id)}
            className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center transition active:scale-95 ${
              track.isMuted
                ? 'bg-rose-500 text-white'
                : 'bg-white/10 text-sky-100 hover:bg-white/20'
            }`}
            title={track.isMuted ? 'Unmute track' : 'Mute track'}
          >
            {track.isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => onOpenEdit(track, 'mainloop')}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-white/10 text-sky-100 hover:bg-white/20 flex items-center justify-center transition active:scale-95"
            title="Edit track audio and BPM"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Assigned Songs Quick Line */}
      <button
        onClick={() => onOpenEdit(track, 'songs')}
        className="w-full text-left mb-2.5 px-2.5 py-1.5 rounded-xl bg-[#011836]/75 border border-white/10 hover:border-amber-300/40 transition flex items-center justify-between gap-2"
      >
        <div className="text-xs truncate">
          {songs.length > 0 ? (
            <span className="text-amber-200 font-medium">
              Songs: {songs.join(', ')}
            </span>
          ) : (
            <span className="text-sky-200/60">
              Tap to write suitable song names for this music...
            </span>
          )}
        </div>
        {track.notes && (
          <span className="text-[10px] text-sky-300/80 truncate max-w-[120px] shrink-0">
            {track.notes}
          </span>
        )}
      </button>

      {/* Middle Row: TWO BUTTONS ON THE SAME LINE (Main Loop & Bit Music) */}
      <div className="grid grid-cols-2 gap-2 w-full">
        {/* BUTTON 1: MAIN LOOP */}
        <button
          onClick={() => onToggleLoop(track.id)}
          className={`relative flex flex-col justify-between p-2.5 rounded-xl border text-left transition-all duration-150 select-none overflow-hidden min-h-[76px] active:scale-[0.98] ${
            isPlaying
              ? 'bg-sky-500/25 border-sky-300 text-white shadow-inner'
              : isPausedForBit
              ? 'bg-amber-500/25 border-amber-300 text-amber-100'
              : 'bg-[#011d42]/80 border-white/15 hover:border-sky-300/50 text-slate-100'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5 w-full">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isPlaying
                    ? 'bg-sky-400 text-slate-950'
                    : isPausedForBit
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-white/15 text-white'
                }`}
              >
                {isPlaying ? (
                  <Square className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold tracking-tight truncate">
                  {isPlaying ? 'Playing' : isPausedForBit ? 'Paused' : 'Main Loop'}
                </div>
                <div className="text-[10px] text-sky-200/80 font-mono truncate tabular-nums">
                  {formatDuration(track.mainLoop.duration)}
                </div>
              </div>
            </div>
          </div>

          <div className="w-full mt-2">
            <WaveformDisplay
              waveform={track.mainLoop.waveform}
              progress={track.loopProgress}
              color={track.color || '#38bdf8'}
              isPlaying={isPlaying}
              isPausedForBit={isPausedForBit}
              height={18}
            />
          </div>
        </button>

        {/* BUTTON 2: BIT MUSIC */}
        <button
          onClick={() => onTriggerBit(track.id)}
          className={`relative flex flex-col justify-between p-2.5 rounded-xl border text-left transition-all duration-150 select-none overflow-hidden min-h-[76px] active:scale-[0.98] ${
            isBitPlaying
              ? 'bg-amber-500/35 border-amber-300 text-white shadow-inner'
              : 'bg-[#2a1d06]/70 border-amber-400/35 hover:border-amber-300/70 text-amber-100'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5 w-full">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isBitPlaying
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-amber-400/20 text-amber-300'
                }`}
              >
                <Zap className="w-4 h-4 fill-current" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold tracking-tight truncate text-amber-200">
                  Bit Music
                </div>
                <div className="text-[10px] text-amber-200/80 font-mono truncate tabular-nums">
                  {formatDuration(track.bitMusic.duration)}
                </div>
              </div>
            </div>
          </div>

          <div className="w-full mt-2 space-y-1">
            <div className="text-[10px] text-amber-200/85 truncate font-medium">
              {isBitPlaying ? 'Playing break...' : 'Tap to pause & fill'}
            </div>
            <div className="w-full h-1.5 rounded-full bg-black/40 overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all duration-75"
                style={{ width: `${isBitPlaying ? track.bitProgress : 0}%` }}
              />
            </div>
          </div>
        </button>
      </div>

      {/* Bottom Row: Volume Slider */}
      <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center gap-3">
        <span className="text-[11px] font-medium text-sky-200/80 shrink-0">Vol</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={track.isMuted ? 0 : track.volume}
          onChange={(e) => onSetVolume(track.id, parseFloat(e.target.value))}
          className="flex-1 h-2 bg-[#011836] rounded-lg appearance-none cursor-pointer"
          aria-label={`${track.name} volume`}
        />
        <span className="text-[11px] font-mono text-sky-100 w-9 text-right tabular-nums shrink-0">
          {track.isMuted ? '0%' : `${Math.round(track.volume * 100)}%`}
        </span>
      </div>
    </div>
  );
};
