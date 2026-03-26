// supabase/functions/sync-usage/index.ts

import { serve } from "https://deno.land/std/http/server.ts"
import Stripe from "https://esm.sh/stripe@20.3.0"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!)

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

const adminToken = Deno.env.get("ADMIN_INTERNAL_TOKEN")!

// 类型定义
interface Metric {
  project_id: string
  tag: string
  created_at: string // ISO 8601 时间戳字符串（记录创建时间）
  updated_at: string // ISO 8601 时间戳字符串（记录最后更新时间）
  increment: number
}

interface GetMetricsOutput {
  metrics: Metric[]
}

// Go serializer.Response 格式
interface SerializerResponse<T = unknown> {
  code: number // 0 表示成功，非 0 表示错误
  data?: T
  msg?: string
  error?: string
}

// Quota 检查返回类型
interface QuotaItem {
  project_id: string
  tag: string
  excess: boolean
}

interface PushMetricsResponse {
  quota: QuotaItem[]
}

// Organization usage 快照类型
interface OrgUsageSnapshot {
  current_task: number
  current_skill: number
  current_fast_skill_search: number
  current_agentic_skill_search: number
  current_storage: number
}

// Metric 处理配置
type MetricGranularity = "daily" | "hourly"
type MetricProcessingType = "incremental" | "threshold"

interface MetricHandlerConfig {
  granularity: MetricGranularity
  processingType: MetricProcessingType
  usageField?: string // organization_usage 表中的字段
  maxField?: string // product_plans 表中的字段
  stripeMeter?: string // Stripe meter 名称
  resetOnMonthStart: boolean // 是否在月初重置计数
}

// Metric Handler 配置映射
const METRIC_HANDLERS: Record<string, MetricHandlerConfig> = {
  // 按天的累加型 metric
  "task.created": {
    granularity: "daily",
    processingType: "incremental",
    usageField: "current_task",
    maxField: "max_task",
    stripeMeter: "agent_tasks",
    resetOnMonthStart: true,
  },
  "space.learned": {
    granularity: "daily",
    processingType: "incremental",
    usageField: "current_skill",
    maxField: "max_skill",
    stripeMeter: "skill_blocks",
    resetOnMonthStart: true,
  },
  "search.experience.embedding": {
    granularity: "daily",
    processingType: "incremental",
    usageField: "current_fast_skill_search",
    maxField: "max_fast_skill_search",
    stripeMeter: "fast_skill_search",
    resetOnMonthStart: true,
  },
  "search.experience.agentic": {
    granularity: "daily",
    processingType: "incremental",
    usageField: "current_agentic_skill_search",
    maxField: "max_agentic_skill_search",
    stripeMeter: "agentic_skill_search",
    resetOnMonthStart: true,
  },
  // 按小时的阈值检查型 metric
  "storage.usage": {
    granularity: "hourly",
    processingType: "threshold",
    usageField: "current_storage",
    maxField: "max_storage",
    stripeMeter: "storage_gb_hour",
    resetOnMonthStart: false,
  },
}

