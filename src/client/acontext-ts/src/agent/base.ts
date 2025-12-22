/**
 * Base classes for agent tools.
 */

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface BaseContext {}

export interface BaseConverter {
  toOpenAIToolSchema(): Record<string, unknown>;
  toAnthropicToolSchema(): Record<string, unknown>;
  toGeminiToolSchema(): Record<string, unknown>;
}

export interface BaseTool extends BaseConverter {
  readonly name: string;
  readonly description: string;
  readonly arguments: Record<string, unknown>;
  readonly requiredArguments: string[];
  execute(ctx: BaseContext, llmArguments: Record<string, unknown>): Promise<string>;
}

export abstract class AbstractBaseTool implements BaseTool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly arguments: Record<string, unknown>;
  abstract readonly requiredArguments: string[];
  abstract execute(ctx: BaseContext, llmArguments: Record<string, unknown>): Promise<string>;

  toOpenAIToolSchema(): Record<string, unknown> {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: {
          type: 'object',
          properties: this.arguments,
          required: this.requiredArguments,
        },
      },
    };
  }

  toAnthropicToolSchema(): Record<string, unknown> {
    return {
      name: this.name,
      description: this.description,
      input_schema: {
        type: 'object',
        properties: this.arguments,
        required: this.requiredArguments,
      },
    };
  }

  toGeminiToolSchema(): Record<string, unknown> {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: this.arguments,
        required: this.requiredArguments,
      },
    };
  }
}

export abstract class BaseToolPool {
  protected tools: Map<string, BaseTool> = new Map();

  addTool(tool: BaseTool): void {
    this.tools.set(tool.name, tool);
  }

  removeTool(toolName: string): void {
    this.tools.delete(toolName);
  }

  extendToolPool(pool: BaseToolPool): void {
    for (const [name, tool] of pool.tools.entries()) {
      this.tools.set(name, tool);
    }
  }

  async executeTool(
    ctx: BaseContext,
    toolName: string,
    llmArguments: Record<string, unknown>
  ): Promise<string> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`);
    }
    const result = await tool.execute(ctx, llmArguments);
    return result.trim();
  }

  toolExists(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  toOpenAIToolSchema(): Record<string, unknown>[] {
    return Array.from(this.tools.values()).map((tool) => tool.toOpenAIToolSchema());
  }

  toAnthropicToolSchema(): Record<string, unknown>[] {
    return Array.from(this.tools.values()).map((tool) => tool.toAnthropicToolSchema());
  }

  toGeminiToolSchema(): Record<string, unknown>[] {
    return Array.from(this.tools.values()).map((tool) => tool.toGeminiToolSchema());
  }

  abstract formatContext(...args: unknown[]): BaseContext;
}

