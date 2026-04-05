import { CreditsShell } from "@/components/credits-shell";
import {
  getPrepaidBalance,
  getUsageSpendBreakdown,
  getUsageTotalSpentUsd,
  getXaiTeamId,
} from "@/lib/xai";
import type { BillingBalanceResponse, BillingUsageBreakdownItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CreditsPage() {
  let initialBalance: BillingBalanceResponse | null = null;
  let initialTotalSpentUsd: number | null = null;
  let spendBreakdown: BillingUsageBreakdownItem[] = [];
  let initialError: string | null = null;

  try {
    const teamId = getXaiTeamId();
    [initialBalance, initialTotalSpentUsd, spendBreakdown] = await Promise.all([
      getPrepaidBalance(teamId),
      getUsageTotalSpentUsd(teamId),
      getUsageSpendBreakdown(teamId),
    ]);
  } catch (error) {
    initialError = error instanceof Error ? error.message : "Unable to load billing credits.";
  }

  return (
    <CreditsShell
      initialBalance={initialBalance}
      initialTotalSpentUsd={initialTotalSpentUsd}
      spendBreakdown={spendBreakdown}
      initialError={initialError}
    />
  );
}
