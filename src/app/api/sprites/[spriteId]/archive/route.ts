import { NextResponse } from "next/server";
import { archiveSprite } from "@/lib/sprites";
import { archiveEntitySchema } from "@/lib/validators";

type Context = {
  params: Promise<{
    spriteId: string;
  }>;
};

export async function POST(request: Request, context: Context) {
  try {
    const { spriteId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const parsed = archiveEntitySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
        { status: 400 },
      );
    }

    const sprite = await archiveSprite(spriteId);
    return NextResponse.json({ sprite });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to archive sprite." },
      { status: 500 },
    );
  }
}
