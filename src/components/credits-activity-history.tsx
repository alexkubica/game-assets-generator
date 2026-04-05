"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BillingBalanceChange } from "@/lib/types";

const PAGE_SIZE = 20;

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeStyle: "short",
  timeZone: "UTC",
});

function parseCents(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function getChangeTimestamp(change: BillingBalanceChange) {
  return change.createTs ?? change.createTime ?? "";
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

function formatSignedUsd(value: number) {
  const absolute = Math.abs(value);
  const [integerPartRaw, fractionalPartRaw] = numberToPlainString(absolute).split(".");
  const integerPart = Number(integerPartRaw || "0").toLocaleString("en-US");
  const fractionalPart = fractionalPartRaw?.replace(/0+$/, "");
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";

  return `${sign}$${fractionalPart ? `${integerPart}.${fractionalPart}` : integerPart}`;
}

function getDisplayUsd(change: BillingBalanceChange) {
  return parseCents(change.amount.val) * -1 / 100;
}

function getToneClass(usd: number) {
  if (usd > 0) {
    return "text-emerald-600";
  }

  if (usd < 0) {
    return "text-amber-600";
  }

  return "text-muted-foreground";
}

export function CreditsActivityHistory({ changes }: { changes: BillingBalanceChange[] }) {
  const [page, setPage] = useState(0);

  const sortedChanges = useMemo(
    () =>
      [...changes].sort((left, right) => {
        return new Date(getChangeTimestamp(right)).getTime() - new Date(getChangeTimestamp(left)).getTime();
      }),
    [changes],
  );

  const totalPages = Math.max(1, Math.ceil(sortedChanges.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = sortedChanges.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const groupedItems = useMemo(() => {
    const groups: Array<{ day: string; items: BillingBalanceChange[] }> = [];

    for (const change of pageItems) {
      const timestamp = getChangeTimestamp(change);
      const day = timestamp ? dayFormatter.format(new Date(timestamp)) : "Unknown day";
      const lastGroup = groups.at(-1);

      if (!lastGroup || lastGroup.day !== day) {
        groups.push({ day, items: [change] });
        continue;
      }

      lastGroup.items.push(change);
    }

    return groups;
  }, [pageItems]);

  if (sortedChanges.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 p-6 text-sm text-muted-foreground">
        No credit activity was returned for this team yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Showing {safePage * PAGE_SIZE + 1}-{Math.min((safePage + 1) * PAGE_SIZE, sortedChanges.length)} of{" "}
          {sortedChanges.length} events
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setPage((current) => Math.max(current - 1, 0))} disabled={safePage === 0}>
            <ArrowLeft className="h-4 w-4" />
            Newer
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => Math.min(current + 1, totalPages - 1))}
            disabled={safePage >= totalPages - 1}
          >
            Older
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {groupedItems.map((group) => (
        <div key={group.day} className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{group.day}</div>

          {group.items.map((change, index) => {
            const usd = getDisplayUsd(change);
            const timestamp = getChangeTimestamp(change);

            return (
              <div
                key={`${change.invoiceId ?? timestamp ?? "change"}-${index}`}
                className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/70 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{change.changeOrigin}</Badge>
                  {change.topupStatus ? <Badge variant="secondary">{change.topupStatus}</Badge> : null}
                  {change.paymentProcessor?.kind ? <Badge variant="secondary">{change.paymentProcessor.kind}</Badge> : null}
                </div>

                <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <div>{timestamp ? `${timeFormatter.format(new Date(timestamp))} UTC` : "Unknown time"}</div>
                  {change.invoiceNumber ? <div>Invoice {change.invoiceNumber}</div> : null}
                </div>

                <div className={`text-lg font-semibold ${getToneClass(usd)}`}>{formatSignedUsd(usd)}</div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
