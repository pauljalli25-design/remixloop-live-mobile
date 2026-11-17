/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { X, Download, Upload, Package, Check } from 'lucide-react';
import { TrackData } from '../types/audio';

interface SoundPackModalProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: TrackData[];
  onImportPack: (importedTracks: TrackData[]) => void;
}

export const SoundPackModal: React.FC<SoundPackModalProps> = ({
  isOpen,
  onClose,
  tracks,
  onImportPack,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [packName, setPackName] = useState('My Custom Pack');
  const [exportSuccess, setExportSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = () => {
    const pack = {
      version: 1,
      name: packName,
      created: new Date().toISOString(),
      tracksCount: tracks.length,
      tracks: tracks.map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        color: t.color,
        volume: t.volume,
        pan: t.pan,
        mainLoop: {
          id: t.mainLoop.id,
          name: t.mainLoop.name,
          duration: t.mainLoop.duration,
          bpm: t.mainLoop.bpm,
          waveform: t.mainLoop.waveform,
        },
        bitMusic: {
          id: t.bitMusic.id,
          name: t.bitMusic.name,
          duration: t.bitMusic.duration,
          bpm: t.bitMusic.bpm,
          waveform: t.bitMusic.waveform,
        },
      })),
    };

    const jsonString = JSON.stringify(pack, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${packName.toLowerCase().replace(/\s+/g, '-')}-pack.json`;
    a.click();
    URL.revokeObjectURL(url);

    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 3000);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.tracks && Array.isArray(json.tracks)) {
          onImportPack(json.tracks);
          setStatusMessage(`Imported "${json.name || 'Pack'}" (${json.tracks.length} tracks).`);
        } else {
          setStatusMessage('Invalid sound pack file format.');
        }
      } catch {
        setStatusMessage('Could not read sound pack JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full sm:max-w-lg bg-[#022654] border border-white/20 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/15 bg-[#011d42]">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-sky-300" />
            <h2 className="text-base font-bold text-white">Sound Pack Sync</h2>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl text-sky-200 hover:text-white flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs text-sky-100 overflow-y-auto">
          {statusMessage && (
            <div className="p-3 rounded-xl bg-sky-500/20 border border-sky-300/40 text-white">
              {statusMessage}
            </div>
          )}

          <div className="p-4 bg-[#011836] rounded-xl border border-white/15 space-y-3">
            <h3 className="font-bold text-white">
              Export Track Layout ({tracks.length} Tracks)
            </h3>
            <input
              type="text"
              value={packName}
              onChange={(e) => setPackName(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl bg-[#022654] border border-white/20 text-white font-medium"
            />
            <button
              onClick={handleExport}
              className="w-full min-h-[44px] px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold flex items-center justify-center gap-2 transition"
            >
              {exportSuccess ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
              <span>{exportSuccess ? 'Downloaded Pack' : 'Export Sound Pack (.json)'}</span>
            </button>
          </div>

          <div className="p-4 bg-[#011836] rounded-xl border border-white/15 space-y-2">
            <h3 className="font-bold text-white">Import Sound Pack File</h3>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full min-h-[48px] px-3 rounded-xl border border-dashed border-sky-300/50 bg-[#022654] flex items-center justify-center gap-2 text-white font-semibold cursor-pointer"
            >
              <Upload className="w-4 h-4 text-sky-300" />
              <span>Choose Pack File (.json)</span>
            </button>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-white/15 bg-[#011d42] flex justify-end">
          <button
            onClick={onClose}
            className="min-h-[44px] px-5 rounded-xl bg-white/15 text-white font-semibold text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
