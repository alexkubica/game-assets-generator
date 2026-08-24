"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Copy, Import, LoaderCircle, Play, RefreshCw, RotateCcw, WandSparkles, X } from "lucide-react";
import { toast } from "sonner";
import { AssetInspectorDrawer } from "@/components/asset-inspector-drawer";
import { EntityActionMenu } from "@/components/entity-action-menu";
import { EntityToolbar } from "@/components/entity-toolbar";
import { JobInspectorContent } from "@/components/job-inspector-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_PROVIDER,
  DEFAULT_VIDEO_ASPECT_RATIO,
  DEFAULT_VIDEO_DURATION,
  DEFAULT_VIDEO_RESOLUTION,
  VIDEO_ASPECT_RATIOS,
  VIDEO_RESOLUTIONS,
} from "@/lib/config";
import type { JobManifest, JobsListResponse, VideoProvider } from "@/lib/types";

const POLLABLE_STATUSES = new Set(["queued", "generating", "downloading", "extracting"]);

function formatStatus(status: JobManifest["status"]) {
  return status.replace("-", " ");
}

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function formatTimestamp(value: string) {
  return `${timestampFormatter.format(new Date(value))} UTC`;
}

function getJobDisplayTitle(job: JobManifest) {
  return job.title.trim() || job.prompt;
}

function getJobPreviewFrames(job: JobManifest) {
  return job.frames.filter((frame) => job.selectedFrameNumbers.includes(frame.number));
}

function getPreviewFrameForTick(job: JobManifest, previewTick: number) {
  const previewFrames = getJobPreviewFrames(job);

  if (previewFrames.length === 0) {
    return null;
  }

  const frameIndex = Math.floor((previewTick * job.previewFps) / 1000) % previewFrames.length;
  return previewFrames[frameIndex] ?? null;
}

