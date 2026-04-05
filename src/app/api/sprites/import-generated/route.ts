import { NextResponse } from "next/server";
import { addDerivedSpriteToJob } from "@/lib/jobs";
import { readJobManifest } from "@/lib/jobs";
import { upsertGeneratedSprite } from "@/lib/sprites";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { jobId?: string };

    if (!body.jobId) {
      return NextResponse.json({ error: "jobId is required." }, { status: 400 });
    }

    const job = await readJobManifest(body.jobId);

    if (!job.spritesheet) {
      return NextResponse.json(
        { error: "This job does not have an exported spritesheet yet." },
        { status: 400 },
      );
    }

    const sprite = await upsertGeneratedSprite(job);
    await addDerivedSpriteToJob(job.jobId, sprite.spriteId);
    return NextResponse.json({ sprite });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to import generated sprite." },
      { status: 500 },
    );
  }
}
