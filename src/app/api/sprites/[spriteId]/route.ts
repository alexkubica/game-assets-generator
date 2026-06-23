import { NextResponse } from "next/server";
import { readSpriteManifest, updateSpriteManifest } from "@/lib/sprites";
import { updateSpriteSchema } from "@/lib/validators";

type Context = {
  params: Promise<{
    spriteId: string;
  }>;
};

export async function GET(_: Request, context: Context) {
  try {
    const { spriteId } = await context.params;
    const sprite = await readSpriteManifest(spriteId);
    return NextResponse.json({ sprite });
  } catch {
    return NextResponse.json({ error: "Sprite not found." }, { status: 404 });
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { spriteId } = await context.params;
    const parsed = updateSpriteSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
        { status: 400 },
      );
    }

    const sprite = await updateSpriteManifest(spriteId, (current) => ({
      ...current,
      title: parsed.data.title ?? current.title,
      cellWidth: parsed.data.cellWidth ?? current.cellWidth,
      cellHeight: parsed.data.cellHeight ?? current.cellHeight,
      frameCount: parsed.data.frameCount ?? current.frameCount,
      selectedFrameNumbers: parsed.data.selectedFrameNumbers ?? current.selectedFrameNumbers,
      playbackFps: parsed.data.playbackFps ?? current.playbackFps,
      chromaKeyColor: parsed.data.chromaKeyColor ?? current.chromaKeyColor,
      chromaKeyTolerance: parsed.data.chromaKeyTolerance ?? current.chromaKeyTolerance,
    }));

    return NextResponse.json({ sprite });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update sprite." },
      { status: 500 },
    );
  }
}
