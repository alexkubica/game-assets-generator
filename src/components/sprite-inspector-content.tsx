import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SpriteAsset } from "@/lib/types";

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
  sprite: SpriteAsset;
  onOpenMain?: () => void;
  onFork?: () => void;
  onArchive?: () => void;
};

export function SpriteInspectorContent({ sprite, onOpenMain, onFork, onArchive }: Props) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{sprite.sourceType === "generated" ? "Generated" : "Uploaded"}</Badge>
        <Badge variant="secondary">{sprite.frameCount} frames</Badge>
        <Badge variant="secondary">{sprite.playbackFps} FPS</Badge>
        {sprite.gifAssetPath ? <Badge variant="secondary">GIF exported</Badge> : null}
      </div>

      <div className="grid gap-3 rounded-2xl border border-border/70 bg-card/60 p-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Created</span>
          <span>{formatTimestamp(sprite.createdAt)} UTC</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Updated</span>
          <span>{formatTimestamp(sprite.updatedAt)} UTC</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Origin</span>
          <span>{sprite.originalJobId ? "Generated from job" : "Manual upload"}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Lineage</span>
          <span>{sprite.sourceSpriteId ? "Forked sprite" : "Original sprite"}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Sheet size</span>
          <span>{sprite.imageWidth}x{sprite.imageHeight}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Cell size</span>
          <span>{sprite.cellWidth}x{sprite.cellHeight}</span>
        </div>
      </div>

      <div className="grid gap-2 rounded-2xl border border-border/70 bg-card/60 p-4">
        <div className="text-sm font-medium">Usage</div>
        <p className="text-sm text-muted-foreground">
          Used {sprite.usageCount} time(s){sprite.lastUsedAt ? `, last touched ${formatTimestamp(sprite.lastUsedAt)} UTC.` : "."}
        </p>
      </div>

      <div className="grid gap-2 rounded-2xl border border-border/70 bg-card/60 p-4">
        <div className="text-sm font-medium">Chroma key</div>
        <p className="text-sm text-muted-foreground">
          {sprite.chromaKeyColor
            ? `Enabled at ${sprite.chromaKeyColor} with tolerance ${sprite.chromaKeyTolerance}.`
            : "No chroma key saved for this sprite."}
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
