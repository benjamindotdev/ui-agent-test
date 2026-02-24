// lib/agent/planner.ts
import { z } from "zod";
import { jsonrepair } from "jsonrepair";
import { createMessageWithFallback, DEFAULT_PLANNER_MODELS } from "../anthropic";
import { SessionState } from "../types";

// Define the structured output schema for the planner
const PlannerSchema = z.object({
  action: z.enum(["REGENERATE_SCREEN", "UPDATE_COMPONENTS", "ADD_COMPONENTS"]),
  reasoning: z.string().describe("Explanation for why this action was chosen"),
  
  // For UPDATE_COMPONENTS:
  targetComponentIds: z.array(z.string()).nullable()
    .describe("List of existing component IDs to modify. Required for UPDATE_COMPONENTS."),
  
  // For ADD_COMPONENTS:
  newComponents: z.array(z.object({
    id: z.string().describe("A concise slug (e.g. 'pricing-table', 'hero')"),
    name: z.string(),
    description: z.string().describe("Detailed description of what this component should contain and look like"),
    positionIndex: z.number().nullable().describe("0-based index where to insert the component. Defaults to end if omitted.")
  })).nullable().describe("List of new components to add. Required for ADD_COMPONENTS and REGENERATE_SCREEN."),
  
  // For REGENERATE_SCREEN: (Also uses newComponents)
  screenName: z.string().nullable().describe("Name of the screen if regenerating"),
});

export type PlannerResponse = z.infer<typeof PlannerSchema>;

export async function planNextMove(
  prompt: string,
  currentState: SessionState
): Promise<PlannerResponse> {
  const componentIndex = Object.values(currentState.components).map(c => ({
    id: c.id,
    name: c.name,
    description: c.description.substring(0, 100) + "..." // Truncate for token efficiency
  }));

  const systemPrompt = `
    You are an AI UI Planner. Your job is to decide how to modify a screen based on user requests.
    
    Current Screen State:
    - Screen Name: ${currentState.screen.name}
    - Components: ${JSON.stringify(componentIndex, null, 2)}
    
    Rules:
    1. Prefer UPDATE_COMPONENTS when the user asks to change specific parts of the existing screen.
    2. Use REGENERATE_SCREEN only if the user asks for a completely different page (e.g., "Show me a dashboard" when on a login page).
    3. Use ADD_COMPONENTS if the user asks to add something new to the current screen (e.g., "Add a footer").
    4. NEVER invent component IDs for UPDATE_COMPONENTS. You must use the IDs provided in the "Current Screen State".
    5. For REGENERATE_SCREEN, provide a full list of 'newComponents' that make up the new screen (4-8 components).
    6. For ADD_COMPONENTS, provide 'newComponents' with 'positionIndex' to place them correctly.

    Output contract:
    - Return ONLY a JSON object that matches the required schema.
    - Do not include markdown code fences.
    - Do not include any prose before or after JSON.
  `;

  try {
    const completion = await createMessageWithFallback({
      system: systemPrompt,
      temperature: 0,
      max_tokens: 1200,
      messages: [
        { role: "user", content: prompt },
      ],
    }, DEFAULT_PLANNER_MODELS);

    const rawText = completion.content
      .filter((block: { type: string; text?: string }) => block.type === "text")
      .map((block: { type: string; text?: string }) => block.text ?? "")
      .join("\n")
      .trim();

    const parsedJson = extractJson(rawText);
    const normalized = normalizePlannerPayload(parsedJson, currentState, prompt);
    const parsed = PlannerSchema.safeParse(normalized);
    if (!parsed.success) {
      throw new Error(`Planner schema validation failed: ${parsed.error.message}`);
    }

    return parsed.data;
  } catch (error) {
    console.error("Planner failed:", error);
    // Fallback: Default to regenerate if completely confused, or throw
    throw error; 
  }
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? text;
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  const jsonSpan = first !== -1 && last !== -1 && last > first
    ? candidate.slice(first, last + 1)
    : candidate;

  try {
    return JSON.parse(jsonSpan);
  } catch {
    try {
      const repaired = jsonrepair(jsonSpan);
      return JSON.parse(repaired);
    } catch {
      throw new Error("Planner did not return valid JSON");
    }
  }
}

type UnknownRecord = Record<string, unknown>;

function normalizePlannerPayload(payload: unknown, currentState: SessionState, prompt: string): UnknownRecord {
  const source = (payload && typeof payload === "object" ? payload : {}) as UnknownRecord;

  const rawAction = String(source.action ?? source.type ?? source.decision ?? "").toUpperCase();
  const action = normalizeAction(rawAction, source);

  const reasoning = String(
    source.reasoning ?? source.rationale ?? source.explanation ?? `Planned via normalization for: ${prompt}`
  );

  const rawTargets = source.targetComponentIds ?? source.componentIds ?? source.targets ?? [];
  const targetComponentIds = normalizeTargets(rawTargets, currentState, prompt, action);

  const rawNewComponents = source.newComponents ?? source.components ?? source.componentsToAdd ?? null;
  const newComponents = normalizeNewComponents(rawNewComponents);

  const rawScreenName = source.screenName ?? source.pageName ?? source.screen ?? source.name ?? null;
  const screenName = typeof rawScreenName === "string" ? rawScreenName : null;

  return {
    action,
    reasoning,
    targetComponentIds,
    newComponents,
    screenName,
  };
}

