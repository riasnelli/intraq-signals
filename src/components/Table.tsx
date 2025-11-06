import React from "react";

export default function Table({ rows }: { rows: any[] }) {
  if (!rows?.length) return null;
  return (
    <table className="w-full text-sm">
      <thead className="text-slate-300">
        <tr>
          {Object.keys(rows[0]).map(k => <th key={k} className="text-left p-2">{k}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r,i)=> (
          <tr key={i} className="border-t border-slate-800">
            {Object.values(r).map((v, j)=>(<td key={j} className="p-2">{String(v)}</td>))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}