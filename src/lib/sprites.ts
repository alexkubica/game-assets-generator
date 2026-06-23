import { cp, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { GIFEncoder, applyPalette, quantize } from "gifenc";
import {
  DEFAULT_SPRITE_CELL_HEIGHT,
  DEFAULT_SPRITE_CELL_WIDTH,
  DEFAULT_SPRITE_PLAYBACK_FPS,
} from "@/lib/config";
import type { JobManifest, SpriteAsset } from "@/lib/types";

export function getSpritesRoot() {
  return path.join(/* turbopackIgnore: true */ process.cwd(), "data", "sprites");
}

export function getSpriteDir(spriteId: string) {
  return path.join(getSpritesRoot(), spriteId);
}

export function getSpriteManifestPath(spriteId: string) {
  return path.join(getSpriteDir(spriteId), "manifest.json");
}

export function getSpriteImagePath(spriteId: string, fileName: string) {
  return path.join(getSpriteDir(spriteId), fileName);
}

export function getSpriteExportsDir(spriteId: string) {
  return path.join(getSpriteDir(spriteId), "exports");
}

async function ensureSpriteDir(spriteId: string) {
  await mkdir(getSpriteDir(spriteId), { recursive: true });
  await mkdir(getSpriteExportsDir(spriteId), { recursive: true });
}

function getFrameCount(imageWidth: number, imageHeight: number, cellWidth: number, cellHeight: number) {
  return Math.floor(imageWidth / cellWidth) * Math.floor(imageHeight / cellHeight);
}

function buildSequentialFrameNumbers(frameCount: number) {
  return Array.from({ length: Math.max(frameCount, 0) }, (_, index) => index + 1);
}

function normalizeSelectedFrameNumbers(selectedFrameNumbers: number[] | null | undefined, maxFrameCount: number) {
  if (selectedFrameNumbers === undefined || selectedFrameNumbers === null) {
    return buildSequentialFrameNumbers(maxFrameCount);
  }

  const normalized = (selectedFrameNumbers ?? [])
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= maxFrameCount)
    .sort((left, right) => left - right)
    .filter((value, index, values) => index === 0 || values[index - 1] !== value);

  return normalized;
}

function normalizeSpriteAsset(sprite: SpriteAsset) {
  const cellWidth = sprite.cellWidth ?? DEFAULT_SPRITE_CELL_WIDTH;
  const cellHeight = sprite.cellHeight ?? DEFAULT_SPRITE_CELL_HEIGHT;
  const maxFrameCount = getFrameCount(sprite.imageWidth, sprite.imageHeight, cellWidth, cellHeight);

  return {
    ...sprite,
    projectId: sprite.projectId ?? null,
    sourceSpriteId: sprite.sourceSpriteId ?? null,
    cellWidth,
    cellHeight,
    playbackFps: sprite.playbackFps ?? DEFAULT_SPRITE_PLAYBACK_FPS,
    selectedFrameNumbers: normalizeSelectedFrameNumbers(sprite.selectedFrameNumbers, maxFrameCount),
    frameCount: normalizeSelectedFrameNumbers(sprite.selectedFrameNumbers, maxFrameCount).length,
    chromaKeyColor: sprite.chromaKeyColor ?? null,
    chromaKeyTolerance: sprite.chromaKeyTolerance ?? 32,
    gifPath: sprite.gifPath ?? null,
    gifAssetPath: sprite.gifAssetPath ?? null,
    gifExportedAt: sprite.gifExportedAt ?? null,
    usageCount: sprite.usageCount ?? 0,
    lastUsedAt: sprite.lastUsedAt ?? null,
    archivedAt: sprite.archivedAt ?? null,
  } satisfies SpriteAsset;
}

export async function writeSpriteManifest(sprite: SpriteAsset) {
  await ensureSpriteDir(sprite.spriteId);
  await writeFile(getSpriteManifestPath(sprite.spriteId), JSON.stringify(sprite, null, 2), "utf8");
}

export async function readSpriteManifest(spriteId: string) {
  const raw = await readFile(getSpriteManifestPath(spriteId), "utf8");
  return normalizeSpriteAsset(JSON.parse(raw) as SpriteAsset);
}

export async function updateSpriteManifest(
  spriteId: string,
  update: (sprite: SpriteAsset) => SpriteAsset | Promise<SpriteAsset>,
) {
  const current = await readSpriteManifest(spriteId);
  const next = await update(current);
  next.updatedAt = new Date().toISOString();
  const maxFrameCount = getFrameCount(next.imageWidth, next.imageHeight, next.cellWidth, next.cellHeight);
  next.selectedFrameNumbers = normalizeSelectedFrameNumbers(next.selectedFrameNumbers, maxFrameCount);
  next.frameCount = next.selectedFrameNumbers.length;
  next.chromaKeyTolerance = Math.max(0, Math.min(next.chromaKeyTolerance, 255));
  await writeSpriteManifest(next);
  return next;
}

