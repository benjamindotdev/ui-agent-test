// Core types for the minimal AI UI tool

export interface Component {
  id: string; // stable slug e.g. "header", "hero-section"
  name: string;
  type: string; // e.g. "header", "footer", "content-block"
  description: string;
  html: string;
}

export interface PendingComponentUpdate {
  componentId: string;
  beforeHtml: string;
  afterHtml: string;
  prompt: string;
  createdAt: string;
}

export interface Screen {
  id: string; // unique ID
  name: string;
  componentOrder: string[]; // array of component ids
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface SessionState {
  sessionId: string;
  messages: Message[];
  screen: Screen;
  components: Record<string, Component>;
  pendingUpdates: Record<string, PendingComponentUpdate>;
}

// Planner Types
export type ActionType = 'REGENERATE_SCREEN' | 'UPDATE_COMPONENTS' | 'ADD_COMPONENTS';

export interface PlannerOutput {
  action: ActionType;
  reasoning: string;
  targetComponentIds?: string[]; // IDs to update or add
  newComponentDescriptions?: { id: string; description: string; name: string; positionIndex?: number }[]; // For ADD_COMPONENTS
}

// API Response Type
export interface GenerateResponse {
  sessionId: string;
  screen: Screen; 
  components: Record<string, Component>;
  pendingUpdates: Record<string, PendingComponentUpdate>;
  plannerReasoning: string;
  action: ActionType;
}
