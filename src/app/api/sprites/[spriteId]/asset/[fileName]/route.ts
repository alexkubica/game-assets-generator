import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSpriteDir } from "@/lib/sprites";

type Context = {
  params: Promise<{
    spriteId: string;
    fileName: string;
  }>;
};

function getContentType(filePath: string) {
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

export async function GET(_: Request, context: Context) {
  try {
    const { spriteId, fileName } = await context.params;
    const spriteDir = path.resolve(getSpriteDir(spriteId));
    const resolved = path.resolve(spriteDir, fileName);

    if (resolved !== spriteDir && !resolved.startsWith(`${spriteDir}${path.sep}`)) {
      return NextResponse.json({ error: "Invalid asset path." }, { status: 400 });
    }

    const content = await readFile(resolved);

    return new NextResponse(content, {
      headers: {
        "Content-Type": getContentType(resolved),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Sprite asset not found." }, { status: 404 });
  }
}
