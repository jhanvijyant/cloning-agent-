import Anthropic from "@anthropic-ai/sdk";
import type { GeneratedFile } from "./types";
import { MODIFY_SYSTEM_PROMPT, buildModifyUserPrompt } from "./prompts";

const MODEL = "claude-sonnet-4-5-20250929";

export class ModificationError extends Error {}

export async function modifyProject(
  currentFiles: GeneratedFile[],
  instruction: string
): Promise<{ changedFiles: GeneratedFile[]; explanation: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ModificationError(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (see README)."
    );
  }
  const anthropic = new Anthropic({ apiKey });

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: MODIFY_SYSTEM_PROMPT,
    messages: [
      { role: "user", content: buildModifyUserPrompt(currentFiles, instruction) },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? fenced[1] : text;

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
