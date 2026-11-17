/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { X, Play, Pause, Download, Disc, Check } from 'lucide-react';

interface RecordingExportModalProps {
  recording: { url: string; duration: number } | null;
  isOpen: boolean;
  onClose: () => void;
}

export const RecordingExportModal: React.FC<RecordingExportModalProps> = ({
  recording,
  isOpen,
  onClose,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(false);

  if (!isOpen || !recording) return null;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = recording.url;
    a.download = `remixloop-live-${Date.now()}.webm`;
    a.click();
    setHasDownloaded(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full sm:max-w-md bg-[#022654] border border-white/20 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/15 bg-[#011d42]">
          <div className="flex items-center gap-2">
            <Disc className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">Live Recording Ready</h2>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl text-sky-200 hover:text-white flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-center">
          <audio
            ref={audioRef}
            src={recording.url}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />

          <div className="p-5 bg-[#011836] rounded-2xl border border-white/15 flex flex-col items-center gap-3">
            <div className="text-xs text-sky-200 tabular-nums">
              Duration: {recording.duration}s
            </div>
            <button
              onClick={togglePlay}
              className="w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg transition active:scale-95"
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
            </button>
            <div className="text-xs font-semibold text-white">
              {isPlaying ? 'Playing recording...' : 'Tap to preview'}
            </div>
          </div>

          <button
            onClick={handleDownload}
            className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition"
          >
            {hasDownloaded ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            <span>{hasDownloaded ? 'Saved to Device' : 'Download Audio File'}</span>
          </button>
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
