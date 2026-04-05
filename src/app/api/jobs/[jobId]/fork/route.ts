import { NextResponse } from "next/server";
import { enqueueJob } from "@/lib/job-runner";
import { forkJob } from "@/lib/jobs";
import { forkJobSchema } from "@/lib/validators";

type Context = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function POST(request: Request, context: Context) {
  try {
    const { jobId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const parsed = forkJobSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
        { status: 400 },
      );
    }

    const job = await forkJob(jobId, parsed.data);
    await enqueueJob(job);
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fork job." },
      { status: 500 },
    );
  }
}
