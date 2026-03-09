/**
 * Type declarations for openclaw/plugin-sdk.
 *
 * Based on the upstream OpenClaw plugin SDK types from
 * https://github.com/openclaw/openclaw (src/plugins/types.ts).
 *
 * OpenClaw plugin SDK types are only available at runtime inside the
 * OpenClaw gateway. This declaration file satisfies the type checker
 * for builds and tests outside of that environment.
 */
declare module "openclaw/plugin-sdk/core" {
  // ---------------------------------------------------------------------------
  // Logger
  // ---------------------------------------------------------------------------

  export type PluginLogger = {
    debug?: (message: string) => void;
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };

  // ---------------------------------------------------------------------------
  // Config Schema
  // ---------------------------------------------------------------------------

  export type PluginConfigValidation =
    | { ok: true; value?: unknown }
    | { ok: false; errors: string[] };

  export type OpenClawPluginConfigSchema = {
    safeParse?: (value: unknown) => {
      success: boolean;
      data?: unknown;
      error?: { issues?: Array<{ path: unknown[]; message: string }> };
    };
    parse?: (value: unknown) => unknown;
    validate?: (value: unknown) => PluginConfigValidation;
    uiHints?: Record<string, unknown>;
    jsonSchema?: Record<string, unknown>;
  };

  // ---------------------------------------------------------------------------
  // Tool Types
  // ---------------------------------------------------------------------------

  export type AnyAgentTool = Record<string, unknown> & {
    name: string;
    description?: string;
    parameters?: unknown;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute?: (...args: any[]) => any;
  };

  export type OpenClawPluginToolContext = {
    config?: unknown;
    workspaceDir?: string;
    agentDir?: string;
    agentId?: string;
    sessionKey?: string;
    sessionId?: string;
    messageChannel?: string;
    agentAccountId?: string;
    requesterSenderId?: string;
    senderIsOwner?: boolean;
    sandboxed?: boolean;
  };

  export type OpenClawPluginToolFactory = (
    ctx: OpenClawPluginToolContext,
  ) => AnyAgentTool | AnyAgentTool[] | null | undefined;

  export type OpenClawPluginToolOptions = {
    name?: string;
    names?: string[];
    optional?: boolean;
  };

  // ---------------------------------------------------------------------------
  // Hook Options
  // ---------------------------------------------------------------------------

  export type OpenClawPluginHookOptions = {
    entry?: unknown;
    name?: string;
    description?: string;
    register?: boolean;
  };

  // ---------------------------------------------------------------------------
  // CLI Types
  // ---------------------------------------------------------------------------

  export type OpenClawPluginCliContext = {
    program: unknown;
    config: unknown;
    workspaceDir?: string;
    logger: PluginLogger;
  };

  export type OpenClawPluginCliRegistrar = (
    ctx: OpenClawPluginCliContext,
  ) => void | Promise<void>;

  // ---------------------------------------------------------------------------
  // Service Types
  // ---------------------------------------------------------------------------

  export type OpenClawPluginServiceContext = {
    config: unknown;
    workspaceDir?: string;
    stateDir: string;
    logger: PluginLogger;
  };

  export type OpenClawPluginService = {
    id: string;
    start: (ctx: OpenClawPluginServiceContext) => void | Promise<void>;
    stop?: (ctx: OpenClawPluginServiceContext) => void | Promise<void>;
  };

  // ---------------------------------------------------------------------------
  // Hook Types
  // ---------------------------------------------------------------------------

  export type PluginHookName =
    | "before_model_resolve"
    | "before_prompt_build"
    | "before_agent_start"
    | "llm_input"
    | "llm_output"
    | "agent_end"
    | "before_compaction"
    | "after_compaction"
    | "before_reset"
    | "message_received"
    | "message_sending"
    | "message_sent"
    | "before_tool_call"
    | "after_tool_call"
    | "tool_result_persist"
    | "before_message_write"
    | "session_start"
    | "session_end"
    | "subagent_spawning"
    | "subagent_delivery_target"
    | "subagent_spawned"
    | "subagent_ended"
    | "gateway_start"
    | "gateway_stop";

  // -- Agent context shared across agent hooks --------------------------------

  export type PluginHookAgentContext = {
    agentId?: string;
    sessionKey?: string;
    sessionId?: string;
    workspaceDir?: string;
    messageProvider?: string;
    trigger?: string;
    channelId?: string;
  };

  // -- before_model_resolve ---------------------------------------------------

  export type PluginHookBeforeModelResolveEvent = {
    prompt: string;
  };

  export type PluginHookBeforeModelResolveResult = {
    modelOverride?: string;
    providerOverride?: string;
  };

  // -- before_prompt_build ----------------------------------------------------

  export type PluginHookBeforePromptBuildEvent = {
    prompt: string;
    messages: unknown[];
  };

