import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { exportSpriteGif, readSpriteManifest } from "@/lib/sprites";

type Context = {
  params: Promise<{
    spriteId: string;
  }>;
};

export async function POST(_: Request, context: Context) {
  try {
    const { spriteId } = await context.params;
    const sprite = await exportSpriteGif(spriteId);
    return NextResponse.json({ sprite });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to export GIF." },
      { status: 500 },
    );
  }
}

export async function GET(_: Request, context: Context) {
  try {
    const { spriteId } = await context.params;
    const sprite = await readSpriteManifest(spriteId);

    if (!sprite.gifPath) {
      return NextResponse.json({ error: "GIF has not been exported yet." }, { status: 404 });
    }

    const content = await readFile(sprite.gifPath);
    return new NextResponse(content, {
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "GIF not found." }, { status: 404 });
  }
}
