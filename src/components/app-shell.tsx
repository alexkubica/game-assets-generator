"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import Image from "next/image";
import { Copy, Download, LoaderCircle, Play, RefreshCw, RotateCcw, WandSparkles, X } from "lucide-react";
import { toast } from "sonner";
import { AssetInspectorDrawer } from "@/components/asset-inspector-drawer";
import { EntityActionMenu } from "@/components/entity-action-menu";
import { EntityToolbar } from "@/components/entity-toolbar";
import { JobInspectorContent } from "@/components/job-inspector-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_PROVIDER,
  DEFAULT_PREVIEW_FPS,
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
                    {job.prompt}
                  </span>
                  <span className="absolute top-full left-0 z-20 hidden max-h-[min(24rem,calc(100vh-6rem))] max-w-[min(32rem,calc(100vw-3rem))] translate-y-2 overflow-y-auto whitespace-normal break-words rounded-2xl border border-border bg-popover px-3 py-2 text-sm font-normal text-popover-foreground shadow-lg group-hover/prompt:block hover:block">
                    {job.prompt}
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
                entityLabel={`Job ${job.title}`}
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

export function AppShell({ initialJobs }: { initialJobs: JobManifest[] }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [activeJobId, setActiveJobId] = useState(initialJobs[0]?.jobId ?? null);
  const [inspectedJobId, setInspectedJobId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExportingSpritesheet, setIsExportingSpritesheet] = useState(false);
  const [isCachingFrames, setIsCachingFrames] = useState(false);
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
  const [frameSkipCount, setFrameSkipCount] = useState(0);
  const [frameSkipStart, setFrameSkipStart] = useState(0);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewFps, setPreviewFps] = useState<number>(initialJobs[0]?.previewFps ?? DEFAULT_PREVIEW_FPS);
  const [cachedFrameUrls, setCachedFrameUrls] = useState<Record<number, string>>({});
  const [libraryCardHeight, setLibraryCardHeight] = useState<number | null>(null);
  const debounceRef = useRef<number | null>(null);
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const createCardRef = useRef<HTMLDivElement | null>(null);
  const cacheUrlsRef = useRef<string[]>([]);
  const activeJob = jobs.find((job) => job.jobId === activeJobId) ?? null;
  const inspectedJob = jobs.find((job) => job.jobId === inspectedJobId) ?? null;
  const retrySourceJob = jobs.find((job) => job.jobId === retrySourceJobId) ?? null;
  const activeJobFrames = activeJob?.frames ?? [];
  const frameCacheKey = activeJob ? activeJob.frames.map((frame) => frame.fileName).join("|") : "";
  const selectedFrames = activeJob
    ? activeJob.frames.filter((frame) => activeJob.selectedFrameNumbers.includes(frame.number))
    : [];
  const previewFrame = selectedFrames[previewIndex % Math.max(selectedFrames.length, 1)] ?? null;
  const previewFrameSrc = previewFrame ? cachedFrameUrls[previewFrame.number] ?? null : null;
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

  function clearFrameCache() {
    for (const objectUrl of cacheUrlsRef.current) {
      URL.revokeObjectURL(objectUrl);
    }

    cacheUrlsRef.current = [];
    setCachedFrameUrls({});
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
    if (!activeJob) {
      return;
    }

    setPreviewFps(activeJob.previewFps);
  }, [activeJob]);

  useEffect(() => {
    if (!activeJob || selectedFrames.length === 0) {
      setPreviewIndex(0);
      return;
    }

    const interval = window.setInterval(() => {
      setPreviewIndex((current) => (current + 1) % selectedFrames.length);
    }, Math.max(1000 / previewFps, 16));

    return () => window.clearInterval(interval);
  }, [activeJob, previewFps, selectedFrames.length]);

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
    if (!activeJobId || activeJobFrames.length === 0) {
      clearFrameCache();
      setIsCachingFrames(false);
      return;
    }

    let cancelled = false;
    const nextObjectUrls: string[] = [];

    clearFrameCache();
    setIsCachingFrames(true);

    void Promise.all(
      activeJobFrames.map(async (frame) => {
        const response = await fetch(frame.assetPath, { cache: "force-cache" });

        if (!response.ok) {
          throw new Error(`Failed to preload frame ${frame.number}.`);
        }

        const objectUrl = URL.createObjectURL(await response.blob());
        nextObjectUrls.push(objectUrl);

        return [frame.number, objectUrl] as const;
      }),
    )
      .then((entries) => {
        if (cancelled) {
          nextObjectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
          return;
        }

        cacheUrlsRef.current = nextObjectUrls;
        setCachedFrameUrls(Object.fromEntries(entries));
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Unable to cache frames.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsCachingFrames(false);
        }
      });

    return () => {
      cancelled = true;
      nextObjectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
      clearFrameCache();
    };
    // `frameCacheKey` captures the frame list changes; depending on the full job object
    // would rebuild the cache on unrelated updates like FPS or selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJobId, frameCacheKey]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }

      clearFrameCache();
    };
  }, []);

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

  async function patchActiveJob(body: Record<string, unknown>) {
    if (!activeJob) {
      return;
    }

    const response = await fetch(`/api/jobs/${activeJob.jobId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? "Unable to update the job.");
    }

    setJobs((current) =>
      current.map((job) => (job.jobId === data.job.jobId ? data.job : job)),
    );
  }

  async function handleFrameToggle(frameNumber: number, checked: boolean) {
    if (!activeJob) {
      return;
    }

    const nextSelected = checked
      ? [...activeJob.selectedFrameNumbers, frameNumber].sort((a, b) => a - b)
      : activeJob.selectedFrameNumbers.filter((value) => value !== frameNumber);

    await updateSelectedFrames(nextSelected);
  }

  async function toggleFrameSelection(frameNumber: number) {
    if (!activeJob) {
      return;
    }

    const checked = !activeJob.selectedFrameNumbers.includes(frameNumber);
    await handleFrameToggle(frameNumber, checked);
  }

  async function updateSelectedFrames(nextSelected: number[]) {
    if (!activeJob) {
      return;
    }

    setJobs((current) =>
      current.map((job) =>
        job.jobId === activeJob.jobId ? { ...job, selectedFrameNumbers: nextSelected } : job,
      ),
    );

    try {
      await patchActiveJob({ selectedFrameNumbers: nextSelected });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save frame selection.");
      await refreshJobs(activeJob.jobId);
    }
  }

  async function applyFrameSkipSelection() {
    if (!activeJob) {
      return;
    }

    const normalizedSkip = Math.max(0, Math.floor(frameSkipCount));
    const normalizedStart = Math.max(0, Math.floor(frameSkipStart));
    const step = normalizedSkip + 1;
    const nextSelected = activeJob.frames
      .filter((_, index) => index >= normalizedStart && (index - normalizedStart) % step === 0)
      .map((frame) => frame.number);

    await updateSelectedFrames(nextSelected);
  }

  async function selectAllFrames() {
    if (!activeJob) {
      return;
    }

    await updateSelectedFrames(activeJob.frames.map((frame) => frame.number));
  }

  async function unselectAllFrames() {
    await updateSelectedFrames([]);
  }

  async function handleSpritesheetExport() {
    if (!activeJob) {
      return;
    }

    setIsExportingSpritesheet(true);

    try {
      const response = await fetch(`/api/jobs/${activeJob.jobId}/spritesheet`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to export spritesheet.");
      }

      setJobs((current) =>
        current.map((job) => (job.jobId === data.job.jobId ? data.job : job)),
      );
      toast.success("Spritesheet exported.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to export spritesheet.");
    } finally {
      setIsExportingSpritesheet(false);
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

  function handlePreviewFpsChange(value: number[]) {
    const nextValue = value[0] ?? DEFAULT_PREVIEW_FPS;
    setPreviewFps(nextValue);

    setJobs((current) =>
      current.map((job) =>
        job.jobId === activeJob?.jobId ? { ...job, previewFps: nextValue } : job,
      ),
    );

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      void patchActiveJob({ previewFps: nextValue }).catch((error) => {
        toast.error(error instanceof Error ? error.message : "Unable to save preview FPS.");
      });
    }, 250);
  }

  return (
    <main className="flex flex-col gap-6">
      <EntityToolbar
        title="Generate Workflow"
        description="Create a run, review extracted frames, and save the curated result as a reusable sprite asset."
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

      <section className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
        <div ref={createCardRef} className="lg:min-w-0 lg:flex-[1.15]">
          <Card className="flex h-full flex-col overflow-hidden">
            <CardHeader className="gap-4 border-b border-border/60 bg-card/60">
              <Badge className="w-fit">Image to video</Badge>
              <div className="space-y-2">
                <CardTitle className="text-3xl sm:text-4xl">Game asset motion lab</CardTitle>
                <CardDescription className="max-w-2xl text-base">
                  Upload a source image, generate a local video with xAI, extract every frame,
                  then curate the exact loop you want to use in your asset pipeline.
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

        <div
          className="lg:min-w-0 lg:flex-[0.85]"
          style={libraryCardHeight ? { height: `${libraryCardHeight}px` } : undefined}
        >
          <Card className="flex h-full min-h-0 flex-col overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Run Browser</CardTitle>
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
                        aria-label={`Open inspector for ${job.title}`}
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

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Job detail</CardTitle>
                <CardDescription>Source media, generation state, and extracted output.</CardDescription>
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
                <div className="grid gap-4 md:grid-cols-2">
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

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Generated video</div>
                    <div className="flex aspect-square items-center justify-center overflow-hidden rounded-3xl border border-border/70 bg-secondary/50">
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
                </div>

                <div className="rounded-3xl border border-border/70 bg-background/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">Prompt</div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void copyPromptToClipboard(activeJob.prompt)}
                    >
                      <Copy className="h-4 w-4" />
                      Copy prompt
                    </Button>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{activeJob.prompt}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>{activeJob.duration}s duration</span>
                    <span>{activeJob.aspectRatio} aspect ratio</span>
                    <span>{activeJob.resolution} resolution</span>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-3xl border border-border/70 bg-background/70 p-4">
                    <div className="text-sm font-medium">Run Status</div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {formatStatus(activeJob.status)}
                    </div>
                  </div>
                  <div className="rounded-3xl border border-border/70 bg-background/70 p-4">
                    <div className="text-sm font-medium">Curated Frames</div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {activeJob.selectedFrameNumbers.length} of {activeJob.frames.length}
                    </div>
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

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Loop preview</CardTitle>
                  <CardDescription>Only selected frames are used in this preview.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {activeJob ? <Badge variant="secondary">{selectedFrames.length} active frames</Badge> : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleSpritesheetExport()}
                    disabled={!activeJob || activeJob.status !== "ready" || selectedFrames.length === 0 || isExportingSpritesheet}
                  >
                    {isExportingSpritesheet ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Export spritesheet
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="relative aspect-[16/9] overflow-hidden rounded-[1.75rem] border border-border/70 bg-secondary/40">
                {activeJob && selectedFrames.length > 0 && previewFrameSrc ? (
                  <Image
                    src={previewFrameSrc}
                    alt={`Preview frame ${previewFrame?.number ?? 0}`}
                    fill
                    unoptimized
                    sizes="(min-width: 1280px) 55vw, 100vw"
                    className="object-contain"
                  />
                ) : activeJob && selectedFrames.length > 0 && isCachingFrames ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                    <LoaderCircle className="h-6 w-6 animate-spin" />
                    <span>Loading frames into memory for preview.</span>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {activeJob ? "Select at least one frame to preview the loop." : "No active job selected."}
                  </div>
                )}
              </div>

              {activeJob?.spritesheet ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/70 bg-background/70 p-4 text-sm">
                  <div className="text-muted-foreground">
                    {activeJob.spritesheet.frameCount} frames, {activeJob.spritesheet.columns}x{activeJob.spritesheet.rows},{" "}
                    {activeJob.spritesheet.frameWidth}x{activeJob.spritesheet.frameHeight} cells
                  </div>
                  <a
                    href={activeJob.spritesheet.assetPath}
                    download={`spritesheet-${activeJob.jobId}.png`}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition hover:bg-secondary"
                  >
                    <Download className="h-4 w-4" />
                    Download PNG
                  </a>
                </div>
              ) : null}

              <div className="rounded-3xl border border-border/70 bg-background/70 p-4">
                <div className="text-sm font-medium">Save Outcome</div>
                <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                  <p>
                    Exporting creates a spritesheet from the currently selected frames and links it back to this generation run.
                  </p>
                  <p>
                    {activeJob
                      ? activeJob.spritesheet
                        ? "A spritesheet has already been exported for the current selection. Re-export after changing frame selection to replace the output."
                        : "No spritesheet exported yet for this run."
                      : "Select a run to manage its output."}
                  </p>
                  {activeJob?.derivedSpriteIds.length ? (
                    <p>{activeJob.derivedSpriteIds.length} persisted sprite asset(s) are already linked to this run.</p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="fps-slider">Preview FPS</Label>
                  <div className="rounded-full bg-secondary px-3 py-1 text-sm font-medium">
                    {previewFps} FPS
                  </div>
                </div>
                <Slider
                  id="fps-slider"
                  min={1}
                  max={60}
                  step={1}
                  value={[previewFps]}
                  onValueChange={handlePreviewFpsChange}
                  disabled={!activeJob}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Frame gallery</CardTitle>
              <CardDescription>
                Every extracted frame stays on disk. Toggle frames to curate the loop.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!activeJob ? (
                <div className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  Pick a job to inspect its frames.
                </div>
              ) : activeJob.frames.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  Frames will appear here after extraction finishes.
                </div>
              ) : (
                <div className="grid gap-4">
                  <div className="rounded-3xl border border-border/70 bg-background/70 p-4">
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                      <div className="grid gap-2">
                        <Label htmlFor="frame-skip-count">Skip Every X Frames</Label>
                        <Input
                          id="frame-skip-count"
                          type="number"
                          min={0}
                          step={1}
                          value={frameSkipCount}
                          onChange={(event) => setFrameSkipCount(Math.max(0, Number(event.target.value) || 0))}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="frame-skip-start">Start At Index</Label>
                        <Input
                          id="frame-skip-start"
                          type="number"
                          min={0}
                          step={1}
                          value={frameSkipStart}
                          onChange={(event) => setFrameSkipStart(Math.max(0, Number(event.target.value) || 0))}
                        />
                      </div>
                      <Button type="button" variant="outline" onClick={() => void applyFrameSkipSelection()}>
                        Apply selection
                      </Button>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={() => void selectAllFrames()}>
                        Select all
                      </Button>
                      <Button type="button" variant="outline" onClick={() => void unselectAllFrames()}>
                        Unselect all
                      </Button>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      `0` skips nothing. Example: skip `1`, start `0` keeps every other frame.
                    </p>
                  </div>

                  <ScrollArea className="h-[360px] pr-3 md:h-[540px]">
                    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                      {activeJob.frames.map((frame) => {
                        const checked = activeJob.selectedFrameNumbers.includes(frame.number);
                        const cachedFrameUrl = cachedFrameUrls[frame.number] ?? null;

                        return (
                          <div
                            key={frame.fileName}
                            role="button"
                            tabIndex={0}
                            aria-pressed={checked}
                            onClick={() => void toggleFrameSelection(frame.number)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                void toggleFrameSelection(frame.number);
                              }
                            }}
                            className={`cursor-pointer overflow-hidden rounded-[1.5rem] border transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              checked
                                ? "border-primary/60 bg-primary/6"
                                : "border-border/70 bg-background/70 hover:border-primary/40 hover:bg-secondary/40"
                            }`}
                          >
                            <div className="relative aspect-square">
                              {cachedFrameUrl ? (
                                <Image
                                  src={cachedFrameUrl}
                                  alt={`Frame ${frame.number}`}
                                  fill
                                  unoptimized
                                  sizes="(min-width: 1536px) 20vw, (min-width: 640px) 33vw, 100vw"
                                  className="object-cover"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center bg-secondary/40 text-xs text-muted-foreground">
                                  {isCachingFrames ? "Caching frame..." : "Frame not loaded"}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-3 p-3">
                              <div>
                                <div className="text-sm font-medium">Frame {frame.number}</div>
                                <div className="text-xs text-muted-foreground">{frame.fileName}</div>
                              </div>
                              <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(value) => void handleFrameToggle(frame.number, value === true)}
                                  aria-label={`Select frame ${frame.number}`}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <AssetInspectorDrawer
        title={inspectedJob?.title ?? "Job"}
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
