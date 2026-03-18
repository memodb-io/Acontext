/**
 * Admin API operations for AcontextClient
 */

import { Constructor, BaseClient } from "./base";

// ==================== Type Definitions ====================

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

export interface TraceSpan {
  traceID: string;
  spanID: string;
  flags: number;
  operationName: string;
  references: Array<{
    refType: string;
    traceID: string;
    spanID: string;
  }>;
  startTime: number; // microseconds
  duration: number; // microseconds
  tags: Array<{
    key: string;
    value: string | number | boolean;
    type?: string;
  }>;
  logs: Array<{
    timestamp: number;
    fields: Array<{
      key: string;
      value: string | number | boolean;
      type?: string;
    }>;
  }>;
  processID: string;
  warnings?: string[] | null;
}

export interface TraceProcess {
  serviceName: string;
  tags: Array<{
    key: string;
    value: string | number | boolean;
    type?: string;
  }>;
}

export interface Trace {
  traceID: string;
  operationName?: string;
  duration?: number; // microseconds
  startTime?: number; // milliseconds
  spanCount?: number;
  spans: TraceSpan[];
  processes: Record<string, TraceProcess>;
  warnings?: string[] | null;
}

// ==================== Admin Operations Mixin ====================

export function AdminOperations<T extends Constructor<BaseClient>>(Base: T) {
  return class extends Base {
    /**
     * Create a project via acontext API
     */
    async createProject(): Promise<string> {
      const response = await this.request<{ project_id?: string }>(
        "/admin/v1/project",
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );
      return response.project_id || "";
    }

    /**
     * Delete projects from external service via acontext API
     */
    async deleteProjects(projectIds: string[]): Promise<void> {
      for (const projectId of projectIds) {
        await this.request(`/admin/v1/project/${projectId}`, {
          method: "DELETE",
        });
      }
    }

    /**
     * Get project statistics (task and skill counts) via acontext API
     */
    async getProjectStatistics(projectId: string): Promise<{
      taskCount: number;
      skillCount: number;
      sessionCount: number;
    }> {
      const result = await this.request<{
        taskCount?: number;
        task_count?: number;
        skillCount?: number;
        skill_count?: number;
        sessionCount?: number;
        session_count?: number;
      }>(`/admin/v1/project/${projectId}/statistics`, {
        projectId,
      });
      return {
        taskCount: result.taskCount || result.task_count || 0,
        skillCount: result.skillCount || result.skill_count || 0,
        sessionCount: result.sessionCount || result.session_count || 0,
      };
    }

    /**
     * Update/rotate project secret key via acontext API
     * Returns the new secret key
     */
    async updateProjectSecretKey(projectId: string): Promise<string> {
      const result = await this.request<{ secret_key?: string; secretKey?: string }>(
        `/admin/v1/project/${projectId}/secret_key`,
        {
          method: "PUT",
        }
      );
      return result.secret_key || result.secretKey || "";
    }

    /**
     * Get dashboard data for a project via acontext API
     * Maps to /project/:project_id/usages endpoint
     */
    async getDashboardData(projectId: string, timeRange: number, fields?: string[]): Promise<DashboardData> {
      let url = `/admin/v1/project/${projectId}/usages?interval_days=${timeRange}`;
      if (fields && fields.length > 0) {
        url += `&fields=${fields.join(",")}`;
      }
      const apiResponse = await this.request<DashboardData>(
        url,
        {
          projectId,
        }
      );

      // Handle null values and format dates
      const result: DashboardData = {
        task_success:
          apiResponse.task_success?.map((item) => ({
            date: this.formatDate(item.date),
            success_rate: item.success_rate ?? 0,
          })) ?? [],
        task_status:
          apiResponse.task_status?.map((item) => ({
            date: this.formatDate(item.date),
            completed: item.completed ?? 0,
            in_progress: item.in_progress ?? 0,
            pending: item.pending ?? 0,
            failed: item.failed ?? 0,
          })) ?? [],
        session_message:
          apiResponse.session_message?.map((item) => ({
            date: this.formatDate(item.date),
            avg_message_turns: item.avg_message_turns ?? 0,
          })) ?? [],
        session_task:
          apiResponse.session_task?.map((item) => ({
            date: this.formatDate(item.date),
            avg_tasks: item.avg_tasks ?? 0,
          })) ?? [],
        task_message:
          apiResponse.task_message?.map((item) => ({
            date: this.formatDate(item.date),
            avg_turns: item.avg_turns ?? 0,
          })) ?? [],
        storage:
          apiResponse.storage?.map((item) => ({
            date: this.formatDate(item.date),
            usage_bytes: item.usage_bytes ?? 0,
          })) ?? [],
        task_stats: apiResponse.task_stats ?? [],
        new_sessions:
          apiResponse.new_sessions?.map((item) => ({
            date: this.formatDate(item.date),
            count: item.count ?? 0,
          })) ?? [],
        new_disks:
          apiResponse.new_disks?.map((item) => ({
            date: this.formatDate(item.date),
            count: item.count ?? 0,
          })) ?? [],
      };

      return result;
    }

    /**
     * Get traces for a project via acontext API
     * Maps to /project/:project_id/metrics endpoint
     * Parameters are aligned with Jaeger API for passthrough
     */
    async getTraces(
      projectId: string,
      options: {
        service?: string;
        limit?: number;
        start: number; // microseconds (required)
        end: number; // microseconds (required)
        tags?: string; // JSON string for Jaeger tag filtering, e.g., '{"http.response.status_code":"200"}'
      }
    ): Promise<Trace[]> {
      const { service = "acontext-api", limit = 50, start, end, tags } = options;

      const params = new URLSearchParams({
        service,
        limit: limit.toString(),
        start: start.toString(),
        end: end.toString(),
      });

      // Add tags if provided (Jaeger format: JSON string)
      if (tags) {
        params.append("tags", tags);
      }

      const data = await this.request<{
        data: Trace[];
        errors: null;
      }>(`/admin/v1/project/${projectId}/metrics?${params.toString()}`, {
        projectId,
      });

      return data?.data ?? [];
    }
  };
}
