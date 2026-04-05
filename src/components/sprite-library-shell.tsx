"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Check, Download, Import, LoaderCircle, Pipette, Upload } from "lucide-react";
import { toast } from "sonner";
import { AssetInspectorDrawer } from "@/components/asset-inspector-drawer";
import { EntityActionMenu } from "@/components/entity-action-menu";
import { EntityToolbar } from "@/components/entity-toolbar";
import { PhaserSpritePlayer } from "@/components/phaser-sprite-player";
import { SpriteInspectorContent } from "@/components/sprite-inspector-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  DEFAULT_SPRITE_CELL_HEIGHT,
  DEFAULT_SPRITE_CELL_WIDTH,
  DEFAULT_SPRITE_PLAYBACK_FPS,
} from "@/lib/config";
import type { JobManifest, SpriteAsset } from "@/lib/types";

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function formatTimestamp(value: string) {
  return `${timestampFormatter.format(new Date(value))} UTC`;
}

async function detectMostCommonEdgeColor(imageAssetPath: string) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new window.Image();
    nextImage.crossOrigin = "anonymous";
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error("Unable to load sprite image for edge color detection."));
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

  const [color] =
    [...samples.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];

  if (!color) {
    return "#00ff00";
  }

  const [red, green, blue] = color.split(",").map(Number);
  return `#${[red, green, blue]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function SpriteLibraryShell({
  initialSprites,
  generatedJobs,
}: {
  initialSprites: SpriteAsset[];
  generatedJobs: JobManifest[];
}) {
  const [sprites, setSprites] = useState(initialSprites);
  const [activeSpriteId, setActiveSpriteId] = useState(initialSprites[0]?.spriteId ?? null);
  const [inspectedSpriteId, setInspectedSpriteId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImportingJobId, setIsImportingJobId] = useState<string | null>(null);
  const [isDetectingEdgeColor, setIsDetectingEdgeColor] = useState(false);
  const [isExportingGif, setIsExportingGif] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "generated" | "uploaded">("all");
  const [sortMode, setSortMode] = useState<"recent" | "title" | "usage">("recent");
  const [activeTitle, setActiveTitle] = useState(initialSprites[0]?.title ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadCellWidth, setUploadCellWidth] = useState(DEFAULT_SPRITE_CELL_WIDTH);
  const [uploadCellHeight, setUploadCellHeight] = useState(DEFAULT_SPRITE_CELL_HEIGHT);
  const activeSprite = sprites.find((sprite) => sprite.spriteId === activeSpriteId) ?? null;
  const inspectedSprite = sprites.find((sprite) => sprite.spriteId === inspectedSpriteId) ?? null;
  const [cellWidth, setCellWidth] = useState(activeSprite?.cellWidth ?? DEFAULT_SPRITE_CELL_WIDTH);
  const [cellHeight, setCellHeight] = useState(activeSprite?.cellHeight ?? DEFAULT_SPRITE_CELL_HEIGHT);
  const [frameCount, setFrameCount] = useState(activeSprite?.frameCount ?? 1);
  const [playbackFps, setPlaybackFps] = useState(activeSprite?.playbackFps ?? DEFAULT_SPRITE_PLAYBACK_FPS);
  const [chromaKeyColor, setChromaKeyColor] = useState(activeSprite?.chromaKeyColor ?? "#00ff00");
  const [chromaKeyEnabled, setChromaKeyEnabled] = useState(Boolean(activeSprite?.chromaKeyColor));
  const [chromaKeyTolerance, setChromaKeyTolerance] = useState(activeSprite?.chromaKeyTolerance ?? 32);

  const frameGrid = useMemo(() => {
    if (!activeSprite) return null;

    const columns = Math.floor(activeSprite.imageWidth / cellWidth);
    const rows = Math.floor(activeSprite.imageHeight / cellHeight);
    const isValid =
      cellWidth > 0 &&
      cellHeight > 0 &&
      activeSprite.imageWidth % cellWidth === 0 &&
      activeSprite.imageHeight % cellHeight === 0 &&
      columns > 0 &&
      rows > 0;

    return {
      columns,
      rows,
      frameCount: columns * rows,
      isValid,
    };
  }, [activeSprite, cellHeight, cellWidth]);
  const previewFrameCount = useMemo(() => {
    if (!activeSprite || !frameGrid) {
      return 0;
    }

    return Math.min(frameCount, frameGrid.frameCount);
  }, [frameCount, activeSprite, frameGrid]);

  const generatedLibraryMap = useMemo(
    () =>
      new Map(
        sprites
          .filter((sprite) => sprite.sourceType === "generated" && sprite.originalJobId)
          .map((sprite) => [sprite.originalJobId!, sprite]),
      ),
    [sprites],
  );
  const importableGeneratedJobs = useMemo(
    () => generatedJobs.filter((job) => !generatedLibraryMap.has(job.jobId)),
    [generatedJobs, generatedLibraryMap],
  );
  const filteredSprites = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const nextSprites = sprites.filter((sprite) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        sprite.title.toLowerCase().includes(normalizedQuery) ||
        (sprite.originalJobId?.toLowerCase().includes(normalizedQuery) ?? false);
      const matchesSource = sourceFilter === "all" ? true : sprite.sourceType === sourceFilter;

      return matchesQuery && matchesSource;
    });

    return nextSprites.sort((left, right) => {
      if (sortMode === "title") {
        return left.title.localeCompare(right.title);
      }

      if (sortMode === "usage") {
        return right.usageCount - left.usageCount || right.updatedAt.localeCompare(left.updatedAt);
      }

      return right.updatedAt.localeCompare(left.updatedAt);
    });
  }, [searchQuery, sortMode, sourceFilter, sprites]);

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!imageFile) {
      toast.error("Choose a sprite sheet image first.");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.set("title", uploadTitle || imageFile.name);
    formData.set("image", imageFile);
    formData.set("cellWidth", String(uploadCellWidth));
    formData.set("cellHeight", String(uploadCellHeight));

    try {
      const response = await fetch("/api/sprites", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to upload sprite.");
      }

      setSprites((current) => [data.sprite, ...current]);
      setActiveSpriteId(data.sprite.spriteId);
      setUploadTitle("");
      setImageFile(null);
      setUploadCellWidth(DEFAULT_SPRITE_CELL_WIDTH);
      setUploadCellHeight(DEFAULT_SPRITE_CELL_HEIGHT);
      const imageInput = document.getElementById("sprite-upload") as HTMLInputElement | null;
      if (imageInput) imageInput.value = "";
      toast.success("Sprite uploaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to upload sprite.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSaveSprite() {
    if (!activeSprite) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/sprites/${activeSprite.spriteId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: activeTitle,
          cellWidth,
          cellHeight,
          frameCount,
          playbackFps,
          chromaKeyColor: chromaKeyEnabled ? chromaKeyColor : null,
          chromaKeyTolerance,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to save sprite settings.");
      }

      setSprites((current) =>
        current.map((sprite) => (sprite.spriteId === data.sprite.spriteId ? data.sprite : sprite)),
      );
      toast.success("Sprite settings saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save sprite settings.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleImportGenerated(jobId: string) {
    setIsImportingJobId(jobId);

    try {
      const response = await fetch("/api/sprites/import-generated", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobId }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to import generated sprite.");
      }

      setSprites((current) => {
        const withoutOld = current.filter((sprite) => sprite.spriteId !== data.sprite.spriteId);
        return [data.sprite, ...withoutOld];
      });
      setActiveSpriteId(data.sprite.spriteId);
      toast.success("Generated sprite added to the library.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to import generated sprite.");
    } finally {
      setIsImportingJobId(null);
    }
  }

  async function handleDetectEdgeColor() {
    if (!activeSprite) {
      return;
    }

    setIsDetectingEdgeColor(true);

    try {
      const nextColor = await detectMostCommonEdgeColor(activeSprite.imageAssetPath);
      setChromaKeyEnabled(true);
      setChromaKeyColor(nextColor);
      toast.success("Matched the most common edge color.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to detect edge color.");
    } finally {
      setIsDetectingEdgeColor(false);
    }
  }

  async function handleExportGif() {
    if (!activeSprite) {
      return;
    }

    setIsExportingGif(true);

    try {
      const saveResponse = await fetch(`/api/sprites/${activeSprite.spriteId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: activeTitle,
          cellWidth,
          cellHeight,
          frameCount,
          playbackFps,
          chromaKeyColor: chromaKeyEnabled ? chromaKeyColor : null,
          chromaKeyTolerance,
        }),
      });
      const saveData = await saveResponse.json();

      if (!saveResponse.ok) {
        throw new Error(saveData.error ?? "Unable to save sprite settings before GIF export.");
      }

      const exportResponse = await fetch(`/api/sprites/${activeSprite.spriteId}/gif`, {
        method: "POST",
      });
      const exportData = await exportResponse.json();

      if (!exportResponse.ok) {
        throw new Error(exportData.error ?? "Unable to export GIF.");
      }

      setSprites((current) =>
        current.map((sprite) => (sprite.spriteId === exportData.sprite.spriteId ? exportData.sprite : sprite)),
      );
      toast.success("GIF exported.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to export GIF.");
    } finally {
      setIsExportingGif(false);
    }
  }

  async function handleRenameSprite(sprite: SpriteAsset) {
    const nextTitle = window.prompt("Rename sprite", sprite.title)?.trim();

    if (!nextTitle || nextTitle === sprite.title) {
      return;
    }

    try {
      const response = await fetch(`/api/sprites/${sprite.spriteId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: nextTitle }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to rename sprite.");
      }

      setSprites((current) =>
        current.map((currentSprite) => (currentSprite.spriteId === data.sprite.spriteId ? data.sprite : currentSprite)),
      );
      toast.success("Sprite renamed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to rename sprite.");
    }
  }

  async function handleForkSprite(sprite: SpriteAsset) {
    try {
      const response = await fetch(`/api/sprites/${sprite.spriteId}/fork`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to fork sprite.");
      }

      setSprites((current) => [data.sprite, ...current]);
      setActiveSpriteId(data.sprite.spriteId);
      toast.success("Sprite forked.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to fork sprite.");
    }
  }

  async function handleArchiveSprite(sprite: SpriteAsset) {
    const confirmed = window.confirm(`Archive "${sprite.title}"?`);

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/sprites/${sprite.spriteId}/archive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ archived: true }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to archive sprite.");
      }

      const nextSprites = sprites.filter((currentSprite) => currentSprite.spriteId !== data.sprite.spriteId);
      setSprites(nextSprites);
      setActiveSpriteId((currentId) => (currentId === data.sprite.spriteId ? nextSprites[0]?.spriteId ?? null : currentId));
      toast.success("Sprite archived.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to archive sprite.");
    }
  }

  useEffect(() => {
    if (!activeSprite) return;
    setActiveTitle(activeSprite.title);
    setCellWidth(activeSprite.cellWidth);
    setCellHeight(activeSprite.cellHeight);
    setFrameCount(activeSprite.frameCount);
    setPlaybackFps(activeSprite.playbackFps);
    setChromaKeyEnabled(Boolean(activeSprite.chromaKeyColor));
    setChromaKeyColor(activeSprite.chromaKeyColor ?? "#00ff00");
    setChromaKeyTolerance(activeSprite.chromaKeyTolerance);
  }, [activeSprite]);

  return (
    <main className="flex min-h-screen flex-col gap-6">
      <EntityToolbar
        title="Library Browser"
        description="Search, filter, sort, and import persisted sprite assets. The inspector is now the cross-page management surface."
        actions={
          <>
            <Badge variant="secondary">{sprites.length} saved</Badge>
            <Badge variant="secondary">{importableGeneratedJobs.length} importable runs</Badge>
          </>
        }
        controls={
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_180px_180px]">
            <div className="grid gap-2">
              <Label htmlFor="library-search">Search sprites</Label>
              <Input
                id="library-search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by title or origin"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="library-source-filter">Source</Label>
              <Select value={sourceFilter} onValueChange={(value) => setSourceFilter(value as typeof sourceFilter)}>
                <SelectTrigger id="library-source-filter">
                  <SelectValue placeholder="All sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="generated">Generated</SelectItem>
                  <SelectItem value="uploaded">Uploaded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="library-sort-mode">Sort</Label>
              <Select value={sortMode} onValueChange={(value) => setSortMode(value as typeof sortMode)}>
                <SelectTrigger id="library-sort-mode">
                  <SelectValue placeholder="Sort mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Recently updated</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                  <SelectItem value="usage">Most used</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="overflow-hidden">
          <CardHeader className="gap-4 border-b border-border/60 bg-card/60">
            <Badge className="w-fit">Add To Library</Badge>
            <div className="space-y-2">
              <CardTitle className="text-3xl sm:text-4xl">Persisted sprite sheets</CardTitle>
              <CardDescription className="max-w-2xl text-base">
                Browse generated sprite sheets from the workbench or upload your own, then preview
                the animation with configurable cell dimensions.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form className="grid gap-4" onSubmit={handleUpload}>
              <div className="grid gap-2">
                <Label htmlFor="sprite-title">Title</Label>
                <Input
                  id="sprite-title"
                  value={uploadTitle}
                  onChange={(event) => setUploadTitle(event.target.value)}
                  placeholder="Hero idle sheet"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sprite-upload">Sprite sheet image</Label>
                <Input
                  id="sprite-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="upload-cell-width">Cell width</Label>
                  <Input
                    id="upload-cell-width"
                    type="number"
                    min={1}
                    value={uploadCellWidth}
                    onChange={(event) => setUploadCellWidth(Number(event.target.value) || 1)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="upload-cell-height">Cell height</Label>
                  <Input
                    id="upload-cell-height"
                    type="number"
                    min={1}
                    value={uploadCellHeight}
                    onChange={(event) => setUploadCellHeight(Number(event.target.value) || 1)}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full sm:w-fit" disabled={isUploading}>
                {isUploading ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Upload sprite sheet
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import From Generated Runs</CardTitle>
            <CardDescription>
              Import exported spritesheets from prior generation jobs into the library. Imported items then behave like any other sprite asset.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px] pr-3 md:h-[340px]">
              <div className="grid gap-3 sm:grid-cols-2">
                {generatedJobs.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                    Export a spritesheet from the generator page to make it available here.
                  </div>
                ) : null}

                {generatedJobs.map((job) => {
                  const existingSprite = generatedLibraryMap.get(job.jobId) ?? null;

                  return (
                    <div
                      key={job.jobId}
                      className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-background/70"
                    >
                      <div className="relative aspect-square">
                        <Image
                          src={job.spritesheet!.assetPath}
                          alt={`Generated sprite ${job.jobId}`}
                          fill
                          unoptimized
                          className="object-contain"
                        />
                      </div>
                      <div className="space-y-3 p-4">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">{job.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {job.spritesheet!.frameCount} frames • {job.spritesheet!.columns}x{job.spritesheet!.rows}
                          </div>
                        </div>
                        {existingSprite ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => setActiveSpriteId(existingSprite.spriteId)}
                          >
                            <Check className="h-4 w-4" />
                            Open in library
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            className="w-full"
                            onClick={() => void handleImportGenerated(job.jobId)}
                            disabled={isImportingJobId === job.jobId}
                          >
                            {isImportingJobId === job.jobId ? (
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : (
                              <Import className="h-4 w-4" />
                            )}
                            Add to sprite library
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle>Sprite Browser</CardTitle>
            <CardDescription>
              Generated exports and manual uploads are persisted under <code>data/sprites</code> and managed through one filtered browser.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px] pr-3 md:h-[340px]">
              <div className="grid gap-3">
                {filteredSprites.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                    No sprites match the current filters. Change the search/filter settings, import a generated run, or upload a new sheet.
                  </div>
                ) : null}

                {filteredSprites.map((sprite) => (
                  <div
                    key={sprite.spriteId}
                    className={`rounded-3xl border p-4 text-left transition ${
                      activeSpriteId === sprite.spriteId
                        ? "border-primary bg-primary/8"
                        : "border-border/70 bg-background/60 hover:bg-secondary/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button type="button" onClick={() => setActiveSpriteId(sprite.spriteId)} className="min-w-0 flex-1 text-left">
                        <span className="space-y-1">
                          <span className="block font-medium">{sprite.title}</span>
                          <span className="block text-xs text-muted-foreground">
                            {sprite.sourceType === "generated" ? "Generated" : "Uploaded"} •{" "}
                            {formatTimestamp(sprite.createdAt)}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {sprite.usageCount} uses
                            {sprite.originalJobId ? " • linked to generation run" : ""}
                          </span>
                        </span>
                      </button>
                      <div className="flex items-start gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                            activeSpriteId === sprite.spriteId
                              ? "border-transparent bg-primary/15 text-primary"
                              : "border-transparent bg-secondary text-secondary-foreground"
                          }`}
                        >
                          {sprite.frameCount} frames
                        </span>
                        <EntityActionMenu
                          entityLabel={`Sprite ${sprite.title}`}
                          onOpen={() => setActiveSpriteId(sprite.spriteId)}
                          onRename={() => void handleRenameSprite(sprite)}
                          onFork={() => void handleForkSprite(sprite)}
                          onArchive={() => void handleArchiveSprite(sprite)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Open inspector for ${sprite.title}`}
                          onClick={() => setInspectedSpriteId(sprite.spriteId)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Sprite detail</CardTitle>
                <CardDescription>Adjust per-sprite playback slicing before previewing the animation.</CardDescription>
              </div>
              {activeSprite ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setInspectedSpriteId(activeSprite.spriteId)}>
                  Open inspector
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {!activeSprite ? (
              <div className="rounded-3xl border border-dashed border-border p-10 text-center text-muted-foreground">
                Choose a sprite sheet to inspect it.
              </div>
            ) : (
              <>
                <div className="relative aspect-square overflow-hidden rounded-3xl border border-border/70 bg-secondary/50">
                  <Image
                    src={activeSprite.imageAssetPath}
                    alt={activeSprite.title}
                    fill
                    unoptimized
                    className="object-contain"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="active-sprite-title">Title</Label>
                  <Input
                    id="active-sprite-title"
                    value={activeTitle}
                    onChange={(event) => setActiveTitle(event.target.value)}
                    placeholder="Sprite title"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="cell-width">Cell width</Label>
                    <Input
                      id="cell-width"
                      type="number"
                      min={1}
                      value={cellWidth}
                      onChange={(event) => setCellWidth(Number(event.target.value) || 1)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="cell-height">Cell height</Label>
                    <Input
                      id="cell-height"
                      type="number"
                      min={1}
                      value={cellHeight}
                      onChange={(event) => setCellHeight(Number(event.target.value) || 1)}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="frame-count">Frame count</Label>
                  <Input
                    id="frame-count"
                    type="number"
                    min={1}
                    max={frameGrid?.frameCount ?? undefined}
                    value={frameCount}
                    onChange={(event) => setFrameCount(Number(event.target.value) || 1)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Max available from the current grid: {frameGrid?.frameCount ?? 0} frames.
                  </p>
                </div>
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="sprite-fps">Playback FPS</Label>
                    <div className="rounded-full bg-secondary px-3 py-1 text-sm font-medium">
                      {playbackFps} FPS
                    </div>
                  </div>
                  <Slider
                    id="sprite-fps"
                    min={1}
                    max={60}
                    step={1}
                    value={[playbackFps]}
                    onValueChange={(value) => setPlaybackFps(value[0] ?? DEFAULT_SPRITE_PLAYBACK_FPS)}
                  />
                </div>
                <div className="grid gap-4 rounded-3xl border border-border/70 bg-background/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">Chroma key</div>
                      <div className="text-xs text-muted-foreground">
                        Remove a picked color to transparency. Threshold controls how similar nearby colors are also removed.
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant={chromaKeyEnabled ? "default" : "outline"}
                      size="sm"
                      onClick={() => setChromaKeyEnabled((current) => !current)}
                    >
                      {chromaKeyEnabled ? "Enabled" : "Disabled"}
                    </Button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
                    <Input
                      type="color"
                      value={chromaKeyColor}
                      onChange={(event) => setChromaKeyColor(event.target.value)}
                      disabled={!chromaKeyEnabled}
                      className="h-12 w-20 rounded-2xl p-2"
                    />
                    <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                      <div className="grid gap-2">
                        <Label htmlFor="chroma-key-threshold">Threshold</Label>
                        <Input
                          id="chroma-key-threshold"
                          type="number"
                          min={0}
                          max={255}
                          value={chromaKeyTolerance}
                          onChange={(event) => setChromaKeyTolerance(Number(event.target.value) || 0)}
                          disabled={!chromaKeyEnabled}
                        />
                        <p className="text-xs text-muted-foreground">
                          `0` matches only the picked color. Higher values remove more similar shades.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleDetectEdgeColor()}
                        disabled={!activeSprite || isDetectingEdgeColor}
                      >
                        {isDetectingEdgeColor ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <Pipette className="h-4 w-4" />
                        )}
                        Match edge color
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>{activeSprite.imageWidth}x{activeSprite.imageHeight}px</span>
                  <span>{previewFrameCount} frames</span>
                  <span>{frameCount} configured</span>
                  <span>{frameGrid?.columns ?? 0} columns</span>
                  <span>{frameGrid?.rows ?? 0} rows</span>
                  <span>
                    {chromaKeyEnabled ? `key ${chromaKeyColor} @ ${chromaKeyTolerance}` : "chroma key off"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button type="button" onClick={() => void handleSaveSprite()} disabled={isSaving}>
                    {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                    Save cell settings
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleExportGif()}
                    disabled={isExportingGif || !frameGrid?.isValid || previewFrameCount < 1}
                  >
                    {isExportingGif ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Export GIF
                  </Button>
                  {activeSprite.gifAssetPath ? (
                    <a
                      href={activeSprite.gifAssetPath}
                      download={`${activeSprite.title.replace(/\s+/g, "-").toLowerCase() || "sprite"}.gif`}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition hover:bg-secondary"
                    >
                      <Download className="h-4 w-4" />
                      Download GIF
                    </a>
                  ) : null}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Animation preview</CardTitle>
            <CardDescription>Phaser renders the selected sprite sheet using the configured cell dimensions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeSprite ? (
              <div className="rounded-3xl border border-dashed border-border p-10 text-center text-muted-foreground">
                Select a sprite to preview it.
              </div>
            ) : !frameGrid?.isValid ? (
              <div className="rounded-3xl border border-dashed border-destructive/40 bg-destructive/5 p-10 text-center text-sm text-destructive">
                Cell dimensions must divide the sprite sheet cleanly before playback can start.
              </div>
            ) : (
              <PhaserSpritePlayer
                spriteId={activeSprite.spriteId}
                imageAssetPath={activeSprite.imageAssetPath}
                cellWidth={cellWidth}
                cellHeight={cellHeight}
                fps={playbackFps}
                frameCount={previewFrameCount}
                chromaKeyColor={chromaKeyEnabled ? chromaKeyColor : null}
                chromaKeyTolerance={chromaKeyTolerance}
              />
            )}
          </CardContent>
        </Card>
      </section>

      <AssetInspectorDrawer
        title={inspectedSprite?.title ?? "Sprite"}
        open={Boolean(inspectedSprite)}
        onClose={() => setInspectedSpriteId(null)}
      >
        {inspectedSprite ? (
          <SpriteInspectorContent
            sprite={inspectedSprite}
            onOpenMain={() => {
              setActiveSpriteId(inspectedSprite.spriteId);
              setInspectedSpriteId(null);
            }}
            onFork={() => void handleForkSprite(inspectedSprite)}
            onArchive={() => void handleArchiveSprite(inspectedSprite)}
          />
        ) : null}
      </AssetInspectorDrawer>
    </main>
  );
}
