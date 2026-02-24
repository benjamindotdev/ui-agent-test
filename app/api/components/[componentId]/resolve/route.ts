import { NextRequest, NextResponse } from "next/server";
import { getSession, saveSession } from "@/lib/store";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ componentId: string }> }
) {
  try {
    const { componentId } = await context.params;
    const body = await req.json();
    const { sessionId, decision } = body as { sessionId?: string; decision?: "before" | "after" };

    if (!sessionId || !decision) {
      return NextResponse.json({ error: "sessionId and decision are required" }, { status: 400 });
    }

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const pending = session.pendingUpdates[componentId];
    if (!pending) {
      return NextResponse.json({ error: "Pending update not found" }, { status: 404 });
    }

    if (decision === "after") {
      const component = session.components[componentId];
      if (!component) {
        return NextResponse.json({ error: "Component not found" }, { status: 404 });
      }
      session.components[componentId] = {
        ...component,
        html: pending.afterHtml,
      };
    }

    delete session.pendingUpdates[componentId];
    saveSession(session);

    return NextResponse.json({
      sessionId: session.sessionId,
      screen: session.screen,
      components: session.components,
      pendingUpdates: session.pendingUpdates,
    });
  } catch (error) {
    console.error("Resolve update API error:", error);
    return NextResponse.json({ error: "Failed to resolve pending update" }, { status: 500 });
  }
}
