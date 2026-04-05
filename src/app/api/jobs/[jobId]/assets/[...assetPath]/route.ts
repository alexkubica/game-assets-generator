import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getJobDir } from "@/lib/jobs";

type Context = {
  params: Promise<{
    jobId: string;
    assetPath: string[];
  }>;
};

function getContentType(filePath: string) {
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".webp")) return "image/webp";
  if (filePath.endsWith(".mp4")) return "video/mp4";
  return "application/octet-stream";
}

export async function GET(_: Request, context: Context) {
  try {
    const { jobId, assetPath } = await context.params;
    const jobDir = path.resolve(getJobDir(jobId));
    const resolved = path.resolve(jobDir, ...assetPath);

    if (resolved !== jobDir && !resolved.startsWith(`${jobDir}${path.sep}`)) {
      return NextResponse.json({ error: "Invalid asset path." }, { status: 400 });
    }

    const content = await readFile(resolved);
    const isExport = assetPath[0] === "exports";
    return new NextResponse(content, {
      headers: {
        "Content-Type": getContentType(resolved),
        "Cache-Control": isExport
          ? "no-store"
          : "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }
}
