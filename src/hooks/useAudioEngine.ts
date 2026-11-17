/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { RemixAudioEngine } from '../audio/engine';
import { PRESET_PACKS } from '../audio/presetPacks';
import {
  fetchFolderMusicLibrary,
  getLocalSongMetadata,
  saveSongMetadata,
  SongMetadataMap,
} from '../audio/folderLibrary';
import { SoundSample, TrackData } from '../types/audio';

export function useAudioEngine() {
  const engineRef = useRef<RemixAudioEngine>(RemixAudioEngine.getInstance());
  const [tracks, setTracks] = useState<TrackData[]>([]);
  const [isLoadingPack, setIsLoadingPack] = useState(true);
  const [isRefreshingFolder, setIsRefreshingFolder] = useState(false);
  const [selectedPackId, setSelectedPackId] = useState<string>('edm-mainstage');
  const [masterBpm, setMasterBpmState] = useState<number>(128);
  const [metronomeOn, setMetronomeOn] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [lastRecording, setLastRecording] = useState<{ url: string; duration: number } | null>(null);
  const serverMetadataRef = useRef<SongMetadataMap>({});

  useEffect(() => {
    const engine = engineRef.current;
    const unsubscribe = engine.subscribe((newTracks) => {
      setTracks([...newTracks]);
    });
    return unsubscribe;
  }, []);

  const applySavedMetadata = useCallback((list: TrackData[], serverMeta: SongMetadataMap): TrackData[] => {
    const localMeta = getLocalSongMetadata();
    const combined: SongMetadataMap = { ...serverMeta, ...localMeta };

    return list.map((t) => {
      const key = t.folderFileName || t.id;
      const saved = combined[key];
      if (!saved) return t;
      return {
        ...t,
        assignedSongs: Array.isArray(saved.assignedSongs) ? saved.assignedSongs : t.assignedSongs || [],
        notes: typeof saved.notes === 'string' ? saved.notes : t.notes || '',
        mainLoop: {
          ...t.mainLoop,
          bpm: saved.bpm || t.mainLoop.bpm,
        },
        bitMusic: {
          ...t.bitMusic,
          bpm: saved.bpm || t.bitMusic.bpm,
        },
      };
    });
  }, []);

  // Load folder music from public/music/ (via /api/music-library or manifest.json)
  const refreshFolderLibrary = useCallback(async () => {
    setIsRefreshingFolder(true);
    try {
      const { tracks: folderTracks, metadata } = await fetchFolderMusicLibrary();
      serverMetadataRef.current = metadata;
      engineRef.current.replaceTracksBySource('folder', folderTracks);
    } catch (err) {
      console.error('Error loading folder music:', err);
    } finally {
      setIsRefreshingFolder(false);
    }
  }, []);

  // Load preset pack
  const loadPack = useCallback(
    async (packId: string) => {
      const packDef = PRESET_PACKS.find((p) => p.id === packId);
      if (!packDef) return;

      setIsLoadingPack(true);
      setSelectedPackId(packId);
      setMasterBpmState(packDef.bpm);
      engineRef.current.setMasterBpm(packDef.bpm);

      try {
        const generatedTracks = await packDef.generateTracks();
        const tagged = generatedTracks.map((t) => ({
          ...t,
          sourceType: 'preset' as const,
          assignedSongs: t.assignedSongs || [],
          notes: t.notes || '',
        }));
        const hydrated = applySavedMetadata(tagged, serverMetadataRef.current);
        engineRef.current.replaceTracksBySource('preset', hydrated);
      } catch (err) {
        console.error('Error loading pack:', err);
      } finally {
        setIsLoadingPack(false);
      }
    },
    [applySavedMetadata]
  );

  // Initial load: folder library + default preset pack
  useEffect(() => {
    (async () => {
      await refreshFolderLibrary();
      await loadPack('edm-mainstage');
    })();
  }, [refreshFolderLibrary, loadPack]);

  const toggleMainLoop = useCallback((trackId: string) => {
    engineRef.current.toggleMainLoop(trackId);
  }, []);

  const triggerBitMusic = useCallback((trackId: string) => {
    engineRef.current.triggerBitMusic(trackId);
  }, []);

  const stopAll = useCallback(() => {
    engineRef.current.stopAll();
  }, []);

  const setTrackVolume = useCallback((trackId: string, vol: number) => {
    engineRef.current.setTrackVolume(trackId, vol);
  }, []);

  const setTrackPan = useCallback((trackId: string, pan: number) => {
    engineRef.current.setTrackPan(trackId, pan);
  }, []);

  const toggleTrackMute = useCallback((trackId: string) => {
    engineRef.current.toggleTrackMute(trackId);
  }, []);

  const toggleTrackSolo = useCallback((trackId: string) => {
    engineRef.current.toggleTrackSolo(trackId);
  }, []);

  const setBpm = useCallback((bpm: number) => {
    setMasterBpmState(bpm);
    engineRef.current.setMasterBpm(bpm);
  }, []);

  const toggleMetronome = useCallback(() => {
    const state = engineRef.current.toggleMetronome();
    setMetronomeOn(state);
  }, []);

  useEffect(() => {
    let interval: number | null = null;
    if (isRecording) {
      interval = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    const success = await engineRef.current.startLiveRecording();
    if (success) {
      setIsRecording(true);
      setRecordingSeconds(0);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    const res = await engineRef.current.stopLiveRecording();
    setIsRecording(false);
    if (res) {
      setLastRecording({ url: res.url, duration: res.duration });
    }
    return res;
  }, []);

  const decodeAudioFile = useCallback(async (file: File, baseBpm?: number) => {
    return await engineRef.current.decodeAudioFile(file, baseBpm);
  }, []);

  const updateTrackSound = useCallback(
    (trackId: string, type: 'mainLoop' | 'bitMusic', sample: SoundSample) => {
      engineRef.current.updateTrackSound(trackId, type, sample);
    },
    []
  );

  const updateTrackSongs = useCallback(
    async (trackId: string, assignedSongs: string[], notes: string, baseBpm?: number) => {
      const target = engineRef.current.getTracks().find((t) => t.id === trackId);
      engineRef.current.updateTrackMetadata(trackId, assignedSongs, notes, baseBpm);

      if (target) {
        const key = target.folderFileName || target.id;
        await saveSongMetadata(key, {
          assignedSongs,
          notes,
          bpm: baseBpm || target.mainLoop.bpm,
        });
      }
    },
    []
  );

  const addCustomTrack = useCallback((newTrack: TrackData) => {
    const tagged: TrackData = {
      ...newTrack,
      sourceType: newTrack.sourceType || 'custom',
      assignedSongs: newTrack.assignedSongs || [],
      notes: newTrack.notes || '',
    };
    engineRef.current.addCustomTrack(tagged);
    if (tagged.assignedSongs && tagged.assignedSongs.length > 0) {
      saveSongMetadata(tagged.id, {
        assignedSongs: tagged.assignedSongs,
        notes: tagged.notes || '',
        bpm: tagged.mainLoop.bpm,
      });
    }
  }, []);

  const removeTrack = useCallback((trackId: string) => {
    engineRef.current.removeTrack(trackId);
  }, []);

  const setDJFilter = useCallback(
    (cutoff: number, type: 'lowpass' | 'highpass', active: boolean) => {
      engineRef.current.setDJFilter(cutoff, type, active);
    },
    []
  );

  const setDJDelay = useCallback((time: number, feedback: number, active: boolean) => {
    engineRef.current.setDJDelay(time, feedback, active);
  }, []);

  return {
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
    setTrackPan,
    toggleTrackMute,
    toggleTrackSolo,
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
  };
}
