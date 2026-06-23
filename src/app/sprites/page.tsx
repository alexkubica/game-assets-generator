import { SpriteLibraryShell } from "@/components/sprite-library-shell";
import { listJobs } from "@/lib/jobs";
import { listSprites } from "@/lib/sprites";

export default async function SpritesPage({
  searchParams,
}: {
  searchParams?: Promise<{ sprite?: string }>;
}) {
  const initialSprites = await listSprites();
  const initialJobs = await listJobs();
  const generatedJobs = initialJobs.filter((job) => job.status === "ready");
  const params = await searchParams;

  return (
    <SpriteLibraryShell
      initialSprites={initialSprites}
      generatedJobs={generatedJobs}
      initialActiveSpriteId={params?.sprite ?? null}
    />
  );
}
