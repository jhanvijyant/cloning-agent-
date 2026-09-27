# Architecture

```
Website URL
    |
    v
Fetcher (agent/fetcher.ts)
  - plain fetch(), 10s timeout, validates URL/content-type
    |
    v
Analyzer (agent/analyzer.ts)
  - cheerio parses the HTML (no headless browser)
  - extracts: metadata, navigation, sections, colors, typography,
    assets, layout hints, responsive hints
  - pure code, no LLM call - this stage costs nothing
    |
    v
WebsiteAnalysis (agent/types.ts)
  - small structured JSON object, not raw HTML
    |
    v
Generator (agent/generator.ts) --- 1 Claude call ---
  - analysis JSON in, {files, summary} JSON out
  - only app/page.tsx + components/*.tsx (config files are static templates)
    |
    v
Generated project written to /generated/<slug>
  - lib/projectTemplate.ts supplies package.json/tsconfig/tailwind/etc.
  - lib/fileWriter.ts writes files safely + symlinks node_modules
    |
    v
Validator (agent/validator.ts)
  - runs `tsc --noEmit` inside the generated project
    |
    +-- error? --> Generator.repairFile() --- 1 Claude call per attempt ---
    |               (max 2 attempts, targets only the failing file)
    |
    v
Dev server (agent/devServer.ts)
  - spawns `next dev -p <port>` for that generated project
  - iframed in the tool's own UI as the "local preview"
    |
    v
Modifier (agent/modifier.ts) --- 1 Claude call ---
  - current app/+components/ files + instruction in
  - {changedFiles, explanation} out
  - re-runs the same validator/repair loop above
    |
    v
Updated preview (same dev server, hot-reloads automatically)
```

## Why an in-process job store + spawned dev servers

This is a local, single-user 48-hour MVP. A database and a container
orchestrator would solve problems this project doesn't have. An in-memory
`Map` (lib/jobStore.ts) and directly spawning `next dev` per generated
project (agent/devServer.ts) are the simplest things that give a real,
non-iframed-original, live preview.
