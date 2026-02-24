"use client";

import { useState, useRef, useEffect } from 'react';
import { Component, Screen, ActionType, PendingComponentUpdate } from '@/lib/types';
import { DebugPanel, SystemActionEntry } from '@/components/debug/DebugPanel';
import { Sparkles, RefreshCw, Send, Loader2 } from 'lucide-react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // State from API
  const [screen, setScreen] = useState<Screen | null>(null);
  const [components, setComponents] = useState<Record<string, Component>>({});
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, PendingComponentUpdate>>({});
  const [previewModeByComponent, setPreviewModeByComponent] = useState<Record<string, 'before' | 'after'>>({});
  const [resolvingComponentId, setResolvingComponentId] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<ActionType | undefined>(undefined);
  const [lastReasoning, setLastReasoning] = useState<string | undefined>(undefined);
  const [systemHistory, setSystemHistory] = useState<SystemActionEntry[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    const submittedPrompt = prompt.trim();
    const actionId = crypto.randomUUID();

    setSystemHistory((current) => ([
      {
        id: actionId,
        prompt: submittedPrompt,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]));

    setPrompt('');
    setIsLoading(true);
    
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: submittedPrompt,
          sessionId,
          clientSnapshot: {
            screen,
            components,
            pendingUpdates,
            messages: systemHistory.flatMap((entry) => {
              const items: Array<{ role: 'user' | 'assistant'; content: string }> = [
                { role: 'user', content: entry.prompt },
              ];
              if (entry.action) {
                items.push({
                  role: 'assistant',
                  content: `Action: ${entry.action}. Reasoning: ${entry.reasoning ?? ''}`,
                });
              }
              return items;
            }),
          },
        })
      });

      if (!res.ok) throw new Error('Generation failed');

      const data = await res.json();
      
      setSessionId(data.sessionId);
      setScreen(data.screen);
      setComponents(data.components);
      setPendingUpdates(data.pendingUpdates ?? {});
      setPreviewModeByComponent((current) => {
        const next = { ...current };
        const updates = data.pendingUpdates ?? {};
        Object.keys(updates).forEach((id) => {
          if (!next[id]) {
            next[id] = 'after';
          }
        });
        Object.keys(next).forEach((id) => {
          if (!updates[id]) {
            delete next[id];
          }
        });
        return next;
      });
      setLastAction(data.action);
      setLastReasoning(data.plannerReasoning);
      setSystemHistory((current) => current.map((item) => (
        item.id === actionId
          ? {
              ...item,
              action: data.action,
              reasoning: data.plannerReasoning,
              status: 'completed',
            }
          : item
      )));
      
    } catch (error) {
      console.error(error);
      setSystemHistory((current) => current.map((item) => (
        item.id === actionId
          ? {
              ...item,
              reasoning: 'Request failed',
              status: 'failed',
            }
          : item
      )));
      alert('Failed to generate UI. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-scroll to bottom of components when new ones are added
  useEffect(() => {
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [screen?.componentOrder.length]);

  const handlePromptSubmit = (e: React.FormEvent) => {
    handleSubmit(e);
  };

  const setPromptValue = (val: string) => {
    setPrompt(val);
  };

  const setPreviewMode = (componentId: string, mode: 'before' | 'after') => {
    setPreviewModeByComponent((current) => ({
      ...current,
      [componentId]: mode,
    }));
  };

  const resolvePendingUpdate = async (componentId: string, decision: 'before' | 'after') => {
    if (!sessionId || resolvingComponentId) return;
    setResolvingComponentId(componentId);

    try {
      const res = await fetch(`/api/components/${componentId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, decision }),
      });

      if (!res.ok) {
        throw new Error('Failed to resolve pending update');
      }

      const data = await res.json();
      setScreen(data.screen);
      setComponents(data.components);
      setPendingUpdates(data.pendingUpdates ?? {});
      setPreviewModeByComponent((current) => {
        const next = { ...current };
        delete next[componentId];
        return next;
      });
    } catch (error) {
      console.error(error);
      alert('Failed to resolve component update. Please try again.');
    } finally {
      setResolvingComponentId(null);
    }
  };

  return (
    <main className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar / Controls */}
      <aside className="w-96 bg-white border-r border-slate-200 flex flex-col shadow-sm z-10 h-full">
        <div className="p-6 border-b border-slate-100 flex-shrink-0">
          <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800">
            <Sparkles className="w-5 h-5 text-purple-600" />
            UI Agent Test
          </h1>
          <p className="text-xs text-slate-500 mt-1">Minimal AI UI Generator</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Component List (Minimal) */}
          {screen && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Components</h3>
              <ul className="space-y-1">
                {screen.componentOrder.map((id, index) => {
                  const comp = components[id];
                  if (!comp) return null;
                  const pending = pendingUpdates[id];
                  const previewMode = previewModeByComponent[id] ?? 'before';
                  return (
                    <li key={id} className="text-sm px-3 py-2 bg-slate-50 rounded border border-slate-100 text-slate-600 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="truncate max-w-[180px]">{comp.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                          #{index + 1}
                        </span>
                      </div>
                      {pending && (
                        <div className="space-y-2">
                          <div className="text-[10px] uppercase tracking-wide font-semibold text-amber-600">Pending update</div>
                          <div className="grid grid-cols-2 gap-1">
                            <button
                              type="button"
                              onClick={() => setPreviewMode(id, 'before')}
                              className={`px-2 py-1 rounded text-[11px] border ${previewMode === 'before' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}
                            >
                              Before
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreviewMode(id, 'after')}
                              className={`px-2 py-1 rounded text-[11px] border ${previewMode === 'after' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}
                            >
                              After
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            <button
                              type="button"
                              disabled={resolvingComponentId === id}
                              onClick={() => resolvePendingUpdate(id, 'before')}
                              className="px-2 py-1 rounded text-[11px] border border-slate-200 bg-white text-slate-700 disabled:opacity-50"
                            >
                              Keep Before
                            </button>
                            <button
                              type="button"
                              disabled={resolvingComponentId === id}
                              onClick={() => resolvePendingUpdate(id, 'after')}
                              className="px-2 py-1 rounded text-[11px] border border-emerald-300 bg-emerald-50 text-emerald-700 disabled:opacity-50"
                            >
                              Keep After
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50 backdrop-blur-sm flex-shrink-0">
          <form onSubmit={handlePromptSubmit} className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPromptValue(e.target.value)}
              placeholder="Describe UI usage..."
              className="w-full bg-white border border-slate-300 rounded-lg pl-4 pr-12 py-3 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none resize-none h-24 shadow-sm transition-all text-slate-900 placeholder:text-slate-400"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handlePromptSubmit(e);
                }
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !prompt.trim()}
              className="absolute right-3 bottom-3 p-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
          <div className="mt-2 text-[10px] text-slate-400 flex justify-between px-1">
             <span>Press Enter to send</span>
             {sessionId && <span className="font-mono opacity-50">Session: {sessionId.slice(0, 8)}...</span>}
          </div>
        </div>
      </aside>

      {/* Main Preview Area */}
      <main className="flex-1 overflow-y-auto bg-slate-100/50 relative h-full">
        <div className="min-h-full p-8 md:p-12 max-w-5xl mx-auto">
           {screen ? (
             <div className="bg-white shadow-xl rounded-xl border border-slate-200 overflow-hidden min-h-[800px]">
                {/* Simulated Browser Header */}
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center gap-2 sticky top-0 z-10">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400/80"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400/80"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400/80"></div>
                  </div>
                  <div className="ml-4 flex-1 bg-white border border-slate-200 rounded-md py-1 px-3 text-xs text-slate-400 text-center font-mono shadow-sm truncate">
                    {screen.name.toLowerCase().replace(/\s+/g, '-')}.html
                  </div>
                </div>

                {/* Rendered Components */}
                <div className="divide-y divide-slate-100 relative">
                  {screen.componentOrder.length > 0 ? (
                    screen.componentOrder.map((id) => {
                        const component = components[id];
                        if (!component) return null;
                        const pending = pendingUpdates[id];
                        const previewMode = previewModeByComponent[id] ?? 'before';
                        const htmlToRender = pending
                          ? (previewMode === 'after' ? pending.afterHtml : pending.beforeHtml)
                          : component.html;
                        return (
                            <div key={id} className={`render-wrapper-${id}`}>
                               <div dangerouslySetInnerHTML={{ __html: htmlToRender }} />
                            </div>
                        );
                    })
                  ) : (
                    isLoading ? (
                      <div className="flex flex-col items-center justify-center h-[600px] text-slate-400">
                        <RefreshCw className="w-12 h-12 mb-4 opacity-20 animate-spin-slow" />
                        <p>Generating components...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-[600px] text-slate-400">
                        <p>No components available in this session.</p>
                      </div>
                    )
                  )}
                  {isLoading && (
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center z-20">
                      <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm shadow-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Loading...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
             </div>
           ) : (
             <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-6 mt-20">
               <div className="w-24 h-24 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center mb-4 rotate-3 transform transition-transform hover:rotate-6">
                 <Sparkles className="w-10 h-10 text-purple-400" />
               </div>
               <div className="text-center max-w-md">
                 <h2 className="text-xl font-bold text-slate-700 mb-2">Ready to Build</h2>
                 <p className="text-slate-500">Describe the interface you want to create. The AI planner will construct it component by component.</p>
               </div>
               
               <div className="grid grid-cols-2 gap-3 text-sm mt-8 w-full max-w-lg">
                 <button onClick={() => setPromptValue("SaaS landing page for a developer tool")} className="p-3 bg-white border border-slate-200 rounded-lg hover:border-purple-300 hover:shadow-sm text-left transition-all text-slate-600">
                   🚀 SaaS Landing Page
                 </button>
                 <button onClick={() => setPromptValue("E-commerce product detail page for sneakers")} className="p-3 bg-white border border-slate-200 rounded-lg hover:border-purple-300 hover:shadow-sm text-left transition-all text-slate-600">
                   👟 Product Detail Page
                 </button>
                 <button onClick={() => setPromptValue("Dashboard with user analytics and charts")} className="p-3 bg-white border border-slate-200 rounded-lg hover:border-purple-300 hover:shadow-sm text-left transition-all text-slate-600">
                   📊 Analytics Dashboard
                 </button>
                 <button onClick={() => setPromptValue("Mobile-first login screen with social auth")} className="p-3 bg-white border border-slate-200 rounded-lg hover:border-purple-300 hover:shadow-sm text-left transition-all text-slate-600">
                   📱 Login Screen
                 </button>
               </div>
             </div>
           )}
        </div>
      </main>

      <aside className="w-96 bg-slate-950 border-l border-slate-800 h-full">
        <DebugPanel
          lastAction={lastAction}
          lastReasoning={lastReasoning}
          componentCount={screen ? screen.componentOrder.length : 0}
          screenName={screen ? screen.name : 'Waiting for prompt...'}
          history={systemHistory}
        />
      </aside>
    </main>
  );
}
