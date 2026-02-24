# UI Agent Test

Minimal AI-powered UI generation app focused on **agent architecture** and **component-based screen updates**.

This is intentionally scoped for a fast interview task (3–6 hours): clear design, practical trade-offs, no heavy framework abstractions.

## What was built

- Prompt-driven page generation in a Next.js app.
- A screen preview container that renders HTML composed from reusable components.
- A left sidebar listing the current screen’s components.
- A full-height right sidebar showing system state and action history.
- Conversation-aware updates across multiple prompts (session memory in-memory).
- A before/after review flow for component updates:
    - update requests create pending diffs per component
    - user can preview `Before` vs `After`
    - user decides which version to persist (`Keep Before` / `Keep After`)
- Planner decisions for:
  - `REGENERATE_SCREEN`
  - `UPDATE_COMPONENTS`
  - `ADD_COMPONENTS`

## Architecture

### 1) Planner Layer (`lib/agent/planner.ts`)
- Input: user prompt + current screen/component index + session context.
- Output: normalized, schema-validated plan object.
- Model provider: Anthropic (with model fallback).
- Reliability handling:
  - JSON extraction from raw LLM output
  - JSON repair for malformed output
  - Payload normalization (field aliases/defaults)
  - Component target inference for prompts like “component 1” / “second section”

### 2) Orchestrator Layer (`lib/agent/orchestrator.ts`)
- Executes planner action.
- Preserves session messages.
- Stores screen composition and components separately.
- Applies component-level updates without full regen when possible.
- For update actions, stores pending before/after variants instead of immediately overwriting committed HTML.

### 3) Generator Layer (`lib/agent/generator.ts`)
- Generates or updates a single component’s HTML.
- Returns HTML fragments only (Tailwind classes, semantic markup).
- Reused for both create and update paths.

## Data model

- `Component`: `id`, `name`, `type`, `description`, `html`
- `PendingComponentUpdate`: `componentId`, `beforeHtml`, `afterHtml`, `prompt`, `createdAt`
- `Screen`: `id`, `name`, `componentOrder[]`
- `SessionState`: `sessionId`, `messages[]`, `screen`, `components<Record<string, Component>>`, `pendingUpdates<Record<string, PendingComponentUpdate>>`

Rendering is composition-driven:
`screen.componentOrder.map(id => components[id].html)`

Pending updates are resolved through API (`Keep Before` / `Keep After`) before they are committed.

## Tech stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Anthropic SDK
- Zod

## Run locally

1. Set environment variable in `.env`:
    - `ANTHROPIC_API_KEY=...`
2. Install dependencies:
    - `npm install`
3. Start dev server:
    - `npm run dev`

## Brief coverage

- ✅ Component-based screen decomposition and composition
- ✅ Planner decision logic (regen vs update vs add)
- ✅ Conversation/session memory (in-memory)
- ✅ Human-in-the-loop update persistence (before/after toggle + explicit commit choice)
- ✅ System action history and state visibility in UI
- ✅ Clean, pragmatic TypeScript architecture
- ✅ No heavy agent frameworks
- ✅ Fast iteration oriented implementation

## Known risks and explicit trade-offs

These are known and intentional given the interview scope and time constraint:

1. **Planner output can still be imperfect**
    - Risk: LLMs sometimes return inconsistent structure/content.
    - Mitigation implemented: schema validation, normalization, JSON repair, model fallback.
    - Why not over-solved: adding full retry chains / constrained decoding layers was beyond brief and time budget.

2. **Target inference may be occasionally wrong on ambiguous prompts**
    - Risk: vague references ("that section") can map to the wrong component.
    - Mitigation implemented: index/ordinal/name/id matching and safe fallback.
    - Why not over-solved: deeper reference resolution (embedding memory / graph linking) is more complexity than required for this task.

3. **In-memory session storage only**
    - Risk: data resets on restart and is single-process.
    - Why not addressed: persistent storage was explicitly optional and not needed to demonstrate architecture.

4. **No production hardening features**
    - Examples: auth, rate-limiting, observability, retries with backoff, circuit breakers.
    - Why not addressed: out of scope for a focused architecture exercise.

5. **Reset control is not implemented in UI yet**
    - Risk: manual session reset requires a new session path rather than explicit button action.
    - Why not addressed: prioritized core agent decision loop and component update behavior first under limited time.

## Design intent

This implementation is optimized for demonstrating judgment:
- deterministic-enough planning,
- component-first updates over full regeneration,
- clear planner/generator/orchestrator boundaries,
- minimal but robust abstractions.
