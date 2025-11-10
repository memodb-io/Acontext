import { createApiResponse, createApiError } from "@/lib/api-response";
import { Session, GetSessionsResp } from "@/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const spaceId = searchParams.get("space_id");
  const notConnected = searchParams.get("not_connected");
  const limit = parseInt(searchParams.get("limit") || "20");
  const cursor = searchParams.get("cursor") || undefined;
  const time_desc = searchParams.get("time_desc") === "true";

  const getSessions = new Promise<GetSessionsResp>(async (resolve, reject) => {
    try {
      // Build query parameters
      const params = new URLSearchParams({
        limit: limit.toString(),
        time_desc: time_desc.toString(),
      });
      if (spaceId) {
        params.append("space_id", spaceId);
      }
      if (notConnected) {
        params.append("not_connected", notConnected);
      }
      if (cursor) {
        params.append("cursor", cursor);
      }

      const queryString = params.toString();
      const url = `${process.env.NEXT_PUBLIC_API_SERVER_URL}/api/v1/session${
        queryString ? `?${queryString}` : ""
      }`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer sk-ac-${process.env.ROOT_API_BEARER_TOKEN}`,
        },
      });
      if (response.status !== 200) {
        reject(new Error("Internal Server Error"));
      }

      const result = await response.json();
      if (result.code !== 0) {
        reject(new Error(result.message));
      }
      resolve(result.data);
    } catch {
      reject(new Error("Internal Server Error"));
    }
  });

  try {
    const res = await getSessions;
    return createApiResponse(res);
  } catch (error) {
    console.error(error);
    return createApiError("Internal Server Error");
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const createSession = new Promise<Session>(async (resolve, reject) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_SERVER_URL}/api/v1/session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer sk-ac-${process.env.ROOT_API_BEARER_TOKEN}`,
          },
          body: JSON.stringify(body),
        }
      );
      if (response.status !== 201) {
        reject(new Error("Internal Server Error"));
      }

      const result = await response.json();
      if (result.code !== 0) {
        reject(new Error(result.message));
      }
      resolve(result.data);
    } catch {
      reject(new Error("Internal Server Error"));
    }
  });

  try {
    const res = await createSession;
    return createApiResponse(res);
  } catch (error) {
    console.error(error);
    return createApiError("Internal Server Error");
  }
}

