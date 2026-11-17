/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SlidersHorizontal, Activity, RefreshCw } from 'lucide-react';

interface MasterFXBarProps {
  onSetFilter: (cutoff: number, type: 'lowpass' | 'highpass', active: boolean) => void;
  onSetDelay: (time: number, feedback: number, active: boolean) => void;
}

export const MasterFXBar: React.FC<MasterFXBarProps> = ({
  onSetFilter,
  onSetDelay,
}) => {
  const [filterActive, setFilterActive] = useState(false);
  const [filterCutoff, setFilterCutoff] = useState(20000);
  const [filterType, setFilterType] = useState<'lowpass' | 'highpass'>('lowpass');

  const [delayActive, setDelayActive] = useState(false);
  const [delayTime] = useState(0.28);
  const [delayFeedback] = useState(0.4);

  const [activeRoll, setActiveRoll] = useState<string | null>(null);

  const handleFilterChange = (val: number) => {
    setFilterCutoff(val);
    setFilterActive(true);
    onSetFilter(val, filterType, true);
  };

  const toggleFilterBypass = () => {
    const next = !filterActive;
    setFilterActive(next);
    onSetFilter(filterCutoff, filterType, next);
  };

  const toggleFilterType = () => {
    const next = filterType === 'lowpass' ? 'highpass' : 'lowpass';
    setFilterType(next);
    onSetFilter(filterCutoff, next, filterActive);
  };

  const toggleDelay = () => {
    const next = !delayActive;
    setDelayActive(next);
    onSetDelay(delayTime, delayFeedback, next);
  };

  const triggerRoll = (division: string) => {
    if (activeRoll === division) {
      setActiveRoll(null);
      onSetDelay(delayTime, 0, false);
    } else {
      setActiveRoll(division);
      const time = division === '1/4' ? 0.23 : division === '1/8' ? 0.11 : 0.055;
      onSetDelay(time, 0.75, true);
    }
  };

  return (
    <div className="bg-[#022654]/90 backdrop-blur-md border border-white/15 rounded-2xl p-3 space-y-3">
      {/* DJ Filter */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-sky-300 shrink-0" />
          <span className="text-xs font-bold text-white">Filter</span>
          <button
            onClick={toggleFilterType}
            className="min-h-[36px] px-2.5 text-[11px] font-mono rounded-lg bg-[#011836] text-sky-200 border border-white/15"
          >
            {filterType === 'lowpass' ? 'Low-Pass' : 'High-Pass'}
          </button>
        </div>

        <button
          onClick={toggleFilterBypass}
          className={`min-h-[36px] px-3 text-xs font-bold rounded-lg border transition ${
            filterActive
              ? 'bg-sky-500 text-slate-950 border-sky-300'
              : 'bg-[#011836] border-white/15 text-sky-200'
          }`}
        >
          {filterActive ? 'Active' : 'Bypass'}
        </button>

        <div className="w-full flex items-center gap-2">
          <input
            type="range"
            min="200"
            max="18000"
            step="50"
            value={filterCutoff}
            onChange={(e) => handleFilterChange(parseFloat(e.target.value))}
            className="flex-1 h-2 bg-[#011836] rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-[11px] font-mono text-sky-200 w-14 text-right tabular-nums">
            {filterCutoff > 1000 ? `${(filterCutoff / 1000).toFixed(1)}k` : `${Math.round(filterCutoff)}`}Hz
          </span>
        </div>
      </div>

      {/* Beat Roll & Dub Delay */}
      <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-amber-300 shrink-0" />
          <span className="text-xs font-bold text-white mr-1">Roll</span>
          {['1/4', '1/8', '1/16'].map((div) => (
            <button
              key={div}
              onClick={() => triggerRoll(div)}
              className={`min-h-[40px] px-2.5 text-xs font-mono font-bold rounded-lg border transition ${
                activeRoll === div
                  ? 'bg-amber-400 border-amber-200 text-slate-950'
                  : 'bg-[#011836] border-white/15 text-sky-100'
              }`}
            >
              {div}
            </button>
          ))}
        </div>

        <button
          onClick={toggleDelay}
          className={`min-h-[40px] px-3 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition ${
            delayActive
              ? 'bg-amber-400 border-amber-200 text-slate-950'
              : 'bg-[#011836] border-white/15 text-sky-100'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{delayActive ? 'Delay On' : 'Delay Off'}</span>
        </button>
      </div>
    </div>
  );
};
