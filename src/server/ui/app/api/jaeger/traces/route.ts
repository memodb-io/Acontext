import { NextRequest, NextResponse } from "next/server";
import { createApiResponse, createApiError } from "@/lib/api-response";

// Jaeger API 类型定义
export interface JaegerTrace {
  traceID: string;
  spans: JaegerSpan[];
  processes: Record<string, JaegerProcess>;
  warnings?: string[] | null;
}

export interface JaegerSpan {
  traceID: string;
  spanID: string;
  flags: number;
  operationName: string;
  references: JaegerReference[];
  startTime: number;
  duration: number;
  tags: JaegerTag[];
  logs: JaegerLog[];
  processID: string;
  warnings?: string[] | null;
}

export interface JaegerReference {
  refType: string;
  traceID: string;
  spanID: string;
}

export interface JaegerTag {
  key: string;
  value: string | number | boolean;
  type?: string;
}

export interface JaegerLog {
  timestamp: number;
  fields: JaegerTag[];
}

export interface JaegerProcess {
  serviceName: string;
  tags: JaegerTag[];
}

export interface JaegerTracesResponse {
  data: JaegerTrace[];
  total: number;
  limit: number;
  offset: number;
  errors?: unknown[] | null;
}

// Get Jaeger base URL (internal URL for server-side API calls)
const getJaegerUrl = () => {
  return process.env.JAEGER_INTERNAL_URL || process.env.JAEGER_URL || "http://localhost:16686";
};

// Check if Jaeger is accessible
async function checkJaegerAvailability(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/api/services`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// 获取 traces 列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const service = searchParams.get("service") || "acontext-api";
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const lookback = searchParams.get("lookback") || "1h"; // Default to last 1 hour

    const jaegerUrl = getJaegerUrl();

    // Check if Jaeger is accessible
    const isAvailable = await checkJaegerAvailability(jaegerUrl);
    if (!isAvailable) {
      const errorResponse = createApiError(
        `Jaeger is not available at ${jaegerUrl}. Please check if Jaeger is running.`,
        1
      );
      return new NextResponse(errorResponse.body, {
        status: 503,
        headers: errorResponse.headers,
      });
    }

    // Calculate time range
    // Support explicit start/end parameters for pagination
    let end: number;
    let start: number;

    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    if (startParam && endParam) {
      // Use explicit start/end for pagination
      start = parseInt(startParam, 10);
      end = parseInt(endParam, 10);
    } else {
      // Calculate from lookback parameter
      end = Date.now() * 1000; // microseconds
      // Parse lookback parameter (e.g., "15m", "1h", "6h", "24h", "7d")
      const lookbackMatch = lookback.match(/^(\d+)([hdms])$/);
      if (lookbackMatch) {
        const value = parseInt(lookbackMatch[1], 10);
        const unit = lookbackMatch[2];
        const multiplier =
          unit === "s" ? 1000 :
          unit === "m" ? 60000 :
          unit === "h" ? 3600000 :
          86400000; // days
        start = end - (value * multiplier * 1000); // Convert to microseconds
      } else {
        // Default to 1 hour
        start = end - (3600 * 1000 * 1000);
      }
    }

    // Build Jaeger API URL
    const params = new URLSearchParams({
      service: service,
      limit: limit.toString(),
      start: start.toString(),
      end: end.toString(),
    });

    const jaegerApiUrl = `${jaegerUrl}/api/traces?${params.toString()}`;

    // Fetch data from Jaeger
    const response = await fetch(jaegerApiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Jaeger API error: ${response.statusText}`);
    }

    const data: JaegerTracesResponse = await response.json();

    return createApiResponse({
      traces: data.data || [],
      total: data.total || 0,
      limit: data.limit || limit,
      offset: data.offset || 0,
    }, "Success");
  } catch (error) {
    console.error("Failed to fetch traces from Jaeger:", error);
    const errorResponse = createApiError(
      error instanceof Error ? error.message : "Failed to fetch traces",
      1
    );
    return new NextResponse(errorResponse.body, {
      status: 500,
      headers: errorResponse.headers,
    });
  }
}

