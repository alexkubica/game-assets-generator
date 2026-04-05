import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  DEFAULT_PROVIDER,
  DEFAULT_VIDEO_ASPECT_RATIO,
  DEFAULT_VIDEO_DURATION,
  DEFAULT_VIDEO_RESOLUTION,
} from "@/lib/config";
import { createInitialJob, enqueueJob } from "@/lib/job-runner";
import { getSourceDir, listJobs, readJobManifest } from "@/lib/jobs";
import { createJobSchema } from "@/lib/validators";

export async function GET() {
  const jobs = await listJobs();
  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const parsed = createJobSchema.safeParse({
      prompt: formData.get("prompt"),
      provider: formData.get("provider") ?? DEFAULT_PROVIDER,
      retryFromJobId: formData.get("retryFromJobId") || undefined,
      duration: formData.get("duration") ?? DEFAULT_VIDEO_DURATION,
      aspectRatio: formData.get("aspectRatio") ?? DEFAULT_VIDEO_ASPECT_RATIO,
      resolution: formData.get("resolution") ?? DEFAULT_VIDEO_RESOLUTION,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 },
      );
    }

    const image = formData.get("image");
    const hasUpload = image instanceof File && image.size > 0;
    const hasRetrySource = Boolean(parsed.data.retryFromJobId);

    if (hasUpload === hasRetrySource) {
      return NextResponse.json(
        { error: "Provide either a new source image or a retry source job." },
        { status: 400 },
      );
    }

    const jobId = crypto.randomUUID();
    const sourceDir = getSourceDir(jobId);
    await mkdir(sourceDir, { recursive: true });

    let fileName: string;
    let sourceMimeType: string;

    if (hasUpload) {
      const upload = image as File;
      const extension = path.extname(upload.name) || ".png";
      fileName = `source${extension.toLowerCase()}`;
      sourceMimeType = upload.type || "image/png";
      await writeFile(path.join(sourceDir, fileName), Buffer.from(await upload.arrayBuffer()));
    } else {
      const sourceJob = await readJobManifest(parsed.data.retryFromJobId!);
      const extension = path.extname(sourceJob.sourceImagePath) || ".png";
      fileName = `source${extension.toLowerCase()}`;
      sourceMimeType = sourceJob.sourceImageMimeType;
      await cp(sourceJob.sourceImagePath, path.join(sourceDir, fileName));
    }

    const job = createInitialJob(jobId, {
      prompt: parsed.data.prompt,
      provider: parsed.data.provider,
      sourceFileName: fileName,
      sourceMimeType,
      duration: parsed.data.duration,
      aspectRatio: parsed.data.aspectRatio,
      resolution: parsed.data.resolution,
    });

    await enqueueJob(job);

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create job." },
      { status: 500 },
    );
  }
}
