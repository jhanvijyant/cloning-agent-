<div align="center">

# 🧬 Website Cloning Agent

**Give it a URL. Get back a real, editable Next.js codebase — not an iframe.**

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind-CSS-38BDF8?logo=tailwindcss)
![Status](https://img.shields.io/badge/status-MVP-orange)

</div>

---

An AI agent that takes a public website URL, analyzes its structure and content,
and generates a **new** React/Next.js frontend implementation for it — not an
embed or iframe of the original. Once generated, you can modify the site with
plain-English instructions like *"make the navbar sticky"* and watch it rebuild live.



##  Table of contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Setup](#setup)
- [Environment variables](#environment-variables)
- [Technologies](#technologies)
- [Key implementation decisions](#key-implementation-decisions)
- [Error handling](#error-handling)
- [Cost considerations](#cost-considerations)
- [Limitations](#limitations)
- [Future improvements](#future-improvements)

##  What it does

| Step | What happens |
|---|---|
| 1️⃣ | You give it a URL |
| 2️⃣ | It fetches and parses the HTML — layout, navigation, text, images, colors, typography, rough responsive signals |
| 3️⃣ | That structured summary (**not** the raw HTML) goes to the LLM, which generates real Next.js/TypeScript/Tailwind component files |
| 4️⃣ | It type-checks the generated project, and if the model produced a small error, asks it for a focused fix (up to 2 retries) |
| 5️⃣ | It starts a real `next dev` server for the generated project and shows a live preview |
| 6️⃣ | You type an instruction like *"make the navbar sticky"* — it edits the relevant file(s) directly, re-validates, and the preview hot-reloads |

##  Architecture

Full diagram: [`ARCHITECTURE.md`](./ARCHITECTURE.md)

##  Setup

Requires **Node 18+**.

```bash
git clone https://github.com/jhanvijyant/cloning-agent-.git
cd cloning-agent-
npm install
cp .env.local.example .env.local
# edit .env.local and add your API key (see below)
npm run dev
```

Open **http://localhost:3000**.

##  Environment variables

Set **one** of the following in `.env.local` (see `.env.local.example`):

| Variable | Provider | Get a key |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic (Claude) | console.anthropic.com |
| `OPENAI_API_KEY` | OpenAI (GPT) | platform.openai.com |
| `GEMINI_API_KEY` | Google Gemini | aistudio.google.com/apikey |

`agent/llmClient.ts` picks whichever key is set (Anthropic first if more than
one is set) and routes generation/repair/modification calls to that provider.
Set `LLM_PROVIDER=openai|gemini|anthropic` to force a specific one.

> Analysis itself needs **no API key** — it's plain HTML parsing, no LLM call.

##  Technologies

- **Next.js 14** (App Router) + React + TypeScript
- **Tailwind CSS**
- **cheerio** for HTML parsing
- `@anthropic-ai/sdk`, `openai`, `@google/generative-ai` — routes to whichever provider has a key set
- No database, no queue, no headless browser, no state-management library

##  Key implementation decisions

**One LLM client, three providers.**
`agent/llmClient.ts` is the only file that knows how to talk to Anthropic, OpenAI, or Gemini. `generator.ts` and `modifier.ts` just call `completeText(system, prompt, maxTokens)` — swapping providers, or adding a fourth one later, never touches generation/repair/modification logic.

**Analysis is pure code, not an LLM call.**
Parsing HTML into a structured summary (nav, sections, colors, fonts) needs a DOM parser, not a model. This is the single biggest cost lever in the system — the LLM only ever sees a small JSON object, never a raw page dump.

**No headless browser.**
Puppeteer/Playwright would give more accurate computed styles and screenshots, but adds a heavy dependency and real latency for a 48-hour MVP. `cheerio` + regex-based color/font extraction from `<style>` blocks and inline styles is a reasonable middle ground (documented as a limitation below).

**Config files are static templates, not AI-generated.**
`package.json`, `tsconfig.json`, `tailwind.config.ts`, etc. are identical for every generated project (`lib/projectTemplate.ts`). Only `app/page.tsx` and `components/*.tsx` are AI-generated — this saves tokens and stops the model from breaking config it doesn't need to touch.

**Generated projects share the root's `node_modules` via a symlink.**
(`lib/fileWriter.ts`) instead of running `npm install` per generated project. Same next/react/tailwind versions everywhere, so this is safe and avoids a slow, redundant install on every generation.

**`tsc --noEmit` is the validator, not a full `next build`, for the repair loop.**
It catches the errors AI-generated code actually produces (type errors, bad JSX, missing imports) in a couple of seconds instead of 30+. A full build is a reasonable next step before shipping, not something this MVP needed on every retry.

**Modification sends the current files, not a diff format.**
The generated project is only a handful of small files, so sending their full content and asking for full replacement content back is simpler and more reliable than asking a model to produce a patch/diff format, at negligible extra cost.

## Error handling

- Invalid URL / unreachable site / non-HTML response / timeout → caught in `agent/fetcher.ts`, surfaced as a short message, not a stack trace.
- Malformed or unusable LLM JSON response → caught in `agent/generator.ts` and `agent/modifier.ts` with defensive parsing (strips markdown fences, falls back to a clear error instead of crashing).
- Generated TypeScript/build errors → caught by `agent/validator.ts`, fed back to the model for a targeted fix, retried up to 2 times, then surfaced honestly as a failure if still broken.
- File writes are restricted to the generated project's own directory (`lib/fileWriter.ts`), since file paths ultimately come from LLM output and shouldn't be trusted blindly.
- Full error output is logged server-side; only a short message reaches the UI.

##  Cost considerations

Per full run (analyze → generate → modify), the app makes **at most**:

| Step | LLM calls |
|---|---|
| Analysis | **0** |
| Generation | **1** |
| Automatic repair | **0–2** (only if the build actually failed) |
| Modification | **1** per request |

No LLM call ever receives raw HTML — only the small structured `WebsiteAnalysis` object, or the generated project's own (small) files.

##  Limitations

- No headless browser, so JavaScript-rendered single-page apps analyze poorly (the fetcher only gets the initial HTML).
- Color/typography extraction is regex-based over inline styles and `<style>` blocks; it misses colors that only exist in external stylesheets or CSS-in-JS.
- Section detection ("hero", "pricing", "testimonials", etc.) is heuristic, not guaranteed correct.
- Visual fidelity is "recreate the hierarchy and content," not pixel-perfect cloning.
- The repair loop only handles the case where the failing file is identifiable from the compiler output; more exotic errors surface as an honest failure rather than an infinite retry.
- Single-user, local-only: the in-memory job store and dev-server ports assume one person running one machine, not concurrent users.

##  Future improvements

- Optional headless-browser analysis pass for JS-heavy sites and computed-style-accurate color/font extraction.
- Screenshot-based visual diffing to score recreation accuracy.
- Streaming generation output so the UI can show progress mid-generation instead of only at completion.
- Persisting jobs/generated projects to disk-backed storage so they survive a server restart.
- A "revert last modification" button, since changes are currently applied directly.

---

<div align="center">

Built for the Founding AI Engineer assignment.

</div>
