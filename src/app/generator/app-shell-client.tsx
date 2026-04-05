"use client";

import dynamic from "next/dynamic";
import type { JobManifest } from "@/lib/types";

const AppShell = dynamic(() => import("@/components/app-shell").then((mod) => mod.AppShell), {
  ssr: false,
});

export function AppShellClient({ initialJobs }: { initialJobs: JobManifest[] }) {
  return <AppShell initialJobs={initialJobs} />;
}
