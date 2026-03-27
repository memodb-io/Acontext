import { NextRequest, NextResponse } from "next/server";

const API_SERVER_URL = process.env.API_SERVER_URL;
const ROOT_API_BEARER_TOKEN = process.env.ROOT_API_BEARER_TOKEN;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const diskId = formData.get("disk_id") as string;

    if (!diskId) {
      return NextResponse.json(
        { code: 1, msg: "disk_id is required" },
        { status: 400 }
      );
    }

    // Remove disk_id from the forwarded form data (it's a URL param for the Go API)
    formData.delete("disk_id");

    const response = await fetch(
      `${API_SERVER_URL}/api/v1/disk/${diskId}/artifact`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer sk-ac-${ROOT_API_BEARER_TOKEN}`,
        },
        body: formData,
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("uploadArtifact proxy error:", error);
    return NextResponse.json(
      { code: 1, msg: "Internal Server Error" },
      { status: 500 }
    );
  }
}
