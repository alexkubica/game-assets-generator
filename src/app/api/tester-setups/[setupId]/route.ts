import { NextResponse } from "next/server";
import { readTesterSetup, updateTesterSetup } from "@/lib/tester-setups";
import { updateTesterSetupSchema } from "@/lib/validators";

type Context = {
  params: Promise<{
    setupId: string;
  }>;
};

export async function GET(_: Request, context: Context) {
  try {
    const { setupId } = await context.params;
    const setup = await readTesterSetup(setupId);
    return NextResponse.json({ setup });
  } catch {
    return NextResponse.json({ error: "Tester setup not found." }, { status: 404 });
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { setupId } = await context.params;
    const parsed = updateTesterSetupSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
        { status: 400 },
      );
    }

    const setup = await updateTesterSetup(setupId, (current) => ({
      ...current,
      title: parsed.data.title ?? current.title,
      projectId: parsed.data.projectId ?? current.projectId,
      defaultAssetKey: parsed.data.defaultAssetKey ?? current.defaultAssetKey,
      defaultFps: parsed.data.defaultFps ?? current.defaultFps,
      defaultScale: parsed.data.defaultScale ?? current.defaultScale,
      defaultOrientation: parsed.data.defaultOrientation ?? current.defaultOrientation,
      states: parsed.data.states ?? current.states,
      assetOverrides: parsed.data.assetOverrides ?? current.assetOverrides,
    }));

    return NextResponse.json({ setup });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update tester setup." },
      { status: 500 },
    );
  }
}
