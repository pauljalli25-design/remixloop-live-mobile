/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallBannerProps {
  onOpenInstallGuide: () => void;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({
  onOpenInstallGuide,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || dismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      onOpenInstallGuide();
    }
  };

  return (
    <div className="bg-[#023470]/95 border border-sky-300/40 rounded-2xl p-3 flex items-center justify-between gap-2.5 shadow-md">
      <div className="flex items-center gap-2.5 min-w-0">
        <img
          src="/app-icon.png"
          alt="RemixLoop App Icon"
          className="w-10 h-10 rounded-xl border border-white/25 shrink-0 object-cover"
        />
        <div className="min-w-0">
          <div className="text-xs sm:text-sm font-bold text-white truncate">
            Install RemixLoop Mobile App
          </div>
          <div className="text-[11px] text-sky-200/85 truncate">
            {isIOS
              ? 'Add to iPhone Home Screen for full-screen offline play'
              : 'Full-screen phone app with offline music cache'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={handleInstallClick}
          className="min-h-[40px] px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isInstallable ? 'Install' : 'Install App'}</span>
        </button>

        <button
          onClick={() => setDismissed(true)}
          className="min-h-[40px] min-w-[36px] rounded-xl text-sky-200/75 hover:text-white hover:bg-white/10 flex items-center justify-center"
          aria-label="Dismiss install banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
