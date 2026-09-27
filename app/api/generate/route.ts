import { NextRequest, NextResponse } from "next/server";
import { getJob, updateJob } from "@/lib/jobStore";
import { writeProjectFiles } from "@/lib/fileWriter";
import { baseProjectFiles } from "@/lib/projectTemplate";
import { generateProject, repairFile, GenerationError } from "@/agent/generator";
import { runTypeCheck, extractFailingFile } from "@/agent/validator";
import { startPreview } from "@/agent/devServer";
import type { GeneratedFile } from "@/agent/types";

const MAX_REPAIR_ATTEMPTS = 2;

export async function POST(req: NextRequest) {
  const { jobId } = (await req.json()) as { jobId?: string };
  const job = jobId ? getJob(jobId) : undefined;

  if (!job || !job.analysis) {
    return NextResponse.json({ error: "Unknown or unanalyzed job." }, { status: 404 });
  }

  try {
    updateJob(job.id, { status: "generating", statusMessage: "Generating frontend..." });
    const { files: aiFiles, summary } = await generateProject(job.analysis);

    let files: GeneratedFile[] = [
      ...baseProjectFiles(job.analysis.metadata.title),
      ...aiFiles,
    ];
    writeProjectFiles(job.slug, files);

    updateJob(job.id, { status: "checking-build", statusMessage: "Checking build..." });
    let result = await runTypeCheck(job.slug);
    let attempt = 0;

    while (!result.success && attempt < MAX_REPAIR_ATTEMPTS) {
      attempt++;
      updateJob(job.id, {
        status: "fixing",
        statusMessage: `Fixing generated code (attempt ${attempt}/${MAX_REPAIR_ATTEMPTS})...`,
      });

      const knownPaths = files.map((f) => f.path);
      const failingPath = extractFailingFile(result.errorOutput || "", knownPaths);
      if (!failingPath) break; // can't tell which file - stop rather than guess

      const failingFile = files.find((f) => f.path === failingPath);
      if (!failingFile) break;

      const fixed = await repairFile(failingPath, failingFile.content, result.errorOutput || "");
      files = files.map((f) => (f.path === failingPath ? { ...f, content: fixed } : f));
      writeProjectFiles(job.slug, files);

      updateJob(job.id, { status: "checking-build", statusMessage: "Re-checking build..." });
      result = await runTypeCheck(job.slug);
    }

    if (!result.success) {
      updateJob(job.id, {
        status: "error",
        statusMessage: "Build still has errors after automatic fixes.",
        generatedFiles: files,
      });
      return NextResponse.json(
        {
          error: "Generated code has a build error that automatic repair could not fix.",
          details: result.errorOutput,
          jobId: job.id,
        },
        { status: 422 }
      );
    }

    updateJob(job.id, { status: "checking-build", statusMessage: "Starting preview server..." });
    const port = await startPreview(job.slug);

    const finalJob = updateJob(job.id, {
      status: "ready",
      statusMessage: "Ready for preview.",
      generatedFiles: files,
      previewPort: port,
    });

    return NextResponse.json({
      jobId: finalJob.id,
      status: finalJob.status,
      previewUrl: `http://localhost:${port}`,
      summary,
      files: files.map((f) => f.path),
    });
  } catch (err) {
    console.error("Unexpected generate error:", err);
    const message =
      err instanceof GenerationError ? err.message : "Something went wrong generating the frontend.";
    updateJob(job.id, { status: "error", statusMessage: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
