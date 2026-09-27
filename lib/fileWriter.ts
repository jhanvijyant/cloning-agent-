import fs from "fs";
import path from "path";
import type { GeneratedFile } from "@/agent/types";

const GENERATED_ROOT = path.join(process.cwd(), "generated");

export function projectDir(slug: string): string {
  return path.join(GENERATED_ROOT, slug);
}

// Writes/overwrites the given files inside generated/<slug>/. Rejects any
// path that would escape the project directory (e.g. "../../etc/passwd") -
// this matters because file paths in this function ultimately originate
// from LLM output, which should never be trusted blindly.
export function writeProjectFiles(slug: string, files: GeneratedFile[]): void {
  const root = projectDir(slug);
  fs.mkdirSync(root, { recursive: true });

  for (const file of files) {
    const target = path.resolve(root, file.path);
    if (!target.startsWith(root + path.sep)) {
      throw new Error(`Refusing to write outside project directory: ${file.path}`);
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.content, "utf8");
  }

  linkSharedNodeModules(root);
}

export function readProjectFiles(slug: string): GeneratedFile[] {
  const root = projectDir(slug);
  const results: GeneratedFile[] = [];

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        results.push({
          path: path.relative(root, full),
          content: fs.readFileSync(full, "utf8"),
        });
      }
    }
  }

  if (fs.existsSync(root)) walk(root);
  return results;
}

// Generated projects use the exact same next/react/tailwind versions as the
// root tool, so instead of running `npm install` per generated project
// (slow, and burns disk space for identical packages), we symlink the
// root's node_modules in. Documented in the README as a cost/time decision.
function linkSharedNodeModules(root: string): void {
  const target = path.join(root, "node_modules");
  const source = path.join(process.cwd(), "node_modules");
  if (fs.existsSync(target)) return;
  try {
    fs.symlinkSync(source, target, "junction");
  } catch (err) {
    // Fall back silently - if symlinking isn't permitted on this OS/FS,
    // the validator will surface a clear "next: command not found" error
    // instead of failing here.
    console.error("Could not symlink node_modules:", err);
  }
}
