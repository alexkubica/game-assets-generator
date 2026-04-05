import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TesterSetup } from "@/lib/types";

const TESTER_SETUPS_DIR = path.join(process.cwd(), "data", "tester-setups");

function getTesterSetupsRoot() {
  return TESTER_SETUPS_DIR;
}

function getTesterSetupDir(setupId: string) {
  return path.join(getTesterSetupsRoot(), setupId);
}

function getTesterSetupManifestPath(setupId: string) {
  return path.join(getTesterSetupDir(setupId), "manifest.json");
}

async function ensureTesterSetupDir(setupId: string) {
  await mkdir(getTesterSetupDir(setupId), { recursive: true });
}

function normalizeTesterSetup(setup: TesterSetup): TesterSetup {
  return {
    ...setup,
    projectId: setup.projectId ?? null,
    archivedAt: setup.archivedAt ?? null,
    states: {
      idle: setup.states.idle ?? {
        assetKey: null,
        fps: null,
        scale: null,
        sourceOrientation: null,
      },
      walking: setup.states.walking ?? {
        assetKey: null,
        fps: null,
        scale: null,
        sourceOrientation: null,
      },
      jumping: setup.states.jumping ?? {
        assetKey: null,
        fps: null,
        scale: null,
        sourceOrientation: null,
      },
    },
    assetOverrides: setup.assetOverrides ?? {},
  };
}

export async function writeTesterSetup(setup: TesterSetup) {
  await ensureTesterSetupDir(setup.setupId);
  await writeFile(getTesterSetupManifestPath(setup.setupId), JSON.stringify(setup, null, 2), "utf8");
}

export async function readTesterSetup(setupId: string) {
  const raw = await readFile(getTesterSetupManifestPath(setupId), "utf8");
  return normalizeTesterSetup(JSON.parse(raw) as TesterSetup);
}

export async function updateTesterSetup(
  setupId: string,
  update: (setup: TesterSetup) => TesterSetup | Promise<TesterSetup>,
) {
  const current = await readTesterSetup(setupId);
  const next = normalizeTesterSetup(await update(current));
  next.updatedAt = new Date().toISOString();
  await writeTesterSetup(next);
  return next;
}

export async function listTesterSetups(options?: { includeArchived?: boolean }) {
  await mkdir(getTesterSetupsRoot(), { recursive: true });
  const entries = await readdir(getTesterSetupsRoot(), { withFileTypes: true });
  const setups = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        try {
          return await readTesterSetup(entry.name);
        } catch {
          return null;
        }
      }),
  );

  return setups
    .filter((setup): setup is TesterSetup => setup !== null)
    .filter((setup) => options?.includeArchived ? true : setup.archivedAt === null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createTesterSetup(input: Omit<TesterSetup, "setupId" | "createdAt" | "updatedAt" | "archivedAt">) {
  const now = new Date().toISOString();
  const setup: TesterSetup = normalizeTesterSetup({
    ...input,
    setupId: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  });

  await writeTesterSetup(setup);
  return setup;
}

export async function archiveTesterSetup(setupId: string) {
  return updateTesterSetup(setupId, (current) => ({
    ...current,
    archivedAt: current.archivedAt ?? new Date().toISOString(),
  }));
}

export async function restoreTesterSetup(setupId: string) {
  return updateTesterSetup(setupId, (current) => ({
    ...current,
    archivedAt: null,
  }));
}

export async function forkTesterSetup(setupId: string, overrides?: { title?: string }) {
  const source = await readTesterSetup(setupId);
  const now = new Date().toISOString();
  const forked: TesterSetup = normalizeTesterSetup({
    ...source,
    setupId: crypto.randomUUID(),
    title: overrides?.title?.trim() || `${source.title} (Copy)`,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  });

  await writeTesterSetup(forked);
  return forked;
}

export async function testerSetupExists(setupId: string) {
  try {
    await stat(getTesterSetupManifestPath(setupId));
    return true;
  } catch {
    return false;
  }
}
