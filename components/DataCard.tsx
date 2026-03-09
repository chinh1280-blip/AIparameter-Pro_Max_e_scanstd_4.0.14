import React from 'react';
import { getDefaultTolerance } from '../types';

interface DataCardProps {
  dataKey: string;
  value: number | null;
  standardValue?: number;
  tolerance?: number;
  onChange: (key: string, value: number | null) => void;
  fieldLabels: Record<string, string>;
}

export const DataCard: React.FC<DataCardProps> = React.memo(({ dataKey, value, standardValue, tolerance, onChange, fieldLabels }) => {
  const activeTolerance = tolerance ?? getDefaultTolerance(dataKey);

  let statusColor = "text-slate-400";
  let diffDisplay = "";

  if (value !== null && standardValue !== undefined) {
    const diff = value - standardValue;
    const diffAbs = Math.abs(diff);
    const sign = diff > 0 ? "+" : "";
    diffDisplay = diff === 0 ? "✓ OK" : `${sign}${diff.toFixed(1)}`;
    
    if (diffAbs <= activeTolerance / 2) {
      statusColor = "text-green-400";
    } else if (diffAbs <= activeTolerance) {
      statusColor = "text-yellow-400";
    } else {
      statusColor = "text-red-400";
    }
  }

  return (
    <div className="bg-slate-800/90 p-4 rounded-2xl border border-slate-700/50 shadow-xl flex flex-col transition-all hover:border-blue-500/50 group">
      <div className="flex justify-between items-start mb-2.5">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[55%]">
          {fieldLabels[dataKey] || dataKey}
        </label>
        {standardValue !== undefined && (
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black text-green-500 uppercase tracking-tighter leading-none mb-1">
              Std: {standardValue}
            </span>
            <span className="text-[9px] font-black text-yellow-500 uppercase tracking-tighter leading-none">
              Tol: ±{activeTolerance}
            </span>
          </div>
        )}
      </div>
      
      <div className="flex items-center relative gap-2">
        <input
          type="number"
          step="0.1"
          className={`w-full bg-slate-900/80 text-white text-2xl font-mono font-black p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 border border-slate-700/50 transition-all ${value === null ? 'border-red-900/50' : ''} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
          value={value ?? ''}
          onChange={(e) => onChange(dataKey, e.target.value === '' ? null : parseFloat(e.target.value))}
          placeholder="--"
        />
        
        {value !== null && standardValue !== undefined && (
           <div className={`absolute right-4 top-1/2 -translate-y-1/2 font-mono font-black text-base drop-shadow-md ${statusColor}`}>
              {diffDisplay}
           </div>
        )}

        {value === null && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400 animate-pulse">
             <span className="text-[10px] font-black bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20 uppercase">Missing</span>
          </div>
        )}
      </div>
    </div>
  );
});