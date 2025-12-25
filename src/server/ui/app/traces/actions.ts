"use server";

import { ApiResponse } from "@/lib/api-response";
import { getJaegerUrl, handleResponse, handleError } from "@/lib/api-config";
import {
  JaegerTrace,
  JaegerTracesResponse,
} from "@/types";

// Check if Jaeger is accessible
export async function checkJaegerAvailability(
  url?: string
): Promise<ApiResponse<{ available: boolean; url: string }>> {
  try {
    const jaegerUrl = url || getJaegerUrl();
    const response = await fetch(`${jaegerUrl}/api/services`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });

    return {
      code: 0,
      data: {
        available: response.ok,
        url: jaegerUrl,
      },
      message: "success",
    };
  } catch (error) {
    console.error("checkJaegerAvailability error:", error);
    return {
      code: 1,
      data: {
        available: false,
        url: url || getJaegerUrl(),
      },
      message: error instanceof Error ? error.message : "Failed to check Jaeger availability",
    };
  }
}

// Get Jaeger URL
export async function getJaegerUrlAction(): Promise<ApiResponse<{ url: string }>> {
  try {
    return {
      code: 0,
      data: {
        url: getJaegerUrl(),
      },
      message: "success",
    };
  } catch (error) {
    return handleError(error, "getJaegerUrl");
  }
}

// Get Jaeger services
export async function getJaegerServices(): Promise<ApiResponse<string[]>> {
  try {
    const jaegerUrl = getJaegerUrl();
    const response = await fetch(`${jaegerUrl}/api/services`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Jaeger API error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      code: 0,
      data: data.data || [],
      message: "success",
    };
  } catch (error) {
    return handleError(error, "getJaegerServices");
  }
}

// Get Jaeger traces
export async function getJaegerTraces(
  service: string = "acontext-api",
  limit: number = 50,
  lookback?: string,
  start?: number,
  end?: number
): Promise<ApiResponse<{
  traces: JaegerTrace[];
  total: number;
  limit: number;
  offset: number;
}>> {
  try {
    const jaegerUrl = getJaegerUrl();

    // Check if Jaeger is accessible
    const availabilityCheck = await checkJaegerAvailability(jaegerUrl);
    if (!availabilityCheck.data?.available) {
      return {
        code: 1,
        data: null,
        message: `Jaeger is not available at ${jaegerUrl}. Please check if Jaeger is running.`,
      };
    }

    // Calculate time range
    let endTime: number;
    let startTime: number;

    if (start !== undefined && end !== undefined) {
      // Use explicit start/end for pagination
      startTime = start;
      endTime = end;
    } else {
      // Calculate from lookback parameter
      endTime = Date.now() * 1000; // microseconds
      const lookbackValue = lookback || "1h";
      // Parse lookback parameter (e.g., "15m", "1h", "6h", "24h", "7d")
      const lookbackMatch = lookbackValue.match(/^(\d+)([hdms])$/);
      if (lookbackMatch) {
        const value = parseInt(lookbackMatch[1], 10);
        const unit = lookbackMatch[2];
        const multiplier =
          unit === "s" ? 1000 :
          unit === "m" ? 60000 :
          unit === "h" ? 3600000 :
          86400000; // days
        startTime = endTime - (value * multiplier * 1000); // Convert to microseconds
      } else {
        // Default to 1 hour
        startTime = endTime - (3600 * 1000 * 1000);
      }
    }

    // Build Jaeger API URL
    const params = new URLSearchParams({
      service: service,
      limit: limit.toString(),
      start: startTime.toString(),
      end: endTime.toString(),
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

    return {
      code: 0,
      data: {
        traces: data.data || [],
        total: data.total || 0,
        limit: data.limit || limit,
        offset: data.offset || 0,
      },
      message: "success",
    };
  } catch (error) {
    return handleError(error, "getJaegerTraces");
  }
}

