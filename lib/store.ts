// lib/store.ts
// In-memory session store
// For development/demo purposes only

import { SessionState } from './types';

// Use a global variable to persist state across hot reloads in development
const globalStore = global as unknown as { sessions: Record<string, SessionState> };

if (!globalStore.sessions) {
  globalStore.sessions = {};
}

export const sessions = globalStore.sessions;

export function getSession(sessionId: string): SessionState | null {
  return sessions[sessionId] || null;
}

export function saveSession(state: SessionState): void {
  sessions[state.sessionId] = state;
}

export function createSession(sessionId: string): SessionState {
  const newState: SessionState = {
    sessionId,
    messages: [],
    screen: {
      id: "default-screen",
      name: "Empty Screen",
      componentOrder: []
    },
    components: {},
    pendingUpdates: {}
  };
  saveSession(newState);
  return newState;
}
