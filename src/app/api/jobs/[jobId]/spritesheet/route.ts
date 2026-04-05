import { NextResponse } from "next/server";
import { addDerivedSpriteToJob, readJobManifest, updateJobManifest } from "@/lib/jobs";
import { upsertGeneratedSprite } from "@/lib/sprites";
import { createSpritesheet } from "@/lib/video";

type Context = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function POST(_: Request, context: Context) {
  try {
    const { jobId } = await context.params;
    const job = await readJobManifest(jobId);

    if (job.status !== "ready") {
      return NextResponse.json(
        { error: "Spritesheet export is only available for ready jobs." },
        { status: 400 },
      );
    }

    const selectedFrames = job.selectedFrameNumbers
      .map((frameNumber) => job.frames.find((frame) => frame.number === frameNumber))
      .filter((frame) => frame !== undefined);

    if (selectedFrames.length === 0) {
      return NextResponse.json(
        { error: "Select at least one frame before exporting a spritesheet." },
        { status: 400 },
      );
    }

    const spritesheet = await createSpritesheet(jobId, selectedFrames);
    const updatedJob = await updateJobManifest(jobId, (current) => ({
      ...current,
      spritesheet,
    }));
    const sprite = await upsertGeneratedSprite(updatedJob);
    const finalJob = await addDerivedSpriteToJob(updatedJob.jobId, sprite.spriteId);

    return NextResponse.json({ job: finalJob });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to export spritesheet." },
      { status: 500 },
    );
  }
}
