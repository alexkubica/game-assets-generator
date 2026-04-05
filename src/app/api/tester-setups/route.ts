import { NextResponse } from "next/server";
import { createTesterSetup, listTesterSetups } from "@/lib/tester-setups";
import { createTesterSetupSchema } from "@/lib/validators";

export async function GET() {
  const setups = await listTesterSetups();
  return NextResponse.json({ setups });
}

export async function POST(request: Request) {
  try {
    const parsed = createTesterSetupSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
        { status: 400 },
      );
    }

    const setup = await createTesterSetup({
      title: parsed.data.title,
      projectId: parsed.data.projectId ?? null,
      defaultAssetKey: parsed.data.defaultAssetKey,
      defaultFps: parsed.data.defaultFps,
      defaultScale: parsed.data.defaultScale,
      defaultOrientation: parsed.data.defaultOrientation,
      states: parsed.data.states,
      assetOverrides: parsed.data.assetOverrides,
    });

    return NextResponse.json({ setup }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create tester setup." },
      { status: 500 },
    );
  }
}