function normalizeAction(rawAction: string, source: UnknownRecord): "REGENERATE_SCREEN" | "UPDATE_COMPONENTS" | "ADD_COMPONENTS" {
  if (rawAction.includes("REGENERATE") || rawAction.includes("NEW_SCREEN") || rawAction.includes("FULL")) {
    return "REGENERATE_SCREEN";
  }
  if (rawAction.includes("UPDATE") || rawAction.includes("MODIFY") || rawAction.includes("EDIT")) {
    return "UPDATE_COMPONENTS";
  }
  if (rawAction.includes("ADD") || rawAction.includes("INSERT") || rawAction.includes("APPEND")) {
    return "ADD_COMPONENTS";
  }

  const hasComponents = Array.isArray(source.newComponents) || Array.isArray(source.components) || Array.isArray(source.componentsToAdd);
  const hasTargets = Array.isArray(source.targetComponentIds) || Array.isArray(source.componentIds) || Array.isArray(source.targets);

  if (hasTargets) return "UPDATE_COMPONENTS";
  if (hasComponents) return "ADD_COMPONENTS";
  return "REGENERATE_SCREEN";
}

function normalizeTargets(
  rawTargets: unknown,
  currentState: SessionState,
  prompt: string,
  action: "REGENERATE_SCREEN" | "UPDATE_COMPONENTS" | "ADD_COMPONENTS"
): string[] | null {
  const existingIds = new Set(Object.keys(currentState.components));

  if (Array.isArray(rawTargets)) {
    const normalized = rawTargets
      .map((item) => String(item ?? "").trim())
      .filter((id) => id.length > 0 && existingIds.has(id));

    if (normalized.length > 0) {
      return normalized;
    }
  }

  if (action === "UPDATE_COMPONENTS") {
    const inferred = inferTargetComponentIdsFromPrompt(prompt, currentState);
    if (inferred.length > 0) {
      return inferred;
    }
  }

  return [];
}

function inferTargetComponentIdsFromPrompt(prompt: string, currentState: SessionState): string[] {
  const orderedIds = currentState.screen.componentOrder.filter((id) => Boolean(currentState.components[id]));
  if (orderedIds.length === 0) {
    return [];
  }

  const normalizedPrompt = prompt.toLowerCase();
  const indexMatches = new Set<number>();

  const numericRegex = /(?:component|section|block|card)?\s*#?\s*(\d{1,2})/gi;
  for (const match of normalizedPrompt.matchAll(numericRegex)) {
    const value = Number(match[1]);
    if (Number.isFinite(value) && value >= 1 && value <= orderedIds.length) {
      indexMatches.add(value - 1);
    }
  }

  const ordinals: Record<string, number> = {
    first: 0,
    second: 1,
    third: 2,
    fourth: 3,
    fifth: 4,
    sixth: 5,
    seventh: 6,
    eighth: 7,
  };

  for (const [word, index] of Object.entries(ordinals)) {
    if (normalizedPrompt.includes(word) && index < orderedIds.length) {
      indexMatches.add(index);
    }
  }

  const targetsByIndex = Array.from(indexMatches)
    .sort((a, b) => a - b)
    .map((index) => orderedIds[index])
    .filter(Boolean);

  if (targetsByIndex.length > 0) {
    return targetsByIndex;
  }

  const nameMatches: string[] = [];
  for (const id of orderedIds) {
    const component = currentState.components[id];
    if (!component) continue;

    const idHit = normalizedPrompt.includes(component.id.toLowerCase());
    const nameHit = normalizedPrompt.includes(component.name.toLowerCase());

    if (idHit || nameHit) {
      nameMatches.push(id);
    }
  }

  if (nameMatches.length > 0) {
    return nameMatches;
  }

  return [orderedIds[0]];
}

function normalizeNewComponents(raw: unknown): Array<{ id: string; name: string; description: string; positionIndex: number | null }> | null {
  if (!Array.isArray(raw)) {
    return null;
  }

  return raw.map((item, index) => {
    if (typeof item === "string") {
      const id = slugify(item) || `component-${index + 1}`;
      return {
        id,
        name: toTitleCase(item),
        description: item,
        positionIndex: index,
      };
    }

    const obj = (item && typeof item === "object" ? item : {}) as UnknownRecord;
    const rawId = String(obj.id ?? obj.componentId ?? obj.slug ?? obj.name ?? obj.title ?? `component-${index + 1}`);
    const id = slugify(rawId) || `component-${index + 1}`;
    const name = String(obj.name ?? obj.title ?? toTitleCase(id));
    const description = String(obj.description ?? obj.details ?? obj.content ?? `UI component for ${name}`);

    const idx = obj.positionIndex;
    const positionIndex = typeof idx === "number" && Number.isFinite(idx) ? idx : index;

    return {
      id,
      name,
      description,
      positionIndex,
    };
  });
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function toTitleCase(value: string): string {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
