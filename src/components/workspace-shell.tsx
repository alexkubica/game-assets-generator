import Link from "next/link";
import { Film, Gamepad2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { JobManifest, SpriteAsset, TesterSetup } from "@/lib/types";

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function WorkspaceShell({
  jobs,
  sprites,
  setups,
}: {
  jobs: JobManifest[];
  sprites: SpriteAsset[];
  setups: TesterSetup[];
}) {
  const recentJobs = jobs.slice(0, 4);
  const recentSprites = sprites.slice(0, 4);
  const recentSetups = setups.slice(0, 4);

  return (
    <main className="flex flex-col gap-6">
      <Card className="overflow-hidden">
        <CardHeader className="gap-4 border-b border-border/60 bg-card/60">
          <Badge className="w-fit">Workspace</Badge>
          <div className="space-y-2">
            <CardTitle className="text-3xl sm:text-4xl">Asset workbench overview</CardTitle>
            <CardDescription className="max-w-3xl text-base">
              Resume the latest generation runs, open saved sprite assets, and jump back into playable tester setups without using the home page as a duplicate generator entry point.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/generator">
                <Sparkles className="h-4 w-4" />
                Create run
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/sprites">
                <Film className="h-4 w-4" />
                Open library
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/tester">
                <Gamepad2 className="h-4 w-4" />
                Open tester
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-border/70 bg-background/70 p-4">
              <div className="text-sm font-medium">Generation runs</div>
              <div className="mt-2 text-2xl font-semibold">{jobs.length}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {jobs.filter((job) => job.status === "ready").length} ready for curation or export
              </div>
            </div>
            <div className="rounded-3xl border border-border/70 bg-background/70 p-4">
              <div className="text-sm font-medium">Saved sprites</div>
              <div className="mt-2 text-2xl font-semibold">{sprites.length}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {sprites.filter((sprite) => sprite.sourceType === "generated").length} generated, {sprites.filter((sprite) => sprite.sourceType === "uploaded").length} uploaded
              </div>
            </div>
            <div className="rounded-3xl border border-border/70 bg-background/70 p-4">
              <div className="text-sm font-medium">Tester setups</div>
              <div className="mt-2 text-2xl font-semibold">{setups.length}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Reusable playable validation setups
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Recent Runs</CardTitle>
                <CardDescription>Continue generation and frame curation.</CardDescription>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/generator">Open</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentJobs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                No generation runs yet.
              </div>
            ) : (
              recentJobs.map((job) => (
                <div key={job.jobId} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{job.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{formatTimestamp(job.updatedAt)} UTC</div>
                    </div>
                    <Badge variant="secondary">{job.status}</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Recent Sprites</CardTitle>
                <CardDescription>Open reusable assets from the library.</CardDescription>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/sprites">Open</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentSprites.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                No saved sprites yet.
              </div>
            ) : (
              recentSprites.map((sprite) => (
                <div key={sprite.spriteId} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{sprite.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{formatTimestamp(sprite.updatedAt)} UTC</div>
                    </div>
                    <Badge variant="secondary">{sprite.sourceType}</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Recent Setups</CardTitle>
                <CardDescription>Jump back into playable validation.</CardDescription>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/tester">Open</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentSetups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                No tester setups saved yet.
              </div>
            ) : (
              recentSetups.map((setup) => (
                <div key={setup.setupId} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{setup.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{formatTimestamp(setup.updatedAt)} UTC</div>
                    </div>
                    <Badge variant="secondary">{setup.defaultOrientation}</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
