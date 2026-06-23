import { LevelTesterShell } from "@/components/level-tester-shell";
import { listJobs } from "@/lib/jobs";
import { listSprites } from "@/lib/sprites";
import { listTesterSetups } from "@/lib/tester-setups";

export default async function TesterPage({
  searchParams,
}: {
  searchParams?: Promise<{ sprite?: string }>;
}) {
  const sprites = await listSprites();
  const jobs = await listJobs();
  const setups = await listTesterSetups();
  const params = await searchParams;

  return (
    <LevelTesterShell
      initialSprites={sprites}
      initialJobs={jobs}
      initialSetups={setups}
      initialAssetKey={params?.sprite ? `sprite:${params.sprite}` : null}
    />
  );
}
