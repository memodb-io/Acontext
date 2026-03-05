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

  export type PluginHookAgentContext = {
    agentId?: string;
    sessionKey?: string;
    sessionId?: string;
    workspaceDir?: string;
    messageProvider?: string;
    trigger?: string;
    channelId?: string;
  };

  export type PluginHookBeforeAgentStartEvent = {
    prompt: string;
    messages?: unknown[];
  };

  export type PluginHookBeforeAgentStartResult = {
    systemPrompt?: string;
    prependContext?: string;
    modelOverride?: string;
    providerOverride?: string;
  };

  export type PluginHookAgentEndEvent = {
    messages: unknown[];
    success: boolean;
    error?: string;
    durationMs?: number;
  };

  export type PluginHookBeforeCompactionEvent = {
    messageCount: number;
    compactingCount?: number;
    tokenCount?: number;
    messages?: unknown[];
    sessionFile?: string;
  };

  export type PluginHookBeforeResetEvent = {
    sessionFile?: string;
    messages?: unknown[];
    reason?: string;
  };

  export type PluginHookHandlerMap = {
    before_model_resolve: (event: unknown, ctx: PluginHookAgentContext) => unknown;
    before_prompt_build: (event: unknown, ctx: PluginHookAgentContext) => unknown;
    before_agent_start: (
      event: PluginHookBeforeAgentStartEvent,
      ctx: PluginHookAgentContext,
    ) => Promise<PluginHookBeforeAgentStartResult | void> | PluginHookBeforeAgentStartResult | void;
    llm_input: (event: unknown, ctx: PluginHookAgentContext) => unknown;
    llm_output: (event: unknown, ctx: PluginHookAgentContext) => unknown;
    agent_end: (
      event: PluginHookAgentEndEvent,
      ctx: PluginHookAgentContext,
    ) => Promise<void> | void;
    before_compaction: (
      event: PluginHookBeforeCompactionEvent,
      ctx: PluginHookAgentContext,
    ) => Promise<void> | void;
    after_compaction: (event: unknown, ctx: PluginHookAgentContext) => unknown;
    before_reset: (
      event: PluginHookBeforeResetEvent,
      ctx: PluginHookAgentContext,
    ) => Promise<void> | void;
    message_received: (event: unknown, ctx: unknown) => unknown;
    message_sending: (event: unknown, ctx: unknown) => unknown;
    message_sent: (event: unknown, ctx: unknown) => unknown;
    before_tool_call: (event: unknown, ctx: unknown) => unknown;
    after_tool_call: (event: unknown, ctx: unknown) => unknown;
    tool_result_persist: (event: unknown, ctx: unknown) => unknown;
    before_message_write: (event: unknown, ctx: unknown) => unknown;
    session_start: (event: unknown, ctx: unknown) => unknown;
    session_end: (event: unknown, ctx: unknown) => unknown;
    subagent_spawning: (event: unknown, ctx: unknown) => unknown;
    subagent_delivery_target: (event: unknown, ctx: unknown) => unknown;
    subagent_spawned: (event: unknown, ctx: unknown) => unknown;
    subagent_ended: (event: unknown, ctx: unknown) => unknown;
    gateway_start: (event: unknown, ctx: unknown) => unknown;
    gateway_stop: (event: unknown, ctx: unknown) => unknown;
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
      opts?: unknown,
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

  export type PluginKind = "memory";

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