  export type PluginHookBeforePromptBuildResult = {
    systemPrompt?: string;
    prependContext?: string;
    prependSystemContext?: string;
    appendSystemContext?: string;
  };

  // -- before_agent_start (legacy: combines both phases) ----------------------

  export type PluginHookBeforeAgentStartEvent = {
    prompt: string;
    messages?: unknown[];
  };

  export type PluginHookBeforeAgentStartResult = PluginHookBeforePromptBuildResult &
    PluginHookBeforeModelResolveResult;

  // -- llm_input --------------------------------------------------------------

  export type PluginHookLlmInputEvent = {
    runId: string;
    sessionId: string;
    provider: string;
    model: string;
    systemPrompt?: string;
    prompt: string;
    historyMessages: unknown[];
    imagesCount: number;
  };

  // -- llm_output -------------------------------------------------------------

  export type PluginHookLlmOutputEvent = {
    runId: string;
    sessionId: string;
    provider: string;
    model: string;
    assistantTexts: string[];
    lastAssistant?: unknown;
    usage?: {
      input?: number;
      output?: number;
      cacheRead?: number;
      cacheWrite?: number;
      total?: number;
    };
  };

  // -- agent_end --------------------------------------------------------------

  export type PluginHookAgentEndEvent = {
    messages: unknown[];
    success: boolean;
    error?: string;
    durationMs?: number;
  };

  // -- Compaction hooks -------------------------------------------------------

  export type PluginHookBeforeCompactionEvent = {
    messageCount: number;
    compactingCount?: number;
    tokenCount?: number;
    messages?: unknown[];
    sessionFile?: string;
  };

  export type PluginHookAfterCompactionEvent = {
    messageCount: number;
    tokenCount?: number;
    compactedCount: number;
    sessionFile?: string;
  };

  // -- before_reset -----------------------------------------------------------

  export type PluginHookBeforeResetEvent = {
    sessionFile?: string;
    messages?: unknown[];
    reason?: string;
  };

  // -- Message context --------------------------------------------------------

  export type PluginHookMessageContext = {
    channelId: string;
    accountId?: string;
    conversationId?: string;
  };

  // -- message_received -------------------------------------------------------

  export type PluginHookMessageReceivedEvent = {
    from: string;
    content: string;
    timestamp?: number;
    metadata?: Record<string, unknown>;
  };

  // -- message_sending --------------------------------------------------------

  export type PluginHookMessageSendingEvent = {
    to: string;
    content: string;
    metadata?: Record<string, unknown>;
  };

  export type PluginHookMessageSendingResult = {
    content?: string;
    cancel?: boolean;
  };

  // -- message_sent -----------------------------------------------------------

  export type PluginHookMessageSentEvent = {
    to: string;
    content: string;
    success: boolean;
    error?: string;
  };

  // -- Tool context -----------------------------------------------------------

  export type PluginHookToolContext = {
    agentId?: string;
    sessionKey?: string;
    sessionId?: string;
    runId?: string;
    toolName: string;
    toolCallId?: string;
  };

  // -- before_tool_call -------------------------------------------------------

  export type PluginHookBeforeToolCallEvent = {
    toolName: string;
    params: Record<string, unknown>;
    runId?: string;
    toolCallId?: string;
  };

  export type PluginHookBeforeToolCallResult = {
    params?: Record<string, unknown>;
    block?: boolean;
    blockReason?: string;
  };

  // -- after_tool_call --------------------------------------------------------

  export type PluginHookAfterToolCallEvent = {
    toolName: string;
    params: Record<string, unknown>;
    runId?: string;
    toolCallId?: string;
    result?: unknown;
    error?: string;
    durationMs?: number;
  };

  // -- tool_result_persist ----------------------------------------------------

  export type PluginHookToolResultPersistContext = {
    agentId?: string;
    sessionKey?: string;
    toolName?: string;
    toolCallId?: string;
  };

  export type PluginHookToolResultPersistEvent = {
    toolName?: string;
    toolCallId?: string;
    message: unknown;
    isSynthetic?: boolean;
  };

  export type PluginHookToolResultPersistResult = {
    message?: unknown;
  };

  // -- before_message_write ---------------------------------------------------

  export type PluginHookBeforeMessageWriteEvent = {
    message: unknown;
    sessionKey?: string;
    agentId?: string;
  };

  export type PluginHookBeforeMessageWriteResult = {
    block?: boolean;
    message?: unknown;
  };

  // -- Session context --------------------------------------------------------

  export type PluginHookSessionContext = {
    agentId?: string;
    sessionId: string;
    sessionKey?: string;
  };

  // -- session_start ----------------------------------------------------------

  export type PluginHookSessionStartEvent = {
    sessionId: string;
    sessionKey?: string;
    resumedFrom?: string;
  };

