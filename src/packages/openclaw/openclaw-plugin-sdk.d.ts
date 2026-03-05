/**
 * Stub type declarations for openclaw/plugin-sdk.
 * OpenClaw plugin SDK types are only available at runtime inside the
 * OpenClaw gateway. This declaration file satisfies the type checker
 * for builds and tests outside of that environment.
 */
declare module "openclaw/plugin-sdk" {
  export interface OpenClawPluginApi {
    pluginConfig: unknown;
    logger: {
      info: (...args: unknown[]) => void;
      warn: (...args: unknown[]) => void;
      error: (...args: unknown[]) => void;
    };
    resolvePath: (p: string) => string;
    registerTool: (toolDef: any, opts?: any) => void;
    registerCli: (handler: any, opts?: any) => void;
    registerService: (service: any) => void;
    on: (event: string, handler: (...args: any[]) => any) => void;
  }
}
