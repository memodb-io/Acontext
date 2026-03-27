import { NextRequest, NextResponse } from "next/server";

const API_SERVER_URL = process.env.API_SERVER_URL;
const ROOT_API_BEARER_TOKEN = process.env.ROOT_API_BEARER_TOKEN;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const response = await fetch(
      `${API_SERVER_URL}/api/v1/agent_skills`,
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
    console.error("createAgentSkill proxy error:", error);
    return NextResponse.json(
      { code: 1, msg: "Internal Server Error" },
      { status: 500 }
    );
  }
}
