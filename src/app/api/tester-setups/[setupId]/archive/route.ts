import { NextResponse } from "next/server";
import { archiveTesterSetup } from "@/lib/tester-setups";
import { archiveEntitySchema } from "@/lib/validators";

type Context = {
  params: Promise<{
    setupId: string;
  }>;
};

export async function POST(request: Request, context: Context) {
  try {
    const { setupId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const parsed = archiveEntitySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
        { status: 400 },
      );
    }

    const setup = await archiveTesterSetup(setupId);
    return NextResponse.json({ setup });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to archive tester setup." },
      { status: 500 },
    );
  }
}
