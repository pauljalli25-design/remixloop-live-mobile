/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Square, Smartphone, Download, Search } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface HeaderProps {
  hasActiveAudio: boolean;
  onStopAll: () => void;
  onOpenSearch: () => void;
  onOpenMobileModal: (tab?: 'quick' | 'render' | 'laptop' | 'pwabuilder') => void;
}

export const Header: React.FC<HeaderProps> = ({
  hasActiveAudio,
  onStopAll,
  onOpenSearch,
  onOpenMobileModal,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      onOpenMobileModal('quick');
    }
  };

  return (
    <header className="sticky top-0 z-40 h-14 bg-[#01346e]/95 backdrop-blur-md border-b border-white/15 px-3 sm:px-6 flex items-center justify-between gap-2">
      {/* Zone 1: Brand icon + single-line wordmark */}
      <div className="flex items-center gap-2 min-w-0">
        <img
          src="/app-icon.png"
          alt="RemixLoop Live"
          className="w-9 h-9 rounded-full border border-white/30 shadow-sm shrink-0 object-cover"
        />
        <span className="font-extrabold text-base sm:text-lg tracking-tight text-white whitespace-nowrap truncate">
          RemixLoop
        </span>
      </div>

      {/* Zone 2/3: Search icon + Stop + Install App + APK/Deploy */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onOpenSearch}
          className="min-h-[40px] min-w-[40px] px-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 whitespace-nowrap shrink-0"
          aria-label="Search songs and assigned music"
          title="Search songs and music"
        >
          <Search className="w-4 h-4" />
          <span className="hidden sm:inline">Search</span>
        </button>

        {hasActiveAudio && (
          <button
            onClick={onStopAll}
            className="min-h-[40px] px-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition active:scale-95 whitespace-nowrap shrink-0"
            title="Stop active audio"
          >
            <Square className="w-3.5 h-3.5 fill-white" />
            <span>Stop</span>
          </button>
        )}

        {!isInstalled && (
          <button
            onClick={handleInstallClick}
            className="min-h-[40px] px-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center gap-1 shadow-sm transition active:scale-95 whitespace-nowrap shrink-0"
            title="Install mobile app on your phone"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install App</span>
          </button>
        )}

        <button
          onClick={() => onOpenMobileModal('quick')}
          className="min-h-[40px] min-w-[40px] px-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-semibold flex items-center justify-center gap-1 transition active:scale-95 whitespace-nowrap shrink-0"
          title="Mobile APK & GitHub/Render Guide"
        >
          <Smartphone className="w-4 h-4 text-sky-300" />
          <span className="hidden sm:inline">APK / Deploy</span>
        </button>
      </div>
    </header>
  );
};
