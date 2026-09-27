// A single place that talks to whichever LLM provider is configured. The
// generator and modifier don't know or care which one is in use - they just
// call completeText(). This means adding/removing a provider never touches
// the actual generation/repair/modification logic.

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

export type LlmProvider = "anthropic" | "openai" | "gemini";

export class LlmConfigError extends Error {}

function detectProvider(): LlmProvider {
  // LLM_PROVIDER lets you force a choice if you happen to have more than
  // one key set. Otherwise the first key found wins, in this order.
  const explicit = process.env.LLM_PROVIDER?.toLowerCase();
  if (explicit === "openai" || explicit === "gemini" || explicit === "anthropic") {
    return explicit;
  }
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";

  throw new LlmConfigError(
    "No LLM API key found. Set one of ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY in .env.local."
  );
}

// Sends a system prompt + user prompt to the configured provider and
// returns its raw text reply. Callers parse JSON out of that text
// themselves (see agent/generator.ts and agent/modifier.ts) since each
// provider wraps/doesn't wrap JSON slightly differently.
export async function completeText(
  system: string,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  const provider = detectProvider();

  if (provider === "anthropic") return callAnthropic(system, userPrompt, maxTokens);
  if (provider === "openai") return callOpenAI(system, userPrompt, maxTokens);
  return callGemini(system, userPrompt, maxTokens);
}

async function callAnthropic(
  system: string,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: userPrompt }],
  });
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

async function callOpenAI(
  system: string,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ],
  });
  return response.choices[0]?.message?.content ?? "";
}

async function callGemini(
  system: string,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
  const model = client.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: system,
    generationConfig: { maxOutputTokens: maxTokens },
  });
  const result = await model.generateContent(userPrompt);
  return result.response.text();
}
