import { createApiResponse, createApiError } from "@/lib/api-response";
import { Block } from "@/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ space_id: string }> }
) {
  const { space_id } = await params;
  const { searchParams } = new URL(request.url);
  const parent_id = searchParams.get("parent_id");

  const getFolders = new Promise<Block[]>(async (resolve, reject) => {
    try {
      const queryString = parent_id ? `?parent_id=${parent_id}` : "";
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_SERVER_URL}/api/v1/space/${space_id}/folder${queryString}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer sk-ac-${process.env.ROOT_API_BEARER_TOKEN}`,
          },
        }
      );
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
    const res = await getFolders;
    return createApiResponse(res || []);
  } catch (error) {
    console.error(error);
    return createApiError("Internal Server Error");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ space_id: string }> }
) {
  const { space_id } = await params;
  const body = await request.json();

  const createFolder = new Promise<Block>(async (resolve, reject) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_SERVER_URL}/api/v1/space/${space_id}/folder`,
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
    const res = await createFolder;
    return createApiResponse(res);
  } catch (error) {
    console.error(error);
    return createApiError("Internal Server Error");
  }
}

