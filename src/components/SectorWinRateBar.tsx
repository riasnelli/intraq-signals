import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

export default function SectorWinRateBar({ 
  data 
}: { 
  data: { sector: string; winRate: number; total: number; wins: number }[] 
}) {
  // Color gradient from red to green based on win rate
  const getColor = (winRate: number) => {
    if (winRate >= 70) return "#10b981"; // green
    if (winRate >= 50) return "#fbbf24"; // yellow
    return "#ef4444"; // red
  };

  return (
    <div className="w-full h-80">
      <div className="mb-3 text-sm font-medium text-slate-300">
        Sector Win-rate (%)
        <span className="ml-2 text-xs text-slate-400">Minimum 3 trades</span>
      </div>
      <ResponsiveContainer>
        <BarChart data={data.filter(d => d.total >= 3)}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="sector" 
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            domain={[0, 100]} 
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af' }}
            label={{ value: 'Win Rate (%)', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              border: '1px solid #475569',
              borderRadius: '8px',
              color: '#e2e8f0'
            }}
            formatter={(value: any, name: string, props: any) => {
              return [
                `${value}% (${props.payload.wins}/${props.payload.total})`,
                'Win Rate'
              ];
            }}
          />
          <Bar 
            dataKey="winRate" 
            radius={[8, 8, 0, 0]}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.winRate)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

