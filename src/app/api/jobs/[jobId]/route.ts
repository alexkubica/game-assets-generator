import { NextResponse } from "next/server";
import { readJobManifest, updateJobManifest } from "@/lib/jobs";
import { updateJobSchema } from "@/lib/validators";

type Context = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function GET(_: Request, context: Context) {
  try {
    const { jobId } = await context.params;
    const job = await readJobManifest(jobId);
    return NextResponse.json({ job });
  } catch {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { jobId } = await context.params;
    const body = await request.json();
    const parsed = updateJobSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
        { status: 400 },
      );
    }

    const job = await updateJobManifest(jobId, (current) => ({
      ...current,
      title: parsed.data.title ?? current.title,
      selectedFrameNumbers:
        parsed.data.selectedFrameNumbers ?? current.selectedFrameNumbers,
      spritesheet:
        parsed.data.selectedFrameNumbers !== undefined ? null : current.spritesheet,
      previewFps: parsed.data.previewFps ?? current.previewFps,
    }));

    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update job." },
      { status: 500 },
    );
  }
}