function JobLibraryPreview({
  job,
  isActive,
  previewTick,
  onSelect,
  onRename,
  onFork,
  onArchive,
}: {
  job: JobManifest;
  isActive: boolean;
  previewTick: number;
  onSelect: () => void;
  onRename: () => void;
  onFork: () => void;
  onArchive: () => void;
}) {
  const previewFrames = getJobPreviewFrames(job);
  const previewFrame = getPreviewFrameForTick(job, previewTick);
  const displayTitle = getJobDisplayTitle(job);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      aria-pressed={isActive}
      className={`min-w-0 w-full cursor-pointer rounded-3xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        isActive ? "border-primary bg-primary/8" : "border-border/70 bg-background/60 hover:bg-secondary/60"
      }`}
    >
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden rounded-[1.25rem] border border-border/70 bg-secondary/40 sm:w-40">
          {previewFrame ? (
            <Image
              src={previewFrame.assetPath}
              alt={`Preview frame ${previewFrame.number}`}
              fill
              unoptimized
              sizes="(min-width: 640px) 10rem, 100vw"
              className="object-contain"
            />
          ) : previewFrames.length > 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              <span>Loading preview</span>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center px-3 text-center text-xs text-muted-foreground">
              Select frames to preview
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 max-w-full items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex min-w-0 items-start gap-2">
                <span className="group/prompt relative block min-w-0 max-w-full flex-1">
                  <span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-medium">
                    {displayTitle}
                  </span>
                </span>
                <span className="group/copy relative shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={(event) => {
                      event.stopPropagation();
                      void navigator.clipboard.writeText(job.prompt).then(
                        () => toast.success("Prompt copied."),
                        () => toast.error("Unable to copy prompt."),
                      );
                    }}
                    onKeyDown={(event) => event.stopPropagation()}
                    aria-label="Copy prompt"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <span className="pointer-events-none absolute top-full right-0 z-20 mt-1 hidden whitespace-nowrap rounded-xl border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-lg group-hover/copy:block">
                    Copy prompt
                  </span>
                </span>
              </div>
              {displayTitle !== job.prompt ? (
                <p className="line-clamp-2 text-sm text-muted-foreground">{job.prompt}</p>
              ) : null}
              <span className="block text-xs text-muted-foreground">{formatTimestamp(job.createdAt)}</span>
            </div>
            <span
              className="flex shrink-0 items-start gap-2"
            >
              <span
                className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  isActive ? "border-transparent bg-primary/15 text-primary" : "border-transparent bg-secondary text-secondary-foreground"
                }`}
              >
                {formatStatus(job.status)}
              </span>
              <EntityActionMenu
                entityLabel={`Job ${displayTitle}`}
                onOpen={() => {
                  onSelect();
                }}
                onRename={onRename}
                onFork={onFork}
                onArchive={onArchive}
                onViewRelated={job.derivedSpriteIds.length > 0 ? onSelect : undefined}
              />
            </span>
          </div>

          <span className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span>{job.frames.length} frames</span>
            <span>{job.selectedFrameNumbers.length} selected</span>
            <span>{job.previewFps} FPS</span>
            <span>{job.duration}s</span>
            <span>{job.aspectRatio}</span>
            <span>{job.resolution}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function ExpandablePrompt({
  prompt,
  expanded,
  onToggle,
}: {
  prompt: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-3xl border border-border/70 bg-background/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">Prompt</div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggle}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {expanded ? "Collapse" : "Expand"}
          </Button>
        </div>
      </div>
      <p
        className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground"
        style={
          expanded
            ? undefined
            : {
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 3,
                overflow: "hidden",
              }
        }
      >
        {prompt}
      </p>
    </div>
  );
}

export function AppShell({ initialJobs }: { initialJobs: JobManifest[] }) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initialJobs);
  const [activeJobId, setActiveJobId] = useState(initialJobs[0]?.jobId ?? null);
  const [inspectedJobId, setInspectedJobId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImportingSprite, setIsImportingSprite] = useState(false);
  const [provider, setProvider] = useState<VideoProvider>(DEFAULT_PROVIDER);
  const [prompt, setPrompt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [retrySourceJobId, setRetrySourceJobId] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(DEFAULT_VIDEO_DURATION);
  const [aspectRatio, setAspectRatio] = useState<JobManifest["aspectRatio"]>(DEFAULT_VIDEO_ASPECT_RATIO);
  const [resolution, setResolution] = useState<JobManifest["resolution"]>(DEFAULT_VIDEO_RESOLUTION);
  const [previewTick, setPreviewTick] = useState(0);
  const [jobSearchQuery, setJobSearchQuery] = useState("");
  const [jobStatusFilter, setJobStatusFilter] = useState<"all" | JobManifest["status"]>("all");
  const [libraryCardHeight, setLibraryCardHeight] = useState<number | null>(null);
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const createCardRef = useRef<HTMLDivElement | null>(null);
  const activeJob = jobs.find((job) => job.jobId === activeJobId) ?? null;
  const inspectedJob = jobs.find((job) => job.jobId === inspectedJobId) ?? null;
  const retrySourceJob = jobs.find((job) => job.jobId === retrySourceJobId) ?? null;
  const filteredJobs = jobs.filter((job) => {
    const normalizedQuery = jobSearchQuery.trim().toLowerCase();
    const matchesQuery =
      normalizedQuery.length === 0 ||
      job.title.toLowerCase().includes(normalizedQuery) ||
      job.prompt.toLowerCase().includes(normalizedQuery);
    const matchesStatus = jobStatusFilter === "all" ? true : job.status === jobStatusFilter;

    return matchesQuery && matchesStatus;
  });

  function resetImageInput() {
    const imageInput = document.getElementById("image-upload") as HTMLInputElement | null;

    if (imageInput) {
      imageInput.value = "";
    }
  }

  async function refreshJobs(preferredJobId?: string) {
    const response = await fetch("/api/jobs", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Failed to refresh jobs.");
    }

    const data = (await response.json()) as JobsListResponse;
    setJobs(data.jobs);

    if (preferredJobId) {
      setActiveJobId(preferredJobId);
      return;
    }

    setActiveJobId((current) => current ?? data.jobs[0]?.jobId ?? null);
  }

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPreviewTick(Date.now());
    }, 100);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!jobs.some((job) => POLLABLE_STATUSES.has(job.status))) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshJobs(activeJobId ?? undefined);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [jobs, activeJobId]);

  useEffect(() => {
    const element = createCardRef.current;

    if (!element) {
      return;
    }

    const mediaQuery = window.matchMedia("(min-width: 1024px)");

    const updateHeight = () => {
      if (mediaQuery.matches) {
        setLibraryCardHeight(element.getBoundingClientRect().height);
        return;
      }

      setLibraryCardHeight(null);
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });
    resizeObserver.observe(element);

    mediaQuery.addEventListener("change", updateHeight);

    return () => {
      resizeObserver.disconnect();
      mediaQuery.removeEventListener("change", updateHeight);
    };
  }, []);

  useEffect(() => {
    setIsPromptExpanded(false);
  }, [activeJobId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!imageFile && !retrySourceJobId) {
      toast.error("Choose a source image before generating.");
      return;
    }

    const formData = new FormData();
    formData.set("prompt", prompt);
    formData.set("provider", provider);
    formData.set("duration", String(duration));
    formData.set("aspectRatio", aspectRatio);
    formData.set("resolution", resolution);
    if (retrySourceJobId) {
      formData.set("retryFromJobId", retrySourceJobId);
    } else if (imageFile) {
      formData.set("image", imageFile);
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to create the job.");
      }

      await refreshJobs(data.job.jobId);
      setPrompt("");
      setImageFile(null);
      setRetrySourceJobId(null);
      setDuration(DEFAULT_VIDEO_DURATION);
      setAspectRatio(DEFAULT_VIDEO_ASPECT_RATIO);
      setResolution(DEFAULT_VIDEO_RESOLUTION);
      resetImageInput();
      toast.success("Generation started.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unexpected error.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleImportAsSprite() {
    if (!activeJob) {
      return;
    }

    setIsImportingSprite(true);

    try {
      if (!activeJob.spritesheet) {
        const exportResponse = await fetch(`/api/jobs/${activeJob.jobId}/spritesheet`, {
          method: "POST",
        });
        const exportData = await exportResponse.json();

        if (!exportResponse.ok) {
          throw new Error(exportData.error ?? "Unable to export spritesheet.");
        }

        setJobs((current) =>
          current.map((job) => (job.jobId === exportData.job.jobId ? exportData.job : job)),
        );
      }

      const importResponse = await fetch("/api/sprites/import-generated", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobId: activeJob.jobId }),
      });
      const importData = await importResponse.json();

      if (!importResponse.ok) {
        throw new Error(importData.error ?? "Unable to import sprite.");
      }

      setJobs((current) =>
        current.map((job) =>
          job.jobId === activeJob.jobId
            ? {
                ...job,
                derivedSpriteIds: Array.from(new Set([...job.derivedSpriteIds, importData.sprite.spriteId])),
              }
            : job,
        ),
      );
      toast.success("Sprite imported to the library.");
      router.push(`/sprites?sprite=${encodeURIComponent(importData.sprite.spriteId)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to import sprite.");
    } finally {
      setIsImportingSprite(false);
    }
  }

  async function copyPromptToClipboard(promptText: string) {
    try {
      await navigator.clipboard.writeText(promptText);
      toast.success("Prompt copied.");
    } catch {
      toast.error("Unable to copy prompt.");
    }
  }

  function handleRetryFromActiveJob() {
    if (!activeJob) {
      return;
    }

    setRetrySourceJobId(activeJob.jobId);
    setPrompt(activeJob.prompt);
    setDuration(activeJob.duration);
    setAspectRatio(activeJob.aspectRatio);
    setResolution(activeJob.resolution);
    setImageFile(null);
    resetImageInput();

    window.requestAnimationFrame(() => {
      promptInputRef.current?.focus();
      promptInputRef.current?.setSelectionRange(activeJob.prompt.length, activeJob.prompt.length);
    });
  }

  async function handleRenameJob(job: JobManifest) {
    const nextTitle = window.prompt("Rename job", job.title)?.trim();

    if (!nextTitle || nextTitle === job.title) {
      return;
    }

    try {
      const response = await fetch(`/api/jobs/${job.jobId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: nextTitle }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to rename job.");
      }

      setJobs((current) =>
        current.map((currentJob) => (currentJob.jobId === data.job.jobId ? data.job : currentJob)),
      );
      toast.success("Job renamed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to rename job.");
    }
  }

  async function handleForkJob(job: JobManifest) {
    try {
      const response = await fetch(`/api/jobs/${job.jobId}/fork`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to fork job.");
      }

      await refreshJobs(data.job.jobId);
      toast.success("Job forked.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to fork job.");
    }
  }

  async function handleArchiveJob(job: JobManifest) {
    const confirmed = window.confirm(`Archive "${job.title}"?`);

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/jobs/${job.jobId}/archive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ archived: true }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to archive job.");
      }

      const nextJobs = jobs.filter((currentJob) => currentJob.jobId !== data.job.jobId);
      setJobs(nextJobs);
      setActiveJobId((current) => (current === data.job.jobId ? nextJobs[0]?.jobId ?? null : current));
      toast.success("Job archived.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to archive job.");
    }
  }

  return (
    <main className="flex flex-col gap-6">
      <EntityToolbar
        title="Generate Workflow"
        description="Create a run, review the generated output, and hand successful runs off to the sprite library."
        actions={
          <>
            <Badge variant="secondary">{jobs.length} runs</Badge>
            <Badge variant="secondary">{jobs.filter((job) => job.status === "ready").length} ready</Badge>
            {activeJob ? (
              <Badge variant="secondary">
                {activeJob.derivedSpriteIds.length > 0 ? `${activeJob.derivedSpriteIds.length} linked sprites` : "No linked sprites"}
              </Badge>
            ) : null}
          </>
        }
        controls={
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_220px]">
            <div className="grid gap-2">
              <Label htmlFor="job-search">Search runs</Label>
              <Input
                id="job-search"
                value={jobSearchQuery}
                onChange={(event) => setJobSearchQuery(event.target.value)}
                placeholder="Search by title or prompt"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="job-status-filter">Status</Label>
              <Select value={jobStatusFilter} onValueChange={(value) => setJobStatusFilter(value as typeof jobStatusFilter)}>
                <SelectTrigger id="job-status-filter">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="queued">Queued</SelectItem>
                  <SelectItem value="generating">Generating</SelectItem>
                  <SelectItem value="downloading">Downloading</SelectItem>
                  <SelectItem value="extracting">Extracting</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        }
      />

      <section>
        <div ref={createCardRef}>
          <Card className="flex h-full flex-col overflow-hidden">
            <CardHeader className="gap-4 border-b border-border/60 bg-card/60">
              <Badge className="w-fit">Image to video</Badge>
              <div className="space-y-2">
                <CardTitle className="text-3xl sm:text-4xl">Image to video</CardTitle>
                <CardDescription className="max-w-2xl text-base">
                  Upload a source image, generate a local video with xAI, extract every frame,
                  then import the resulting motion into the sprite library when it is ready.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col pt-6">
              <form className="grid flex-1 content-start gap-6" onSubmit={handleSubmit}>
                <div className="grid gap-2">
                  <Label htmlFor="provider">Model</Label>
                  <Select value={provider} onValueChange={(value) => setProvider(value as VideoProvider)}>
                    <SelectTrigger id="provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={DEFAULT_PROVIDER}>xAI Grok Imagine Video</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="prompt">Motion prompt</Label>
                  <Textarea
                    id="prompt"
                    ref={promptInputRef}
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Animate the flame, add subtle camera drift, and make the cloth banner ripple."
                    required
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="grid gap-2">
                    <Label htmlFor="duration">Duration</Label>
                    <Input
                      id="duration"
                      type="number"
                      min={1}
                      max={15}
                      value={duration}
                      onChange={(event) => setDuration(Number(event.target.value) || 1)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="aspect-ratio">Aspect ratio</Label>
                    <Select value={aspectRatio} onValueChange={(value) => setAspectRatio(value as JobManifest["aspectRatio"])}>
                      <SelectTrigger id="aspect-ratio">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VIDEO_ASPECT_RATIOS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="resolution">Resolution</Label>
                    <Select value={resolution} onValueChange={(value) => setResolution(value as JobManifest["resolution"])}>
                      <SelectTrigger id="resolution">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VIDEO_RESOLUTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2">
                  {retrySourceJob ? (
                    <div className="rounded-3xl border border-primary/25 bg-primary/8 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">Retrying from existing source image</div>
                          <div className="text-sm text-muted-foreground">
                            Reusing the source image from job created {formatTimestamp(retrySourceJob.createdAt)}.
                            Edit the prompt above before submitting if needed.
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setRetrySourceJobId(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Label htmlFor="image-upload">Source image</Label>
                      <Input
                        id="image-upload"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                        required={!retrySourceJobId}
                      />
                    </>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Stored locally under <code>data/jobs</code> with the generated video and extracted frames.
                  </p>
                </div>

                <Button className="w-full sm:w-fit" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <WandSparkles className="h-4 w-4" />
                  )}
                  {retrySourceJobId ? "Generate new job from source" : "Generate asset video"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <div style={libraryCardHeight ? { minHeight: `${libraryCardHeight}px` } : undefined}>
          <Card className="flex h-full min-h-0 flex-col overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>History</CardTitle>
                  <CardDescription>All uploads, videos, and frame selections persist on disk and are filterable here.</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Refresh run browser"
                  onClick={() => void refreshJobs(activeJobId ?? undefined)}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <ScrollArea className="min-h-0 flex-1 pr-3">
                <div className="grid gap-3">
                  {filteredJobs.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                      No runs match the current filters. Adjust the search/status controls or create a new run.
                    </div>
                  ) : null}

                  {filteredJobs.map((job) => (
                    <div key={job.jobId} className="flex min-w-0 items-start gap-2">
                      <JobLibraryPreview
                        job={job}
                        isActive={activeJobId === job.jobId}
                        previewTick={previewTick}
                        onSelect={() => setActiveJobId(job.jobId)}
                        onRename={() => void handleRenameJob(job)}
                        onFork={() => void handleForkJob(job)}
                        onArchive={() => void handleArchiveJob(job)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Open inspector for ${getJobDisplayTitle(job)}`}
                        onClick={() => setInspectedJobId(job.jobId)}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Job detail</CardTitle>
                <CardDescription>Source media, generation state, extracted output, and sprite import.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {activeJob ? <Badge>{formatStatus(activeJob.status)}</Badge> : null}
                {activeJob ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setInspectedJobId(activeJob.jobId)}>
                    Open inspector
                  </Button>
                ) : null}
                {activeJob ? (
                  <Button type="button" variant="outline" size="sm" onClick={handleRetryFromActiveJob}>
                    <RotateCcw className="h-4 w-4" />
                    Retry as new job
                  </Button>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {!activeJob ? (
              <div className="rounded-3xl border border-dashed border-border p-10 text-center text-muted-foreground">
                Select a job to inspect its output.
              </div>
            ) : (
              <>
                <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Source image</div>
                    <div className="relative aspect-square overflow-hidden rounded-3xl border border-border/70 bg-secondary/50">
                      <Image
                        src={activeJob.sourceImageAssetPath}
                        alt="Source upload"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Generated video</div>
                      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-3xl border border-border/70 bg-secondary/50">
                        {activeJob.videoAssetPath ? (
                          <video
                            className="h-full w-full object-cover"
                            src={activeJob.videoAssetPath}
                            controls
                            loop
                            muted
                            playsInline
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
                            {POLLABLE_STATUSES.has(activeJob.status) ? (
                              <LoaderCircle className="h-6 w-6 animate-spin" />
                            ) : (
                              <Play className="h-6 w-6" />
                            )}
                            <span>
                              {activeJob.status === "failed" || activeJob.status === "expired"
                                ? activeJob.errorMessage
                                : "Video will appear here when the generation finishes."}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-border/70 bg-background/70 p-4">
                      <div className="text-sm font-medium">Import behavior</div>
                      <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                        <p>Import creates a spritesheet for this run if needed, adds it to the library, and opens the sprite editor.</p>
                        <p>Frame gallery editing, playback tuning, and GIF export now live on the sprites page.</p>
                        {activeJob.spritesheet ? (
                          <p>
                            Existing spritesheet: {activeJob.spritesheet.frameCount} frames, {activeJob.spritesheet.columns}x{activeJob.spritesheet.rows},{" "}
                            {activeJob.spritesheet.frameWidth}x{activeJob.spritesheet.frameHeight} cells.
                          </p>
                        ) : (
                          <p>No spritesheet exported yet for this run. It will be generated during import.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-semibold">{getJobDisplayTitle(activeJob)}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{activeJob.duration}s duration</span>
                      <span>{activeJob.aspectRatio} aspect ratio</span>
                      <span>{activeJob.resolution} resolution</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void copyPromptToClipboard(activeJob.prompt)}
                    >
                      <Copy className="h-4 w-4" />
                      Copy prompt
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleImportAsSprite()}
                      disabled={activeJob.status !== "ready" || activeJob.frames.length === 0 || isImportingSprite}
                    >
                      {isImportingSprite ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Import className="h-4 w-4" />}
                      Import as sprite
                    </Button>
                    {activeJob.derivedSpriteIds[0] ? (
                      <a
                        href={`/sprites?sprite=${encodeURIComponent(activeJob.derivedSpriteIds[0])}`}
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition hover:bg-secondary"
                      >
                        Open in sprites
                      </a>
                    ) : null}
                  </div>
                </div>

                <ExpandablePrompt
                  prompt={activeJob.prompt}
                  expanded={isPromptExpanded}
                  onToggle={() => setIsPromptExpanded((current) => !current)}
                />

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-3xl border border-border/70 bg-background/70 p-4">
                    <div className="text-sm font-medium">Run Status</div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {formatStatus(activeJob.status)}
                    </div>
                  </div>
                  <div className="rounded-3xl border border-border/70 bg-background/70 p-4">
                    <div className="text-sm font-medium">Total frames</div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {activeJob.frames.length}
                    </div>
                  </div>
                  <div className="rounded-3xl border border-border/70 bg-background/70 p-4">
                    <div className="text-sm font-medium">Selected frames</div>
                    <div className="mt-2 text-sm text-muted-foreground">{activeJob.selectedFrameNumbers.length}</div>
                  </div>
                  <div className="rounded-3xl border border-border/70 bg-background/70 p-4">
                    <div className="text-sm font-medium">Related Sprites</div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {activeJob.derivedSpriteIds.length > 0
                        ? `${activeJob.derivedSpriteIds.length} linked sprite asset(s)`
                        : "None yet"}
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <AssetInspectorDrawer
        title={inspectedJob ? getJobDisplayTitle(inspectedJob) : "Job"}
        open={Boolean(inspectedJob)}
        onClose={() => setInspectedJobId(null)}
      >
        {inspectedJob ? (
          <JobInspectorContent
            job={inspectedJob}
            onOpenMain={() => {
              setActiveJobId(inspectedJob.jobId);
              setInspectedJobId(null);
            }}
            onFork={() => void handleForkJob(inspectedJob)}
            onArchive={() => void handleArchiveJob(inspectedJob)}
          />
        ) : null}
      </AssetInspectorDrawer>
    </main>
  );
}
