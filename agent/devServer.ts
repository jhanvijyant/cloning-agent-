import { spawn, ChildProcess } from "child_process";
import path from "path";
import { projectDir } from "@/lib/fileWriter";

type RunningServer = {
  process: ChildProcess;
  port: number;
};

// Keyed by slug. Module-level state persists across API calls within the
// same Next.js dev server process - fine for a local single-user MVP.
const servers = new Map<string, RunningServer>();
let nextPort = 4100;

export function isRunning(slug: string): boolean {
  return servers.has(slug);
}

export function getPort(slug: string): number | null {
  return servers.get(slug)?.port ?? null;
}

// Starts `next dev` for the given generated project and resolves once it
// reports "ready", or rejects if it errors out first. The generated
// project's own file watcher gives us hot-reload for free on modifications,
// so we don't need to restart the server after every edit.
export function startPreview(slug: string): Promise<number> {
  const existing = servers.get(slug);
  if (existing) return Promise.resolve(existing.port);

  const port = nextPort++;
  const cwd = projectDir(slug);
  const nextBin = path.join(cwd, "node_modules", ".bin", "next");

  return new Promise((resolve, reject) => {
    const child = spawn(nextBin, ["dev", "-p", String(port)], {
      cwd,
      env: { ...process.env },
    });

    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        reject(new Error("Preview server did not start within 20 seconds."));
      }
    }, 20_000);

    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      if (!settled && /ready/i.test(text)) {
        settled = true;
        clearTimeout(timeout);
        servers.set(slug, { process: child, port });
        resolve(port);
      }
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      console.error(`[preview:${slug}]`, chunk.toString());
    });

    child.on("exit", () => {
      servers.delete(slug);
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error("Preview server exited before it was ready."));
      }
    });
  });
}

export function stopPreview(slug: string): void {
  const existing = servers.get(slug);
  if (!existing) return;
  existing.process.kill();
  servers.delete(slug);
}
