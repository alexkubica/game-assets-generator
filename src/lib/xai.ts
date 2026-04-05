import type {
  BillingBalanceResponse,
  BillingUsageBreakdownItem,
  BillingUsageHistoryPoint,
  BillingUsageResponse,
} from "@/lib/types";

const XAI_BASE_URL = "https://api.x.ai/v1";
const XAI_MANAGEMENT_BASE_URL = "https://management-api.x.ai/v1";

interface CreateGenerationResponse {
  request_id: string;
}

interface GenerationStatusResponse {
  status: "pending" | "done" | "expired";
  video?: {
    url: string;
    duration?: number;
    respect_moderation?: boolean;
  };
  model?: string;
}

function getApiKey() {
  const apiKey = process.env.XAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing XAI_API_KEY in the environment.");
  }

  return apiKey;
}

function getManagementApiKey() {
  const apiKey = process.env.XAI_MANAGEMENT_API_KEY;

  if (!apiKey) {
    throw new Error("Missing XAI_MANAGEMENT_API_KEY in the environment.");
  }

  return apiKey;
}

export function getXaiTeamId() {
  const teamId = process.env.XAI_TEAM_ID;

  if (!teamId) {
    throw new Error("Missing XAI_TEAM_ID in the environment.");
  }

  return teamId;
}

async function xaiFetch<T>(pathname: string, init?: RequestInit) {
  const response = await fetch(`${XAI_BASE_URL}${pathname}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`xAI API ${response.status}: ${message}`);
  }

  return (await response.json()) as T;
}

async function xaiManagementFetch<T>(pathname: string, init?: RequestInit) {
  const response = await fetch(`${XAI_MANAGEMENT_BASE_URL}${pathname}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getManagementApiKey()}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`xAI Management API ${response.status}: ${message}`);
  }

  return (await response.json()) as T;
}

export async function createImageToVideoGeneration(args: {
  prompt: string;
  imageDataUri: string;
  duration: number;
  aspectRatio: string;
  resolution: string;
}) {
  return xaiFetch<CreateGenerationResponse>("/videos/generations", {
    method: "POST",
    body: JSON.stringify({
      model: "grok-imagine-video",
      prompt: args.prompt,
      image: {
        url: args.imageDataUri,
      },
      duration: args.duration,
      aspect_ratio: args.aspectRatio,
      resolution: args.resolution,
    }),
  });
}

export async function getGenerationStatus(requestId: string) {
  return xaiFetch<GenerationStatusResponse>(`/videos/${requestId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function getPrepaidBalance(teamId: string) {
  return xaiManagementFetch<BillingBalanceResponse>(`/billing/teams/${teamId}/prepaid/balance`, {
    method: "GET",
  });
}

function formatUsageTimestamp(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  const hours = String(value.getUTCHours()).padStart(2, "0");
  const minutes = String(value.getUTCMinutes()).padStart(2, "0");
  const seconds = String(value.getUTCSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export async function getUsageTotalSpentUsd(teamId: string) {
  const response = await xaiManagementFetch<BillingUsageResponse>(`/billing/teams/${teamId}/usage`, {
    method: "POST",
    body: JSON.stringify({
      analyticsRequest: {
        timeRange: {
          startTime: "2020-01-01 00:00:00",
          endTime: formatUsageTimestamp(new Date()),
          timezone: "Etc/UTC",
        },
        timeUnit: "TIME_UNIT_NONE",
        values: [
          {
            name: "usd",
            aggregation: "AGGREGATION_SUM",
          },
        ],
        groupBy: [],
        filters: [],
      },
    }),
  });

  return response.timeSeries.reduce((total, series) => {
    const seriesTotal = series.dataPoints.reduce((sum, point) => sum + (point.values[0] ?? 0), 0);
    return total + seriesTotal;
  }, 0);
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addUtcDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export async function getUsageSpentHistory(teamId: string, days = 14): Promise<BillingUsageHistoryPoint[]> {
  const today = startOfUtcDay(new Date());
  const start = addUtcDays(today, -(days - 1));
  const end = addUtcDays(today, 1);

  const response = await xaiManagementFetch<BillingUsageResponse>(`/billing/teams/${teamId}/usage`, {
    method: "POST",
    body: JSON.stringify({
      analyticsRequest: {
        timeRange: {
          startTime: formatUsageTimestamp(start),
          endTime: formatUsageTimestamp(end),
          timezone: "Etc/UTC",
        },
        timeUnit: "TIME_UNIT_DAY",
        values: [
          {
            name: "usd",
            aggregation: "AGGREGATION_SUM",
          },
        ],
        groupBy: [],
        filters: [],
      },
    }),
  });

  const totalsByTimestamp = new Map<string, number>();

  for (const series of response.timeSeries) {
    for (const point of series.dataPoints) {
      totalsByTimestamp.set(point.timestamp, (totalsByTimestamp.get(point.timestamp) ?? 0) + (point.values[0] ?? 0));
    }
  }

  return [...totalsByTimestamp.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([timestamp, usd]) => ({ timestamp, usd }));
}

export async function getUsageSpendBreakdown(teamId: string): Promise<BillingUsageBreakdownItem[]> {
  const response = await xaiManagementFetch<BillingUsageResponse>(`/billing/teams/${teamId}/usage`, {
    method: "POST",
    body: JSON.stringify({
      analyticsRequest: {
        timeRange: {
          startTime: "2020-01-01 00:00:00",
          endTime: formatUsageTimestamp(new Date()),
          timezone: "Etc/UTC",
        },
        timeUnit: "TIME_UNIT_NONE",
        values: [
          {
            name: "usd",
            aggregation: "AGGREGATION_SUM",
          },
        ],
        groupBy: ["description"],
        filters: [],
      },
    }),
  });

  return response.timeSeries
    .map((series) => ({
      label: series.groupLabels[0] ?? series.group[0] ?? "Unknown usage",
      usd: series.dataPoints.reduce((sum, point) => sum + (point.values[0] ?? 0), 0),
    }))
    .filter((item) => item.usd !== 0)
    .sort((left, right) => right.usd - left.usd);
}
