// app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { processUserRequest } from "@/lib/agent/orchestrator";
import { getSession, createSession, saveSession } from "@/lib/store";
import { GenerateResponse, SessionState, Message } from "@/lib/types";

type ClientSnapshot = {
  screen?: SessionState["screen"] | null;
  components?: SessionState["components"] | null;
  pendingUpdates?: SessionState["pendingUpdates"] | null;
  messages?: Message[] | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, sessionId: clientSessionId, clientSnapshot } = body as {
      prompt?: string;
      sessionId?: string;
      clientSnapshot?: ClientSnapshot;
    };
    
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Get or create session
    let sessionId: string = clientSessionId ?? crypto.randomUUID();
    let sessionState = getSession(sessionId);
    
    if (!sessionState) {
      sessionState = buildSessionFromSnapshot(sessionId, clientSnapshot) ?? createSession(sessionId);
    }

    // Process the request
    const { newState, plannerOutput } = await processUserRequest(
      sessionId,
      prompt,
      sessionState
    );

    // Save state
    saveSession(newState);

    // Return response
    const response: GenerateResponse = {
      sessionId,
      screen: newState.screen,
      components: newState.components,
      pendingUpdates: newState.pendingUpdates,
      plannerReasoning: plannerOutput.reasoning,
      action: plannerOutput.action
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Generate API Error:", error);
    return NextResponse.json(
      { error: "Failed to generate UI", details: error instanceof Error ? error.message : String(error) }, 
      { status: 500 }
    );
  }
}

function buildSessionFromSnapshot(sessionId: string, snapshot?: ClientSnapshot): SessionState | null {
  if (!snapshot?.screen || !snapshot?.components) {
    return null;
  }

  const normalizedMessages = Array.isArray(snapshot.messages)
    ? snapshot.messages.filter((msg) => msg && (msg.role === "user" || msg.role === "assistant") && typeof msg.content === "string")
    : [];

  return {
    sessionId,
    messages: normalizedMessages,
    screen: snapshot.screen,
    components: snapshot.components,
    pendingUpdates: snapshot.pendingUpdates ?? {},
  };
}
