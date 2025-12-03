import { createApiResponse, createApiError } from "@/lib/api-response";
import { NextResponse } from "next/server";

const getJaegerUrl = () => {
  return process.env.JAEGER_INTERNAL_URL || process.env.JAEGER_URL || "http://localhost:16686";
};

export async function GET() {
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

    return createApiResponse(data.data || [], "Success");
  } catch (error) {
    console.error("Failed to fetch services from Jaeger:", error);
    const errorResponse = createApiError(
      error instanceof Error ? error.message : "Failed to fetch services",
      1
    );
    return new NextResponse(errorResponse.body, {
      status: 500,
      headers: errorResponse.headers,
    });
  }
}