export async function listSprites(options?: { includeArchived?: boolean }) {
  await mkdir(getSpritesRoot(), { recursive: true });
  const entries = await readdir(getSpritesRoot(), { withFileTypes: true });
  const sprites = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        try {
          return await readSpriteManifest(entry.name);
        } catch {
          return null;
        }
      }),
  );

  return sprites
    .filter((sprite): sprite is SpriteAsset => sprite !== null)
    .filter((sprite) => options?.includeArchived ? true : sprite.archivedAt === null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function getImageDimensions(imagePath: string) {
  const metadata = await sharp(imagePath).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Unable to read sprite image dimensions.");
  }

  return {
    imageWidth: metadata.width,
    imageHeight: metadata.height,
  };
}

export async function upsertGeneratedSprite(job: JobManifest) {
  if (!job.spritesheet) {
    throw new Error("The job does not have an exported spritesheet.");
  }

  const spriteId = crypto.randomUUID();
  const fileName = "sheet.png";
  const imagePath = getSpriteImagePath(spriteId, fileName);

  await ensureSpriteDir(spriteId);
  await cp(job.spritesheet.filePath, imagePath);

  const { imageWidth, imageHeight } = await getImageDimensions(imagePath);
  const now = new Date().toISOString();
  const sprite: SpriteAsset = {
    spriteId,
    projectId: job.projectId ?? null,
    sourceSpriteId: null,
    sourceType: "generated",
    title: job.title,
    imagePath,
    imageAssetPath: `/api/sprites/${spriteId}/asset/${fileName}`,
    imageMimeType: "image/png",
    imageWidth,
    imageHeight,
    cellWidth: job.spritesheet.frameWidth,
    cellHeight: job.spritesheet.frameHeight,
    playbackFps: job.previewFps,
    frameCount: job.spritesheet.frameCount,
    selectedFrameNumbers: buildSequentialFrameNumbers(job.spritesheet.frameCount),
    chromaKeyColor: null,
    chromaKeyTolerance: 32,
    gifPath: null,
    gifAssetPath: null,
    gifExportedAt: null,
    originalJobId: job.jobId,
    usageCount: 0,
    lastUsedAt: null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };

  await writeSpriteManifest(sprite);
  return sprite;
}

export async function createUploadedSprite(args: {
  title: string;
  fileName: string;
  mimeType: string;
  content: Buffer;
  cellWidth?: number;
  cellHeight?: number;
}) {
  const spriteId = crypto.randomUUID();
  const extension = path.extname(args.fileName) || ".png";
  const imageFileName = `sheet${extension.toLowerCase()}`;
  const imagePath = getSpriteImagePath(spriteId, imageFileName);

  await ensureSpriteDir(spriteId);
  await writeFile(imagePath, args.content);

  const { imageWidth, imageHeight } = await getImageDimensions(imagePath);
  const cellWidth = args.cellWidth ?? DEFAULT_SPRITE_CELL_WIDTH;
  const cellHeight = args.cellHeight ?? DEFAULT_SPRITE_CELL_HEIGHT;
  const now = new Date().toISOString();

  const sprite: SpriteAsset = {
    spriteId,
    projectId: null,
    sourceSpriteId: null,
    sourceType: "uploaded",
    title: args.title,
    imagePath,
    imageAssetPath: `/api/sprites/${spriteId}/asset/${imageFileName}`,
    imageMimeType: args.mimeType,
    imageWidth,
    imageHeight,
    cellWidth,
    cellHeight,
    playbackFps: DEFAULT_SPRITE_PLAYBACK_FPS,
    frameCount: getFrameCount(imageWidth, imageHeight, cellWidth, cellHeight),
    selectedFrameNumbers: buildSequentialFrameNumbers(getFrameCount(imageWidth, imageHeight, cellWidth, cellHeight)),
    chromaKeyColor: null,
    chromaKeyTolerance: 32,
    gifPath: null,
    gifAssetPath: null,
    gifExportedAt: null,
    originalJobId: null,
    usageCount: 0,
    lastUsedAt: null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };

  await writeSpriteManifest(sprite);
  return sprite;
}

export async function spriteExists(spriteId: string) {
  try {
    await stat(getSpriteManifestPath(spriteId));
    return true;
  } catch {
    return false;
  }
}

