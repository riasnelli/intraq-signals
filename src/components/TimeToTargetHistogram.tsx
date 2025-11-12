import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function TimeToTargetHistogram({ 
  data 
}: { 
  data: { label: string; count: number }[] 
}) {
  return (
    <div className="w-full h-64">
      <div className="mb-3 text-sm font-medium text-slate-300">Time to Target (minutes)</div>
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="label" 
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af' }}
          />
          <YAxis 
            allowDecimals={false} 
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              border: '1px solid #475569',
              borderRadius: '8px',
              color: '#e2e8f0'
            }}
          />
          <Bar 
            dataKey="count" 
            fill="#0ea5e9"
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

