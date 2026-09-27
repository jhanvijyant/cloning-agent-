import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { fetchWebsite, FetchError } from "@/agent/fetcher";
import { analyzeHtml } from "@/agent/analyzer";
import { slugify } from "@/lib/slugify";
import { createJob } from "@/lib/jobStore";
import type { Job } from "@/agent/types";

export async function POST(req: NextRequest) {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "A URL is required." }, { status: 400 });
  }

  try {
    const { html, finalUrl } = await fetchWebsite(url);
    const analysis = analyzeHtml(html, finalUrl);

    const job: Job = {
      id: randomUUID(),
      slug: slugify(finalUrl),
      sourceUrl: finalUrl,
      analysis,
      generatedFiles: [],
      previewPort: null,
      status: "analyzed",
      statusMessage: "Analysis complete.",
      createdAt: Date.now(),
    };
    createJob(job);

    return NextResponse.json({ jobId: job.id, analysis });
  } catch (err) {
    if (err instanceof FetchError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error("Unexpected analyze error:", err);
    return NextResponse.json(
      { error: "Something went wrong analyzing that site." },
      { status: 500 }
    );
  }
}
