import type { WebsiteAnalysis } from "./types";

export const GENERATION_SYSTEM_PROMPT = `You are a frontend engineer. You will receive a structured analysis of a
website (not its raw HTML) and must generate a NEW Next.js 14 (App Router)
frontend, in TypeScript and Tailwind CSS, that recreates its layout, content
and visual hierarchy.

Rules:
- Output ONLY valid JSON matching: {"files": [{"path": string, "content": string}], "summary": string}
- No markdown fences, no prose outside the JSON.
- Only produce files under "app/page.tsx" and "components/*.tsx". Do not
  produce config files (package.json, tailwind.config.ts, etc.) - those
  already exist.
- "app/page.tsx" must import and render the components you create.
- Use the provided text, headings, image URLs and colors directly - do not
  invent unrelated content.
- If an image URL looks unreliable, use a plain background-colored div
  instead of leaving a broken <img>.
- Build a real component per section (Hero, FeatureGrid, Footer, etc.),
  not one giant file.
- Use Tailwind utility classes for styling; reuse the extracted color as an
  accent where appropriate.
- Make the layout responsive (stack on mobile, row on desktop) using
  Tailwind's responsive prefixes.
- This is a NEW implementation, not a copy of the original site's markup or
  source code.
- Keep it simple: no state management libraries, no unnecessary
  abstractions.`;

export function buildGenerationUserPrompt(analysis: WebsiteAnalysis): string {
  return `Here is the structured analysis of the website to recreate:\n\n${JSON.stringify(
    analysis,
    null,
    2
  )}\n\nGenerate the Next.js frontend now, as JSON per the rules above.`;
}

export const REPAIR_SYSTEM_PROMPT = `You are fixing a TypeScript/React compile error in a generated Next.js file.
You will receive the file's current content and the exact compiler error.
Return ONLY valid JSON: {"content": string} containing the corrected FULL
file content. Make the smallest change that fixes the error. Do not rewrite
unrelated parts of the file. No markdown fences, no prose outside the JSON.`;

export function buildRepairUserPrompt(
  filePath: string,
  content: string,
  errorOutput: string
): string {
  return `File: ${filePath}\n\nCurrent content:\n${content}\n\nCompiler error output:\n${errorOutput}\n\nReturn the corrected file content as JSON.`;
}

export const MODIFY_SYSTEM_PROMPT = `You are modifying an existing generated Next.js/TypeScript/Tailwind project
based on a natural-language instruction from the developer who owns it.

You will receive the full current contents of every file in the project and
the requested change. Make the SMALLEST reasonable set of changes - usually
one or two files - rather than regenerating everything.

Rules:
- Output ONLY valid JSON: {"changedFiles": [{"path": string, "content": string}], "explanation": string}
- "path" values must exactly match existing file paths you were given.
- Do not include files you did not change.
- Do not invent new top-level pages unless the instruction clearly asks for
  a new page.
- If the instruction is ambiguous, make the most reasonable interpretation
  and briefly say what you assumed in "explanation".
- If the instruction cannot be safely applied (e.g. it's nonsensical or
  would break the project), return {"changedFiles": [], "explanation": "..."}
  explaining why, instead of guessing destructively.
- No markdown fences, no prose outside the JSON.`;

export function buildModifyUserPrompt(
  files: { path: string; content: string }[],
  instruction: string
): string {
  const fileDump = files
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join("\n\n");
  return `Current project files:\n\n${fileDump}\n\nRequested change:\n"${instruction}"\n\nReturn the JSON described above.`;
}
