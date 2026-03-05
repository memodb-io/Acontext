/**
 * Stub for openclaw/plugin-sdk — only the type is imported in index.ts.
 */
export interface OpenClawPluginApi {
  pluginConfig: unknown;
  logger: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
  resolvePath: (p: string) => string;
  registerTool: (...args: unknown[]) => void;
  registerCli: (...args: unknown[]) => void;
  registerService: (...args: unknown[]) => void;
  on: (event: string, handler: (...args: unknown[]) => unknown) => void;
}