  // -- session_end ------------------------------------------------------------

  export type PluginHookSessionEndEvent = {
    sessionId: string;
    sessionKey?: string;
    messageCount: number;
    durationMs?: number;
  };

  // -- Subagent context -------------------------------------------------------

  export type PluginHookSubagentContext = {
    runId?: string;
    childSessionKey?: string;
    requesterSessionKey?: string;
  };

  export type PluginHookSubagentTargetKind = "subagent" | "acp";

  // -- subagent_spawning ------------------------------------------------------

  export type PluginHookSubagentSpawningEvent = {
    childSessionKey: string;
    agentId: string;
    label?: string;
    mode: "run" | "session";
    requester?: {
      channel?: string;
      accountId?: string;
      to?: string;
      threadId?: string | number;
    };
    threadRequested: boolean;
  };

  export type PluginHookSubagentSpawningResult =
    | {
        status: "ok";
        threadBindingReady?: boolean;
      }
    | {
        status: "error";
        error: string;
      };

  // -- subagent_delivery_target -----------------------------------------------

  export type PluginHookSubagentDeliveryTargetEvent = {
    childSessionKey: string;
    requesterSessionKey: string;
    requesterOrigin?: {
      channel?: string;
      accountId?: string;
      to?: string;
      threadId?: string | number;
    };
    childRunId?: string;
    spawnMode?: "run" | "session";
    expectsCompletionMessage: boolean;
  };

  export type PluginHookSubagentDeliveryTargetResult = {
    origin?: {
      channel?: string;
      accountId?: string;
      to?: string;
      threadId?: string | number;
    };
  };

  // -- subagent_spawned -------------------------------------------------------

  export type PluginHookSubagentSpawnedEvent = PluginHookSubagentSpawningEvent & {
    runId: string;
  };

  // -- subagent_ended ---------------------------------------------------------

  export type PluginHookSubagentEndedEvent = {
    targetSessionKey: string;
    targetKind: PluginHookSubagentTargetKind;
    reason: string;
    sendFarewell?: boolean;
    accountId?: string;
    runId?: string;
    endedAt?: number;
    outcome?: "ok" | "error" | "timeout" | "killed" | "reset" | "deleted";
    error?: string;
  };

  // -- Gateway context --------------------------------------------------------

  export type PluginHookGatewayContext = {
    port?: number;
  };

  // -- gateway_start ----------------------------------------------------------

  export type PluginHookGatewayStartEvent = {
    port: number;
  };

  // -- gateway_stop -----------------------------------------------------------

  export type PluginHookGatewayStopEvent = {
    reason?: string;
  };

  // ---------------------------------------------------------------------------
  // Hook Handler Map
  // ---------------------------------------------------------------------------