// 从时间戳提取日期部分（用于日志记录）
function extractDateFromTimestamp(createdAt: string): string {
  const date = new Date(createdAt)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

// 获取当前月份第一天的时间戳（UTC）
function getCurrentMonthStartTimestamp(): number {
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  return Math.floor(monthStart.getTime() / 1000)
}

// 获取当前小时的时间戳（UTC，用于 storage 上报去重）
function getCurrentHourTimestamp(): number {
  const now = new Date()
  now.setUTCMinutes(0, 0, 0)
  return Math.floor(now.getTime() / 1000)
}

// Atomically try to claim the monthly reset checkpoint for an org.
// Returns true if this invocation claimed the reset (i.e., should proceed with reset).
// Uses a Postgres RPC function with INSERT ... ON CONFLICT + WHERE clause to guarantee
// only one concurrent caller succeeds (the upsert only fires when the value differs).
async function tryClaimMonthlyReset(orgId: string): Promise<boolean> {
  const monthStartTimestamp = getCurrentMonthStartTimestamp()
  const checkpointId = `monthly_reset_${orgId}`

  const { data: claimed, error } = await supabase.rpc("try_claim_monthly_reset", {
    p_checkpoint_id: checkpointId,
    p_month_start_timestamp: monthStartTimestamp,
  })

  if (error) {
    console.error(`Failed to claim monthly reset checkpoint for ${orgId}:`, error)
    return false
  }

  return claimed === true
}

// 重置指定 org 的月初计数（针对需要重置的 metrics）
async function resetOrgMonthlyCounters(orgId: string): Promise<void> {
  // Atomically claim the reset checkpoint — only one invocation proceeds
  if (!(await tryClaimMonthlyReset(orgId))) {
    console.log(`Organization ${orgId} monthly counters already reset this month, skipping`)
    return
  }

  console.log(`Resetting monthly counters for organization ${orgId}...`)

  // 获取所有需要重置的 metrics
  const metricsToReset = Object.entries(METRIC_HANDLERS)
    .filter(([, config]) => config.resetOnMonthStart && config.usageField)
    .map(([, config]) => ({ usageField: config.usageField! }))

  if (metricsToReset.length === 0) {
    return
  }

  // 获取该 org 下所有 projects
  const { data: orgProjects } = await supabase
    .from("organization_projects")
    .select("project_id")
    .eq("organization_id", orgId)

  if (!orgProjects || orgProjects.length === 0) {
    return
  }

  const projectIds = orgProjects.map(p => p.project_id)

  // 重置该 org 下所有 project_usage 中对应字段
  for (const { usageField } of metricsToReset) {
    await supabase
      .from("project_usage")
      .update({
        [usageField]: 0,
        updated_at: new Date().toISOString(),
      })
      .in("project_id", projectIds)
      .neq(usageField, 0) // 只更新非零值，提高效率
  }

  // 重置该 org 的 organization_usage 中对应字段
  for (const { usageField } of metricsToReset) {
    await supabase
      .from("organization_usage")
      .update({
        [usageField]: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", orgId)
      .neq(usageField, 0) // 只更新非零值，提高效率
  }

  console.log(`Monthly counters reset completed for organization ${orgId}`)
}

serve(async (req) => {
  // 1️⃣ 验证请求方法
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 })
  }

  // 2️⃣ 验证 Authorization header
  const authHeader = req.headers.get("Authorization")
  if (!authHeader || authHeader !== `Bearer ${adminToken}`) {
    const error: SerializerResponse = {
      code: 401,
      error: "Unauthorized",
      msg: "Invalid or missing Authorization header",
    }
    return new Response(JSON.stringify(error), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  // 3️⃣ 从请求 body 读取 metrics 数据
  try {
    const body = await req.json()
    const metricsData: GetMetricsOutput = body

    // 验证数据格式
    if (!metricsData || !Array.isArray(metricsData.metrics)) {
      const error: SerializerResponse = {
        code: 400,
        error: "Invalid request body",
        msg: "Expected { metrics: Metric[] } format",
      }
      return new Response(JSON.stringify(error), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // 提取 metrics 数据
    const metrics: Metric[] = metricsData.metrics || []

    // 验证 metrics 数据
    const validMetrics = metrics.filter((m) => {
      return (
        m.project_id &&
        m.tag &&
        m.tag in METRIC_HANDLERS && // 确保 tag 是已配置的类型
        m.created_at &&
        m.updated_at &&
        typeof m.increment === "number" &&
        m.increment >= 0
      )
    })

    if (validMetrics.length === 0) {
      console.log("No valid metrics to process")
      const response: PushMetricsResponse = {
        quota: [],
      }
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Step 4: 收集所有涉及的 orgIds，并建立 projectId -> orgId 缓存
    const orgIdSet = new Set<string>()
    const projectToOrgMap = new Map<string, string>()

    // 批量查询所有 project 的 org 映射
    const projectIds = [...new Set(validMetrics.map(m => m.project_id))]
    const { data: orgProjects } = await supabase
      .from("organization_projects")
      .select("project_id, organization_id")
      .in("project_id", projectIds)

    if (orgProjects) {
      for (const op of orgProjects) {
        projectToOrgMap.set(op.project_id, op.organization_id)
        orgIdSet.add(op.organization_id)
      }
    }

    // Step 5: 先执行月初重置
    // Track orgs whose reset failed — skip them in all subsequent steps
    // to prevent Stripe from being billed on stale (pre-reset) cumulative counters.
    const resetFailedOrgs = new Set<string>()
    for (const orgId of orgIdSet) {
      try {
        await resetOrgMonthlyCounters(orgId)
      } catch (error) {
        console.error(`Failed to reset monthly counters for ${orgId}:`, error)
        resetFailedOrgs.add(orgId)
      }
    }
    if (resetFailedOrgs.size > 0) {
      console.warn(`Skipping processing for ${resetFailedOrgs.size} org(s) with failed monthly reset: ${[...resetFailedOrgs].join(", ")}`)
    }

    // Step 5.5: 记录每个 org 处理前的 usage（用于 Stripe 超量计算）
    const orgInitialUsage = new Map<string, OrgUsageSnapshot>()
    for (const orgId of orgIdSet) {
      if (resetFailedOrgs.has(orgId)) continue
      const { data: usage } = await supabase
        .from("organization_usage")
        .select("current_task, current_skill, current_fast_skill_search, current_agentic_skill_search, current_storage")
        .eq("organization_id", orgId)
        .maybeSingle()

      orgInitialUsage.set(orgId, {
        current_task: (usage?.current_task as number) || 0,
        current_skill: (usage?.current_skill as number) || 0,
        current_fast_skill_search: (usage?.current_fast_skill_search as number) || 0,
        current_agentic_skill_search: (usage?.current_agentic_skill_search as number) || 0,
        current_storage: (usage?.current_storage as number) || 0,
      })
    }

    // Step 6: 处理 metrics（更新 project_usage，但不上报 Stripe）
    // 记录成功处理的 metrics，被 checkpoint 跳过的不会进入这个数组
    const processedMetrics: Metric[] = []
    for (const m of validMetrics) {
      try {
        const orgId = projectToOrgMap.get(m.project_id)
        if (!orgId) {
          console.warn(`No orgId found for project: ${m.project_id}`)
          continue
        }
        if (resetFailedOrgs.has(orgId)) continue
        const processed = await processMetricWithoutStripe(m, orgId)
        if (processed) {
          processedMetrics.push(m)
        }
      } catch (error) {
        console.error(`Failed to process metric:`, m, error)
      }
    }

    // Step 7: 聚合到 organization_usage
    for (const orgId of orgIdSet) {
      if (resetFailedOrgs.has(orgId)) continue
      try {
        await aggregateOrganizationUsage(orgId)
      } catch (error) {
        console.error(`Failed to aggregate organization usage for ${orgId}:`, error)
      }
    }

    // Step 8: 上报 Stripe
    // 8.1 上报 incremental metrics（只对有变化的 org，基于处理前后的 usage 差值）
    for (const orgId of orgIdSet) {
      if (resetFailedOrgs.has(orgId)) continue
      try {
        const initialUsage = orgInitialUsage.get(orgId)
        if (!initialUsage) continue
        await reportIncrementalMetricsToStripe(orgId, initialUsage)
      } catch (error) {
        console.error(`Failed to report incremental metrics to Stripe for org ${orgId}:`, error)
      }
    }

    // 8.2 上报 storage（查询所有超量的 org，不限于本次调用涉及的 org）
    // 即使没有 storage.usage metric 传入，已超量的 org 也应该每小时上报一次
    try {
      await reportStorageOverageForAllOrgs()
    } catch (error) {
      console.error(`Failed to report storage overage to Stripe:`, error)
    }

    // Step 9: 检查 quota（只对成功处理的 metrics）
    // 批量查询需要的数据，避免每个 metric 都查询数据库
    const quotaItems: QuotaItem[] = []

    // 6.1 批量查询所有 org 的 billing 信息（包含 payment_status）
    const orgBillingMap = new Map<string, { plan: string; payment_status: string }>()
    const { data: allBillings } = await supabase
      .from("organization_billing")
      .select("organization_id, plan, payment_status")
      .in("organization_id", [...orgIdSet])

    if (allBillings) {
      for (const b of allBillings) {
        orgBillingMap.set(b.organization_id, { plan: b.plan, payment_status: b.payment_status || "ok" })
      }
    }

    // 6.2 查询 free plan 的限制（只查询一次）
    const { data: freePlanLimits } = await supabase
      .from("product_plans")
      .select("max_task, max_skill, max_fast_skill_search, max_agentic_skill_search, max_storage")
      .eq("plan", "free")
      .maybeSingle()

    // 6.3 批量查询所有 org 的 usage
    const orgUsageMap = new Map<string, OrgUsageSnapshot>()
    const { data: allOrgUsages } = await supabase
      .from("organization_usage")
      .select("organization_id, current_task, current_skill, current_fast_skill_search, current_agentic_skill_search, current_storage")
      .in("organization_id", [...orgIdSet])

    if (allOrgUsages) {
      for (const u of allOrgUsages) {
        orgUsageMap.set(u.organization_id, {
          current_task: (u.current_task as number) || 0,
          current_skill: (u.current_skill as number) || 0,
          current_fast_skill_search: (u.current_fast_skill_search as number) || 0,
          current_agentic_skill_search: (u.current_agentic_skill_search as number) || 0,
          current_storage: (u.current_storage as number) || 0,
        })
      }
    }

    // 6.4 检查 quota（使用缓存的数据）
    for (const m of processedMetrics) {
      try {
        const orgId = projectToOrgMap.get(m.project_id)
        if (!orgId) continue
        const quotaCheck = checkQuotaExcessWithCache(
          m,
          orgId,
          orgBillingMap,
          freePlanLimits,
          orgUsageMap
        )
        if (quotaCheck !== null) {
          quotaItems.push(quotaCheck)
        }
      } catch (error) {
        console.error(`Failed to check quota for metric:`, m, error)
      }
    }

    // 6.5 For payment-blocked orgs, force excess=true for ALL metric tags on ALL their projects.
    // This blocks both storage.usage (Go API) and task.created (CORE) enforcement.
    const blockedOrgIds = [...orgBillingMap.entries()]
      .filter(([, billing]) => billing.payment_status === "blocked")
      .map(([orgId]) => orgId)

    if (blockedOrgIds.length > 0) {
      // Fetch ALL project_ids for blocked orgs from DB (not just those in current batch)
      // to ensure enforcement even for projects that didn't send metrics this invocation.
      const { data: blockedProjectRows } = await supabase
        .from("organization_projects")
        .select("project_id")
        .in("organization_id", blockedOrgIds)
      const blockedProjectIds = (blockedProjectRows ?? []).map((p) => p.project_id)

      // All tracked metric tags that need blocking
      const allTrackedTags = Object.keys(METRIC_HANDLERS)

      for (const projectId of blockedProjectIds) {
        for (const tag of allTrackedTags) {
          // Force excess=true, overriding any existing excess=false entry
          const existingIdx = quotaItems.findIndex(
            (q) => q.project_id === projectId && q.tag === tag
          )
          if (existingIdx === -1) {
            quotaItems.push({
              project_id: projectId,
              tag,
              excess: true,
            })
          } else {
            quotaItems[existingIdx].excess = true
          }
        }
      }

      console.log(
        `Payment-blocked orgs: ${blockedOrgIds.join(", ")} — forced excess=true for ${blockedProjectIds.length} projects`
      )
    }

    // 6️⃣ 返回结果（包含 quota 检查）
    const response: PushMetricsResponse = {
      quota: quotaItems,
    }
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Unexpected error:", error)
    const errorResponse: SerializerResponse = {
      code: 500,
      error: "Internal server error",
      msg: error instanceof Error ? error.message : String(error),
    }
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})

// 处理 metric，只更新 usage，不上报 Stripe
async function processMetricWithoutStripe(m: Metric, orgId: string): Promise<boolean> {
  // 1. 获取配置
  const config = METRIC_HANDLERS[m.tag]
  if (!config) {
    console.warn(`No handler config for tag: ${m.tag}`)
    return false
  }

  // 2. 提取日期（仅用于日志记录）
  const dateValue = extractDateFromTimestamp(m.created_at)

  // 3. 检查是否需要处理（使用 updated_at 判断记录是否有更新）
  // 返回是否需要处理，以及上次同步的 increment 值（用于计算差值）
  const { shouldProcess, lastIncrement } = await shouldProcessMetric(
    m.project_id,
    m.tag,
    m.updated_at
  )
  if (!shouldProcess) {
    return false
  }

  // 4. 计算本次需要累加的增量（当前值 - 上次同步的值）
  const incrementDiff = m.increment - lastIncrement

  // 5. 更新 usage
  if (config.processingType === "incremental") {
    // 累加型：累加差值到 project usage field
    if (incrementDiff > 0) {
      await incrementUsage(m.project_id, config, incrementDiff)
    }

    // 记录日志（stripe_reported 在 Step 8 上报 Stripe 成功后按 org_id 更新）
    // 日志中记录实际累加的差值
    await supabase.from("usage_sync_logs").insert({
      organization_id: orgId,
      project_id: m.project_id,
      tag: m.tag,
      date: dateValue,
      increment: incrementDiff,
      stripe_reported: false,
    })
  } else if (config.processingType === "threshold") {
    // 阈值检查型：特殊处理（如 storage）
    // storage 的 increment 是总量，直接设置
    if (m.tag === "storage.usage") {
      await updateStorageUsage(m.project_id, m.increment)

      // 记录日志（stripe_reported 在 Step 8 上报 Stripe 成功后按 org_id 更新）
      // storage 日志记录差值（用于追踪变化）
      await supabase.from("usage_sync_logs").insert({
        organization_id: orgId,
        project_id: m.project_id,
        tag: m.tag,
        date: dateValue,
        increment: incrementDiff,
        stripe_reported: false,
      })
    }
  }

  // 6. 成功后再更新 checkpoint（使用 updated_at 和当前 increment）
  await updateCheckpoint(m.project_id, m.tag, m.updated_at, m.increment)

  return true
}

// 上报 incremental metrics 到 Stripe（只处理有变化的 org）
async function reportIncrementalMetricsToStripe(
  orgId: string,
  initialUsage: OrgUsageSnapshot
): Promise<void> {
  // 1. 查询 billing 信息
  const { data: billing } = await supabase
    .from("organization_billing")
    .select("stripe_customer_id, plan")
    .eq("organization_id", orgId)
    .maybeSingle()

  if (!billing?.stripe_customer_id || billing.plan === "free") {
    return // 免费计划或无 customer_id，不上报
  }

  // 2. 查询 plan 的 max 限制
  const { data: planData } = await supabase
    .from("product_plans")
    .select("max_task, max_skill, max_fast_skill_search, max_agentic_skill_search")
    .eq("plan", billing.plan)
    .maybeSingle()

  if (!planData) {
    console.warn(`Plan ${billing.plan} not found in product_plans`)
    return
  }

  // 3. 获取聚合后的 usage
  const { data: currentUsage } = await supabase
    .from("organization_usage")
    .select("current_task, current_skill, current_fast_skill_search, current_agentic_skill_search")
    .eq("organization_id", orgId)
    .maybeSingle()

  if (!currentUsage) {
    return
  }

  // 4. 对每个 incremental metric 类型计算并上报超量
  const incrementalMetrics: Array<{
    usageField: keyof OrgUsageSnapshot
    maxField: string
    meter: string
    tag: string
  }> = [
    { usageField: "current_task", maxField: "max_task", meter: "agent_tasks", tag: "task.created" },
    { usageField: "current_skill", maxField: "max_skill", meter: "skill_blocks", tag: "space.learned" },
    { usageField: "current_fast_skill_search", maxField: "max_fast_skill_search", meter: "fast_skill_search", tag: "search.experience.embedding" },
    { usageField: "current_agentic_skill_search", maxField: "max_agentic_skill_search", meter: "agentic_skill_search", tag: "search.experience.agentic" },
  ]

  // 记录成功上报的 tags
  const reportedTags: string[] = []

  for (const { usageField, maxField, meter, tag } of incrementalMetrics) {
    const before = initialUsage[usageField]
    const after = (currentUsage[usageField] as number) || 0
    const max = (planData[maxField] as number) || 0

    // 如果没有变化，跳过
    if (after <= before) continue

    const overageBefore = Math.max(0, before - max)
    const overageAfter = Math.max(0, after - max)
    const incrementOverage = overageAfter - overageBefore

    if (incrementOverage > 0) {
      try {
        await stripe.billing.meterEvents.create({
          event_name: meter,
          payload: {
            value: incrementOverage.toString(),
            stripe_customer_id: billing.stripe_customer_id,
          },
        })
        console.log(`Reported ${incrementOverage} to Stripe meter ${meter} for org ${orgId}`)
        reportedTags.push(tag)
      } catch (error) {
        console.error(`Failed to report Stripe for ${meter}:`, error)
      }
    }
  }

  // 5. 更新 usage_sync_logs 的 stripe_reported 字段
  if (reportedTags.length > 0) {
    await supabase
      .from("usage_sync_logs")
      .update({
        stripe_reported: true,
      })
      .eq("organization_id", orgId)
      .eq("stripe_reported", false)
      .in("tag", reportedTags)
  }
}

// 上报所有超量 org 的 storage 到 Stripe（不限于本次调用涉及的 org）
// 每个 org 每小时最多上报一次
async function reportStorageOverageForAllOrgs(): Promise<void> {
  const currentHour = getCurrentHourTimestamp()

  // 1. 查询所有非 free plan 且有 stripe_customer_id 的 org
  const { data: billings } = await supabase
    .from("organization_billing")
    .select("organization_id, stripe_customer_id, plan")
    .neq("plan", "free")
    .not("stripe_customer_id", "is", null)

  if (!billings || billings.length === 0) {
    return
  }

  // 2. 获取所有 plan 的 max_storage 限制
  const plans = [...new Set(billings.map(b => b.plan))]
  const { data: planLimits } = await supabase
    .from("product_plans")
    .select("plan, max_storage")
    .in("plan", plans)

  if (!planLimits) {
    return
  }

  const planMaxStorageMap = new Map<string, number>()
  for (const p of planLimits) {
    planMaxStorageMap.set(p.plan, (p.max_storage as number) || 0)
  }

  // 3. 获取所有涉及 org 的 storage usage
  const orgIds = billings.map(b => b.organization_id)
  const { data: orgUsages } = await supabase
    .from("organization_usage")
    .select("organization_id, current_storage")
    .in("organization_id", orgIds)

  if (!orgUsages) {
    return
  }

  const orgStorageMap = new Map<string, number>()
  for (const u of orgUsages) {
    orgStorageMap.set(u.organization_id, (u.current_storage as number) || 0)
  }

  // 4. 批量查询本小时已上报的 org
  const storageCheckpointIds = orgIds.map(id => `storage_report_${id}`)
  const { data: existingCheckpoints } = await supabase
    .from("usage_sync_global_checkpoint")
    .select("id, last_processed_to_timestamp")
    .in("id", storageCheckpointIds)

  const alreadyReportedThisHour = new Set<string>()
  if (existingCheckpoints) {
    for (const cp of existingCheckpoints) {
      if (cp.last_processed_to_timestamp === currentHour) {
        // 从 id 中提取 orgId: "storage_report_{orgId}"
        const orgId = cp.id.replace("storage_report_", "")
        alreadyReportedThisHour.add(orgId)
      }
    }
  }

  // 5. 遍历每个 org，检查是否超量并上报
  for (const billing of billings) {
    const orgId = billing.organization_id
    const stripeCustomerId = billing.stripe_customer_id
    const maxStorage = planMaxStorageMap.get(billing.plan) || 0
    const currentStorage = orgStorageMap.get(orgId) || 0

    // 跳过未超量的 org
    if (currentStorage <= maxStorage) {
      continue
    }

    // 跳过本小时已上报的 org
    if (alreadyReportedThisHour.has(orgId)) {
      console.log(`Storage overage already reported this hour for org ${orgId}, skipping`)
      continue
    }

    const overageGb = currentStorage - maxStorage

    try {
      await stripe.billing.meterEvents.create({
        event_name: "storage_gb_hour",
        payload: {
          value: overageGb.toString(),
          stripe_customer_id: stripeCustomerId,
        },
      })
      console.log(`Reported ${overageGb} GB storage overage to Stripe for org ${orgId}`)

      // 记录本小时已上报
      await supabase.from("usage_sync_global_checkpoint").upsert({
        id: `storage_report_${orgId}`,
        last_processed_to_timestamp: currentHour,
      })

      // 更新 usage_sync_logs 的 stripe_reported 字段
      await supabase
        .from("usage_sync_logs")
        .update({
          stripe_reported: true,
        })
        .eq("organization_id", orgId)
        .eq("stripe_reported", false)
        .eq("tag", "storage.usage")
    } catch (error) {
      console.error(`Failed to report Stripe storage for org ${orgId}:`, error)
    }
  }
}

// 检查是否需要处理的结果
interface ShouldProcessResult {
  shouldProcess: boolean
  lastIncrement: number // 上次同步的 increment 值，用于计算差值
}

// 检查是否需要处理（不更新 checkpoint）
// 使用 updated_at 判断记录是否有更新，返回是否需要处理以及上次同步的 increment 值
async function shouldProcessMetric(
  projectId: string,
  tag: string,
  updatedAt: string
): Promise<ShouldProcessResult> {
  // 查询指定项目和标签的同步检查点
  const { data: checkpoint } = await supabase
    .from("project_usage_checkpoints")
    .select("last_synced_timestamp, last_synced_increment")
    .eq("project_id", projectId)
    .eq("tag", tag)
    .maybeSingle()

  if (!checkpoint) {
    // 没有 checkpoint，需要处理，上次 increment 为 0
    return { shouldProcess: true, lastIncrement: 0 }
  }

  const updatedAtTs = new Date(updatedAt).toISOString()
  const checkpointTs = checkpoint.last_synced_timestamp
    ? new Date(checkpoint.last_synced_timestamp).toISOString()
    : null

  // 如果 updated_at 比 checkpoint 更新，说明记录有变化，需要处理
  if (!checkpointTs || updatedAtTs > checkpointTs) {
    const lastIncrement = (checkpoint.last_synced_increment as number) || 0
    return { shouldProcess: true, lastIncrement }
  }

  // updated_at <= checkpoint，说明已处理过，跳过
  return { shouldProcess: false, lastIncrement: 0 }
}

// 更新 checkpoint（在 usage 更新成功之后调用）
async function updateCheckpoint(
  projectId: string,
  tag: string,
  updatedAt: string,
  increment: number
): Promise<void> {
  const updatedAtTs = new Date(updatedAt).toISOString()

  // 更新或插入检查点记录，使用 updated_at 作为时间戳，包含 increment 值用于下次计算差值
  await supabase.from("project_usage_checkpoints").upsert({
    project_id: projectId,
    tag,
    last_synced_timestamp: updatedAtTs,
    last_synced_increment: increment,
  })
}

async function incrementUsage(
  projectId: string,
  config: MetricHandlerConfig,
  increment: number
) {
  if (!config.usageField) return

  // Use Postgres RPC for atomic increment to avoid read-modify-write race conditions.
  // The function atomically: INSERT if not exists, or UPDATE field = field + increment.
  const { error } = await supabase.rpc("increment_project_usage", {
    p_project_id: projectId,
    p_field: config.usageField,
    p_increment: increment,
  })

  if (error) {
    console.error(`Failed to atomically increment usage for project ${projectId}, field ${config.usageField}:`, error)
  }
}

// 更新 storage usage（只更新数据，不上报 Stripe）
async function updateStorageUsage(projectId: string, storageValue: number): Promise<void> {
  // Atomic upsert to avoid read-then-write race condition on first insert.
  // Storage is a total (not a delta), so we always SET the value.
  const { error } = await supabase
    .from("project_usage")
    .upsert({
      project_id: projectId,
      current_storage: storageValue,
      updated_at: new Date().toISOString(),
    }, { onConflict: "project_id" })

  if (error) {
    console.error(`Failed to upsert storage usage for project ${projectId}:`, error)
  }
}

async function aggregateOrganizationUsage(orgId: string): Promise<void> {
  // 获取 org 下所有 projects
  const { data: orgProjects } = await supabase
    .from("organization_projects")
    .select("project_id")
    .eq("organization_id", orgId)

  if (!orgProjects || orgProjects.length === 0) {
    return
  }

  const projectIds = orgProjects.map(p => p.project_id)

  // 聚合所有 projects 的使用量
  const { data: projectUsages } = await supabase
    .from("project_usage")
    .select("current_task, current_skill, current_fast_skill_search, current_agentic_skill_search, current_storage")
    .in("project_id", projectIds)

  if (!projectUsages || projectUsages.length === 0) {
    return
  }

  // 计算总和
  const aggregated = projectUsages.reduce(
    (acc, p) => ({
      current_task: acc.current_task + ((p.current_task as number) || 0),
      current_skill: acc.current_skill + ((p.current_skill as number) || 0),
      current_fast_skill_search: acc.current_fast_skill_search + ((p.current_fast_skill_search as number) || 0),
      current_agentic_skill_search: acc.current_agentic_skill_search + ((p.current_agentic_skill_search as number) || 0),
      current_storage: acc.current_storage + ((p.current_storage as number) || 0),
    }),
    {
      current_task: 0,
      current_skill: 0,
      current_fast_skill_search: 0,
      current_agentic_skill_search: 0,
      current_storage: 0,
    }
  )

  // 更新 organization_usage
  await supabase
    .from("organization_usage")
    .upsert({
      organization_id: orgId,
      ...aggregated,
      updated_at: new Date().toISOString(),
    })
}

// Free plan 限制类型
interface FreePlanLimits {
  max_task: number
  max_skill: number
  max_fast_skill_search: number
  max_agentic_skill_search: number
  max_storage: number
}

// 检查 free plan 的 quota 是否超限（使用缓存数据，同步函数）
function checkQuotaExcessWithCache(
  m: Metric,
  orgId: string,
  orgBillingMap: Map<string, { plan: string }>,
  freePlanLimits: FreePlanLimits | null,
  orgUsageMap: Map<string, OrgUsageSnapshot>
): QuotaItem | null {
  // 1. 检查是否为 free plan
  const billing = orgBillingMap.get(orgId)
  if (!billing || billing.plan !== "free") {
    // Non-free plan: explicitly return excess=false so the API clears any
    // leftover quota enforcement items (Redis keys + DB records) that were
    // set while the org was still on the free plan.
    return {
      project_id: m.project_id,
      tag: m.tag,
      excess: false,
    }
  }

  // 2. 获取配置
  const config = METRIC_HANDLERS[m.tag]
  if (!config || !config.usageField || !config.maxField) {
    return null
  }

  // 3. 获取 free plan 的 max 限制
  if (!freePlanLimits) {
    return null
  }

  const maxAllowed = (freePlanLimits[config.maxField as keyof FreePlanLimits] as number) || 0

  // 4. 获取当前 org 的使用量（从缓存）
  const orgUsage = orgUsageMap.get(orgId)
  if (!orgUsage) {
    return null
  }

  const currentUsage = (orgUsage[config.usageField as keyof OrgUsageSnapshot] as number) || 0

  // 5. 检查是否超限
  const excess = currentUsage > maxAllowed

  return {
    project_id: m.project_id,
    tag: m.tag,
    excess,
  }
}
