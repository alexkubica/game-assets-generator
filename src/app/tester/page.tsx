import { LevelTesterShell } from "@/components/level-tester-shell";
import { listJobs } from "@/lib/jobs";
import { listSprites } from "@/lib/sprites";
import { listTesterSetups } from "@/lib/tester-setups";

export default async function TesterPage() {
  const sprites = await listSprites();
  const jobs = await listJobs();
  const setups = await listTesterSetups();

  return <LevelTesterShell initialSprites={sprites} initialJobs={jobs} initialSetups={setups} />;
}
