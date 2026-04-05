import { listJobs } from "@/lib/jobs";
import { listSprites } from "@/lib/sprites";
import { listTesterSetups } from "@/lib/tester-setups";
import { WorkspaceShell } from "@/components/workspace-shell";

export default async function HomePage() {
  const [jobs, sprites, setups] = await Promise.all([
    listJobs(),
    listSprites(),
    listTesterSetups(),
  ]);

  return <WorkspaceShell jobs={jobs} sprites={sprites} setups={setups} />;
}
