/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Play, Square, Zap, Music2, Edit3 } from 'lucide-react';
import { TrackData } from '../types/audio';
import { formatDuration } from '../utils/format';

interface SongSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: TrackData[];
  onToggleLoop: (trackId: string) => void;
  onTriggerBit: (trackId: string) => void;
  onEditSongs: (track: TrackData) => void;
}

export const SongSearchModal: React.FC<SongSearchModalProps> = ({
  isOpen,
  onClose,
  tracks,
  onToggleLoop,
  onTriggerBit,
  onEditSongs,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const trimmed = query.trim().toLowerCase();

  // Rank tracks: matching song names first, then matching track name/notes
  const filteredTracks = tracks
    .filter((t) => {
      if (!trimmed) return true;
      const songsMatch = (t.assignedSongs || []).some((s) =>
        s.toLowerCase().includes(trimmed)
      );
      const nameMatch = t.name.toLowerCase().includes(trimmed);
      const fileMatch = (t.folderFileName || '').toLowerCase().includes(trimmed);
      const notesMatch = (t.notes || '').toLowerCase().includes(trimmed);
      return songsMatch || nameMatch || fileMatch || notesMatch;
    })
    .sort((a, b) => {
      const aHasSongs = (a.assignedSongs?.length || 0) > 0 ? 1 : 0;
      const bHasSongs = (b.assignedSongs?.length || 0) > 0 ? 1 : 0;
      if (trimmed) {
        const aExact = (a.assignedSongs || []).some((s) =>
          s.toLowerCase().includes(trimmed)
        )
          ? 1
          : 0;
        const bExact = (b.assignedSongs || []).some((s) =>
          s.toLowerCase().includes(trimmed)
        )
          ? 1
          : 0;
        if (aExact !== bExact) return bExact - aExact;
      }
      return bHasSongs - aHasSongs;
    });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center sm:pt-12 sm:px-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full sm:max-w-xl bg-[#022654] border-b sm:border border-white/20 sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Search Input Row */}
        <div className="p-3 sm:p-4 bg-[#011d42] border-b border-white/15 flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-[#011836] border border-white/20 focus-within:border-sky-300 rounded-xl px-3 min-h-[46px]">
            <Search className="w-4 h-4 text-sky-300 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search song name or music..."
              className="w-full bg-transparent text-sm text-white placeholder:text-sky-200/50 focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="p-1 text-sky-200 hover:text-white"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="min-h-[46px] px-3 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white shrink-0"
          >
            Close
          </button>
        </div>

        {/* Results List */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-2.5 flex-1">
          {filteredTracks.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <Music2 className="w-8 h-8 text-sky-300/60 mx-auto" />
              <p className="text-sm font-semibold text-white">No matching song or music found</p>
              <p className="text-xs text-sky-200/75">
                Assign song names to any music track to find them instantly here.
              </p>
            </div>
          ) : (
            filteredTracks.map((track) => {
              const isPlaying = track.loopState === 'playing';
              const isBitPlaying = track.bitPlaying;
              const songs = track.assignedSongs || [];

              return (
                <div
                  key={track.id}
                  className={`rounded-xl border p-3 transition ${
                    isPlaying
                      ? 'bg-[#023878] border-sky-300'
                      : 'bg-[#011836]/90 border-white/15'
                  }`}
                >
                  {/* Matched Songs Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      {songs.length > 0 ? (
                        <div className="text-sm font-bold text-amber-300 leading-snug">
                          {songs.join(' · ')}
                        </div>
                      ) : (
                        <div className="text-xs font-medium text-sky-200/60">
                          No song assigned yet
                        </div>
                      )}

                      <div className="text-xs font-semibold text-white mt-0.5 truncate">
                        Music: {track.name}
                      </div>

                      <div className="text-[11px] text-sky-200/80 flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span>{track.sourceType === 'folder' ? 'Folder' : track.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{formatDuration(track.mainLoop.duration)}</span>
                        {track.notes && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{track.notes}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onClose();
                        onEditSongs(track);
                      }}
                      className="min-h-[40px] px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-sky-100 text-xs font-medium flex items-center gap-1 shrink-0"
                      title="Edit assigned songs"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Songs</span>
                    </button>
                  </div>

                  {/* Direct Play Loop & Bit Music Actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onToggleLoop(track.id)}
                      className={`min-h-[44px] px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        isPlaying
                          ? 'bg-sky-400 border-sky-200 text-slate-950'
                          : 'bg-[#022654] border-white/20 text-white hover:border-sky-300'
                      }`}
                    >
                      {isPlaying ? (
                        <>
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>Stop Music</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Play Music</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => onTriggerBit(track.id)}
                      className={`min-h-[44px] px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        isBitPlaying
                          ? 'bg-amber-400 border-amber-200 text-slate-950'
                          : 'bg-[#2a1d06]/80 border-amber-400/40 text-amber-200 hover:border-amber-300'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>{isBitPlaying ? 'Playing Bit...' : 'Bit Music'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
