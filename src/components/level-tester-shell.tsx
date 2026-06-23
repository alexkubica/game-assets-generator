"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Gamepad2, LoaderCircle, MoveHorizontal, Pipette, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  PlayableLevelPreview,
  type PlayableSpriteStateConfig,
  type SpriteMotionState,
} from "@/components/playable-level-preview";
import { SaveScopeDialog } from "@/components/save-scope-dialog";
import { SpritePreviewTile } from "@/components/sprite-preview-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type { JobManifest, SpriteAsset, TesterSetup } from "@/lib/types";

type SpriteOrientation = "left" | "right";
type TesterAssetSourceType = "generated" | "uploaded" | "input-image";
type TesterAssetOption = {
  assetKey: string;
  title: string;
  sourceType: TesterAssetSourceType;
  sourceLabel: string;
  previewAssetPath: string;
  previewMimeType: string;
  animatedPreviewAvailable: boolean;
  spritesheetAssetPath: string;
  imageWidth: number;
  imageHeight: number;
  cellWidth: number;
  cellHeight: number;
  frameCount: number;
  selectedFrameNumbers?: number[];
  playbackFps: number;
  chromaKeyColor: string | null;
  chromaKeyTolerance: number;
  spriteId: string | null;
  jobId: string | null;
};
type SpriteTesterDefaultConfig = {
  assetKey: string;
  fps: number;
  scale: number;
  sourceOrientation: SpriteOrientation;
};
type SpriteTesterStateConfig = {
  assetKey: string | null;
  fps: number | null;
  scale: number | null;
  sourceOrientation: SpriteOrientation | null;
};
type TesterAssetOverride = {
  chromaKeyColor: string | null;
  chromaKeyTolerance: number;
};
type SpriteTesterConfig = {
  default: SpriteTesterDefaultConfig;
  states: Record<SpriteMotionState, SpriteTesterStateConfig>;
  assetOverrides: Record<string, TesterAssetOverride>;
};
type PendingChromaSave = {
  asset: TesterAssetOption;
  chromaKeyColor: string | null;
  chromaKeyTolerance: number;
};

const TESTER_CONFIG_STORAGE_KEY = "level-tester-state-config";
const SPRITE_STATES: SpriteMotionState[] = ["idle", "walking", "jumping"];

function clampFps(value: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.min(24, Math.round(value)))
    : fallback;
}

function clampScale(value: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0.5, Math.min(2, Number(value)))
    : 1;
}

function normalizeOrientation(value: string | null | undefined): SpriteOrientation {
  return value === "left" ? "left" : "right";
}

function withVersion(assetPath: string, version: string | null | undefined) {
  if (!version) {
    return assetPath;
  }

  const separator = assetPath.includes("?") ? "&" : "?";
  return `${assetPath}${separator}v=${encodeURIComponent(version)}`;
}

function formatSourceTypeLabel(sourceType: TesterAssetSourceType) {
  if (sourceType === "generated") {
    return "Generated";
  }

  if (sourceType === "uploaded") {
    return "Uploaded";
  }

  return "Input image";
}

function buildTesterAssets(sprites: SpriteAsset[], jobs: JobManifest[]): TesterAssetOption[] {
  const spriteAssets = sprites.map((sprite) => ({
    assetKey: `sprite:${sprite.spriteId}`,
    title: sprite.title,
    sourceType: sprite.sourceType,
    sourceLabel: sprite.sourceType === "generated" ? "Library sprite · generated" : "Library sprite · uploaded",
    previewAssetPath: sprite.gifAssetPath
      ? withVersion(sprite.gifAssetPath, sprite.gifExportedAt)
      : withVersion(sprite.imageAssetPath, sprite.updatedAt),
    previewMimeType: sprite.gifAssetPath ? "image/gif" : sprite.imageMimeType,
    animatedPreviewAvailable: Boolean(sprite.gifAssetPath) || sprite.frameCount > 1,
    spritesheetAssetPath: withVersion(sprite.imageAssetPath, sprite.updatedAt),
    imageWidth: sprite.imageWidth,
    imageHeight: sprite.imageHeight,
    cellWidth: sprite.cellWidth,
    cellHeight: sprite.cellHeight,
    frameCount: sprite.frameCount,
    selectedFrameNumbers: sprite.selectedFrameNumbers,
    playbackFps: sprite.playbackFps,
    chromaKeyColor: sprite.chromaKeyColor,
    chromaKeyTolerance: sprite.chromaKeyTolerance,
    spriteId: sprite.spriteId,
    jobId: null,
  }));
  const sourceAssets = jobs.map((job) => ({
    assetKey: `job-source:${job.jobId}`,
    title: job.title,
    sourceType: "input-image" as const,
    sourceLabel: "Input image",
    previewAssetPath: withVersion(job.sourceImageAssetPath, job.updatedAt),
    previewMimeType: job.sourceImageMimeType,
    animatedPreviewAvailable: false,
    spritesheetAssetPath: withVersion(job.sourceImageAssetPath, job.updatedAt),
    imageWidth: 1,
    imageHeight: 1,
    cellWidth: 1,
    cellHeight: 1,
    frameCount: 1,
    playbackFps: 1,
    chromaKeyColor: null,
    chromaKeyTolerance: 32,
    spriteId: null,
    jobId: job.jobId,
  }));

  return [...spriteAssets, ...sourceAssets];
}

