// app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { processUserRequest } from "@/lib/agent/orchestrator";
import { getSession, createSession, saveSession } from "@/lib/store";
import { GenerateResponse } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, sessionId: clientSessionId } = body;
    
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Get or create session
    let sessionId = clientSessionId;
    let sessionState = sessionId ? getSession(sessionId) : null;
    
    if (!sessionState) {
      sessionId = crypto.randomUUID();
      sessionState = createSession(sessionId);
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
