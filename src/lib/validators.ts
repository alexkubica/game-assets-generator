import { z } from "zod";
import {
  DEFAULT_PROVIDER,
  VIDEO_ASPECT_RATIOS,
  VIDEO_RESOLUTIONS,
} from "@/lib/config";

export const createJobSchema = z.object({
  prompt: z.string().trim().min(1, "Prompt is required."),
  provider: z.literal(DEFAULT_PROVIDER),
  retryFromJobId: z.string().uuid().optional(),
  duration: z.coerce.number().int().min(1).max(15),
  aspectRatio: z.enum(VIDEO_ASPECT_RATIOS),
  resolution: z.enum(VIDEO_RESOLUTIONS),
});

export const updateJobSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").optional(),
  selectedFrameNumbers: z.array(z.number().int().positive()).optional(),
  previewFps: z.number().int().min(1).max(60).optional(),
});

export const updateSpriteSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").optional(),
  cellWidth: z.coerce.number().int().min(1).optional(),
  cellHeight: z.coerce.number().int().min(1).optional(),
  frameCount: z.coerce.number().int().min(1).optional(),
  playbackFps: z.coerce.number().int().min(1).max(60).optional(),
  chromaKeyColor: z.union([z.string().regex(/^#[0-9a-fA-F]{6}$/), z.null()]).optional(),
  chromaKeyTolerance: z.coerce.number().min(0).max(255).optional(),
});

export const archiveEntitySchema = z.object({
  archived: z.coerce.boolean().optional().default(true),
});

export const forkJobSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").optional(),
});

export const forkSpriteSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").optional(),
});

export const createTesterSetupSchema = z.object({
  title: z.string().trim().min(1, "Title is required."),
  projectId: z.string().uuid().nullable().optional(),
  defaultAssetKey: z.string().trim().min(1, "Default asset is required."),
  defaultFps: z.coerce.number().int().min(1).max(24),
  defaultScale: z.coerce.number().min(0.5).max(2),
  defaultOrientation: z.enum(["left", "right"]),
  states: z.record(
    z.enum(["idle", "walking", "jumping"]),
    z.object({
      assetKey: z.string().nullable(),
      fps: z.coerce.number().int().min(1).max(24).nullable(),
      scale: z.coerce.number().min(0.5).max(2).nullable(),
      sourceOrientation: z.enum(["left", "right"]).nullable(),
    }),
  ),
  assetOverrides: z.record(
    z.string(),
    z.object({
      chromaKeyColor: z.union([z.string().regex(/^#[0-9a-fA-F]{6}$/), z.null()]),
      chromaKeyTolerance: z.coerce.number().min(0).max(255),
    }),
  ),
});

export const updateTesterSetupSchema = createTesterSetupSchema.partial().extend({
  title: z.string().trim().min(1, "Title is required.").optional(),
  defaultAssetKey: z.string().trim().min(1, "Default asset is required.").optional(),
});
