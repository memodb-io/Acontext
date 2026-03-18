"use server";

import {
  getCurrentUser,
  getProject,
  getOrganizationMembershipForCurrentUser,
  getSecretKeyRotations,
} from "@/lib/supabase";
import { AcontextClient, type GetUsersResp, type User } from "@/lib/acontext/server";

export type TimeRange = "7" | "30" | "90";

export interface DashboardData {
  task_success: Array<{ date: string; success_rate: number }>;
  task_status: Array<{
    date: string;
    completed: number;
    in_progress: number;
    pending: number;
    failed: number;
  }>;
  session_message: Array<{ date: string; avg_message_turns: number }>;
  session_task: Array<{ date: string; avg_tasks: number }>;
  task_message: Array<{ date: string; avg_turns: number }>;
  storage: Array<{ date: string; usage_bytes: number }>;
  task_stats: Array<{
    status: string;
    count: number;
    percentage: number;
    avg_time: number | null;
  }>;
  new_sessions: Array<{ date: string; count: number }>;
  new_disks: Array<{ date: string; count: number }>;
}

const getDaysFromRange = (timeRange: TimeRange) => parseInt(timeRange, 10);

export type ChartGroupKey = "tasks" | "session_metrics" | "task_metrics" | "storage" | "counts";

const buildDateLabels = (days: number) => {
  const now = new Date();
  const labels: string[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    labels.push(`${date.getMonth() + 1}/${date.getDate()}`);
  }

  return labels;
};

const createPlaceholderData = (timeRange: TimeRange): DashboardData => {
  const days = getDaysFromRange(timeRange);
  const labels = buildDateLabels(days);

  return {
    task_success: labels.map((label) => ({ date: label, success_rate: 0 })),
    task_status: labels.map((label) => ({
      date: label,
      completed: 0,
      in_progress: 0,
      pending: 0,
      failed: 0,
    })),
    session_message: [],
    session_task: [],
    task_message: [],
    storage: labels.map((label) => ({
      date: label,
      usage_bytes: 0,
    })),
    task_stats: [],
    new_sessions: labels.map((label) => ({ date: label, count: 0 })),
    new_disks: labels.map((label) => ({ date: label, count: 0 })),
  };
};

/**
 * Validate dashboard access — runs Supabase auth + org check + API key check
 */
export async function validateDashboardAccess(projectId: string): Promise<{
  hasApiKey: boolean;
  isValid: boolean;
}> {
  try {
    await getCurrentUser();

    const project = await getProject(projectId);
    if (!project) {
      return { hasApiKey: false, isValid: false };
    }

    const membership = await getOrganizationMembershipForCurrentUser(
      project.organization_id,
      "role"
    );

    if (!membership) {
      return { hasApiKey: false, isValid: false };
    }

    const apiKeys = await getSecretKeyRotations(projectId).catch(() => []);
    return {
      hasApiKey: apiKeys && apiKeys.length > 0,
      isValid: true,
    };
  } catch {
    return { hasApiKey: false, isValid: false };
  }
}

/**
 * Fetch a specific chart group's data
 */
