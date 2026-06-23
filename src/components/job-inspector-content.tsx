import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { JobManifest } from "@/lib/types";

function formatStatus(status: JobManifest["status"]) {
  return status.replace("-", " ");
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

type Props = {
  job: JobManifest;
  onOpenMain?: () => void;
  onFork?: () => void;
  onArchive?: () => void;
};

export function JobInspectorContent({ job, onOpenMain, onFork, onArchive }: Props) {
  const displayTitle = job.title.trim() || job.prompt;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{formatStatus(job.status)}</Badge>
        <Badge variant="secondary">{job.frames.length} total frames</Badge>
        <Badge variant="secondary">{job.selectedFrameNumbers.length} selected</Badge>
        {job.derivedSpriteIds.length > 0 ? <Badge variant="secondary">{job.derivedSpriteIds.length} sprites</Badge> : null}
      </div>

      <div className="grid gap-2 rounded-2xl border border-border/70 bg-card/60 p-4">
        <div className="text-sm font-medium">History</div>
        <p className="text-sm text-muted-foreground">{displayTitle}</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/60">
        {job.videoAssetPath ? (
          <video
            className="aspect-video h-full w-full object-cover"
            src={job.videoAssetPath}
            autoPlay
            loop
            muted
            playsInline
            controls
          />
        ) : (
          <div className="flex aspect-video items-center justify-center px-4 text-center text-sm text-muted-foreground">
            Video preview will appear here when the run finishes.
          </div>
        )}
      </div>

      <div className="grid gap-2 rounded-2xl border border-border/70 bg-card/60 p-4">
        <div className="text-sm font-medium">Prompt</div>
        <p className="text-sm text-muted-foreground">{job.prompt}</p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border/70 bg-card/60 p-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Created</span>
          <span>{formatTimestamp(job.createdAt)} UTC</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Updated</span>
          <span>{formatTimestamp(job.updatedAt)} UTC</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Duration</span>
          <span>{job.duration}s</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Aspect ratio</span>
          <span>{job.aspectRatio}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Resolution</span>
          <span>{job.resolution}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Lineage</span>
          <span>{job.sourceJobId ? "Forked job" : "Original job"}</span>
        </div>
      </div>

      <div className="grid gap-2 rounded-2xl border border-border/70 bg-card/60 p-4">
        <div className="text-sm font-medium">Related outputs</div>
        <p className="text-sm text-muted-foreground">
          {job.derivedSpriteIds.length > 0
            ? `${job.derivedSpriteIds.length} persisted sprite asset(s) derived from this job.`
            : "No derived sprites have been linked to this job yet."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {onOpenMain ? (
          <Button type="button" variant="outline" onClick={onOpenMain}>
            Open in page
          </Button>
        ) : null}
        {onFork ? (
          <Button type="button" variant="outline" onClick={onFork}>
            Fork
          </Button>
        ) : null}
        {onArchive ? (
          <Button type="button" variant="outline" onClick={onArchive}>
            Archive
          </Button>
        ) : null}
      </div>
    </div>
  );
}
