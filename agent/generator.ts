import Anthropic from "@anthropic-ai/sdk";
import type { GeneratedFile, WebsiteAnalysis } from "./types";
import {
  GENERATION_SYSTEM_PROMPT,
  buildGenerationUserPrompt,
  REPAIR_SYSTEM_PROMPT,
  buildRepairUserPrompt,
} from "./prompts";

const MODEL = "claude-sonnet-4-5-20250929";

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (see README)."
    );
  }
  return new Anthropic({ apiKey });
}

export class GenerationError extends Error {}

// One LLM call: structured analysis in, a small set of component files out.
export async function generateProject(
  analysis: WebsiteAnalysis
): Promise<{ files: GeneratedFile[]; summary: string }> {
  const anthropic = client();

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: GENERATION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildGenerationUserPrompt(analysis) }],
  });

  const text = extractText(response);
  const parsed = safeParseJson<{
    files: GeneratedFile[];
    summary: string;
  }>(text);

  if (!parsed || !Array.isArray(parsed.files) || parsed.files.length === 0) {
    throw new GenerationError(
      "The model did not return a usable set of files. Try again."
    );
  }

  return { files: parsed.files, summary: parsed.summary || "" };
}

// Focused fix for one broken file - used by the validator's retry loop.
export async function repairFile(
  filePath: string,
  content: string,
  errorOutput: string
): Promise<string> {
  const anthropic = client();

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: REPAIR_SYSTEM_PROMPT,
    messages: [
      { role: "user", content: buildRepairUserPrompt(filePath, content, errorOutput) },
    ],
  });

  const text = extractText(response);
  const parsed = safeParseJson<{ content: string }>(text);

  if (!parsed || typeof parsed.content !== "string") {
    throw new GenerationError("The model did not return a usable repair.");
  }

  return parsed.content;
}

function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

// The model is asked for raw JSON but occasionally wraps it in fences or
// adds stray text - strip that defensively rather than failing outright.
function safeParseJson<T>(text: string): T | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}
