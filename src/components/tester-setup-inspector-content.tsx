import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TesterSetup } from "@/lib/types";

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

type Props = {
  setup: TesterSetup;
  onFork?: () => void;
  onArchive?: () => void;
};

export function TesterSetupInspectorContent({ setup, onFork, onArchive }: Props) {
  const overriddenStates = Object.entries(setup.states).filter(([, value]) => value.assetKey || value.fps || value.scale || value.sourceOrientation);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>Tester setup</Badge>
        <Badge variant="secondary">{setup.defaultFps} FPS default</Badge>
        <Badge variant="secondary">{setup.defaultScale}x scale</Badge>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border/70 bg-card/60 p-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Created</span>
          <span>{formatTimestamp(setup.createdAt)} UTC</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Updated</span>
          <span>{formatTimestamp(setup.updatedAt)} UTC</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Default orientation</span>
          <span>{setup.defaultOrientation}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">State overrides</span>
          <span>{overriddenStates.length}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
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
