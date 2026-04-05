import { NextResponse } from "next/server";
import {
  getPrepaidBalance,
  getUsageSpendBreakdown,
  getUsageTotalSpentUsd,
  getXaiTeamId,
} from "@/lib/xai";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const teamId = getXaiTeamId();
    const [balance, totalSpentUsd, spendBreakdown] = await Promise.all([
      getPrepaidBalance(teamId),
      getUsageTotalSpentUsd(teamId),
      getUsageSpendBreakdown(teamId),
    ]);

    return NextResponse.json({ balance, totalSpentUsd, spendBreakdown });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load billing credits." },
      { status: 500 },
    );
  }
}
