/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';

interface WaveformDisplayProps {
  waveform: number[];
  progress: number; // 0 to 100
  color: string;
  isPlaying: boolean;
  isPausedForBit?: boolean;
  height?: number;
}

export const WaveformDisplay: React.FC<WaveformDisplayProps> = ({
  waveform,
  progress,
  color,
  isPlaying,
  isPausedForBit = false,
  height = 36,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const canvasHeight = height;

    canvas.width = width * dpr;
    canvas.height = canvasHeight * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, canvasHeight);

    const peaks = waveform.length > 0 ? waveform : new Array(48).fill(0.3);
    const numBars = peaks.length;
    const barWidth = Math.max(2, (width / numBars) - 1.5);
    const progressX = (progress / 100) * width;

    for (let i = 0; i < numBars; i++) {
      const x = (i / numBars) * width;
      const peak = peaks[i];
      const barH = Math.max(4, peak * (canvasHeight - 6));
      const y = (canvasHeight - barH) / 2;

      const isPassed = x <= progressX;

      if (isPausedForBit) {
        // Flashing amber/orange paused appearance
        ctx.fillStyle = isPassed ? '#f59e0b' : '#374151';
      } else if (isPlaying) {
        ctx.fillStyle = isPassed ? color : '#374151';
      } else {
        ctx.fillStyle = '#1f2937';
      }

      // Rounded rect
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, 2);
      ctx.fill();
    }

    // Playhead line
    if (isPlaying || isPausedForBit) {
      ctx.fillStyle = isPausedForBit ? '#fbbf24' : '#ffffff';
      ctx.fillRect(progressX - 1, 0, 2, canvasHeight);
    }
  }, [waveform, progress, color, isPlaying, isPausedForBit, height]);

  return (
    <div className="w-full relative overflow-hidden rounded bg-black/40 border border-white/5">
      <canvas
        ref={canvasRef}
        className="w-full block"
        style={{ height: `${height}px` }}
      />
    </div>
  );
};
