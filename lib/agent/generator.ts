// lib/agent/generator.ts
import { createMessageWithFallback, DEFAULT_GENERATOR_MODELS } from "../anthropic";

export interface GenerationRequest {
  id: string;
  name: string;
  description: string;
  existingHtml?: string;
}

const SYSTEM_PROMPT = `
You are a specialized UI component generator.
Your role is to generate or update HTML components using Tailwind CSS classes.

Strict Rules:
1. Return ONLY the raw HTML string for the component.
2. Do NOT include <html>, <head>, or <body> tags.
3. Do NOT include any <script> tags or JavaScript.
4. Use Tailwind CSS for all styling.
5. Create semantic, accessible HTML (use <section>, <header>, <nav>, etc.).
6. The component must be self-contained and responsive.
7. Use Lucide icons if mentioned (using <i data-lucide="icon-name"></i> placeholder pattern, or just SVG if easier, but let's stick to standard SVG for now to avoid dependency on icon runtime replacements if we can, or just simple text/emoji if complexity is high. Actually, better: Use standard SVGs for icons to ensure they render without client-side JS).
8. If updating an existing component, make minimal changes to satisfy the request while preserving the overall structure and style.
`;

export async function generateComponent(
  request: GenerationRequest
): Promise<string> {
  const isUpdate = !!request.existingHtml;
  
  const userContent = isUpdate
    ? `Update this component: "${request.name}". \nDescription of changes: ${request.description}\n\nExisting HTML:\n${request.existingHtml}`
    : `Create a new component: "${request.name}". \nDescription: ${request.description}`;

  try {
    const response = await createMessageWithFallback({
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: userContent },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    }, DEFAULT_GENERATOR_MODELS);

    let html = response.content
      .filter((block: { type: string; text?: string }) => block.type === "text")
      .map((block: { type: string; text?: string }) => block.text ?? "")
      .join("\n")
      .trim();
    
    // Cleanup markdown code blocks if present
    html = html.replace(/```html/g, "").replace(/```/g, "").trim();
    
    return html;
  } catch (error) {
    console.error(`Failed to generate component ${request.id}:`, error);
    return `<div class="p-4 border border-red-500 text-red-500">Failed to load ${request.name}</div>`;
  }
}
