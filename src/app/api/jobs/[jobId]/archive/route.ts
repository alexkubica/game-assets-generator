import { NextResponse } from "next/server";
import { archiveJob } from "@/lib/jobs";
import { archiveEntitySchema } from "@/lib/validators";

type Context = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function POST(request: Request, context: Context) {
  try {
    const { jobId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const parsed = archiveEntitySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
        { status: 400 },
      );
    }

    const job = await archiveJob(jobId);
    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to archive job." },
      { status: 500 },
    );
  }
}
