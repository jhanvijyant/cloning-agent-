import type { GeneratedFile } from "./types";
import { completeText } from "./llmClient";
import { MODIFY_SYSTEM_PROMPT, buildModifyUserPrompt } from "./prompts";

export class ModificationError extends Error {}

export async function modifyProject(
  currentFiles: GeneratedFile[],
  instruction: string
): Promise<{ changedFiles: GeneratedFile[]; explanation: string }> {
  const text = await completeText(
    MODIFY_SYSTEM_PROMPT,
    buildModifyUserPrompt(currentFiles, instruction),
    8000
  );

  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? fenced[1] : trimmed;

  let parsed: { changedFiles: GeneratedFile[]; explanation: string };
  try {
    parsed = JSON.parse(candidate);
  } catch {
    throw new ModificationError("The model returned a response that could not be parsed.");
  }

  if (!Array.isArray(parsed.changedFiles)) {
    throw new ModificationError("The model's response was missing the expected file list.");
  }

  return parsed;
}