function normalizeStoredConfigs(
  testerAssets: TesterAssetOption[],
  rawConfig: Partial<SpriteTesterConfig> & {
    scale?: number;
    sourceOrientation?: SpriteOrientation;
  },
) {
  const defaultAssetKey = testerAssets[0]?.assetKey ?? "";
  const assetLookup = new Map(testerAssets.map((asset) => [asset.assetKey, asset]));
  const legacyWalkingState = rawConfig.states?.walking;
  const nextDefaultAsset =
    (rawConfig.default?.assetKey ? assetLookup.get(rawConfig.default.assetKey) : null) ??
    (legacyWalkingState?.assetKey ? assetLookup.get(legacyWalkingState.assetKey) : null) ??
    assetLookup.get(defaultAssetKey) ??
    null;
  const nextDefaultFps = clampFps(
    rawConfig.default?.fps ?? legacyWalkingState?.fps ?? nextDefaultAsset?.playbackFps ?? 8,
    nextDefaultAsset?.playbackFps ?? 8,
  );
  const nextDefaultScale = clampScale(rawConfig.default?.scale ?? rawConfig.scale ?? 1);
  const nextDefaultOrientation = normalizeOrientation(
    rawConfig.default?.sourceOrientation ?? rawConfig.sourceOrientation,
  );

  return {
    default: {
      assetKey: nextDefaultAsset?.assetKey ?? "",
      fps: nextDefaultFps,
      scale: nextDefaultScale,
      sourceOrientation: nextDefaultOrientation,
    },
    states: Object.fromEntries(
      SPRITE_STATES.map((state) => {
        const storedState = rawConfig.states?.[state];
        const nextAsset =
          storedState?.assetKey && storedState.assetKey !== nextDefaultAsset?.assetKey
            ? assetLookup.get(storedState.assetKey) ?? null
            : null;
        const nextFps =
          typeof storedState?.fps === "number" && Number.isFinite(storedState.fps) && storedState.fps !== nextDefaultFps
            ? clampFps(storedState.fps, nextDefaultFps)
            : null;
        const nextScale =
          typeof storedState?.scale === "number" && Number.isFinite(storedState.scale) && storedState.scale !== nextDefaultScale
            ? clampScale(storedState.scale)
            : null;
        const nextOrientation =
          storedState?.sourceOrientation && storedState.sourceOrientation !== nextDefaultOrientation
            ? normalizeOrientation(storedState.sourceOrientation)
            : null;

        return [
          state,
          {
            assetKey: nextAsset?.assetKey ?? null,
            fps: nextFps,
            scale: nextScale,
            sourceOrientation: nextOrientation,
          },
        ];
      }),
    ) as SpriteTesterConfig["states"],
    assetOverrides: Object.fromEntries(
      Object.entries(rawConfig.assetOverrides ?? {}).map(([assetKey, override]) => [
        assetKey,
        {
          chromaKeyColor: override?.chromaKeyColor ?? null,
          chromaKeyTolerance: Math.max(0, Math.min(override?.chromaKeyTolerance ?? 32, 255)),
        },
      ]),
    ),
  } satisfies SpriteTesterConfig;
}

function setupToConfig(setup: TesterSetup): SpriteTesterConfig {
  return {
    default: {
      assetKey: setup.defaultAssetKey,
      fps: setup.defaultFps,
      scale: setup.defaultScale,
      sourceOrientation: setup.defaultOrientation,
    },
    states: setup.states,
    assetOverrides: setup.assetOverrides,
  };
}

function buildInitialDraftConfig(
  initialSprites: SpriteAsset[],
  initialJobs: JobManifest[],
  initialSetups: TesterSetup[],
  initialAssetKey: string | null | undefined,
) {
  const initialAssets = buildTesterAssets(initialSprites, initialJobs);
  const assetLookup = new Map(initialAssets.map((asset) => [asset.assetKey, asset]));
  const baseConfig = initialSetups[0] ? setupToConfig(initialSetups[0]) : {};

  if (!initialAssetKey) {
    return normalizeStoredConfigs(initialAssets, baseConfig);
  }

  const initialAsset = assetLookup.get(initialAssetKey);

  if (!initialAsset) {
    return normalizeStoredConfigs(initialAssets, baseConfig);
  }

  return normalizeStoredConfigs(initialAssets, {
    ...baseConfig,
    default: {
      ...(baseConfig.default ?? {}),
      assetKey: initialAssetKey,
      fps: clampFps(
        initialAsset.playbackFps,
        typeof baseConfig.default?.fps === "number" ? baseConfig.default.fps : initialAsset.playbackFps,
      ),
    },
  });
}

function configToSetupInput(title: string, projectId: string | null, config: SpriteTesterConfig) {
  return {
    title,
    projectId,
    defaultAssetKey: config.default.assetKey,
    defaultFps: config.default.fps,
    defaultScale: config.default.scale,
    defaultOrientation: config.default.sourceOrientation,
    states: config.states,
    assetOverrides: config.assetOverrides,
  };
}

function getLegacyDraftConfig(): Partial<SpriteTesterConfig> | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(TESTER_CONFIG_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as Partial<SpriteTesterConfig>;
  } catch {
    return null;
  }
}