  export type PluginHookHandlerMap = {
    before_model_resolve: (
      event: PluginHookBeforeModelResolveEvent,
      ctx: PluginHookAgentContext,
    ) =>
      | Promise<PluginHookBeforeModelResolveResult | void>
      | PluginHookBeforeModelResolveResult
      | void;
    before_prompt_build: (
      event: PluginHookBeforePromptBuildEvent,
      ctx: PluginHookAgentContext,
    ) => Promise<PluginHookBeforePromptBuildResult | void> | PluginHookBeforePromptBuildResult | void;
    before_agent_start: (
      event: PluginHookBeforeAgentStartEvent,
      ctx: PluginHookAgentContext,
    ) => Promise<PluginHookBeforeAgentStartResult | void> | PluginHookBeforeAgentStartResult | void;
    llm_input: (event: PluginHookLlmInputEvent, ctx: PluginHookAgentContext) => Promise<void> | void;
    llm_output: (
      event: PluginHookLlmOutputEvent,
      ctx: PluginHookAgentContext,
    ) => Promise<void> | void;
    agent_end: (
      event: PluginHookAgentEndEvent,
      ctx: PluginHookAgentContext,
    ) => Promise<void> | void;
    before_compaction: (
      event: PluginHookBeforeCompactionEvent,
      ctx: PluginHookAgentContext,
    ) => Promise<void> | void;
    after_compaction: (
      event: PluginHookAfterCompactionEvent,
      ctx: PluginHookAgentContext,
    ) => Promise<void> | void;
    before_reset: (
      event: PluginHookBeforeResetEvent,
      ctx: PluginHookAgentContext,
    ) => Promise<void> | void;
    message_received: (
      event: PluginHookMessageReceivedEvent,
      ctx: PluginHookMessageContext,
    ) => Promise<void> | void;
    message_sending: (
      event: PluginHookMessageSendingEvent,
      ctx: PluginHookMessageContext,
    ) => Promise<PluginHookMessageSendingResult | void> | PluginHookMessageSendingResult | void;
    message_sent: (
      event: PluginHookMessageSentEvent,
      ctx: PluginHookMessageContext,
    ) => Promise<void> | void;
    before_tool_call: (
      event: PluginHookBeforeToolCallEvent,
      ctx: PluginHookToolContext,
    ) => Promise<PluginHookBeforeToolCallResult | void> | PluginHookBeforeToolCallResult | void;
    after_tool_call: (
      event: PluginHookAfterToolCallEvent,
      ctx: PluginHookToolContext,
    ) => Promise<void> | void;
    tool_result_persist: (
      event: PluginHookToolResultPersistEvent,
      ctx: PluginHookToolResultPersistContext,
    ) => PluginHookToolResultPersistResult | void;
    before_message_write: (
      event: PluginHookBeforeMessageWriteEvent,
      ctx: { agentId?: string; sessionKey?: string },
    ) => PluginHookBeforeMessageWriteResult | void;
    session_start: (
      event: PluginHookSessionStartEvent,
      ctx: PluginHookSessionContext,
    ) => Promise<void> | void;
    session_end: (
      event: PluginHookSessionEndEvent,
      ctx: PluginHookSessionContext,
    ) => Promise<void> | void;
    subagent_spawning: (
      event: PluginHookSubagentSpawningEvent,
      ctx: PluginHookSubagentContext,
    ) => Promise<PluginHookSubagentSpawningResult | void> | PluginHookSubagentSpawningResult | void;
    subagent_delivery_target: (
      event: PluginHookSubagentDeliveryTargetEvent,
      ctx: PluginHookSubagentContext,
    ) =>
      | Promise<PluginHookSubagentDeliveryTargetResult | void>
      | PluginHookSubagentDeliveryTargetResult
      | void;
    subagent_spawned: (
      event: PluginHookSubagentSpawnedEvent,
      ctx: PluginHookSubagentContext,
    ) => Promise<void> | void;
    subagent_ended: (
      event: PluginHookSubagentEndedEvent,
      ctx: PluginHookSubagentContext,
    ) => Promise<void> | void;
    gateway_start: (
      event: PluginHookGatewayStartEvent,
      ctx: PluginHookGatewayContext,
    ) => Promise<void> | void;
    gateway_stop: (
      event: PluginHookGatewayStopEvent,
      ctx: PluginHookGatewayContext,
    ) => Promise<void> | void;
  };

  // ---------------------------------------------------------------------------
  // Command Types
  // ---------------------------------------------------------------------------

  export type OpenClawPluginCommandDefinition = {
    name: string;
    description: string;
    acceptsArgs?: boolean;
    requireAuth?: boolean;
    handler: (ctx: unknown) => unknown;
  };

  // ---------------------------------------------------------------------------
  // Plugin API
  // ---------------------------------------------------------------------------

  export type OpenClawPluginApi = {
    id: string;
    name: string;
    version?: string;
    description?: string;
    source: string;
    config: unknown;
    pluginConfig?: Record<string, unknown>;
    runtime: unknown;
    logger: PluginLogger;
    registerTool: (
      tool: AnyAgentTool | OpenClawPluginToolFactory,
      opts?: OpenClawPluginToolOptions,
    ) => void;
    registerHook: (
      events: string | string[],
      handler: (...args: unknown[]) => unknown,
      opts?: OpenClawPluginHookOptions,
    ) => void;
    registerHttpRoute: (params: unknown) => void;
    registerChannel: (registration: unknown) => void;
    registerGatewayMethod: (method: string, handler: unknown) => void;
    registerCli: (
      registrar: OpenClawPluginCliRegistrar,
      opts?: { commands?: string[] },
    ) => void;
    registerService: (service: OpenClawPluginService) => void;
    registerProvider: (provider: unknown) => void;
    registerCommand: (command: OpenClawPluginCommandDefinition) => void;
    registerContextEngine: (id: string, factory: unknown) => void;
    resolvePath: (input: string) => string;
    on: <K extends PluginHookName>(
      hookName: K,
      handler: PluginHookHandlerMap[K],
      opts?: { priority?: number },
    ) => void;
  };

  // ---------------------------------------------------------------------------
  // Plugin Definition
  // ---------------------------------------------------------------------------

  export type PluginKind = "memory" | "context-engine";

  export type OpenClawPluginDefinition = {
    id?: string;
    name?: string;
    description?: string;
    version?: string;
    kind?: PluginKind;
    configSchema?: OpenClawPluginConfigSchema;
    register?: (api: OpenClawPluginApi) => void | Promise<void>;
    activate?: (api: OpenClawPluginApi) => void | Promise<void>;
  };
}

/**
 * Legacy monolithic import path — re-exports everything from core.
 * Kept for backward compatibility with existing external plugins.
 */
declare module "openclaw/plugin-sdk" {
  export * from "openclaw/plugin-sdk/core";
}
