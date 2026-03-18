import {
  getCurrentUser,
  getProject,
  getOrganizationMembershipForCurrentUser,
} from "@/lib/supabase";
import { AcontextClient } from "@/lib/acontext/server";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const projectId = searchParams.get("projectId");
  const timeRange = searchParams.get("timeRange");
  const fields = searchParams.get("fields");

  if (!projectId || !timeRange || !fields) {
    return Response.json({}, { status: 400 });
  }

  try {
    await getCurrentUser();

    const project = await getProject(projectId);
    if (!project) {
      return Response.json({}, { status: 403 });
    }

    const membership = await getOrganizationMembershipForCurrentUser(
      project.organization_id,
      "role"
    );

    if (!membership) {
      return Response.json({}, { status: 403 });
    }

    const days = parseInt(timeRange, 10);
    const client = new AcontextClient();
    const data = await client.getDashboardData(
      projectId,
      days,
      fields.split(",")
    );

    return Response.json(data);
  } catch (error) {
    console.error(
      `Failed to fetch dashboard group [${fields}]: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    return Response.json({}, { status: 500 });
  }
}
