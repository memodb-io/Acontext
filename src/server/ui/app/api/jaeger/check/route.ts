import { createApiResponse, createApiError } from "@/lib/api-response";
import { NextResponse } from "next/server";

const getJaegerUrl = () => {
  return process.env.JAEGER_INTERNAL_URL || process.env.JAEGER_URL || "http://localhost:16686";
};

// 检查 Jaeger 是否可访问
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

export async function GET() {
  try {
    const jaegerUrl = getJaegerUrl();
    const isAvailable = await checkJaegerAvailability(jaegerUrl);

    return createApiResponse({
      available: isAvailable,
      url: jaegerUrl,
    }, "Success");
  } catch (error) {
    console.error("Failed to check Jaeger availability:", error);
    const errorResponse = createApiError(
      error instanceof Error ? error.message : "Failed to check Jaeger availability",
      1
    );
    return new NextResponse(errorResponse.body, {
      status: 500,
      headers: errorResponse.headers,
    });
  }
}

