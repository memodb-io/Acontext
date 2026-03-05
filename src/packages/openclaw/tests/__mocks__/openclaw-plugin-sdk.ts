/**
 * Stub for openclaw/plugin-sdk — matches the upstream OpenClawPluginApi surface.
 */
export interface OpenClawPluginApi {
  id: string;
  name: string;
  version?: string;
  description?: string;
  source: string;
  config: unknown;
  pluginConfig?: Record<string, unknown>;
  runtime: unknown;
  logger: {
    debug?: (message: string) => void;
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };
  registerTool: (...args: unknown[]) => void;
  registerHook: (...args: unknown[]) => void;
  registerHttpRoute: (...args: unknown[]) => void;
  registerChannel: (...args: unknown[]) => void;
  registerGatewayMethod: (...args: unknown[]) => void;
  registerCli: (...args: unknown[]) => void;
  registerService: (...args: unknown[]) => void;
  registerProvider: (...args: unknown[]) => void;
  registerCommand: (...args: unknown[]) => void;
  resolvePath: (input: string) => string;
  on: (event: string, handler: (...args: unknown[]) => unknown, opts?: unknown) => void;
}
