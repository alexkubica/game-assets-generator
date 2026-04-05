import { NextResponse } from "next/server";
import { forkTesterSetup } from "@/lib/tester-setups";
import { forkJobSchema } from "@/lib/validators";

type Context = {
  params: Promise<{
    setupId: string;
  }>;
};

export async function POST(request: Request, context: Context) {
  try {
    const { setupId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const parsed = forkJobSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
        { status: 400 },
      );
    }

    const setup = await forkTesterSetup(setupId, parsed.data);
    return NextResponse.json({ setup }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fork tester setup." },
      { status: 500 },
    );
  }
}
