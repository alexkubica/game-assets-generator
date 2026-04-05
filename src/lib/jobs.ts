import { cp, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_PREVIEW_FPS,
  DEFAULT_VIDEO_ASPECT_RATIO,
  DEFAULT_VIDEO_DURATION,
  DEFAULT_VIDEO_RESOLUTION,
} from "@/lib/config";
import type { JobManifest } from "@/lib/types";

export function getJobsRoot() {
  return path.join(/* turbopackIgnore: true */ process.cwd(), "data", "jobs");
}

export function getJobDir(jobId: string) {
  return path.join(getJobsRoot(), jobId);
}

export function getJobManifestPath(jobId: string) {
  return path.join(getJobDir(jobId), "manifest.json");
}

export function getSourceDir(jobId: string) {
  return path.join(getJobDir(jobId), "source");
}

export function getVideoDir(jobId: string) {
  return path.join(getJobDir(jobId), "video");
}

export function getFramesDir(jobId: string) {
  return path.join(getJobDir(jobId), "frames");
}

export function getExportsDir(jobId: string) {
  return path.join(getJobDir(jobId), "exports");
}

export async function ensureJobStructure(jobId: string) {
  await mkdir(getSourceDir(jobId), { recursive: true });
  await mkdir(getVideoDir(jobId), { recursive: true });
  await mkdir(getFramesDir(jobId), { recursive: true });
  await mkdir(getExportsDir(jobId), { recursive: true });
}

function normalizeJobManifest(job: JobManifest) {
  return {
    ...job,
    projectId: job.projectId ?? null,
    sourceJobId: job.sourceJobId ?? null,
    title: job.title?.trim() || job.prompt,
    duration: job.duration ?? DEFAULT_VIDEO_DURATION,
    aspectRatio: job.aspectRatio ?? DEFAULT_VIDEO_ASPECT_RATIO,
    resolution: job.resolution ?? DEFAULT_VIDEO_RESOLUTION,
    selectedFrameNumbers: job.selectedFrameNumbers ?? [],
    spritesheet: job.spritesheet ?? null,
    derivedSpriteIds: job.derivedSpriteIds ?? [],
    previewFps: job.previewFps ?? DEFAULT_PREVIEW_FPS,
    archivedAt: job.archivedAt ?? null,
  } satisfies JobManifest;
}

export async function writeJobManifest(job: JobManifest) {
  await ensureJobStructure(job.jobId);
  await writeFile(getJobManifestPath(job.jobId), JSON.stringify(job, null, 2), "utf8");
}

export async function readJobManifest(jobId: string) {
  const raw = await readFile(getJobManifestPath(jobId), "utf8");
  return normalizeJobManifest(JSON.parse(raw) as JobManifest);
}

export async function updateJobManifest(
  jobId: string,
  update: (job: JobManifest) => JobManifest | Promise<JobManifest>,
) {
  const current = await readJobManifest(jobId);
  const next = await update(current);
  next.updatedAt = new Date().toISOString();
  await writeJobManifest(next);
  return next;
}

export async function listJobs(options?: { includeArchived?: boolean }) {
  await mkdir(getJobsRoot(), { recursive: true });
  const entries = await readdir(getJobsRoot(), { withFileTypes: true });
  const jobs = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        try {
          const job = await readJobManifest(entry.name);
          return job;
        } catch {
          return null;
        }
      }),
  );

  return jobs
    .filter((job): job is JobManifest => job !== null)
    .filter((job) => options?.includeArchived ? true : job.archivedAt === null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function archiveJob(jobId: string) {
  return updateJobManifest(jobId, (current) => ({
    ...current,
    archivedAt: current.archivedAt ?? new Date().toISOString(),
  }));
}

export async function restoreJob(jobId: string) {
  return updateJobManifest(jobId, (current) => ({
    ...current,
    archivedAt: null,
  }));
}

export async function forkJob(jobId: string, overrides?: { title?: string }) {
  const source = await readJobManifest(jobId);
  const nextJobId = crypto.randomUUID();
  const sourceExtension = path.extname(source.sourceImagePath) || ".png";
  const sourceFileName = `source${sourceExtension.toLowerCase()}`;
  const now = new Date().toISOString();

  await ensureJobStructure(nextJobId);
  await cp(source.sourceImagePath, path.join(getSourceDir(nextJobId), sourceFileName));

  const forked = normalizeJobManifest({
    ...source,
    jobId: nextJobId,
    projectId: source.projectId ?? null,
    sourceJobId: source.jobId,
    title: overrides?.title?.trim() || `${source.title} (Copy)`,
    sourceImagePath: path.join(getSourceDir(nextJobId), sourceFileName),
    sourceImageAssetPath: `/api/jobs/${nextJobId}/assets/source/${sourceFileName}`,
    videoPath: null,
    videoAssetPath: null,
    requestId: null,
    frames: [],
    selectedFrameNumbers: [],
    spritesheet: null,
    derivedSpriteIds: [],
    status: "queued",
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    startedAt: null,
    completedAt: null,
    errorMessage: null,
  });

  await writeJobManifest(forked);
  return forked;
}

export async function addDerivedSpriteToJob(jobId: string, spriteId: string) {
  return updateJobManifest(jobId, (current) => ({
    ...current,
    derivedSpriteIds: [...new Set([...current.derivedSpriteIds, spriteId])],
  }));
}

export async function fileExists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}
