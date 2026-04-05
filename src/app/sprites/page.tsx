import { SpriteLibraryShell } from "@/components/sprite-library-shell";
import { listJobs } from "@/lib/jobs";
import { listSprites } from "@/lib/sprites";

export default async function SpritesPage() {
  const initialSprites = await listSprites();
  const initialJobs = await listJobs();
  const generatedJobs = initialJobs.filter((job) => job.spritesheet !== null);

  return <SpriteLibraryShell initialSprites={initialSprites} generatedJobs={generatedJobs} />;
}
