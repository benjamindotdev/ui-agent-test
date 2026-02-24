import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

try {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    if (envConfig.ANTHROPIC_API_KEY) {
      process.env.ANTHROPIC_API_KEY = envConfig.ANTHROPIC_API_KEY;
    }
  }
} catch (error) {
  console.warn("Could not load .env file manually:", error);
}

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("Missing ANTHROPIC_API_KEY environment variable");
}

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

type MessageCreateArgs = Parameters<typeof anthropic.messages.create>[0];

export type AnthropicTextResponse = {
  content: Array<{ type: string; text?: string }>;
};

export const DEFAULT_PLANNER_MODELS = [
  process.env.ANTHROPIC_PLANNER_MODEL,
  "claude-3-5-haiku-20241022",
  "claude-3-haiku-20240307",
].filter(Boolean) as string[];

export const DEFAULT_GENERATOR_MODELS = [
  process.env.ANTHROPIC_GENERATOR_MODEL,
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022",
  "claude-3-sonnet-20240229",
].filter(Boolean) as string[];

async function getAvailableModelIds(): Promise<string[]> {
  try {
    const page = await anthropic.models.list({ limit: 100 });
    return page.getPaginatedItems().map((model) => model.id);
  } catch {
    return [];
  }
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export async function createMessageWithFallback(
  baseArgs: Omit<MessageCreateArgs, "model">,
  models: string[]
): Promise<AnthropicTextResponse> {
  let lastError: unknown;

  const preferredModels = unique(models.filter(Boolean));
  const availableModels = await getAvailableModelIds();

  const fallbackAvailable = availableModels
    .filter((modelId) => modelId.startsWith("claude-"))
    .slice(0, 6);

  const candidateModels = availableModels.length > 0
    ? unique([
        ...preferredModels.filter((model) => availableModels.includes(model)),
        ...fallbackAvailable,
      ])
    : preferredModels;

  for (const model of candidateModels) {
    try {
      return (await anthropic.messages.create({
        ...baseArgs,
        model,
        stream: false,
      } as MessageCreateArgs)) as AnthropicTextResponse;
    } catch (error: any) {
      const isNotFound = error?.status === 404;
      if (!isNotFound) {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError ?? new Error("No accessible Anthropic model found for this API key");
}