import type { GeneratedFile, WebsiteAnalysis } from "./types";
import { completeText } from "./llmClient";
import {
  GENERATION_SYSTEM_PROMPT,
  buildGenerationUserPrompt,
  REPAIR_SYSTEM_PROMPT,
  buildRepairUserPrompt,
} from "./prompts";

export class GenerationError extends Error {}

// One LLM call: structured analysis in, a small set of component files out.
// Which provider actually handles this is decided in llmClient.ts based on
// which API key is set - this function doesn't need to know or care.
export async function generateProject(
  analysis: WebsiteAnalysis
): Promise<{ files: GeneratedFile[]; summary: string }> {
  const text = await completeText(
    GENERATION_SYSTEM_PROMPT,
    buildGenerationUserPrompt(analysis),
    8000
  );

  const parsed = safeParseJson<{ files: GeneratedFile[]; summary: string }>(text);

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
  const text = await completeText(
    REPAIR_SYSTEM_PROMPT,
    buildRepairUserPrompt(filePath, content, errorOutput),
    4000
  );

  const parsed = safeParseJson<{ content: string }>(text);

  if (!parsed || typeof parsed.content !== "string") {
    throw new GenerationError("The model did not return a usable repair.");
  }

  return parsed.content;
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
