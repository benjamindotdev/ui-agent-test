// components/debug/DebugPanel.tsx
import React from 'react';
import { ActionType } from '@/lib/types';

interface DebugPanelProps {
  lastAction?: ActionType;
  lastReasoning?: string;
  componentCount: number;
  screenName: string;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ 
  lastAction, 
  lastReasoning, 
  componentCount,
  screenName
}) => {
  return (
    <div className="bg-slate-900 text-slate-200 p-4 rounded-lg text-sm font-mono space-y-4 h-full overflow-auto border border-slate-700">
      <h3 className="text-slate-400 uppercase text-xs tracking-wider font-bold mb-2">System State</h3>
      
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

      <div className="border-t border-slate-800 my-4 pt-4">
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
    </div>
  );
};
