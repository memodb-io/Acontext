import { createApiResponse } from "@/lib/api-response";

const getJaegerUrl = () => {
  return process.env.JAEGER_URL || "http://localhost:16686";
};

export async function GET() {
  return createApiResponse({
    url: getJaegerUrl(),
  }, "Success");
}

