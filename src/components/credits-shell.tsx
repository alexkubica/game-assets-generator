import { AlertCircle, ArrowUpRight, CreditCard, Wallet } from "lucide-react";
import { CreditsActivityHistory } from "@/components/credits-activity-history";
import { CreditsRefreshButton } from "@/components/credits-refresh-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  BillingBalanceResponse,
  BillingUsageBreakdownItem,
} from "@/lib/types";

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function formatTimestamp(value?: string) {
  if (!value) {
    return "Unknown time";
  }

  return `${timestampFormatter.format(new Date(value))} UTC`;
}

function parseCents(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function numberToPlainString(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  const asString = value.toString();

  if (!/[eE]/.test(asString)) {
    return asString;
  }

  const [mantissa, exponentPart] = asString.toLowerCase().split("e");

  if (!mantissa || !exponentPart) {
    return asString;
  }

  const exponent = Number(exponentPart);

  if (!Number.isInteger(exponent)) {
    return asString;
  }

  const isNegative = mantissa.startsWith("-");
  const unsignedMantissa = isNegative ? mantissa.slice(1) : mantissa;
  const [integerPart, fractionalPart = ""] = unsignedMantissa.split(".");
  const digits = `${integerPart}${fractionalPart}`;
  const decimalIndex = integerPart.length + exponent;

  let plain: string;

  if (decimalIndex <= 0) {
    plain = `0.${"0".repeat(Math.abs(decimalIndex))}${digits}`;
  } else if (decimalIndex >= digits.length) {
    plain = `${digits}${"0".repeat(decimalIndex - digits.length)}`;
  } else {
    plain = `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
  }

  return isNegative ? `-${plain}` : plain;
}

function formatUsdPrecise(value: number) {
  const absolute = Math.abs(value);
  const [integerPartRaw, fractionalPartRaw] = numberToPlainString(absolute).split(".");
  const integerPart = Number(integerPartRaw || "0").toLocaleString("en-US");
  const fractionalPart = fractionalPartRaw?.replace(/0+$/, "");
  const prefix = value < 0 ? "-$" : "$";

  return `${prefix}${fractionalPart ? `${integerPart}.${fractionalPart}` : integerPart}`;
}

function getAvailableCreditCents(total: string) {
  return parseCents(total) * -1;
}

export function CreditsShell({
  initialBalance,
  initialTotalSpentUsd,
  spendBreakdown,
  initialError,
}: {
  initialBalance: BillingBalanceResponse | null;
  initialTotalSpentUsd: number | null;
  spendBreakdown: BillingUsageBreakdownItem[];
  initialError: string | null;
}) {
  const prepaidCreditUsd = initialBalance ? getAvailableCreditCents(initialBalance.total.val) / 100 : null;
  const availableCreditUsd =
    prepaidCreditUsd !== null && initialTotalSpentUsd !== null ? prepaidCreditUsd - initialTotalSpentUsd : prepaidCreditUsd;
  const latestChange = initialBalance?.changes[0] ?? null;

  return (
    <div className="grid gap-6">
      <Card className="overflow-hidden">
        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Badge className="w-fit rounded-full px-3 py-1 text-xs uppercase tracking-[0.22em]" variant="secondary">
              Billing Monitor
            </Badge>
            <div className="space-y-1">
              <CardTitle className="text-2xl sm:text-3xl">API credits</CardTitle>
              <CardDescription>Track available credits, total spend, spend breakdown, history, and recent balance changes.</CardDescription>
            </div>
          </div>

          <CreditsRefreshButton />
        </CardHeader>
      </Card>

      {initialError ? (
        <Card className="border-amber-300/70 bg-amber-50/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-950">
              <AlertCircle className="h-5 w-5" />
              Credits unavailable
            </CardTitle>
            <CardDescription className="text-amber-900/80">{initialError}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total available</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <Wallet className="h-6 w-6 text-emerald-600" />
              {availableCreditUsd === null ? "--" : formatUsdPrecise(availableCreditUsd)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Total spent</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <ArrowUpRight className="h-6 w-6 text-amber-600" />
              {initialTotalSpentUsd === null ? "--" : formatUsdPrecise(initialTotalSpentUsd)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Balance events</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <CreditCard className="h-6 w-6 text-sky-600" />
              {initialBalance?.changes.length ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Latest activity</CardDescription>
            <CardTitle className="text-lg">{latestChange ? latestChange.changeOrigin : "No activity yet"}</CardTitle>
            <CardDescription>{formatTimestamp(latestChange?.createTs ?? latestChange?.createTime)}</CardDescription>
          </CardHeader>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Spending history</CardTitle>
            <CardDescription>Credit activity grouped by day, sorted from most recent to oldest.</CardDescription>
          </CardHeader>

          <CardContent>
            <CreditsActivityHistory changes={initialBalance?.changes ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spend breakdown</CardTitle>
            <CardDescription>Lifetime spend grouped by usage description from the Management API.</CardDescription>
          </CardHeader>

          <CardContent>
            {spendBreakdown.length > 0 ? (
              <div className="space-y-3">
                {spendBreakdown.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-background/70 px-4 py-3"
                  >
                    <div className="min-w-0 text-sm font-medium">{item.label}</div>
                    <div className={item.usd > 0 ? "shrink-0 text-sm font-semibold text-amber-600" : "shrink-0 text-sm text-muted-foreground"}>
                      {formatUsdPrecise(item.usd)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 p-6 text-sm text-muted-foreground">
                No grouped spend data was returned for this team yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Balance notes</CardTitle>
            <CardDescription>
              Spend is shown as a negative amount. Top-ups and refunds are shown as positive amounts.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
              The history list on this page is sourced from prepaid balance changes, so you can inspect individual spend and
              top-up events within each day.
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
