// components/debug/DebugPanel.tsx
import React from 'react';
import { ActionType } from '@/lib/types';

export interface SystemActionEntry {
  id: string;
  prompt: string;
  action?: ActionType;
  reasoning?: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

interface DebugPanelProps {
  lastAction?: ActionType;
  lastReasoning?: string;
  componentCount: number;
  screenName: string;
  history: SystemActionEntry[];
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ 
  lastAction, 
  lastReasoning, 
  componentCount,
  screenName,
  history,
}) => {
  return (
    <div className="bg-slate-950 text-slate-200 p-4 text-sm font-mono space-y-4 h-full overflow-auto">
      <h3 className="text-slate-400 uppercase text-xs tracking-wider font-bold">System State</h3>
      
      <div className="space-y-2">
        <div>
          <span className="text-slate-500 block text-xs">Current Screen</span>
          <span className="font-semibold text-green-400">{screenName}</span>
        </div>
        
        <div>
          <span className="text-slate-500 block text-xs">Components</span>
          <span className="font-semibold">{componentCount} active elements</span>
        </div>
      </div>

      <div className="border-t border-slate-800 pt-4">
         <h3 className="text-slate-400 uppercase text-xs tracking-wider font-bold mb-2">Last Planner Decision</h3>
         {lastAction ? (
           <div className="space-y-2">
             <div className="flex items-center gap-2">
               <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                 lastAction === 'REGENERATE_SCREEN' ? 'bg-red-900 text-red-200' :
                 lastAction === 'ADD_COMPONENTS' ? 'bg-blue-900 text-blue-200' :
                 'bg-yellow-900 text-yellow-200'
               }`}>
                 {lastAction}
               </span>
             </div>
             <p className="text-slate-300 italic text-xs leading-relaxed">
               "{lastReasoning}"
             </p>
           </div>
         ) : (
           <span className="text-slate-600 italic">Waiting for input...</span>
         )}
      </div>

      <div className="border-t border-slate-800 pt-4 space-y-2">
        <h3 className="text-slate-400 uppercase text-xs tracking-wider font-bold">System Actions</h3>
        {history.length === 0 ? (
          <p className="text-slate-600 italic text-xs">No actions yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map((entry) => (
              <div key={entry.id} className="rounded border border-slate-800 bg-slate-900 p-2 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400">{new Date(entry.createdAt).toLocaleTimeString()}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                    entry.status === 'pending'
                      ? 'bg-amber-900 text-amber-200'
                      : entry.status === 'failed'
                        ? 'bg-red-900 text-red-200'
                        : 'bg-emerald-900 text-emerald-200'
                  }`}>
                    {entry.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-slate-200">{entry.prompt}</p>
                {entry.action && (
                  <p className="text-[10px] text-blue-300">Action: {entry.action}</p>
                )}
                {entry.reasoning && (
                  <p className="text-[10px] text-slate-400 italic">{entry.reasoning}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
