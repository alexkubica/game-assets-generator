import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_PREVIEW_FPS,
  DEFAULT_VIDEO_ASPECT_RATIO,
  DEFAULT_VIDEO_DURATION,
  DEFAULT_VIDEO_RESOLUTION,
} from "@/lib/config";
import {
  getSourceDir,
  getVideoDir,
  updateJobManifest,
  writeJobManifest,
} from "@/lib/jobs";
import type { JobManifest, VideoProvider } from "@/lib/types";
import { createImageToVideoGeneration, getGenerationStatus } from "@/lib/xai";
import { extractFrames, listExtractedFrames } from "@/lib/video";

const runningJobs = new Set<string>();

export function createInitialJob(jobId: string, args: {
  prompt: string;
  provider: VideoProvider;
  sourceFileName: string;
  sourceMimeType: string;
  duration?: number;
  aspectRatio?: JobManifest["aspectRatio"];
  resolution?: JobManifest["resolution"];
}) {
  const now = new Date().toISOString();

  return {
    jobId,
    projectId: null,
    sourceJobId: null,
    provider: args.provider,
    prompt: args.prompt,
    title: args.prompt,
    duration: args.duration ?? DEFAULT_VIDEO_DURATION,
    aspectRatio: args.aspectRatio ?? DEFAULT_VIDEO_ASPECT_RATIO,
    resolution: args.resolution ?? DEFAULT_VIDEO_RESOLUTION,
    status: "queued",
    sourceImagePath: path.join(getSourceDir(jobId), args.sourceFileName),
    sourceImageAssetPath: `/api/jobs/${jobId}/assets/source/${args.sourceFileName}`,
    sourceImageMimeType: args.sourceMimeType,
    videoPath: null,
    videoAssetPath: null,
    requestId: null,
    frames: [],
    selectedFrameNumbers: [],
    spritesheet: null,
    derivedSpriteIds: [],
    previewFps: DEFAULT_PREVIEW_FPS,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    startedAt: null,
    completedAt: null,
    errorMessage: null,
  } satisfies JobManifest;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function enqueueJob(job: JobManifest) {
  await writeJobManifest(job);
  void processJob(job.jobId);
}

export async function processJob(jobId: string) {
  if (runningJobs.has(jobId)) {
    return;
  }

  runningJobs.add(jobId);

  try {
    await updateJobManifest(jobId, (job) => ({
      ...job,
      status: "generating",
      startedAt: job.startedAt ?? new Date().toISOString(),
      errorMessage: null,
    }));

    const job = await updateJobManifest(jobId, async (current) => {
      const sourceBuffer = await readFile(current.sourceImagePath);
      const imageDataUri = `data:${current.sourceImageMimeType};base64,${sourceBuffer.toString("base64")}`;
      const generation = await createImageToVideoGeneration({
        prompt: current.prompt,
        imageDataUri,
        duration: current.duration,
        aspectRatio: current.aspectRatio,
        resolution: current.resolution,
      });

      return {
        ...current,
        requestId: generation.request_id,
      };
    });

    while (true) {
      const result = await getGenerationStatus(job.requestId!);

      if (result.status === "done" && result.video?.url) {
        await updateJobManifest(jobId, (current) => ({
          ...current,
          status: "downloading",
        }));

        const response = await fetch(result.video.url);

        if (!response.ok) {
          throw new Error(`Unable to download generated video: ${response.status}`);
        }

        const videoBuffer = Buffer.from(await response.arrayBuffer());
        const fileName = "generated.mp4";
        const videoPath = path.join(getVideoDir(jobId), fileName);

        await writeFile(videoPath, videoBuffer);

        await updateJobManifest(jobId, (current) => ({
          ...current,
          status: "extracting",
          videoPath,
          videoAssetPath: `/api/jobs/${jobId}/assets/video/${fileName}`,
        }));

        await extractFrames(jobId, videoPath);
        const frames = await listExtractedFrames(jobId);

        await updateJobManifest(jobId, (current) => ({
          ...current,
          status: "ready",
          completedAt: new Date().toISOString(),
          frames,
          selectedFrameNumbers: frames.map((frame) => frame.number),
        }));

        break;
      }

      if (result.status === "expired") {
        await updateJobManifest(jobId, (current) => ({
          ...current,
          status: "expired",
          completedAt: new Date().toISOString(),
          errorMessage: "The xAI generation request expired before the video was ready.",
        }));
        break;
      }

      await sleep(5000);
    }
  } catch (error) {
    await updateJobManifest(jobId, (current) => ({
      ...current,
      status: "failed",
      completedAt: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : "Unexpected job failure.",
    }));
  } finally {
    runningJobs.delete(jobId);
  }
}
