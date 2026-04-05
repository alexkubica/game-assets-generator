import { AppShellClient } from "./app-shell-client";
import { listJobs } from "@/lib/jobs";

export default async function GeneratorPage() {
  const initialJobs = await listJobs();

  return <AppShellClient initialJobs={initialJobs} />;
}
