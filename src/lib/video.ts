import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import sharp from "sharp";
import { getExportsDir, getFramesDir } from "@/lib/jobs";
import type { JobFrame, JobSpritesheet } from "@/lib/types";

const execFileAsync = promisify(execFile);

export async function extractFrames(jobId: string, inputPath: string) {
  const framesDir = getFramesDir(jobId);
  const outputPattern = path.join(framesDir, "frame-%04d.png");

  await execFileAsync("ffmpeg", ["-y", "-i", inputPath, "-start_number", "1", outputPattern]);
}

export async function listExtractedFrames(jobId: string): Promise<JobFrame[]> {
  const framesDir = getFramesDir(jobId);
  const files = await readdir(framesDir);

  return files
    .filter((file) => file.endsWith(".png"))
    .sort()
    .map((fileName, index) => ({
      number: index + 1,
      fileName,
      assetPath: `/api/jobs/${jobId}/assets/frames/${fileName}`,
    }));
}

export async function createSpritesheet(jobId: string, frames: JobFrame[]): Promise<JobSpritesheet> {
  if (frames.length === 0) {
    throw new Error("Select at least one frame before exporting a spritesheet.");
  }

  const firstFramePath = path.join(getFramesDir(jobId), frames[0]!.fileName);
  const firstFrame = sharp(firstFramePath);
  const metadata = await firstFrame.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Unable to read frame dimensions for spritesheet export.");
  }

  const frameWidth = metadata.width;
  const frameHeight = metadata.height;
  const columns = Math.ceil(Math.sqrt(frames.length));
  const rows = Math.ceil(frames.length / columns);
  const fileName = "spritesheet.png";
  const exportsDir = getExportsDir(jobId);
  const outputPath = path.join(exportsDir, fileName);

  await mkdir(exportsDir, { recursive: true });

  await sharp({
    create: {
      width: columns * frameWidth,
      height: rows * frameHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(
      frames.map((frame, index) => ({
        input: path.join(getFramesDir(jobId), frame.fileName),
        left: (index % columns) * frameWidth,
        top: Math.floor(index / columns) * frameHeight,
      })),
    )
    .png()
    .toFile(outputPath);

  return {
    filePath: outputPath,
    assetPath: `/api/jobs/${jobId}/assets/exports/${fileName}`,
    frameCount: frames.length,
    columns,
    rows,
    frameWidth,
    frameHeight,
    exportedAt: new Date().toISOString(),
  };
}
