import { createApiResponse, createApiError } from "@/lib/api-response";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ space_id: string; folder_id: string }> }
) {
  const { space_id, folder_id } = await params;
  const body = await request.json();

  const updateFolderSort = new Promise<void>(async (resolve, reject) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_SERVER_URL}/api/v1/space/${space_id}/folder/${folder_id}/sort`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer sk-ac-${process.env.ROOT_API_BEARER_TOKEN}`,
          },
          body: JSON.stringify(body),
        }
      );
      if (response.status !== 200) {
        reject(new Error("Internal Server Error"));
      }

      const result = await response.json();
      if (result.code !== 0) {
        reject(new Error(result.message));
      }
      resolve();
    } catch {
      reject(new Error("Internal Server Error"));
    }
  });

  try {
    await updateFolderSort;
    return createApiResponse(null);
  } catch (error) {
    console.error(error);
    return createApiError("Internal Server Error");
  }
}

