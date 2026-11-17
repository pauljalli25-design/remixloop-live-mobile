/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  QrCode,
  Terminal,
  Download,
  Copy,
  Check,
  ExternalLink,
  CheckCircle2,
  FolderGit2,
  Share,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { getLocalSongMetadata } from '../audio/folderLibrary';

interface MobileAPKModalProps {
  isOpen: boolean;
  initialTab?: 'quick' | 'render' | 'laptop' | 'pwabuilder';
  onClose: () => void;
}

export const MobileAPKModal: React.FC<MobileAPKModalProps> = ({
  isOpen,
  initialTab = 'quick',
  onClose,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'quick' | 'render' | 'laptop' | 'pwabuilder'>(initialTab);
  const [copiedCmd, setCopiedCmd] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://ais-dev-...run.app';

  const terminalCommands = `# 1. Build web bundle on your laptop
npm install
npm run build

# 2. Add Capacitor Android runtime (capacitor.config.json is already configured)
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync android

# 3. Build standalone APK file
cd android
./gradlew assembleDebug

# Output: android/app/build/outputs/apk/debug/app-debug.apk
# Copy app-debug.apk to your Android phone and tap to install!`;

  const copyCommands = () => {
    navigator.clipboard.writeText(terminalCommands);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const downloadSongsMetadata = () => {
    const localMeta = getLocalSongMetadata();
    const blob = new Blob([JSON.stringify(localMeta, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'songs-metadata.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full sm:max-w-xl bg-[#022654] border border-white/20 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/15 bg-[#011d42]">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/app-icon.png"
              alt="App Icon"
              className="w-9 h-9 rounded-full border border-white/25 shrink-0"
            />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white truncate">
                Install Mobile App & APK
              </h2>
              <p className="text-xs text-sky-200/80 truncate">
                Install directly on Android / iPhone or build .apk
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl text-sky-200 hover:text-white flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-4 border-b border-white/15 bg-[#011836]">
          <button
            onClick={() => setActiveTab('quick')}
            className={`min-h-[44px] px-1.5 text-[11px] font-bold border-b-2 flex items-center justify-center gap-1 transition ${
              activeTab === 'quick'
                ? 'border-sky-300 text-white bg-[#022654]'
                : 'border-transparent text-sky-200/70'
            }`}
          >
            <QrCode className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Phone App</span>
          </button>
          <button
            onClick={() => setActiveTab('laptop')}
            className={`min-h-[44px] px-1.5 text-[11px] font-bold border-b-2 flex items-center justify-center gap-1 transition ${
              activeTab === 'laptop'
                ? 'border-sky-300 text-white bg-[#022654]'
                : 'border-transparent text-sky-200/70'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Build APK</span>
          </button>
          <button
            onClick={() => setActiveTab('pwabuilder')}
            className={`min-h-[44px] px-1.5 text-[11px] font-bold border-b-2 flex items-center justify-center gap-1 transition ${
              activeTab === 'pwabuilder'
                ? 'border-sky-300 text-white bg-[#022654]'
                : 'border-transparent text-sky-200/70'
            }`}
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">APK Online</span>
          </button>
          <button
            onClick={() => setActiveTab('render')}
            className={`min-h-[44px] px-1.5 text-[11px] font-bold border-b-2 flex items-center justify-center gap-1 transition ${
              activeTab === 'render'
                ? 'border-sky-300 text-white bg-[#022654]'
                : 'border-transparent text-sky-200/70'
            }`}
          >
            <FolderGit2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">GitHub/Render</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-sky-100">
          {activeTab === 'quick' && (
            <div className="space-y-4">
              {isInstalled ? (
                <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-400/35 flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-emerald-200">Already Installed as Mobile App</div>
                    <p className="text-sky-100/85 mt-0.5">
                      RemixLoop is running in standalone app mode on your device.
                    </p>
                  </div>
                </div>
              ) : isInstallable ? (
                <button
                  onClick={install}
                  className="w-full min-h-[50px] py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm shadow-md flex items-center justify-center gap-2 transition active:scale-95"
                >
                  <Download className="w-5 h-5" />
                  <span>Install RemixLoop App Now</span>
                </button>
              ) : null}

              {/* Android Chrome Instructions */}
              <div className="p-3.5 rounded-xl bg-[#011836] border border-white/15 space-y-2">
                <div className="font-bold text-white text-sm">
                  Android Phone (Google Chrome WebAPK)
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-sky-100/90 leading-relaxed">
                  <li>
                    Open this app URL in <strong>Google Chrome</strong> on your Android phone (scan the QR code below if you are on your laptop).
                  </li>
                  <li>
                    Tap the <strong>⋮ Menu</strong> button at the top-right of Chrome.
                  </li>
                  <li>
                    Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
                  </li>
                  <li>
                    Android installs <strong>RemixLoop</strong> with your instrument icon into your App Drawer and Home Screen, ready to use full-screen and offline!
                  </li>
                </ol>
              </div>

              {/* iOS Safari Instructions */}
              <div className={`p-3.5 rounded-xl bg-[#011836] border ${isIOS ? 'border-amber-300/60' : 'border-white/15'} space-y-2`}>
                <div className="font-bold text-white text-sm flex items-center gap-1.5">
                  <Share className="w-4 h-4 text-sky-300" />
                  <span>iPhone / iPad (Safari)</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-sky-100/90 leading-relaxed">
                  <li>Open this URL in <strong>Safari</strong>.</li>
                  <li>Tap the <strong>Share</strong> icon at the bottom of Safari.</li>
                  <li>Scroll down and tap <strong>"Add to Home Screen"</strong>.</li>
                </ol>
              </div>

              {/* QR Code to open on Mobile */}
              <div className="flex flex-col items-center p-4 bg-[#011836] rounded-xl border border-white/15 space-y-2.5">
                <div className="p-2.5 bg-white rounded-xl">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(currentUrl)}`}
                    alt="Scan QR code with phone"
                    className="w-32 h-32"
                  />
                </div>
                <span className="text-[11px] text-sky-200">Scan with your mobile camera to open & install</span>
                <div className="text-[10px] text-sky-300 break-all font-mono bg-black/30 px-2.5 py-1.5 rounded-lg w-full text-center">
                  {currentUrl}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'laptop' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-white">Build Standalone app-debug.apk on Laptop</span>
                <button
                  onClick={copyCommands}
                  className="min-h-[40px] px-3 rounded-xl bg-[#011836] border border-white/20 text-white font-semibold flex items-center gap-1.5"
                >
                  {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCmd ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3.5 rounded-xl bg-[#011836] border border-white/15 text-[11px] font-mono text-sky-200 overflow-x-auto leading-relaxed">
                {terminalCommands}
              </pre>
            </div>
          )}

          {activeTab === 'pwabuilder' && (
            <div className="space-y-4">
              <p className="text-sky-100 leading-relaxed">
                Once your app is live on Render (or using the URL below), Microsoft PWABuilder packages it into a downloadable <code className="text-amber-300">.apk</code> file in one click without installing Android Studio.
              </p>
              <a
                href={`https://www.pwabuilder.com?url=${encodeURIComponent(currentUrl)}`}
                target="_blank"
                rel="noreferrer"
                className="w-full min-h-[48px] py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-2"
              >
                <span>Open PWABuilder to Download .APK</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}

          {activeTab === 'render' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-[#011836] border border-white/15 space-y-2">
                <div className="font-bold text-white text-sm">
                  1. Paste Your Music Files in <code className="text-amber-300">public/music/</code>
                </div>
                <p className="text-sky-100/85 leading-relaxed">
                  Paste any <code className="text-sky-300">.mp3</code>, <code className="text-sky-300">.wav</code>, <code className="text-sky-300">.ogg</code>, or <code className="text-sky-300">.m4a</code> files into the <code className="text-amber-300">public/music/</code> folder before pushing to GitHub. Every file in that folder loads automatically in the app!
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#011836] border border-white/15 space-y-2">
                <div className="font-bold text-white text-sm">2. Deploy on Render (Web Service)</div>
                <div className="space-y-1 font-mono text-[11px] text-sky-200 bg-black/30 p-3 rounded-lg">
                  <div>Build Command: <span className="text-white">npm install && npm run build</span></div>
                  <div>Start Command: <span className="text-white">npm start</span></div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#011836] border border-white/15 space-y-2">
                <div className="font-bold text-white text-sm">3. Backup / Commit Song Search Names</div>
                <p className="text-sky-100/85 leading-relaxed">
                  Song names assigned on your laptop automatically save into <code className="text-amber-300">public/music/songs-metadata.json</code>. Download the JSON below to include mobile edits in GitHub.
                </p>
                <button
                  onClick={downloadSongsMetadata}
                  className="w-full min-h-[44px] px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download songs-metadata.json</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-white/15 bg-[#011d42] flex justify-end">
          <button
            onClick={onClose}
            className="min-h-[44px] px-5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
