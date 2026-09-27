import { execFile } from "child_process";
import path from "path";
import type { ValidationResult } from "./types";
import { projectDir } from "@/lib/fileWriter";

// `tsc --noEmit` is used instead of a full `next build` for the retry loop:
// it catches the class of errors AI-generated code actually produces (type
// errors, missing imports, JSX mistakes) in a couple of seconds instead of
// the ~30s+ a full production build takes. A full build is still cheap to
// run once at the end for real confidence - see runFullBuild below.
export function runTypeCheck(slug: string): Promise<ValidationResult> {
  return new Promise((resolve) => {
    const cwd = projectDir(slug);
    const tscBin = path.join(cwd, "node_modules", ".bin", "tsc");

    execFile(tscBin, ["--noEmit"], { cwd, timeout: 30_000 }, (error, stdout, stderr) => {
      if (!error) {
        resolve({ success: true, errorOutput: null });
        return;
      }
      const output = `${stdout}\n${stderr}`.trim();
      resolve({ success: false, errorOutput: output.slice(0, 4000) });
    });
  });
}

export function runFullBuild(slug: string): Promise<ValidationResult> {
  return new Promise((resolve) => {
    const cwd = projectDir(slug);
    const nextBin = path.join(cwd, "node_modules", ".bin", "next");

    execFile(nextBin, ["build"], { cwd, timeout: 90_000 }, (error, stdout, stderr) => {
      if (!error) {
        resolve({ success: true, errorOutput: null });
        return;
      }
      resolve({ success: false, errorOutput: `${stdout}\n${stderr}`.trim().slice(0, 4000) });
    });
  });
}

// Pulls the first "path/to/file.tsx" mentioned in tsc's output so the
// repair call can target just that file instead of guessing.
export function extractFailingFile(errorOutput: string, knownPaths: string[]): string | null {
  for (const p of knownPaths) {
    if (errorOutput.includes(p)) return p;
  }
  return null;
}
