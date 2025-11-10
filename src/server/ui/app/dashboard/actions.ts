"use server";

import { Pool, types } from "pg";

types.setTypeParser(20, (val) => Number(val)); // int8
types.setTypeParser(1700, (val) => Number(val)); // numeric/decimal

export type TimeRange = "7" | "30" | "90";

export type TaskStatistics = {
  status: string;
  count: number;
  percentage: number;
  avgTime: number | null;
};

export type DashboardData = {
  taskSuccessRate: Array<{ date: string; successRate: number }>;
  taskStatusDistribution: Array<{
    date: string;
    completed: number;
    inProgress: number;
    pending: number;
    failed: number;
  }>;
  sessionAvgMessageTurns: Array<{ date: string; avgMessageTurns: number }>;
  sessionAvgTasks: Array<{ date: string; avgTasks: number }>;
  taskAvgMessageTurns: Array<{ date: string; avgTurns: number }>;
  storageUsage: Array<{ date: string; usage: number }>;
  taskStatistics: Array<TaskStatistics>;
};

declare global {
  var __dashboardPool: Pool | undefined;
}

const DEFAULT_CONNECTION_STRING =
  "postgresql://acontext:helloworld@127.0.0.1:15432/acontext?sslmode=disable";

const getPool = () => {
  if (!globalThis.__dashboardPool) {
    const connectionString = process.env["DATABASE_URL"] || DEFAULT_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    globalThis.__dashboardPool = new Pool({
      connectionString,
      max: 10,
    });
  }
  return globalThis.__dashboardPool;
};

const formatLabel = (date: Date) =>
  `${date.getMonth() + 1}/${date.getDate()}`;

const buildDateBuckets = (days: number) => {
  const now = new Date();
  const buckets: Array<{ key: string; label: string }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    buckets.push({ key, label: formatLabel(date) });
  }

  return buckets;
};

const emptyData = (days: number): DashboardData => {
  const buckets = buildDateBuckets(days);
  return {
    taskSuccessRate: buckets.map(({ label }) => ({
      date: label,
      successRate: 0,
    })),
    taskStatusDistribution: buckets.map(({ label }) => ({
      date: label,
      completed: 0,
      inProgress: 0,
      pending: 0,
      failed: 0,
    })),
    sessionAvgMessageTurns: [],
    sessionAvgTasks: [],
    taskAvgMessageTurns: [],
    storageUsage: buckets.map(({ label }) => ({
      date: label,
      usage: 0,
    })),
    taskStatistics: [],
  };
};

const withClient = async <T>(cb: (client: Pool) => Promise<T>): Promise<T> => {
  const pool = getPool();
  return await cb(pool);
};

type TimeRangeInput = {
  days: number;
  intervalDays: number;
};

const getTimeRangeInput = (timeRange: TimeRange): TimeRangeInput => {
  const days = parseInt(timeRange, 10);
  return {
    days,
    intervalDays: days - 1,
  };
};

