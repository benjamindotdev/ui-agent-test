// lib/agent/orchestrator.ts
import { SessionState, Component, Screen } from "../types";
import { planNextMove, PlannerResponse } from "./planner";
import { generateComponent } from "./generator";
import { nanoid } from 'nanoid';

export async function processUserRequest(
  sessionId: string,
  userPrompt: string,
  currentState: SessionState
): Promise<{ newState: SessionState; plannerOutput: PlannerResponse }> {
  // 1. Planner Phase
  const plan = await planNextMove(userPrompt, currentState);
  console.log(`Planner Decision: ${plan.action}`, plan);

  const newState = { ...currentState };
  
  // 2. Execution Phase
  switch (plan.action) {
    case "REGENERATE_SCREEN":
      await handleRegenerateScreen(newState, plan);
      break;
    case "UPDATE_COMPONENTS":
      await handleUpdateComponents(newState, plan, userPrompt);
      break;
    case "ADD_COMPONENTS":
      await handleAddComponents(newState, plan);
      break;
  }

  // 3. Update History
  newState.messages.push({ role: "user", content: userPrompt });
  newState.messages.push({ 
    role: "assistant", 
    content: `Action: ${plan.action}. Reasoning: ${plan.reasoning}` 
  });

  return { newState, plannerOutput: plan };
}

async function handleRegenerateScreen(state: SessionState, plan: PlannerResponse) {
  // Clear old screen
  state.screen.name = plan.screenName || "New Screen";
  state.screen.componentOrder = [];
  state.components = {};
  state.pendingUpdates = {};

  if (!plan.newComponents) return;

  // Generate all new components in parallel for speed
  const promises = plan.newComponents.map(async (compDef) => {
    const id = compDef.id || nanoid();
    const html = await generateComponent({
      id: id,
      name: compDef.name,
      description: compDef.description
    });
    
    return {
      id,
      name: compDef.name,
      type: "generated", 
      description: compDef.description,
      html
    } as Component;
  });

  const newComponents = await Promise.all(promises);
  
  // Update state
  newComponents.forEach(c => {
    state.components[c.id] = c;
    state.screen.componentOrder.push(c.id);
  });
}

async function handleUpdateComponents(state: SessionState, plan: PlannerResponse, userPrompt: string) {
  if (!plan.targetComponentIds) return;

  const updates = plan.targetComponentIds.map(async (id) => {
    const existingComp = state.components[id];
    if (!existingComp) return null;

    // We pass the user prompt as instructions for the update
    const newHtml = await generateComponent({
      id,
      name: existingComp.name,
      description: userPrompt, 
      existingHtml: existingComp.html
    });

    return {
      componentId: id,
      beforeHtml: existingComp.html,
      afterHtml: newHtml,
      prompt: userPrompt,
      createdAt: new Date().toISOString(),
    };
  });

  const results = await Promise.all(updates);
  
  results.forEach((pendingUpdate) => {
    if (pendingUpdate) {
      state.pendingUpdates[pendingUpdate.componentId] = pendingUpdate;
    }
  });
}

async function handleAddComponents(state: SessionState, plan: PlannerResponse) {
  if (!plan.newComponents) return;

  const newComponentsPromises = plan.newComponents.map(async (compDef) => {
    const id = compDef.id || nanoid(); // Ensure ID if planner missed it
    const html = await generateComponent({
      id,
      name: compDef.name,
      description: compDef.description
    });
    
    return {
      component: {
        id,
        name: compDef.name,
        type: "generated",
        description: compDef.description,
        html
      } as Component,
      positionIndex: compDef.positionIndex
    };
  });
  
  const results = await Promise.all(newComponentsPromises);
  
  // Sort by index to maintain relative order if multiple added
  results.sort((a, b) => (a.positionIndex ?? 999) - (b.positionIndex ?? 999));

  // Insert into componentOrder
  for (const { component, positionIndex } of results) {
    state.components[component.id] = component;
    
    if (typeof positionIndex === 'number' && positionIndex >= 0 && positionIndex <= state.screen.componentOrder.length) {
       state.screen.componentOrder.splice(positionIndex, 0, component.id);
    } else {
       state.screen.componentOrder.push(component.id);
    }
  }
}
