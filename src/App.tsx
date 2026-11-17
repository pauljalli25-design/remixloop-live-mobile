/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Plus,
  Layers,
  SlidersHorizontal,
  Loader2,
  Circle,
  Square,
  Minus,
  Package,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import { useAudioEngine } from './hooks/useAudioEngine';
import { PRESET_PACKS } from './audio/presetPacks';
import { Header } from './components/Header';
import { TrackRow } from './components/TrackRow';
import { MasterFXBar } from './components/MasterFXBar';
import { MobileAPKModal } from './components/MobileAPKModal';
import { EditTrackModal } from './components/EditTrackModal';
import { AddTrackModal } from './components/AddTrackModal';
import { SoundPackModal } from './components/SoundPackModal';
import { RecordingExportModal } from './components/RecordingExportModal';
import { SongSearchModal } from './components/SongSearchModal';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { OfflineIndicator } from './components/OfflineIndicator';
import { TrackData } from './types/audio';

export default function App() {
  const {
    tracks,
    isLoadingPack,
    isRefreshingFolder,
    refreshFolderLibrary,
    selectedPackId,
    loadPack,
    toggleMainLoop,
    triggerBitMusic,
    stopAll,
    setTrackVolume,
    toggleTrackMute,
    masterBpm,
    setBpm,
    metronomeOn,
    toggleMetronome,
    isRecording,
    recordingSeconds,
    lastRecording,
    setLastRecording,
    startRecording,
    stopRecording,
    decodeAudioFile,
    updateTrackSound,
    updateTrackSongs,
    addCustomTrack,
    removeTrack,
    setDJFilter,
    setDJDelay,
  } = useAudioEngine();

  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [mobileModalOpen, setMobileModalOpen] = useState(false);
  const [mobileModalTab, setMobileModalTab] = useState<'quick' | 'render' | 'laptop' | 'pwabuilder'>('quick');
  const [addTrackModalOpen, setAddTrackModalOpen] = useState(false);
  const [packModalOpen, setPackModalOpen] = useState(false);
  const [showFxPanel, setShowFxPanel] = useState(false);
  const [editingTrack, setEditingTrack] = useState<TrackData | null>(null);
  const [editInitialTab, setEditInitialTab] = useState<'songs' | 'mainloop' | 'bitmusic'>('songs');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'folder' | 'presets'>('all');
  const [tapTimes, setTapTimes] = useState<number[]>([]);

  const hasActiveAudio = tracks.some(
    (t) => t.loopState === 'playing' || t.loopState === 'paused-for-bit' || t.bitPlaying
  );

  const folderTracks = tracks.filter((t) => t.sourceType === 'folder');
  const presetTracks = tracks.filter((t) => t.sourceType !== 'folder');

  const visibleTracks =
    sourceFilter === 'folder'
      ? folderTracks
      : sourceFilter === 'presets'
      ? presetTracks
      : tracks;

  const handleTapTempo = () => {
    const now = performance.now();
    const newTimes = [...tapTimes.slice(-3), now];
    setTapTimes(newTimes);

    if (newTimes.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < newTimes.length; i++) {
        intervals.push(newTimes[i] - newTimes[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBpm = Math.round(60000 / avgInterval);
      if (calculatedBpm >= 40 && calculatedBpm <= 240) {
        setBpm(calculatedBpm);
      }
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleOpenEdit = (track: TrackData, tab: 'songs' | 'mainloop' | 'bitmusic' = 'songs') => {
    setEditInitialTab(tab);
    setEditingTrack(track);
  };

  const openMobileModal = (tab: 'quick' | 'render' | 'laptop' | 'pwabuilder' = 'quick') => {
    setMobileModalTab(tab);
    setMobileModalOpen(true);
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#005aab] text-white flex flex-col">
      {/* Background Interface matching the uploaded musical instrument & note artwork */}
      <div
        className="fixed inset-0 z-0 pointer-events-none bg-[#005aab]"
        aria-hidden="true"
      >
        <img
          src="/assets/aistudio/image_c2be805c.png"
          alt=""
          className="w-full h-full object-cover object-center opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#003b7a]/75 via-[#004b96]/65 to-[#002957]/85" />
      </div>

      {/* Compact Sticky Mobile Top Bar with Search & Install App */}
      <div className="relative z-40">
        <Header
          hasActiveAudio={hasActiveAudio}
          onStopAll={stopAll}
          onOpenSearch={() => setSearchModalOpen(true)}
          onOpenMobileModal={openMobileModal}
        />
      </div>

      {/* Main Content Container */}
      <main className="relative z-10 flex-1 w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 space-y-3.5 pb-10">
        {/* Mobile App Install Prompt Banner (auto-hides once installed) */}
        <PWAInstallBanner onOpenInstallGuide={() => openMobileModal('quick')} />
        {/* Control Deck: Sound Pack, BPM (Beats + Metronome), Record & FX */}
        <section className="bg-[#022654]/85 backdrop-blur-md border border-white/15 rounded-2xl p-3 sm:p-4 space-y-3">
          {/* Row 1: Pack Picker + Quick Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 bg-[#011836] border border-white/15 rounded-xl px-2.5 min-h-[44px] flex-1 min-w-[180px]">
              <Layers className="w-4 h-4 text-sky-300 shrink-0" />
              <select
                value={selectedPackId}
                onChange={(e) => loadPack(e.target.value)}
                className="w-full bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer truncate"
                aria-label="Select preset pack"
              >
                {PRESET_PACKS.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#011836] text-white">
                    {p.name} ({p.bpm} BPM)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {isRecording ? (
                <button
                  onClick={async () => {
                    await stopRecording();
                  }}
                  className="min-h-[44px] px-3 rounded-xl bg-rose-600 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Circle className="w-3 h-3 fill-white" />
                  <span className="tabular-nums">{formatTimer(recordingSeconds)}</span>
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  className="min-h-[44px] px-3 rounded-xl bg-[#011836] border border-white/15 hover:border-rose-400/60 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                  title="Record live mix"
                >
                  <Circle className="w-3 h-3 text-rose-400 fill-rose-400/40" />
                  <span>Rec</span>
                </button>
              )}

              <button
                onClick={() => setShowFxPanel((v) => !v)}
                className={`min-h-[44px] px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                  showFxPanel
                    ? 'bg-sky-500 text-slate-950 border-sky-300'
                    : 'bg-[#011836] border-white/15 text-sky-100'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>FX</span>
              </button>

              <button
                onClick={() => setPackModalOpen(true)}
                className="min-h-[44px] px-3 rounded-xl bg-[#011836] border border-white/15 text-sky-100 text-xs font-semibold flex items-center gap-1.5 transition"
                title="Export or import pack"
              >
                <Package className="w-3.5 h-3.5 text-sky-300" />
                <span className="hidden sm:inline">Packs</span>
              </button>
            </div>
          </div>

          {/* Row 2: Master BPM Control (Applies to Beats & Metronome) */}
          <div className="pt-2.5 border-t border-white/10 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs text-sky-100 font-semibold">
                Tempo & Beat Speed
                <span className="text-sky-300/85 font-normal ml-1.5">
                  · Applies to beats & metronome
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setBpm(Math.max(40, masterBpm - 2))}
                  className="min-h-[40px] min-w-[40px] rounded-xl bg-[#011836] border border-white/15 flex items-center justify-center text-white active:scale-95"
                  aria-label="Decrease BPM"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <input
                  type="number"
                  min="40"
                  max="240"
                  value={masterBpm}
                  onChange={(e) => setBpm(Math.max(40, Math.min(240, parseInt(e.target.value) || 128)))}
                  className="w-16 min-h-[40px] bg-[#011836] text-sky-300 font-mono font-bold text-sm text-center rounded-xl border border-white/20 tabular-nums focus:outline-none"
                  aria-label="Master BPM"
                />

                <button
                  onClick={() => setBpm(Math.min(240, masterBpm + 2))}
                  className="min-h-[40px] min-w-[40px] rounded-xl bg-[#011836] border border-white/15 flex items-center justify-center text-white active:scale-95"
                  aria-label="Increase BPM"
                >
                  <Plus className="w-4 h-4" />
                </button>

                <button
                  onClick={handleTapTempo}
                  className="min-h-[40px] px-2.5 rounded-xl bg-[#011836] border border-white/15 text-xs font-bold text-sky-200 active:scale-95"
                >
                  Tap
                </button>

                <button
                  onClick={toggleMetronome}
                  className={`min-h-[40px] px-3 rounded-xl text-xs font-bold border transition ${
                    metronomeOn
                      ? 'bg-amber-400 border-amber-200 text-slate-950'
                      : 'bg-[#011836] border-white/15 text-sky-100'
                  }`}
                >
                  {metronomeOn ? 'Metro On' : 'Metro'}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-sky-200/80 tabular-nums">60</span>
              <input
                type="range"
                min="60"
                max="200"
                step="1"
                value={masterBpm}
                onChange={(e) => setBpm(parseInt(e.target.value, 10))}
                className="flex-1 h-2 bg-[#011836] rounded-lg appearance-none cursor-pointer"
                aria-label="BPM speed slider"
              />
              <span className="text-[11px] font-mono text-sky-200/80 tabular-nums">200</span>
            </div>
          </div>
        </section>

        {/* Expandable Master FX Panel */}
        {showFxPanel && (
          <MasterFXBar onSetFilter={setDJFilter} onSetDelay={setDJDelay} />
        )}

        {/* Library Source Filter Tabs + Folder Refresh */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-[#011d42]/90 border border-white/15 rounded-xl">
            <button
              onClick={() => setSourceFilter('all')}
              className={`min-h-[36px] px-3 rounded-lg text-xs font-bold transition ${
                sourceFilter === 'all'
                  ? 'bg-sky-500 text-slate-950'
                  : 'text-sky-100 hover:bg-white/10'
              }`}
            >
              All ({tracks.length})
            </button>
            <button
              onClick={() => setSourceFilter('folder')}
              className={`min-h-[36px] px-3 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                sourceFilter === 'folder'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-sky-100 hover:bg-white/10'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Folder ({folderTracks.length})</span>
            </button>
            <button
              onClick={() => setSourceFilter('presets')}
              className={`min-h-[36px] px-3 rounded-lg text-xs font-bold transition ${
                sourceFilter === 'presets'
                  ? 'bg-sky-500 text-slate-950'
                  : 'text-sky-100 hover:bg-white/10'
              }`}
            >
              Presets ({presetTracks.length})
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={refreshFolderLibrary}
              disabled={isRefreshingFolder}
              className="min-h-[40px] px-3 rounded-xl bg-[#022654]/90 border border-white/15 text-xs font-semibold text-sky-100 hover:border-sky-300 flex items-center gap-1.5 transition"
              title="Rescan public/music folder"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-300 ${isRefreshingFolder ? 'animate-spin' : ''}`} />
              <span>Scan Folder</span>
            </button>

            {hasActiveAudio && (
              <button
                onClick={stopAll}
                className="min-h-[40px] px-3 rounded-xl bg-rose-600 text-white font-bold text-xs flex items-center gap-1 shrink-0"
              >
                <Square className="w-3 h-3 fill-white" />
                <span>Stop</span>
              </button>
            )}
          </div>
        </div>

        {/* Tracks List */}
        {isLoadingPack && tracks.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center gap-3 bg-[#022654]/80 rounded-2xl border border-white/15">
            <Loader2 className="w-7 h-7 text-sky-300 animate-spin" />
            <span className="text-xs font-semibold text-sky-100">
              Loading music library...
            </span>
          </div>
        ) : visibleTracks.length === 0 ? (
          <div className="p-8 text-center bg-[#022654]/80 rounded-2xl border border-white/15 space-y-2">
            <FolderOpen className="w-8 h-8 text-amber-300 mx-auto" />
            <p className="text-sm font-bold text-white">No music files in public/music/ yet</p>
            <p className="text-xs text-sky-200/80">
              Paste your .mp3, .wav, .ogg, or .m4a files into the <code className="text-amber-300">public/music/</code> folder and tap Scan Folder (or push to GitHub/Render).
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {visibleTracks.map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                masterBpm={masterBpm}
                onToggleLoop={toggleMainLoop}
                onTriggerBit={triggerBitMusic}
                onSetVolume={setTrackVolume}
                onToggleMute={toggleTrackMute}
                onOpenEdit={handleOpenEdit}
              />
            ))}
          </div>
        )}

        {/* Insert Track Action */}
        <div className="pt-1">
          <button
            onClick={() => setAddTrackModalOpen(true)}
            className="w-full min-h-[52px] px-4 py-3 rounded-2xl border-2 border-dashed border-sky-300/60 hover:border-sky-200 bg-[#022654]/80 hover:bg-[#023878]/90 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition active:scale-[0.99]"
          >
            <Plus className="w-5 h-5 text-sky-300 shrink-0" />
            <span>Insert Music File or Loop (4s up to 20+ min)</span>
          </button>
        </div>
      </main>

      {/* Modals */}
      <SongSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        tracks={tracks}
        onToggleLoop={toggleMainLoop}
        onTriggerBit={triggerBitMusic}
        onEditSongs={(t) => handleOpenEdit(t, 'songs')}
      />

      <MobileAPKModal
        isOpen={mobileModalOpen}
        initialTab={mobileModalTab}
        onClose={() => setMobileModalOpen(false)}
      />

      <EditTrackModal
        track={editingTrack}
        initialTab={editInitialTab}
        isOpen={!!editingTrack}
        onClose={() => setEditingTrack(null)}
        onUpdateSound={updateTrackSound}
        onUpdateSongs={updateTrackSongs}
        onDeleteTrack={removeTrack}
        decodeAudioFile={decodeAudioFile}
      />

      <AddTrackModal
        isOpen={addTrackModalOpen}
        defaultBpm={masterBpm}
        onClose={() => setAddTrackModalOpen(false)}
        onAddTrack={addCustomTrack}
        decodeAudioFile={decodeAudioFile}
      />

      <SoundPackModal
        isOpen={packModalOpen}
        onClose={() => setPackModalOpen(false)}
        tracks={tracks}
        onImportPack={(importedTracks) => {
          importedTracks.forEach((t) => {
            if (t && t.name) {
              addCustomTrack({
                ...t,
                id: 'imported-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
                loopState: 'stopped',
                bitPlaying: false,
                bitProgress: 0,
                loopProgress: 0,
                pauseOffset: 0,
              });
            }
          });
        }}
      />

      <RecordingExportModal
        recording={lastRecording}
        isOpen={!!lastRecording}
        onClose={() => setLastRecording(null)}
      />

      <OfflineIndicator />
    </div>
  );
}
