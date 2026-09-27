import type { Job } from "@/agent/types";

// A real product would use a database. For a local 48-hour MVP that only
// needs to run on one machine for one person at a time, an in-memory map
// on the Next.js server process is simpler and has zero setup cost.
const jobs = new Map<string, Job>();

export function createJob(job: Job): void {
  jobs.set(job.id, job);
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, patch: Partial<Job>): Job {
  const existing = jobs.get(id);
  if (!existing) throw new Error(`Job ${id} not found`);
  const updated = { ...existing, ...patch };
  jobs.set(id, updated);
  return updated;
}