export const fetchDashboardData = async (
  timeRange: TimeRange
): Promise<DashboardData> => {
  const { days, intervalDays } = getTimeRangeInput(timeRange);

  return await withClient(async (pool) => {
    const dateBuckets = buildDateBuckets(days);

    const [
      taskSuccessRows,
      taskStatusRows,
      sessionMessageRows,
      sessionTaskRows,
      taskMessageRows,
      storageRows,
      taskStatsRows,
    ] = await Promise.all([
      pool.query<{
        date: string;
        success_count: number;
        total_count: number;
      }>(
        `
        SELECT
          TO_CHAR(DATE(created_at), 'YYYY-MM-DD') AS date,
          COUNT(*) FILTER (WHERE status = 'success') AS success_count,
          COUNT(*) AS total_count
        FROM tasks
        WHERE created_at >= CURRENT_DATE - ($1::int) * INTERVAL '1 day'
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at) ASC
        `,
        [intervalDays]
      ),
      pool.query<{
        date: string;
        success_count: number;
        running_count: number;
        pending_count: number;
        failed_count: number;
      }>(
        `
        SELECT
          TO_CHAR(DATE(created_at), 'YYYY-MM-DD') AS date,
          COUNT(*) FILTER (WHERE status = 'success') AS success_count,
          COUNT(*) FILTER (WHERE status = 'running') AS running_count,
          COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
          COUNT(*) FILTER (WHERE status = 'failed') AS failed_count
        FROM tasks
        WHERE created_at >= CURRENT_DATE - ($1::int) * INTERVAL '1 day'
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at) ASC
        `,
        [intervalDays]
      ),
      pool.query<{
        date: string;
        avg_message_count: number;
      }>(
        `
        SELECT
          TO_CHAR(DATE(s.created_at), 'YYYY-MM-DD') AS date,
          AVG(message_counts.message_count) AS avg_message_count
        FROM sessions s
        LEFT JOIN LATERAL (
          SELECT COUNT(m.id) AS message_count
          FROM messages m
          WHERE m.session_id = s.id
        ) message_counts ON true
        WHERE s.created_at >= CURRENT_DATE - ($1::int) * INTERVAL '1 day'
        GROUP BY DATE(s.created_at)
        ORDER BY DATE(s.created_at) ASC
        `,
        [intervalDays]
      ),
      pool.query<{
        date: string;
        avg_task_count: number;
      }>(
        `
        SELECT
          TO_CHAR(DATE(s.created_at), 'YYYY-MM-DD') AS date,
          AVG(task_counts.task_count) AS avg_task_count
        FROM sessions s
        LEFT JOIN LATERAL (
          SELECT COUNT(t.id) AS task_count
          FROM tasks t
          WHERE t.session_id = s.id
        ) task_counts ON true
        WHERE s.created_at >= CURRENT_DATE - ($1::int) * INTERVAL '1 day'
        GROUP BY DATE(s.created_at)
        ORDER BY DATE(s.created_at) ASC
        `,
        [intervalDays]
      ),
      pool.query<{
        date: string;
        avg_message_count: number;
      }>(
        `
        SELECT
          TO_CHAR(DATE(t.created_at), 'YYYY-MM-DD') AS date,
          AVG(message_counts.message_count) AS avg_message_count
        FROM tasks t
        LEFT JOIN LATERAL (
          SELECT COUNT(m.id) AS message_count
          FROM messages m
          WHERE m.task_id = t.id
        ) message_counts ON true
        WHERE t.created_at >= CURRENT_DATE - ($1::int) * INTERVAL '1 day'
        GROUP BY DATE(t.created_at)
        ORDER BY DATE(t.created_at) ASC
        `,
        [intervalDays]
      ),
      pool.query<{
        date: string;
        usage_bytes: number;
      }>(
        `
        WITH date_series AS (
          SELECT generate_series(
            CURRENT_DATE - ($1::int) * INTERVAL '1 day',
            CURRENT_DATE,
            '1 day'::interval
          )::date AS date
        )
        SELECT
          TO_CHAR(ds.date, 'YYYY-MM-DD') AS date,
          COALESCE(
            (SELECT SUM((asset_meta -> 'size_b')::bigint)
             FROM asset_references
             WHERE DATE(created_at) <= ds.date),
            0
          ) AS usage_bytes
        FROM date_series ds
        ORDER BY ds.date ASC
        `,
        [intervalDays]
      ),
      pool.query<{
        status: string;
        count: number;
        avg_duration_seconds: number | null;
      }>(
        `
        WITH total_tasks AS (
          SELECT COUNT(*) AS total_count
          FROM tasks
          WHERE created_at >= CURRENT_DATE - ($1::int) * INTERVAL '1 day'
        )
        SELECT
          status,
          COUNT(*) AS count,
          CASE
            WHEN status IN ('success', 'failed') THEN
              AVG(EXTRACT(EPOCH FROM (updated_at - created_at)))
            ELSE NULL
          END AS avg_duration_seconds
        FROM tasks
        WHERE created_at >= CURRENT_DATE - ($1::int) * INTERVAL '1 day'
        GROUP BY status
        ORDER BY
          CASE status
            WHEN 'success' THEN 1
            WHEN 'running' THEN 2
            WHEN 'pending' THEN 3
            WHEN 'failed' THEN 4
            ELSE 5
          END
        `,
        [intervalDays]
      ),
    ]);

    const taskSuccessMap = new Map(
      taskSuccessRows.rows.map((row) => [row.date, row])
    );
    const taskStatusMap = new Map(
      taskStatusRows.rows.map((row) => [row.date, row])
    );
    const storageUsageMap = new Map(
      storageRows.rows.map((row) => [row.date, row])
    );

    const taskSuccessRate = dateBuckets.map(({ key, label }) => {
      const row = taskSuccessMap.get(key);
      const success =
        row && row.total_count > 0
          ? Number(((row.success_count / row.total_count) * 100).toFixed(1))
          : 0;
      return {
        date: label,
        successRate: success,
      };
    });

    const taskStatusDistribution = dateBuckets.map(({ key, label }) => {
      const row = taskStatusMap.get(key);
      return {
        date: label,
        completed: row?.success_count ?? 0,  // 'success' -> 'completed'
        inProgress: row?.running_count ?? 0, // 'running' -> 'inProgress'
        pending: row?.pending_count ?? 0,    // 'pending' -> 'pending'
        failed: row?.failed_count ?? 0,      // 'failed' -> 'failed'
      };
    });

    const sessionMessageMap = new Map(
      sessionMessageRows.rows.map((row) => [row.date, row])
    );
    const sessionTaskMap = new Map(
      sessionTaskRows.rows.map((row) => [row.date, row])
    );
    const taskMessageMap = new Map(
      taskMessageRows.rows.map((row) => [row.date, row])
    );

    const sessionAvgMessageTurns = dateBuckets.map(({ key, label }) => {
      const row = sessionMessageMap.get(key);
      return {
        date: label,
        avgMessageTurns: row?.avg_message_count ? Number(row.avg_message_count.toFixed(1)) : 0,
      };
    });

    const sessionAvgTasks = dateBuckets.map(({ key, label }) => {
      const row = sessionTaskMap.get(key);
      return {
        date: label,
        avgTasks: row?.avg_task_count ? Number(row.avg_task_count.toFixed(1)) : 0,
      };
    });

    const taskAvgMessageTurns = dateBuckets.map(({ key, label }) => {
      const row = taskMessageMap.get(key);
      return {
        date: label,
        avgTurns: row?.avg_message_count ? Number(row.avg_message_count.toFixed(1)) : 0,
      };
    });

    const storageUsage = dateBuckets.map(({ key, label }) => {
      const row = storageUsageMap.get(key);
      const bytes = row?.usage_bytes ?? 0;
      // Convert to KB for better visibility of small files (1 KB = 1024 bytes)
      const kilobytes = Number((bytes / 1024).toFixed(2));
      return {
        date: label,
        usage: kilobytes,
      };
    });

    const totalTasks = taskStatsRows.rows.reduce((sum, row) => sum + (row.count ?? 0), 0);
    const taskStatistics: TaskStatistics[] = taskStatsRows.rows.map((row) => ({
      status: row.status,
      count: row.count ?? 0,
      percentage: totalTasks > 0 ? Number(((row.count / totalTasks) * 100).toFixed(1)) : 0,
      avgTime: row.avg_duration_seconds !== null && row.avg_duration_seconds !== undefined
        ? Number((row.avg_duration_seconds / 60).toFixed(1))
        : null,
    }));

    return {
      taskSuccessRate,
      taskStatusDistribution,
      sessionAvgMessageTurns,
      sessionAvgTasks,
      taskAvgMessageTurns,
      storageUsage,
      taskStatistics,
    };
  }).catch((error) => {
    console.error("Failed to fetch dashboard data:", error);
    return emptyData(parseInt(timeRange, 10));
  });
};