export async function fetchDashboardGroup(
  projectId: string,
  timeRange: TimeRange,
  fields: string[]
): Promise<Partial<DashboardData>> {
  await getCurrentUser();

  const project = await getProject(projectId);
  if (!project) {
    return {};
  }

  const membership = await getOrganizationMembershipForCurrentUser(
    project.organization_id,
    "role"
  );

  if (!membership) {
    return {};
  }

  try {
    const days = getDaysFromRange(timeRange);
    const client = new AcontextClient();
    const data = await client.getDashboardData(projectId, days, fields);
    return data;
  } catch (error) {
    console.error(
      `Failed to fetch dashboard group [${fields.join(",")}]: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    return {};
  }
}

/**
 * Fetch project statistics (task and skill counts)
 */
export async function fetchProjectStatistics(projectId: string) {
  // Get current user (will redirect if not authenticated)
  await getCurrentUser();

  // Get project to verify access
  const project = await getProject(projectId);
  if (!project) {
    return { error: "Project not found" };
  }

  // Check if user is a member of the organization
  const membership = await getOrganizationMembershipForCurrentUser(
    project.organization_id,
    "role"
  );

  if (!membership) {
    return { error: "Project not found or access denied" };
  }

  try {
    const client = new AcontextClient();
    const statistics = await client.getProjectStatistics(projectId);
    return { success: true, data: statistics };
  } catch (error) {
    return {
      error: `Failed to fetch project statistics: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Fetch dashboard data for charts
 */
export async function fetchDashboardData(
  projectId: string,
  timeRange: TimeRange
): Promise<DashboardData> {
  // Get current user (will redirect if not authenticated)
  await getCurrentUser();

  // Get project to verify access
  const project = await getProject(projectId);
  if (!project) {
    return createPlaceholderData(timeRange);
  }

  // Check if user is a member of the organization
  const membership = await getOrganizationMembershipForCurrentUser(
    project.organization_id,
    "role"
  );

  if (!membership) {
    return createPlaceholderData(timeRange);
  }

  try {
    const days = getDaysFromRange(timeRange);
    const client = new AcontextClient();
    const data = await client.getDashboardData(projectId, days);
    return data;
  } catch (error) {
    console.error(
      `Failed to fetch dashboard data: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    return createPlaceholderData(timeRange);
  }
}

/**
 * Combined initial data fetch - validates once, fetches all data in parallel
 * This is more efficient than calling separate server actions
 */
export interface InitialDashboardData {
  hasApiKey: boolean;
  statistics: { taskCount: number; skillCount: number; sessionCount: number } | null;
  dashboardData: DashboardData;
}

export async function fetchInitialDashboardData(
  projectId: string,
  timeRange: TimeRange
): Promise<InitialDashboardData> {
  // Get current user (will redirect if not authenticated)
  await getCurrentUser();

  // Get project to verify access
  const project = await getProject(projectId);
  if (!project) {
    return {
      hasApiKey: false,
      statistics: null,
      dashboardData: createPlaceholderData(timeRange),
    };
  }

  // Check if user is a member of the organization
  const membership = await getOrganizationMembershipForCurrentUser(
    project.organization_id,
    "role"
  );

  if (!membership) {
    return {
      hasApiKey: false,
      statistics: null,
      dashboardData: createPlaceholderData(timeRange),
    };
  }

  // Now fetch all data in parallel - validation is done once
  const client = new AcontextClient();
  const days = getDaysFromRange(timeRange);

  const [apiKeyResult, statisticsResult, dashboardResult] = await Promise.all([
    getSecretKeyRotations(projectId).catch((error) => {
      console.error("Failed to fetch API keys:", error);
      return [];
    }),
    client.getProjectStatistics(projectId).catch((error) => {
      console.error("Failed to fetch statistics:", error);
      return null;
    }),
    client.getDashboardData(projectId, days).catch((error) => {
      console.error("Failed to fetch dashboard data:", error);
      return createPlaceholderData(timeRange);
    }),
  ]);

  return {
    hasApiKey: apiKeyResult && apiKeyResult.length > 0,
    statistics: statisticsResult,
    dashboardData: dashboardResult,
  };
}

/**
 * Fetch all users under a project
 * Used by disk, session, and space pages for user filtering and selection
 */
export async function getUsers(
  projectId: string,
  limit: number = 0,
  cursor?: string,
  timeDesc: boolean = false
): Promise<GetUsersResp> {
  try {
    const client = new AcontextClient();
    return await client.getUsers(projectId, limit, cursor, timeDesc);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    throw error;
  }
}

/**
 * Fetch all users in a project (paginated automatically)
 */
export async function getAllUsers(projectId: string): Promise<User[]> {
  try {
    const client = new AcontextClient();
    const allUsers: User[] = [];
    let cursor: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      const res = await client.getUsers(projectId, 200, cursor, false);
      allUsers.push(...(res.items || []));
      cursor = res.next_cursor;
      hasMore = res.has_more || false;
    }

    return allUsers;
  } catch (error) {
    console.error("Failed to fetch all users:", error);
    return [];
  }
}
