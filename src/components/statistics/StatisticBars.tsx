import React from 'react';

// Horizontal bars relative to the largest value (no chart library - Tailwind only). Used for a
// metric's per-context split (Open world / Siege) and the economy earned/spent pairs.

export interface StatisticBar {
  key: string;
  label: string;
  value: number;
  /** The text shown next to the bar (formatted in the metric's unit). */
  display: string;
}

export const StatisticBars: React.FC<{ bars: StatisticBar[]; ariaLabel: string }> = ({ bars, ariaLabel }) => {
  const max = Math.max(0, ...bars.map(b => b.value));
  return (
    <ul className="space-y-1" aria-label={ariaLabel}>
      {bars.map(bar => {
        const percent = max > 0 ? Math.max(2, Math.round((bar.value / max) * 100)) : 0;
        return (
          <li key={bar.key} className="grid grid-cols-[7rem_1fr_auto] items-center gap-2 text-xs">
            <span className="text-gray-600 truncate">{bar.label}</span>
            <div
              className="h-2 rounded-full bg-gray-100 overflow-hidden"
              role="progressbar"
              aria-label={bar.label}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-valuenow={bar.value}
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
            <span className="text-gray-700 tabular-nums">{bar.display}</span>
          </li>
        );
      })}
    </ul>
  );
};
