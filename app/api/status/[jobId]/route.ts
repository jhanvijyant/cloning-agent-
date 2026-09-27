import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobStore";

export async function GET(
  _req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const job = getJob(params.jobId);
  if (!job) {
    return NextResponse.json({ error: "Unknown job." }, { status: 404 });
  }
  return NextResponse.json({
    status: job.status,
    statusMessage: job.statusMessage,
    previewPort: job.previewPort,
  });
}