export async function archiveSprite(spriteId: string) {
  return updateSpriteManifest(spriteId, (current) => ({
    ...current,
    archivedAt: current.archivedAt ?? new Date().toISOString(),
  }));
}

export async function restoreSprite(spriteId: string) {
  return updateSpriteManifest(spriteId, (current) => ({
    ...current,
    archivedAt: null,
  }));
}

export async function touchSpriteUsage(spriteId: string) {
  return updateSpriteManifest(spriteId, (current) => ({
    ...current,
    usageCount: current.usageCount + 1,
    lastUsedAt: new Date().toISOString(),
  }));
}

export async function forkSprite(spriteId: string, overrides?: { title?: string }) {
  const source = await readSpriteManifest(spriteId);
  const nextSpriteId = crypto.randomUUID();
  const extension = path.extname(source.imagePath) || ".png";
  const imageFileName = `sheet${extension.toLowerCase()}`;
  const imagePath = getSpriteImagePath(nextSpriteId, imageFileName);
  const now = new Date().toISOString();

  await ensureSpriteDir(nextSpriteId);
  await cp(source.imagePath, imagePath);

  if (source.gifPath) {
    await cp(source.gifPath, path.join(getSpriteExportsDir(nextSpriteId), "preview.gif"));
  }

  const forked: SpriteAsset = normalizeSpriteAsset({
    ...source,
    spriteId: nextSpriteId,
    projectId: source.projectId ?? null,
    sourceSpriteId: source.spriteId,
    title: overrides?.title?.trim() || `${source.title} (Copy)`,
    imagePath,
    imageAssetPath: `/api/sprites/${nextSpriteId}/asset/${imageFileName}`,
    gifPath: source.gifPath ? path.join(getSpriteExportsDir(nextSpriteId), "preview.gif") : null,
    gifAssetPath: source.gifPath ? `/api/sprites/${nextSpriteId}/gif` : null,
    usageCount: 0,
    lastUsedAt: null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  });

  await writeSpriteManifest(forked);
  return forked;
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");

  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function applyChromaKey(
  rgba: Uint8Array,
  chromaKeyColor: string | null,
  chromaKeyTolerance: number,
) {
  if (!chromaKeyColor) {
    return rgba;
  }

  const next = new Uint8Array(rgba);
  const { r, g, b } = hexToRgb(chromaKeyColor);

  for (let index = 0; index < next.length; index += 4) {
    const distance = Math.sqrt(
      (next[index]! - r) ** 2 +
        (next[index + 1]! - g) ** 2 +
        (next[index + 2]! - b) ** 2,
    );

    if (distance <= chromaKeyTolerance) {
      next[index + 3] = 0;
    }
  }

  return next;
}

export async function exportSpriteGif(spriteId: string) {
  const sprite = await readSpriteManifest(spriteId);
  const gifPath = path.join(getSpriteExportsDir(spriteId), "preview.gif");
  const frameDelay = Math.max(Math.round(1000 / Math.max(sprite.playbackFps, 1)), 20);
  const gif = GIFEncoder();

  for (const selectedFrameNumber of sprite.selectedFrameNumbers) {
    const frameIndex = selectedFrameNumber - 1;
    const left = (frameIndex * sprite.cellWidth) % sprite.imageWidth;
    const top = Math.floor((frameIndex * sprite.cellWidth) / sprite.imageWidth) * sprite.cellHeight;

    const frame = await sharp(sprite.imagePath)
      .extract({
        left,
        top,
        width: sprite.cellWidth,
        height: sprite.cellHeight,
      })
      .ensureAlpha()
      .raw()
      .toBuffer();

    const rgba = applyChromaKey(
      new Uint8Array(frame),
      sprite.chromaKeyColor,
      sprite.chromaKeyTolerance,
    );
    const palette = quantize(rgba, 256, {
      format: "rgba4444",
      oneBitAlpha: true,
    });
    const index = applyPalette(rgba, palette, "rgba4444");
    const transparentIndex = palette.findIndex((color) => color[3] === 0);

    gif.writeFrame(index, sprite.cellWidth, sprite.cellHeight, {
      palette,
      delay: frameDelay,
      repeat: 0,
      transparent: transparentIndex >= 0,
      transparentIndex: transparentIndex >= 0 ? transparentIndex : 0,
    });
  }

  gif.finish();
  await ensureSpriteDir(spriteId);
  await writeFile(gifPath, Buffer.from(gif.bytes()));

  const updated = await updateSpriteManifest(spriteId, (current) => ({
    ...current,
    gifPath,
    gifAssetPath: `/api/sprites/${spriteId}/gif`,
    gifExportedAt: new Date().toISOString(),
  }));

  return updated;
}
