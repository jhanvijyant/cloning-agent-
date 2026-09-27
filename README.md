# Website Cloning Agent

An AI agent that takes a public website URL, analyzes its structure and
content, and generates a new React/Next.js frontend implementation for it —
not an embed or iframe of the original. You can then modify the generated
site with natural-language instructions.

## What it does

1. You give it a URL.
2. It fetches and parses the HTML to understand layout, navigation, text,
   images, colors, typography and rough responsive signals.
3. It sends that structured summary (not the raw HTML) to Claude, which
   generates real Next.js/TypeScript/Tailwind component files.
4. It type-checks the generated project, and if the AI produced a small
   error, asks Claude for a focused fix (up to 2 retries).
5. It starts a real `next dev` server for the generated project and shows
   it in a live preview.
6. You can type an instruction like "make the navbar sticky" and it edits
   the relevant file(s) directly, re-validates, and the preview hot-reloads.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full diagram. Short version:

```
URL → Fetcher → Analyzer → WebsiteAnalysis (JSON)
    → Generator (1 LLM call) → Generated Next.js project
    → Validator (tsc) → [repair loop, ≤2 LLM calls] → Preview (next dev)
    → Modifier (1 LLM call) → Validator again → updated Preview
```

## Setup

Requires Node 18+.

```bash
git clone <this repo>
cd website-cloning-agent
npm install
cp .env.local.example .env.local
# edit .env.local and add your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000.

## Environment variables

Set **one** of the following in `.env.local` (see `.env.local.example`):

| Variable            | Provider          | Notes                                    |
| ------------------- | ----------------- | ----------------------------------------- |
| `ANTHROPIC_API_KEY` | Anthropic (Claude) | console.anthropic.com                    |
| `OPENAI_API_KEY`    | OpenAI (GPT)       | platform.openai.com                      |
| `GEMINI_API_KEY`    | Google Gemini      | aistudio.google.com/apikey               |

`agent/llmClient.ts` picks whichever key is set (Anthropic first if more
than one is set) and routes generation/repair/modification calls to that
provider. Set `LLM_PROVIDER=openai|gemini|anthropic` to force a specific one.
Analysis itself needs no API key — it's plain HTML parsing, no LLM call.

## Technologies

- Next.js 14 (App Router) + React + TypeScript
- Tailwind CSS
- `cheerio` for HTML parsing
- `@anthropic-ai/sdk`, `openai`, and `@google/generative-ai` — the app talks
  to whichever one has an API key set (see `agent/llmClient.ts`), for
  generation, build-error repair, and modification
- No database, no queue, no headless browser, no state-management library

## Key implementation decisions

**One LLM client, three providers.** `agent/llmClient.ts` is the only file
that knows how to talk to Anthropic, OpenAI, or Gemini. `generator.ts` and
`modifier.ts` just call `completeText(system, prompt, maxTokens)` — swapping
providers, or supporting a fourth one later, never touches the actual
generation/repair/modification logic.

**Analysis is pure code, not an LLM call.** Parsing HTML into a structured
summary (nav, sections, colors, fonts) doesn't need a model — it needs a DOM
parser. This is the single biggest cost lever in the system: it means the
LLM only ever sees a small JSON object, never a raw page dump.

**No headless browser.** Puppeteer/Playwright would give more accurate
computed styles and screenshots, but adds a heavy dependency and real
latency for a 48-hour MVP. `cheerio` + regex-based color/font extraction
from `<style>` blocks and inline styles is a reasonable middle ground.
Documented as a limitation below.

**Config files are static templates, not AI-generated.** `package.json`,
`tsconfig.json`, `tailwind.config.ts`, etc. are identical for every
generated project (see `lib/projectTemplate.ts`). Only `app/page.tsx` and
`components/*.tsx` are AI-generated. This saves tokens and stops the model
from breaking config it doesn't need to touch.

**Generated projects share the root's `node_modules` via a symlink**
(`lib/fileWriter.ts`) instead of running `npm install` per generated
project. They use the same next/react/tailwind versions, so this is safe
and avoids a slow, redundant install on every single generation.

**`tsc --noEmit` is the validator, not a full `next build`, for the
repair loop.** It catches the errors AI-generated code actually produces
(type errors, bad JSX, missing imports) in a couple of seconds instead of
30+. A full build is a reasonable next step before shipping, not something
this MVP needed to run on every retry.

**Modification sends the current files, not a diff format.** The generated
project is only a handful of small files, so sending their full content in
one call and asking for full replacement content back is simpler and more
reliable than asking a model to produce a patch/diff format, at negligible
extra cost.

## Error handling

- Invalid URL / unreachable site / non-HTML response / timeout → caught in
  `agent/fetcher.ts`, surfaced as a short message, not a stack trace.
- Malformed or unusable LLM JSON response → caught in `agent/generator.ts`
  and `agent/modifier.ts` with defensive parsing (strips markdown fences,
  falls back to a clear error instead of crashing).
- Generated TypeScript/build errors → caught by `agent/validator.ts`,
  fed back to the model for a targeted fix, retried up to 2 times, then
  surfaced honestly as a failure if still broken (never silently "succeeds").
- File writes are restricted to the generated project's own directory
  (`lib/fileWriter.ts`) since file paths ultimately come from LLM output
  and shouldn't be trusted blindly.
- Full error output is logged server-side; only a short message reaches
  the UI.

## Cost considerations

Per full run (analyze → generate → modify), the app makes at most:
- **0** LLM calls for analysis
- **1** LLM call for generation
- **0–2** LLM calls for automatic repair (only if the build actually failed)
- **1** LLM call per modification request

No LLM call ever receives raw HTML — only the small structured
`WebsiteAnalysis` object or the generated project's own (small) files.

## Limitations

- No headless browser, so JavaScript-rendered single-page apps will analyze
  poorly (the fetcher gets the initial HTML only).
- Color/typography extraction is regex-based over inline styles and
  `<style>` blocks; it misses colors that only exist in external
  stylesheets or CSS-in-JS.
- Section detection ("hero", "pricing", "testimonials", etc.) is heuristic,
  not guaranteed correct.
- Visual fidelity is "recreate the hierarchy and content," not
  pixel-perfect cloning.
- The repair loop only handles the case where the failing file is
  identifiable from the compiler output; more exotic errors will surface
  as an honest failure rather than an infinite retry.
- Single-user, local-only: the in-memory job store and dev-server ports
  assume one person running one machine, not concurrent users.

## Future improvements

- Optional headless-browser analysis pass for JS-heavy sites and for
  computed-style-accurate color/font extraction.
- Screenshot-based visual diffing to score recreation accuracy.
- Streaming generation output so the UI can show progress mid-generation
  instead of only at completion.
- Persisting jobs/generated projects to disk-backed storage so they survive
  a server restart.
- A "revert last modification" button, since changes are currently applied
  directly.

---

## How to explain this project in an interview

**What problem it solves:** given an arbitrary public website, automatically
produce a real, working React/Next.js frontend that recreates its structure
and content, then let the user tweak it in plain English — without
hardcoding anything for a specific site.

**Why this architecture:** the core idea is separating *understanding* the
website (deterministic parsing) from *generating* code (the one place an
LLM is actually needed). That keeps cost low and makes the system's
behavior predictable and debuggable — I can inspect the `WebsiteAnalysis`
JSON independently of whether the generation step worked.

**How website analysis works:** `cheerio` loads the HTML server-side (no
browser), and heuristics walk the DOM for nav links, top-level sections,
headings/paragraphs/buttons/images per section, colors and fonts pulled out
of inline styles and `<style>` blocks, and simple responsive signals
(viewport meta tag, media queries). It's turned into one small typed object
(`WebsiteAnalysis`), never raw HTML, before anything touches the model.

**How AI generation works:** one Claude call receives that JSON and a system
prompt instructing it to return `{files, summary}` as strict JSON — a
`page.tsx` plus a handful of components. Static config files (package.json,
tailwind config, etc.) are never AI-generated; they're a fixed template so
the model can't break them.

**How modifications work:** the current project's `app/`/`components/`
files (small, so cheap to include in full) plus the user's instruction go
into one call; the model returns only the files it changed. That's applied
directly, then re-validated the same way as generation.

**How build errors are handled:** after writing files, `tsc --noEmit` runs
against the generated project. If it fails, the failing file path is
extracted from the compiler output and sent back to the model with the
exact error for a targeted fix — max 2 attempts, not an open-ended loop. If
it still fails, the UI is told honestly rather than shown a fake success.

**How it generalizes:** nothing in the pipeline references a specific
domain or site. The analyzer's heuristics look at DOM structure and text
content generically; the generator's prompt only ever sees the structured
analysis, never a hardcoded template for "a SaaS site" vs "a bakery site."

**How API costs are controlled:** analysis costs nothing (no LLM call).
Generation is one call. Repair and modification are targeted, small,
capped calls — never a call with the full raw HTML, never an unbounded
retry loop.

**Current limitations:** no headless browser (JS-heavy SPAs suffer),
heuristic section/color detection, no pixel-diffing to measure accuracy,
single-user/local-only job and process management.

**What I'd improve with more time:** headless-browser analysis for
accuracy, screenshot-based visual scoring, persistent job storage, and
streaming progress during generation instead of a single "please wait."
