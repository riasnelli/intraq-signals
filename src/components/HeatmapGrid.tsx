import React from "react";

type Bin = { band: string; total: number; wins: number; losses: number; winRate: number };

export default function HeatmapGrid({ data }: { data: Bin[] }) {
  const max = 100; // win-rate %
  
  return (
    <div className="w-full">
      <div className="mb-3 text-sm font-medium text-slate-300">Win-rate by Score Band</div>
      <div className="grid grid-cols-6 gap-2">
        {data.map((b) => {
          const intensity = Math.round((b.winRate / max) * 255);
          const bg = `rgb(${255 - intensity}, ${Math.min(intensity + 100, 255)}, ${Math.min(intensity + 50, 200)})`; // greener = higher win-rate
          
          return (
            <div
              key={b.band}
              className="p-4 rounded-lg text-center text-xs shadow-lg transition-transform hover:scale-105"
              style={{ backgroundColor: bg, color: intensity > 128 ? '#000' : '#fff' }}
            >
              <div className="font-bold text-sm mb-1">{b.band}</div>
              <div className="text-lg font-bold mb-1">{b.winRate}%</div>
              <div className="opacity-70 text-xs">
                {b.wins}W / {b.losses}L
              </div>
              <div className="opacity-60 text-xs mt-1">n={b.total}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