async function detectMostCommonEdgeColor(imageAssetPath: string) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new window.Image();
    nextImage.crossOrigin = "anonymous";
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error("Unable to load image for edge color detection."));
    nextImage.src = imageAssetPath;
  });

  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create canvas context for edge color detection.");
  }

  context.drawImage(image, 0, 0);
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  const samples = new Map<string, number>();

  function addPixel(x: number, y: number) {
    const index = (y * width + x) * 4;
    const alpha = data[index + 3] ?? 0;

    if (alpha === 0) {
      return;
    }

    const red = data[index] ?? 0;
    const green = data[index + 1] ?? 0;
    const blue = data[index + 2] ?? 0;
    const key = `${red},${green},${blue}`;
    samples.set(key, (samples.get(key) ?? 0) + 1);
  }

  for (let x = 0; x < width; x += 1) {
    addPixel(x, 0);
    addPixel(x, height - 1);
  }

  for (let y = 1; y < height - 1; y += 1) {
    addPixel(0, y);
    addPixel(width - 1, y);
  }

  const [color] = [...samples.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];

  if (!color) {
    return "#00ff00";
  }

  const [red, green, blue] = color.split(",").map(Number);
  return `#${[red, green, blue]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

function getChromaKeySummary(color: string | null, tolerance: number) {
  return color ? `key ${color} @ ${tolerance}` : "chroma key off";
}

function AssetEditor({
  asset,
  chromaKeyColor,
  chromaKeyTolerance,
  onSaveTitle,
  onSaveChroma,
}: {
  asset: TesterAssetOption | null;
  chromaKeyColor: string | null;
  chromaKeyTolerance: number;
  onSaveTitle: (asset: TesterAssetOption, title: string) => Promise<void>;
  onSaveChroma: (asset: TesterAssetOption, chromaKeyColor: string | null, chromaKeyTolerance: number) => Promise<void>;
}) {
  const [title, setTitle] = useState(asset?.title ?? "");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isSavingChroma, setIsSavingChroma] = useState(false);
  const [isDetectingEdgeColor, setIsDetectingEdgeColor] = useState(false);
  const [chromaEnabled, setChromaEnabled] = useState(Boolean(chromaKeyColor));
  const [localChromaKeyColor, setLocalChromaKeyColor] = useState(chromaKeyColor ?? "#00ff00");
  const [localChromaKeyTolerance, setLocalChromaKeyTolerance] = useState(chromaKeyTolerance);

  useEffect(() => {
    setTitle(asset?.title ?? "");
  }, [asset?.assetKey, asset?.title]);

  useEffect(() => {
    setChromaEnabled(Boolean(chromaKeyColor));
    setLocalChromaKeyColor(chromaKeyColor ?? "#00ff00");
    setLocalChromaKeyTolerance(chromaKeyTolerance);
  }, [asset?.assetKey, chromaKeyColor, chromaKeyTolerance]);

  if (!asset) {
    return null;
  }

  const activeAsset = asset;

  async function handleSaveTitle() {
    setIsSavingTitle(true);

    try {
      await onSaveTitle(activeAsset, title.trim());
    } finally {
      setIsSavingTitle(false);
    }
  }

  async function handleSaveChroma() {
    setIsSavingChroma(true);

    try {
      await onSaveChroma(
        activeAsset,
        chromaEnabled ? localChromaKeyColor : null,
        Math.max(0, Math.min(localChromaKeyTolerance, 255)),
      );
    } finally {
      setIsSavingChroma(false);
    }
  }

  async function handleDetectEdgeColor() {
    setIsDetectingEdgeColor(true);

    try {
      const nextColor = await detectMostCommonEdgeColor(activeAsset.spritesheetAssetPath);
      setChromaEnabled(true);
      setLocalChromaKeyColor(nextColor);
      toast.success("Matched the most common edge color.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to detect edge color.");
    } finally {
      setIsDetectingEdgeColor(false);
    }
  }

  return (
    <div className="space-y-4 rounded-[1.25rem] border border-border/70 bg-background/60 p-4">
      <div className="grid gap-2">
        <Label htmlFor={`asset-title-${activeAsset.assetKey}`}>Title</Label>
        <div className="flex gap-2">
          <Input
            id={`asset-title-${activeAsset.assetKey}`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Sprite title"
          />
          <Button type="button" variant="outline" onClick={() => void handleSaveTitle()} disabled={isSavingTitle}>
            {isSavingTitle ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </div>

      <div className="grid gap-4 rounded-[1.25rem] border border-border/70 bg-background/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Background remover</div>
            <div className="text-xs text-muted-foreground">
              {asset.sourceType === "input-image"
                ? "Saved only in the tester for this source image."
                : "Choose whether to save to the shared sprite asset, only to this setup, or to a forked sprite."}
            </div>
          </div>
          <Button
            type="button"
            variant={chromaEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setChromaEnabled((current) => !current)}
          >
            {chromaEnabled ? "Enabled" : "Disabled"}
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
          <Input
            type="color"
            value={localChromaKeyColor}
            onChange={(event) => setLocalChromaKeyColor(event.target.value)}
            disabled={!chromaEnabled}
            className="h-12 w-20 rounded-2xl p-2"
          />
          <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <div className="grid gap-2">
              <Label htmlFor={`chroma-threshold-${asset.assetKey}`}>Threshold</Label>
              <Input
                id={`chroma-threshold-${activeAsset.assetKey}`}
                type="number"
                min={0}
                max={255}
                value={localChromaKeyTolerance}
                onChange={(event) => setLocalChromaKeyTolerance(Number(event.target.value) || 0)}
                disabled={!chromaEnabled}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleDetectEdgeColor()}
              disabled={isDetectingEdgeColor}
            >
              {isDetectingEdgeColor ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Pipette className="h-4 w-4" />}
              Match edge
            </Button>
            <Button type="button" onClick={() => void handleSaveChroma()} disabled={isSavingChroma}>
              {isSavingChroma ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              Save key
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LevelTesterShell({
  initialSprites,
  initialJobs,
  initialSetups,
  initialAssetKey,
}: {
  initialSprites: SpriteAsset[];
  initialJobs: JobManifest[];
  initialSetups: TesterSetup[];
  initialAssetKey?: string | null;
}) {
  const [sprites, setSprites] = useState(initialSprites);
  const [jobs, setJobs] = useState(initialJobs);
  const [setups, setSetups] = useState(initialSetups);
  const [activeSetupId, setActiveSetupId] = useState<string | null>(initialAssetKey ? null : initialSetups[0]?.setupId ?? null);
  const [setupTitleInput, setSetupTitleInput] = useState(initialSetups[0]?.title ?? "Default tester setup");
  const [isSavingSetup, setIsSavingSetup] = useState(false);
  const [isCreatingSetup, setIsCreatingSetup] = useState(false);
  const [isForkingSetup, setIsForkingSetup] = useState(false);
  const [isArchivingSetup, setIsArchivingSetup] = useState(false);
  const [pendingChromaSave, setPendingChromaSave] = useState<PendingChromaSave | null>(null);
  const [isApplyingSaveScope, setIsApplyingSaveScope] = useState(false);
  const [pendingMainAssetKey, setPendingMainAssetKey] = useState<string | null>(null);
  const hasLoadedLegacyDraftRef = useRef(false);
  const testerAssets = useMemo(() => buildTesterAssets(sprites, jobs), [jobs, sprites]);
  const activeSetup = setups.find((setup) => setup.setupId === activeSetupId) ?? null;
  const [draftConfig, setDraftConfig] = useState<SpriteTesterConfig>(() =>
    buildInitialDraftConfig(initialSprites, initialJobs, initialSetups, initialAssetKey),
  );
  const spriteConfigs = useMemo(
    () => normalizeStoredConfigs(testerAssets, draftConfig),
    [draftConfig, testerAssets],
  );
  const testerAssetLookup = useMemo(
    () => new Map(testerAssets.map((asset) => [asset.assetKey, asset])),
    [testerAssets],
  );
  const defaultAsset = useMemo(
    () => testerAssetLookup.get(spriteConfigs.default.assetKey) ?? null,
    [spriteConfigs.default.assetKey, testerAssetLookup],
  );
  const selectedAssets = useMemo(
    () =>
      Object.fromEntries(
        SPRITE_STATES.map((state) => {
          const overrideKey = spriteConfigs.states[state].assetKey;
          return [state, (overrideKey ? testerAssetLookup.get(overrideKey) : null) ?? defaultAsset];
        }),
      ) as Record<SpriteMotionState, TesterAssetOption | null>,
    [defaultAsset, spriteConfigs.states, testerAssetLookup],
  );
  const playableSpritesByState = useMemo(
    () =>
      Object.fromEntries(
        SPRITE_STATES.flatMap((state) => {
          const asset = selectedAssets[state];

          if (!asset) {
            return [];
          }

          const config = spriteConfigs.states[state];
          const assetOverride = spriteConfigs.assetOverrides[asset.assetKey];
          const chromaKeyColor = assetOverride?.chromaKeyColor ?? asset.chromaKeyColor;
          const chromaKeyTolerance = assetOverride?.chromaKeyTolerance ?? asset.chromaKeyTolerance;
          const playableConfig: PlayableSpriteStateConfig = {
            id: `${state}:${asset.assetKey}:${config.scale ?? "default"}:${config.sourceOrientation ?? "default"}:${chromaKeyColor ?? "none"}:${chromaKeyTolerance}`,
            imageAssetPath: asset.spritesheetAssetPath,
            cellWidth: asset.sourceType === "input-image" ? asset.imageWidth : asset.cellWidth,
            cellHeight: asset.sourceType === "input-image" ? asset.imageHeight : asset.cellHeight,
            fps: clampFps(config.fps ?? spriteConfigs.default.fps, spriteConfigs.default.fps),
            frameCount: Math.max(asset.frameCount, 1),
            selectedFrameNumbers: asset.selectedFrameNumbers,
            scale: clampScale(config.scale ?? spriteConfigs.default.scale),
            sourceOrientation: normalizeOrientation(
              config.sourceOrientation ?? spriteConfigs.default.sourceOrientation,
            ),
            chromaKeyColor,
            chromaKeyTolerance,
          };

          return [[state, playableConfig] as const];
        }),
      ) as Partial<Record<SpriteMotionState, PlayableSpriteStateConfig>>,
    [selectedAssets, spriteConfigs.assetOverrides, spriteConfigs.default, spriteConfigs.states],
  );

  function updateTesterConfig(update: (current: SpriteTesterConfig) => SpriteTesterConfig) {
    setDraftConfig((current) => update(normalizeStoredConfigs(testerAssets, current)));
  }

  useEffect(() => {
    if (activeSetup) {
      setDraftConfig(normalizeStoredConfigs(testerAssets, setupToConfig(activeSetup)));
      setSetupTitleInput(activeSetup.title);
      return;
    }

    setDraftConfig((current) => normalizeStoredConfigs(testerAssets, current));
  }, [activeSetup, testerAssets]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(TESTER_CONFIG_STORAGE_KEY, JSON.stringify(spriteConfigs));
  }, [spriteConfigs]);

  useEffect(() => {
    if (activeSetup || initialAssetKey || hasLoadedLegacyDraftRef.current) {
      return;
    }

    const legacyDraft = getLegacyDraftConfig();

    if (!legacyDraft) {
      hasLoadedLegacyDraftRef.current = true;
      return;
    }

    hasLoadedLegacyDraftRef.current = true;
    setDraftConfig(normalizeStoredConfigs(testerAssets, legacyDraft));
  }, [activeSetup, initialAssetKey, testerAssets]);

  function updateStateSelection(state: SpriteMotionState, assetKey: string) {
    const asset = testerAssetLookup.get(assetKey);

    updateTesterConfig((current) => ({
      ...current,
      states: {
        ...current.states,
        [state]: {
          ...current.states[state],
          assetKey,
          fps: clampFps(current.states[state]?.fps ?? asset?.playbackFps ?? current.default.fps, current.default.fps),
        },
      },
    }));
  }

  function updateStateFps(state: SpriteMotionState, fps: number) {
    updateTesterConfig((current) => ({
      ...current,
      states: {
        ...current.states,
        [state]: {
          ...current.states[state],
          fps: clampFps(fps, current.default.fps),
        },
      },
    }));
  }

  function updateStateScale(state: SpriteMotionState, scale: number) {
    updateTesterConfig((current) => ({
      ...current,
      states: {
        ...current.states,
        [state]: {
          ...current.states[state],
          scale: clampScale(scale),
        },
      },
    }));
  }

  function updateStateOrientation(state: SpriteMotionState, orientation: SpriteOrientation) {
    updateTesterConfig((current) => ({
      ...current,
      states: {
        ...current.states,
        [state]: {
          ...current.states[state],
          sourceOrientation: orientation,
        },
      },
    }));
  }

  function updateDefaultFps(fps: number) {
    updateTesterConfig((current) => ({
      ...current,
      default: {
        ...current.default,
        fps: clampFps(fps, current.default.fps),
      },
    }));
  }

  function updateDefaultScale(scale: number) {
    updateTesterConfig((current) => ({
      ...current,
      default: {
        ...current.default,
        scale: clampScale(scale),
      },
    }));
  }

  function updateDefaultOrientation(sourceOrientation: SpriteOrientation) {
    updateTesterConfig((current) => ({
      ...current,
      default: {
        ...current.default,
        sourceOrientation,
      },
    }));
  }

  function clearStateOverride(state: SpriteMotionState) {
    updateTesterConfig((current) => ({
      ...current,
      states: {
        ...current.states,
        [state]: {
          assetKey: null,
          fps: null,
          scale: null,
          sourceOrientation: null,
        },
      },
    }));
  }

  function enableStateOverride(state: SpriteMotionState) {
    const inheritedAsset = selectedAssets[state];

    updateTesterConfig((current) => ({
      ...current,
      states: {
        ...current.states,
        [state]: {
          assetKey: inheritedAsset?.assetKey ?? current.default.assetKey,
          fps: clampFps(current.default.fps, current.default.fps),
          scale: clampScale(current.default.scale),
          sourceOrientation: current.default.sourceOrientation,
        },
      },
    }));
  }

  function applyPendingMainSelection(resetStateAssets: boolean) {
    if (!pendingMainAssetKey) {
      return;
    }

    const asset = testerAssetLookup.get(pendingMainAssetKey);

    updateTesterConfig((current) => ({
      ...current,
      default: {
        ...current.default,
        assetKey: pendingMainAssetKey,
        fps: clampFps(current.default.fps ?? asset?.playbackFps ?? 8, asset?.playbackFps ?? 8),
      },
      states: Object.fromEntries(
        SPRITE_STATES.map((state) => [
          state,
          resetStateAssets
            ? {
                ...current.states[state],
                assetKey: null,
              }
            : current.states[state],
        ]),
      ) as SpriteTesterConfig["states"],
    }));
    setPendingMainAssetKey(null);
  }

  async function saveAssetTitle(asset: TesterAssetOption, title: string) {
    if (!title) {
      toast.error("Title is required.");
      return;
    }

    try {
      if (asset.spriteId) {
        const response = await fetch(`/api/sprites/${asset.spriteId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to update sprite title.");
        }

        setSprites((current) =>
          current.map((sprite) => (sprite.spriteId === data.sprite.spriteId ? data.sprite : sprite)),
        );
      } else if (asset.jobId) {
        const response = await fetch(`/api/jobs/${asset.jobId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to update source image title.");
        }

        setJobs((current) => current.map((job) => (job.jobId === data.job.jobId ? data.job : job)));
      }

      toast.success("Title updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update title.");
    }
  }

  async function saveAssetChroma(
    asset: TesterAssetOption,
    chromaKeyColor: string | null,
    chromaKeyTolerance: number,
  ) {
    try {
      if (asset.spriteId) {
        setPendingChromaSave({ asset, chromaKeyColor, chromaKeyTolerance });
      } else {
        updateTesterConfig((current) => ({
          ...current,
          assetOverrides: {
            ...current.assetOverrides,
            [asset.assetKey]: {
              chromaKeyColor,
              chromaKeyTolerance,
            },
          },
        }));
        toast.success("Background remover updated.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update background remover.");
    }
  }

  async function applyChromaToSpriteAsset(
    asset: TesterAssetOption,
    chromaKeyColor: string | null,
    chromaKeyTolerance: number,
  ) {
    if (!asset.spriteId) {
      return;
    }

    const response = await fetch(`/api/sprites/${asset.spriteId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chromaKeyColor,
        chromaKeyTolerance,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? "Unable to update sprite background remover.");
    }

    setSprites((current) =>
      current.map((sprite) => (sprite.spriteId === data.sprite.spriteId ? data.sprite : sprite)),
    );
  }

  function applyChromaToSetupOnly(
    asset: TesterAssetOption,
    chromaKeyColor: string | null,
    chromaKeyTolerance: number,
  ) {
    updateTesterConfig((current) => ({
      ...current,
      assetOverrides: {
        ...current.assetOverrides,
        [asset.assetKey]: {
          chromaKeyColor,
          chromaKeyTolerance,
        },
      },
    }));
  }

  function replaceAssetKeyInSetup(current: SpriteTesterConfig, fromAssetKey: string, toAssetKey: string) {
    return {
      ...current,
      default: {
        ...current.default,
        assetKey: current.default.assetKey === fromAssetKey ? toAssetKey : current.default.assetKey,
      },
      states: Object.fromEntries(
        SPRITE_STATES.map((state) => [
          state,
          {
            ...current.states[state],
            assetKey: current.states[state].assetKey === fromAssetKey ? toAssetKey : current.states[state].assetKey,
          },
        ]),
      ) as SpriteTesterConfig["states"],
      assetOverrides: Object.fromEntries(
        Object.entries(current.assetOverrides).map(([assetKey, override]) => [
          assetKey === fromAssetKey ? toAssetKey : assetKey,
          override,
        ]),
      ),
    };
  }

  async function handleSaveScopeToAsset() {
    if (!pendingChromaSave) {
      return;
    }

    setIsApplyingSaveScope(true);

    try {
      await applyChromaToSpriteAsset(
        pendingChromaSave.asset,
        pendingChromaSave.chromaKeyColor,
        pendingChromaSave.chromaKeyTolerance,
      );
      setPendingChromaSave(null);
      toast.success("Background remover updated on the sprite asset.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update sprite background remover.");
    } finally {
      setIsApplyingSaveScope(false);
    }
  }

  async function handleSaveScopeToSetupOnly() {
    if (!pendingChromaSave) {
      return;
    }

    setIsApplyingSaveScope(true);

    try {
      applyChromaToSetupOnly(
        pendingChromaSave.asset,
        pendingChromaSave.chromaKeyColor,
        pendingChromaSave.chromaKeyTolerance,
      );
      setPendingChromaSave(null);
      toast.success("Background remover saved only to this tester setup.");
    } finally {
      setIsApplyingSaveScope(false);
    }
  }

  async function handleSaveScopeForkAndUse() {
    if (!pendingChromaSave || !pendingChromaSave.asset.spriteId) {
      return;
    }

    setIsApplyingSaveScope(true);

    try {
      const forkResponse = await fetch(`/api/sprites/${pendingChromaSave.asset.spriteId}/fork`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const forkData = await forkResponse.json();

      if (!forkResponse.ok) {
        throw new Error(forkData.error ?? "Unable to fork sprite.");
      }

      const forkedSprite = forkData.sprite as SpriteAsset;

      setSprites((current) => [forkedSprite, ...current]);

      await applyChromaToSpriteAsset(
        {
          ...pendingChromaSave.asset,
          assetKey: `sprite:${forkedSprite.spriteId}`,
          spriteId: forkedSprite.spriteId,
        },
        pendingChromaSave.chromaKeyColor,
        pendingChromaSave.chromaKeyTolerance,
      );

      updateTesterConfig((current) =>
        replaceAssetKeyInSetup(current, pendingChromaSave.asset.assetKey, `sprite:${forkedSprite.spriteId}`),
      );
      setPendingChromaSave(null);
      toast.success("Forked sprite created and assigned to this tester setup.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to fork sprite for this tester setup.");
    } finally {
      setIsApplyingSaveScope(false);
    }
  }

  async function handleCreateSetup() {
    if (!spriteConfigs.default.assetKey) {
      toast.error("Choose a default asset before saving a tester setup.");
      return;
    }

    setIsCreatingSetup(true);

    try {
      const response = await fetch("/api/tester-setups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(configToSetupInput(setupTitleInput.trim() || "Tester setup", null, spriteConfigs)),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to create tester setup.");
      }

      setSetups((current) => [data.setup, ...current]);
      setActiveSetupId(data.setup.setupId);
      setSetupTitleInput(data.setup.title);
      toast.success("Tester setup created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create tester setup.");
    } finally {
      setIsCreatingSetup(false);
    }
  }

  async function handleSaveSetup() {
    if (!activeSetup) {
      await handleCreateSetup();
      return;
    }

    setIsSavingSetup(true);

    try {
      const response = await fetch(`/api/tester-setups/${activeSetup.setupId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          configToSetupInput(setupTitleInput.trim() || activeSetup.title, activeSetup.projectId, spriteConfigs),
        ),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to save tester setup.");
      }

      setSetups((current) =>
        current.map((setup) => (setup.setupId === data.setup.setupId ? data.setup : setup)),
      );
      setSetupTitleInput(data.setup.title);
      toast.success("Tester setup saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save tester setup.");
    } finally {
      setIsSavingSetup(false);
    }
  }

  async function handleForkSetup() {
    if (!activeSetup) {
      toast.error("Create a setup first before forking it.");
      return;
    }

    setIsForkingSetup(true);

    try {
      const response = await fetch(`/api/tester-setups/${activeSetup.setupId}/fork`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: `${setupTitleInput.trim() || activeSetup.title} (Copy)` }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to fork tester setup.");
      }

      setSetups((current) => [data.setup, ...current]);
      setActiveSetupId(data.setup.setupId);
      setSetupTitleInput(data.setup.title);
      toast.success("Tester setup forked.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to fork tester setup.");
    } finally {
      setIsForkingSetup(false);
    }
  }

  async function handleArchiveSetup() {
    if (!activeSetup) {
      toast.error("Select a setup to archive.");
      return;
    }

    const confirmed = window.confirm(`Archive "${activeSetup.title}"?`);

    if (!confirmed) {
      return;
    }

    setIsArchivingSetup(true);

    try {
      const response = await fetch(`/api/tester-setups/${activeSetup.setupId}/archive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ archived: true }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to archive tester setup.");
      }

      const nextSetups = setups.filter((setup) => setup.setupId !== data.setup.setupId);
      setSetups(nextSetups);
      setActiveSetupId(nextSetups[0]?.setupId ?? null);
      if (nextSetups.length === 0) {
        setSetupTitleInput("Default tester setup");
      }
      toast.success("Tester setup archived.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to archive tester setup.");
    } finally {
      setIsArchivingSetup(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="h-fit overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-background/50">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <Gamepad2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <CardTitle>Level Tester</CardTitle>
              <CardDescription>Choose sprites, tune each motion state, and run around a tiny platform scene.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-4 rounded-[1.5rem] border border-border/70 bg-background/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Tester Setup</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Saved setups persist the selected assets, motion overrides, and tester-only chroma settings.
                </p>
              </div>
              <Badge variant="secondary">{activeSetup ? "Saved setup" : "Unsaved draft"}</Badge>
            </div>

            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="tester-setup-select">Active setup</Label>
                <Select
                  value={activeSetupId ?? "__draft__"}
                  onValueChange={(value) => setActiveSetupId(value === "__draft__" ? null : value)}
                >
                  <SelectTrigger id="tester-setup-select">
                    <SelectValue placeholder="Choose a saved setup" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__draft__">Unsaved draft</SelectItem>
                    {setups.map((setup) => (
                      <SelectItem key={setup.setupId} value={setup.setupId}>
                        {setup.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tester-setup-title">Setup name</Label>
                <Input
                  id="tester-setup-title"
                  value={setupTitleInput}
                  onChange={(event) => setSetupTitleInput(event.target.value)}
                  placeholder="Forest hero traversal test"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void handleSaveSetup()} disabled={isSavingSetup || isCreatingSetup}>
                  {(isSavingSetup || isCreatingSetup) ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  {activeSetup ? "Save setup" : "Create setup"}
                </Button>
                <Button type="button" variant="outline" onClick={() => void handleForkSetup()} disabled={!activeSetup || isForkingSetup}>
                  {isForkingSetup ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  Fork setup
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleArchiveSetup()}
                  disabled={!activeSetup || isArchivingSetup}
                >
                  {isArchivingSetup ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  Archive setup
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-[1.5rem] border border-border/70 bg-background/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Main Sprite</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Shared default used by every state unless that state overrides it.
                </p>
              </div>
              <Badge variant="secondary">Default</Badge>
            </div>

            {pendingMainAssetKey ? (
              <div className="space-y-3 rounded-[1.25rem] border border-primary/30 bg-primary/5 p-4">
                <p className="text-sm font-medium">Use the new main sprite for other animations too?</p>
                <p className="text-sm text-muted-foreground">
                  Keep state overrides, or reset idle, walking, and jumping to inherit this new main sprite.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => applyPendingMainSelection(false)}>
                    Keep overrides
                  </Button>
                  <Button type="button" variant="outline" onClick={() => applyPendingMainSelection(true)}>
                    Use for all animations
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setPendingMainAssetKey(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="flex gap-3 overflow-x-auto pb-1">
              {testerAssets.map((asset) => {
                const isSelected = spriteConfigs.default.assetKey === asset.assetKey;

                return (
                  <button
                    key={`default-${asset.assetKey}`}
                    type="button"
                    onClick={() => {
                      if (asset.assetKey !== spriteConfigs.default.assetKey) {
                        setPendingMainAssetKey(asset.assetKey);
                      }
                    }}
                    className={`w-32 shrink-0 rounded-[1.25rem] border p-2 text-left transition ${
                      isSelected
                        ? "border-primary bg-primary/8 shadow-[0_0_0_1px_rgba(59,130,246,0.15)]"
                        : "border-border/70 bg-background/70 hover:bg-secondary/60"
                    }`}
                  >
                    <div className="relative aspect-square overflow-hidden rounded-[0.9rem] border border-border/60 bg-secondary/30">
                      <SpritePreviewTile
                        assetPath={asset.previewMimeType === "image/gif" ? asset.previewAssetPath : asset.spritesheetAssetPath}
                        mimeType={asset.previewMimeType}
                        imageWidth={asset.imageWidth}
                        imageHeight={asset.imageHeight}
                        cellWidth={asset.cellWidth}
                        cellHeight={asset.cellHeight}
                        frameCount={asset.frameCount}
                        selectedFrameNumbers={asset.selectedFrameNumbers}
                        fps={asset.playbackFps}
                        animate={asset.animatedPreviewAvailable}
                        alt={asset.title}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-medium">{asset.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatSourceTypeLabel(asset.sourceType)}</p>
                  </button>
                );
              })}
            </div>

            {defaultAsset ? (
              <AssetEditor
                asset={defaultAsset}
                chromaKeyColor={
                  defaultAsset.sourceType === "input-image"
                    ? spriteConfigs.assetOverrides[defaultAsset.assetKey]?.chromaKeyColor ?? null
                    : defaultAsset.chromaKeyColor
                }
                chromaKeyTolerance={
                  defaultAsset.sourceType === "input-image"
                    ? spriteConfigs.assetOverrides[defaultAsset.assetKey]?.chromaKeyTolerance ?? 32
                    : defaultAsset.chromaKeyTolerance
                }
                onSaveTitle={saveAssetTitle}
                onSaveChroma={saveAssetChroma}
              />
            ) : null}

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="default-fps-slider">Playback FPS</Label>
                <Badge variant="secondary">{spriteConfigs.default.fps} FPS</Badge>
              </div>
              <Slider
                id="default-fps-slider"
                min={1}
                max={24}
                step={1}
                value={[spriteConfigs.default.fps]}
                onValueChange={(value) => updateDefaultFps(value[0] ?? spriteConfigs.default.fps)}
                disabled={!defaultAsset}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="default-scale-slider">Sprite Scale</Label>
                <Badge variant="secondary">{spriteConfigs.default.scale.toFixed(2)}x</Badge>
              </div>
              <Slider
                id="default-scale-slider"
                min={0.5}
                max={2}
                step={0.05}
                value={[spriteConfigs.default.scale]}
                onValueChange={(value) => updateDefaultScale(value[0] ?? spriteConfigs.default.scale)}
                disabled={!defaultAsset}
              />
            </div>

            <div className="space-y-2">
              <Label>Main Source Orientation</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["right", "left"] as const).map((orientation) => (
                  <button
                    key={`default-${orientation}`}
                    type="button"
                    onClick={() => updateDefaultOrientation(orientation)}
                    className={`rounded-2xl border px-4 py-3 text-sm transition ${
                      spriteConfigs.default.sourceOrientation === orientation
                        ? "border-primary bg-primary/8 text-foreground"
                        : "border-border/70 bg-background/70 text-muted-foreground hover:bg-secondary/60"
                    }`}
                  >
                    Sprite faces {orientation}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {SPRITE_STATES.map((state) => {
            const selectedAsset = selectedAssets[state];
            const stateConfig = spriteConfigs.states[state];
            const isOverridden = Boolean(
              stateConfig.assetKey || stateConfig.fps !== null || stateConfig.scale !== null || stateConfig.sourceOrientation,
            );
            const effectiveFps = stateConfig.fps ?? spriteConfigs.default.fps;
            const effectiveScale = stateConfig.scale ?? spriteConfigs.default.scale;
            const effectiveOrientation = stateConfig.sourceOrientation ?? spriteConfigs.default.sourceOrientation;

            return (
              <div key={state} className="space-y-3 rounded-[1.5rem] border border-border/70 bg-background/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="capitalize">{state} Animation</Label>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isOverridden
                        ? selectedAsset?.sourceLabel ?? "Choose a sprite or input image"
                        : "Using the main sprite and playback settings"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => (isOverridden ? clearStateOverride(state) : enableStateOverride(state))}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      isOverridden
                        ? "border-primary bg-primary/8 text-foreground"
                        : "border-border/70 bg-background/70 text-muted-foreground hover:bg-secondary/60"
                    }`}
                  >
                    {isOverridden ? "Override enabled" : "Using main config"}
                  </button>
                </div>

                {isOverridden ? (
                  <>
                    <div className="flex gap-3 overflow-x-auto pb-1">
                      {testerAssets.map((asset) => {
                        const isSelected = stateConfig.assetKey === asset.assetKey;

                        return (
                          <button
                            key={`${state}-${asset.assetKey}`}
                            type="button"
                            onClick={() => updateStateSelection(state, asset.assetKey)}
                            className={`w-32 shrink-0 rounded-[1.25rem] border p-2 text-left transition ${
                              isSelected
                                ? "border-primary bg-primary/8 shadow-[0_0_0_1px_rgba(59,130,246,0.15)]"
                                : "border-border/70 bg-background/70 hover:bg-secondary/60"
                            }`}
                          >
                            <div className="relative aspect-square overflow-hidden rounded-[0.9rem] border border-border/60 bg-secondary/30">
                              <SpritePreviewTile
                                assetPath={asset.previewMimeType === "image/gif" ? asset.previewAssetPath : asset.spritesheetAssetPath}
                                mimeType={asset.previewMimeType}
                                imageWidth={asset.imageWidth}
                                imageHeight={asset.imageHeight}
                                cellWidth={asset.cellWidth}
                                cellHeight={asset.cellHeight}
                                frameCount={asset.frameCount}
                                selectedFrameNumbers={asset.selectedFrameNumbers}
                                fps={asset.playbackFps}
                                animate={asset.animatedPreviewAvailable}
                                alt={asset.title}
                                className="h-full w-full object-contain"
                              />
                            </div>
                            <p className="mt-2 line-clamp-2 text-sm font-medium">{asset.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{formatSourceTypeLabel(asset.sourceType)}</p>
                          </button>
                        );
                      })}
                    </div>

                    <AssetEditor
                      asset={selectedAsset}
                      chromaKeyColor={
                        selectedAsset?.sourceType === "input-image"
                          ? spriteConfigs.assetOverrides[selectedAsset.assetKey]?.chromaKeyColor ?? null
                          : selectedAsset?.chromaKeyColor ?? null
                      }
                      chromaKeyTolerance={
                        selectedAsset?.sourceType === "input-image"
                          ? spriteConfigs.assetOverrides[selectedAsset.assetKey]?.chromaKeyTolerance ?? 32
                          : selectedAsset?.chromaKeyTolerance ?? 32
                      }
                      onSaveTitle={saveAssetTitle}
                      onSaveChroma={saveAssetChroma}
                    />
                  </>
                ) : selectedAsset ? (
                  <div className="flex items-center gap-3 rounded-[1.25rem] border border-border/70 bg-background/60 p-3">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-secondary/30">
                      <SpritePreviewTile
                        assetPath={
                          selectedAsset.previewMimeType === "image/gif"
                            ? selectedAsset.previewAssetPath
                            : selectedAsset.spritesheetAssetPath
                        }
                        mimeType={selectedAsset.previewMimeType}
                        imageWidth={selectedAsset.imageWidth}
                        imageHeight={selectedAsset.imageHeight}
                        cellWidth={selectedAsset.cellWidth}
                        cellHeight={selectedAsset.cellHeight}
                        frameCount={selectedAsset.frameCount}
                        selectedFrameNumbers={selectedAsset.selectedFrameNumbers}
                        fps={selectedAsset.playbackFps}
                        animate={selectedAsset.animatedPreviewAvailable}
                        alt={selectedAsset.title}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{selectedAsset.title}</p>
                      <p className="text-xs text-muted-foreground">{formatSourceTypeLabel(selectedAsset.sourceType)}</p>
                      <p className="text-xs text-muted-foreground">
                        {getChromaKeySummary(
                          selectedAsset.sourceType === "input-image"
                            ? spriteConfigs.assetOverrides[selectedAsset.assetKey]?.chromaKeyColor ?? null
                            : selectedAsset.chromaKeyColor,
                          selectedAsset.sourceType === "input-image"
                            ? spriteConfigs.assetOverrides[selectedAsset.assetKey]?.chromaKeyTolerance ?? 32
                            : selectedAsset.chromaKeyTolerance,
                        )}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor={`${state}-fps-slider`}>Playback FPS</Label>
                    <Badge variant="secondary">{effectiveFps} FPS</Badge>
                  </div>
                  <Slider
                    id={`${state}-fps-slider`}
                    min={1}
                    max={24}
                    step={1}
                    value={[effectiveFps]}
                    onValueChange={(value) => updateStateFps(state, value[0] ?? effectiveFps)}
                    disabled={!isOverridden || !selectedAsset}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor={`${state}-scale-slider`}>Sprite Scale</Label>
                    <Badge variant="secondary">{effectiveScale.toFixed(2)}x</Badge>
                  </div>
                  <Slider
                    id={`${state}-scale-slider`}
                    min={0.5}
                    max={2}
                    step={0.05}
                    value={[effectiveScale]}
                    onValueChange={(value) => updateStateScale(state, value[0] ?? effectiveScale)}
                    disabled={!isOverridden || !selectedAsset}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="capitalize">{state} Source Orientation</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["right", "left"] as const).map((orientation) => (
                      <button
                        key={`${state}-${orientation}`}
                        type="button"
                        onClick={() => updateStateOrientation(state, orientation)}
                        disabled={!isOverridden || !selectedAsset}
                        className={`rounded-2xl border px-4 py-3 text-sm transition ${
                          effectiveOrientation === orientation
                            ? "border-primary bg-primary/8 text-foreground"
                            : "border-border/70 bg-background/70 text-muted-foreground hover:bg-secondary/60"
                        }`}
                      >
                        Sprite faces {orientation}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="rounded-[1.5rem] border border-border/70 bg-background/60 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MoveHorizontal className="h-4 w-4 text-primary" />
              Controls
            </div>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <p>`Left` and `Right` move across the platforms.</p>
              <p>`Up` or `Space` jumps.</p>
              <p>`R` resets the level instantly.</p>
              <p>The scene is fixed so you can compare motion, scale, facing, and background removal quickly.</p>
            </div>
          </div>

          {testerAssets.length > 0 ? (
            <div className="rounded-[1.5rem] border border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
              {SPRITE_STATES.map((state) => {
                const asset = selectedAssets[state];
                const isOverridden = Boolean(
                  spriteConfigs.states[state].assetKey ||
                    spriteConfigs.states[state].fps !== null ||
                    spriteConfigs.states[state].scale !== null ||
                    spriteConfigs.states[state].sourceOrientation,
                );
                const summary = asset ? `${asset.title} · ${Math.max(asset.frameCount, 1)} frames` : "Not selected";

                return (
                  <p key={state}>
                    <span className="font-medium capitalize text-foreground">{state}:</span>{" "}
                    {isOverridden ? `${summary} · override` : `${summary} · main config`}
                  </p>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/40 p-4 text-sm text-muted-foreground">
              No sprites or input images are available yet. Generate an image or add a sprite in the library first.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-background/50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Playable Preview</CardTitle>
              <CardDescription>
                A simple platform room with a few jumps so you can check motion, readability, and facing behavior.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => window.dispatchEvent(new CustomEvent("level-tester-reset"))}
            >
              <RotateCcw className="h-4 w-4" />
              Reset level
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <PlayableLevelPreview spritesByState={playableSpritesByState} />
        </CardContent>
      </Card>

      <SaveScopeDialog
        open={Boolean(pendingChromaSave)}
        title="Choose Save Scope"
        description="Background removal changes can update the shared sprite asset, stay only inside this tester setup, or be applied to a forked sprite used by this setup."
        onSaveToAsset={() => void handleSaveScopeToAsset()}
        onSaveToSetupOnly={() => void handleSaveScopeToSetupOnly()}
        onForkAndUse={() => void handleSaveScopeForkAndUse()}
        onClose={() => setPendingChromaSave(null)}
        loading={isApplyingSaveScope}
      />
    </div>
  );
}
