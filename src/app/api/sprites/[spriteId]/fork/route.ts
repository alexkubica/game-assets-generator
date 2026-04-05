import { NextResponse } from "next/server";
import { forkSprite } from "@/lib/sprites";
import { forkSpriteSchema } from "@/lib/validators";

type Context = {
  params: Promise<{
    spriteId: string;
  }>;
};

export async function POST(request: Request, context: Context) {
  try {
    const { spriteId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const parsed = forkSpriteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
        { status: 400 },
      );
    }

    const sprite = await forkSprite(spriteId, parsed.data);
    return NextResponse.json({ sprite }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fork sprite." },
      { status: 500 },
    );
  }
}
