/**
 * Unit tests for agent tools.
 * These tests use mock data and do not require a running API server.
 */

import {
  BaseToolPool,
  WriteFileTool,
  ReadFileTool,
  ReplaceStringTool,
  ListTool,
  DiskToolPool,
  DISK_TOOLS,
  DiskContext,
  SKILL_TOOLS,
  SkillContext,
  GetSkillTool,
  GetSkillFileTool,
  createSkillContext,
  getSkillFromContext,
  SANDBOX_TOOLS,
  BashTool,
  TextEditorTool,
  ExportSandboxFileTool,
} from '../src/agent';
import {
  createMockClient,
  MockAcontextClient,
  mockArtifact,
  mockGetArtifactResp,
  mockFileContent,
  resetMockIds,
} from './mocks';

describe('Agent Tools Unit Tests', () => {
  let mockClient: MockAcontextClient;

  beforeEach(() => {
    mockClient = createMockClient();
    resetMockIds();
  });

  afterEach(() => {
    mockClient.reset();
  });

  describe('Tool Schema Conversion', () => {
    test('WriteFileTool should convert to OpenAI schema correctly', () => {
      const tool = new WriteFileTool();
      const schema = tool.toOpenAIToolSchema();

      expect(schema).toHaveProperty('type', 'function');
      expect(schema).toHaveProperty('function');

      const functionSchema = schema.function as Record<string, unknown>;
      expect(functionSchema).toHaveProperty('name', 'write_file_disk');
      expect(functionSchema).toHaveProperty('description');
      expect(functionSchema).toHaveProperty('parameters');

      const parameters = functionSchema.parameters as Record<string, unknown>;
      expect(parameters).toHaveProperty('type', 'object');
      expect(parameters).toHaveProperty('properties');
      expect(parameters).toHaveProperty('required');
      expect(Array.isArray(parameters.required)).toBe(true);
      expect((parameters.required as string[])).toContain('filename');
      expect((parameters.required as string[])).toContain('content');
    });

    test('WriteFileTool should convert to Anthropic schema correctly', () => {
      const tool = new WriteFileTool();
      const schema = tool.toAnthropicToolSchema();

      expect(schema).toHaveProperty('name', 'write_file_disk');
      expect(schema).toHaveProperty('description');
      expect(schema).toHaveProperty('input_schema');

      const inputSchema = schema.input_schema as Record<string, unknown>;
      expect(inputSchema).toHaveProperty('type', 'object');
      expect(inputSchema).toHaveProperty('properties');
      expect(inputSchema).toHaveProperty('required');
      expect(Array.isArray(inputSchema.required)).toBe(true);
      expect((inputSchema.required as string[])).toContain('filename');
      expect((inputSchema.required as string[])).toContain('content');
    });

    test('ReadFileTool should have correct properties', () => {
      const tool = new ReadFileTool();
      expect(tool.name).toBe('read_file_disk');
      expect(tool.description).toBeTruthy();
      expect(tool.requiredArguments).toContain('filename');
      expect(tool.arguments).toHaveProperty('filename');
      expect(tool.arguments).toHaveProperty('file_path');
      expect(tool.arguments).toHaveProperty('line_offset');
      expect(tool.arguments).toHaveProperty('line_limit');
    });

    test('ReplaceStringTool should have correct properties', () => {
      const tool = new ReplaceStringTool();
      expect(tool.name).toBe('replace_string_disk');
      expect(tool.description).toBeTruthy();
      expect(tool.requiredArguments).toContain('filename');
      expect(tool.requiredArguments).toContain('old_string');
      expect(tool.requiredArguments).toContain('new_string');
    });

    test('ListTool should have correct properties', () => {
      const tool = new ListTool();
      expect(tool.name).toBe('list_disk');
      expect(tool.description).toBeTruthy();
      expect(tool.requiredArguments).toContain('file_path');
    });
  });

  describe('ToolPool Management', () => {
    test('should add and check tool existence', () => {
      const pool = new DiskToolPool();
      const tool = new WriteFileTool();

      expect(pool.toolExists('write_file_disk')).toBe(false);
      pool.addTool(tool);
      expect(pool.toolExists('write_file_disk')).toBe(true);
    });

    test('should remove tool', () => {
      const pool = new DiskToolPool();
      const tool = new WriteFileTool();

      pool.addTool(tool);
      expect(pool.toolExists('write_file_disk')).toBe(true);
      pool.removeTool('write_file_disk');
      expect(pool.toolExists('write_file_disk')).toBe(false);
    });

    test('should extend tool pool', () => {
      const pool1 = new DiskToolPool();
      const pool2 = new DiskToolPool();

      pool1.addTool(new WriteFileTool());
      pool2.addTool(new ReadFileTool());

      expect(pool1.toolExists('write_file_disk')).toBe(true);
      expect(pool1.toolExists('read_file_disk')).toBe(false);

      pool1.extendToolPool(pool2);

      expect(pool1.toolExists('write_file_disk')).toBe(true);
      expect(pool1.toolExists('read_file_disk')).toBe(true);
    });

    test('should generate OpenAI tool schemas', () => {
      const pool = new DiskToolPool();
      pool.addTool(new WriteFileTool());
      pool.addTool(new ReadFileTool());

      const schemas = pool.toOpenAIToolSchema();
      expect(Array.isArray(schemas)).toBe(true);
      expect(schemas.length).toBe(2);
      expect(schemas.every((s) => s.type === 'function')).toBe(true);
    });

    test('should generate Anthropic tool schemas', () => {
      const pool = new DiskToolPool();
      pool.addTool(new WriteFileTool());
      pool.addTool(new ReadFileTool());

      const schemas = pool.toAnthropicToolSchema();
      expect(Array.isArray(schemas)).toBe(true);
      expect(schemas.length).toBe(2);
      expect(schemas.every((s) => s.name && s.input_schema)).toBe(true);
    });

    test('should throw error when executing non-existent tool', async () => {
      const pool = new DiskToolPool();
      const ctx: DiskContext = {
        client: mockClient as unknown as import('../src/index').AcontextClient,
        diskId: 'dummy-id',
        getContextPrompt: () => '',
      };

      await expect(
        pool.executeTool(ctx, 'non_existent_tool', {})
      ).rejects.toThrow("Tool 'non_existent_tool' not found");
    });
  });

  describe('Disk Tools with Mocks', () => {
    const diskId = 'test-disk-id';

    test('DISK_TOOLS should be pre-configured with all tools', () => {
      expect(DISK_TOOLS.toolExists('write_file_disk')).toBe(true);
      expect(DISK_TOOLS.toolExists('read_file_disk')).toBe(true);
      expect(DISK_TOOLS.toolExists('replace_string_disk')).toBe(true);
      expect(DISK_TOOLS.toolExists('list_disk')).toBe(true);
    });

    test('should write file to disk', async () => {
      const artifact = mockArtifact({
        disk_id: diskId,
        path: '/test/',
        filename: 'test.txt',
      });
      mockClient.mock().onPost(`/disk/${diskId}/artifact`, () => artifact);

      const ctx = DISK_TOOLS.formatContext(
        mockClient as unknown as import('../src/index').AcontextClient,
        diskId
      );
      const result = await DISK_TOOLS.executeTool(ctx, 'write_file_disk', {
        filename: 'test.txt',
        file_path: '/test/',
        content: 'Hello, World!',
      });

      expect(result).toContain('test.txt');
      expect(result).toContain('written successfully');
    });

    test('should read file from disk', async () => {
      const artifact = mockArtifact({
        disk_id: diskId,
        path: '/test/',
        filename: 'test.txt',
      });
      mockClient.mock().onGet(`/disk/${diskId}/artifact`, () =>
        mockGetArtifactResp({
          artifact,
          content: mockFileContent({ raw: 'Hello, World!' }),
        })
      );

      const ctx = DISK_TOOLS.formatContext(
        mockClient as unknown as import('../src/index').AcontextClient,
        diskId
      );
      const result = await DISK_TOOLS.executeTool(ctx, 'read_file_disk', {
        filename: 'test.txt',
        file_path: '/test/',
      });

      expect(result).toContain('test.txt');
      expect(result).toContain('Hello, World!');
    });

    test('should read file with line offset and limit', async () => {
      const artifact = mockArtifact({
        disk_id: diskId,
        path: '/test/',
        filename: 'multiline.txt',
      });
      mockClient.mock().onGet(`/disk/${diskId}/artifact`, () =>
        mockGetArtifactResp({
          artifact,
          content: mockFileContent({ raw: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5' }),
        })
      );

      const ctx = DISK_TOOLS.formatContext(
        mockClient as unknown as import('../src/index').AcontextClient,
        diskId
      );
      const result = await DISK_TOOLS.executeTool(ctx, 'read_file_disk', {
        filename: 'multiline.txt',
        file_path: '/test/',
        line_offset: 1,
        line_limit: 2,
      });

      expect(result).toContain('showing L1-3');
      expect(result).toContain('Line 2');
      expect(result).toContain('Line 3');
    });

    test('should replace string in file', async () => {
      const artifact = mockArtifact({
        disk_id: diskId,
        path: '/test/',
        filename: 'test.txt',
      });

      // Mock get artifact (to read content)
      mockClient.mock().onGet(`/disk/${diskId}/artifact`, () =>
        mockGetArtifactResp({
          artifact,
          content: mockFileContent({ raw: 'Hello, World!' }),
        })
      );

      // Mock upsert artifact (to write updated content)
      mockClient.mock().onPost(`/disk/${diskId}/artifact`, () => artifact);

      const ctx = DISK_TOOLS.formatContext(
        mockClient as unknown as import('../src/index').AcontextClient,
        diskId
      );
      const result = await DISK_TOOLS.executeTool(ctx, 'replace_string_disk', {
        filename: 'test.txt',
        file_path: '/test/',
        old_string: 'Hello',
        new_string: 'Hi',
      });

      expect(result).toContain('replaced it');
    });

    test('should handle string replacement when string not found', async () => {
      const artifact = mockArtifact({
        disk_id: diskId,
        path: '/test/',
        filename: 'test.txt',
      });

      mockClient.mock().onGet(`/disk/${diskId}/artifact`, () =>
        mockGetArtifactResp({
          artifact,
          content: mockFileContent({ raw: 'Hello, World!' }),
        })
      );

      const ctx = DISK_TOOLS.formatContext(
        mockClient as unknown as import('../src/index').AcontextClient,
        diskId
      );
      const result = await DISK_TOOLS.executeTool(ctx, 'replace_string_disk', {
        filename: 'test.txt',
        file_path: '/test/',
        old_string: 'NonExistentString',
        new_string: 'NewString',
      });

      expect(result).toContain('not found in file');
    });

    test('should list artifacts in directory', async () => {
      const artifacts = [
        mockArtifact({ disk_id: diskId, path: '/test/', filename: 'test.txt' }),
        mockArtifact({ disk_id: diskId, path: '/test/', filename: 'multiline.txt' }),
      ];
      mockClient.mock().onGet(`/disk/${diskId}/artifact/ls`, () => ({
        artifacts,
        directories: ['subdir/'],
      }));

      const ctx = DISK_TOOLS.formatContext(
        mockClient as unknown as import('../src/index').AcontextClient,
        diskId
      );
      const result = await DISK_TOOLS.executeTool(ctx, 'list_disk', {
        file_path: '/test/',
      });

      expect(result).toContain('[Listing in /test/]');
      expect(result).toContain('test.txt');
      expect(result).toContain('multiline.txt');
    });

    test('should handle write file without file_path', async () => {
      const artifact = mockArtifact({
        disk_id: diskId,
        path: '/',
        filename: 'root_file.txt',
      });
      mockClient.mock().onPost(`/disk/${diskId}/artifact`, () => artifact);

      const ctx = DISK_TOOLS.formatContext(
        mockClient as unknown as import('../src/index').AcontextClient,
        diskId
      );
      const result = await DISK_TOOLS.executeTool(ctx, 'write_file_disk', {
        filename: 'root_file.txt',
        content: 'Content in root',
      });

      expect(result).toContain('root_file.txt');
      expect(result).toContain('written successfully');
    });

    test('should throw error when required arguments missing', async () => {
      const ctx = DISK_TOOLS.formatContext(
        mockClient as unknown as import('../src/index').AcontextClient,
        diskId
      );

      await expect(
        DISK_TOOLS.executeTool(ctx, 'write_file_disk', {
          filename: 'test.txt',
          // Missing content
        })
      ).rejects.toThrow('content is required');

      await expect(
        DISK_TOOLS.executeTool(ctx, 'read_file_disk', {
          // Missing filename
        })
      ).rejects.toThrow('filename is required');
    });
  });

  describe('Skill Tools', () => {
    test('SKILL_TOOLS should be pre-configured with all tools', () => {
      expect(SKILL_TOOLS.toolExists('get_skill')).toBe(true);
      expect(SKILL_TOOLS.toolExists('get_skill_file')).toBe(true);
    });

    test('should throw error when skill_name not provided', async () => {
      const ctx: SkillContext = {
        client: mockClient as unknown as import('../src/index').AcontextClient,
        skills: new Map(),
        getContextPrompt: () => '',
      };
      await expect(
        SKILL_TOOLS.executeTool(ctx, 'get_skill', {})
      ).rejects.toThrow('skill_name is required');
    });

    test('should throw error when skill_name missing for get_file', async () => {
      const ctx: SkillContext = {
        client: mockClient as unknown as import('../src/index').AcontextClient,
        skills: new Map(),
        getContextPrompt: () => '',
      };
      await expect(
        SKILL_TOOLS.executeTool(ctx, 'get_skill_file', {
          file_path: 'test.json',
        })
      ).rejects.toThrow('skill_name is required');
    });

    test('should throw error when file_path missing for get_file', async () => {
      const ctx: SkillContext = {
        client: mockClient as unknown as import('../src/index').AcontextClient,
        skills: new Map(),
        getContextPrompt: () => '',
      };
      await expect(
        SKILL_TOOLS.executeTool(ctx, 'get_skill_file', {
          skill_name: 'test-skill',
        })
      ).rejects.toThrow('file_path is required');
    });

    test('should throw error when skill not found in context', async () => {
      const ctx: SkillContext = {
        client: mockClient as unknown as import('../src/index').AcontextClient,
        skills: new Map(),
        getContextPrompt: () => '',
      };
      await expect(
        SKILL_TOOLS.executeTool(ctx, 'get_skill', { skill_name: 'unknown-skill' })
      ).rejects.toThrow("Skill 'unknown-skill' not found in context");
    });
  });

  describe('Skill Tool Schema Conversion', () => {
    test('GetSkillTool should have correct properties', () => {
      const tool = new GetSkillTool();
      expect(tool.name).toBe('get_skill');
      expect(tool.description).toBeTruthy();
      expect(tool.requiredArguments).toContain('skill_name');
      expect(tool.arguments).toHaveProperty('skill_name');
    });

    test('GetSkillFileTool should have correct properties', () => {
      const tool = new GetSkillFileTool();
      expect(tool.name).toBe('get_skill_file');
      expect(tool.description).toBeTruthy();
      expect(tool.requiredArguments).toContain('skill_name');
      expect(tool.requiredArguments).toContain('file_path');
      expect(tool.arguments).toHaveProperty('skill_name');
      expect(tool.arguments).toHaveProperty('file_path');
      expect(tool.arguments).toHaveProperty('expire');
      expect(tool.arguments).not.toHaveProperty('with_content');
      expect(tool.arguments).not.toHaveProperty('with_public_url');
    });

    test('SKILL_TOOLS should generate OpenAI tool schemas', () => {
      const schemas = SKILL_TOOLS.toOpenAIToolSchema();
      expect(Array.isArray(schemas)).toBe(true);
      expect(schemas.length).toBe(2);
      expect(schemas.every((s) => s.type === 'function')).toBe(true);
    });

    test('SKILL_TOOLS should generate Anthropic tool schemas', () => {
      const schemas = SKILL_TOOLS.toAnthropicToolSchema();
      expect(Array.isArray(schemas)).toBe(true);
      expect(schemas.length).toBe(2);
      expect(schemas.every((s) => s.name && s.input_schema)).toBe(true);
    });
  });

  describe('Skill Context Management', () => {
    test('createSkillContext should create context with empty skills array', async () => {
      const ctx = await createSkillContext(
        mockClient as unknown as import('../src/index').AcontextClient,
        [] // empty skill IDs
      );
      expect(ctx.client).toBeDefined();
      expect(ctx.skills).toBeInstanceOf(Map);
      expect(ctx.skills.size).toBe(0);
    });

    test('getSkillFromContext should throw error for non-existent skill', () => {
      const ctx: SkillContext = {
        client: mockClient as unknown as import('../src/index').AcontextClient,
        skills: new Map(),
        getContextPrompt: () => '',
      };
      expect(() => getSkillFromContext(ctx, 'non-existent')).toThrow(
        "Skill 'non-existent' not found in context"
      );
    });

    test('getSkillFromContext should return skill when it exists', () => {
      const skillData = {
        id: 'skill-id',
        name: 'test-skill',
        description: 'A test skill',
        disk_id: 'disk-id',
        file_index: [],
        meta: null,
        user_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const ctx: SkillContext = {
        client: mockClient as unknown as import('../src/index').AcontextClient,
        skills: new Map([['test-skill', skillData as import('../src/types').Skill]]),
        getContextPrompt: () => '',
      };
      const skill = getSkillFromContext(ctx, 'test-skill');
      expect(skill).toBeDefined();
      expect(skill.name).toBe('test-skill');
    });
  });

  describe('Sandbox Tools', () => {
    test('SANDBOX_TOOLS should be pre-configured with all tools', () => {
      expect(SANDBOX_TOOLS.toolExists('bash_execution_sandbox')).toBe(true);
      expect(SANDBOX_TOOLS.toolExists('text_editor_sandbox')).toBe(true);
      expect(SANDBOX_TOOLS.toolExists('export_file_sandbox')).toBe(true);
    });

    test('BashTool should have correct properties', () => {
      const tool = new BashTool();
      expect(tool.name).toBe('bash_execution_sandbox');
      expect(tool.description).toBeTruthy();
      expect(tool.requiredArguments).toContain('command');
      expect(tool.arguments).toHaveProperty('command');
      expect(tool.arguments).toHaveProperty('timeout');
    });

    test('TextEditorTool should have correct properties', () => {
      const tool = new TextEditorTool();
      expect(tool.name).toBe('text_editor_sandbox');
      expect(tool.description).toBeTruthy();
      expect(tool.requiredArguments).toContain('command');
      expect(tool.requiredArguments).toContain('path');
      expect(tool.arguments).toHaveProperty('command');
      expect(tool.arguments).toHaveProperty('path');
      expect(tool.arguments).toHaveProperty('file_text');
      expect(tool.arguments).toHaveProperty('old_str');
      expect(tool.arguments).toHaveProperty('new_str');
      expect(tool.arguments).toHaveProperty('view_range');
    });

    test('ExportSandboxFileTool should have correct properties', () => {
      const tool = new ExportSandboxFileTool();
      expect(tool.name).toBe('export_file_sandbox');
      expect(tool.description).toBeTruthy();
      expect(tool.requiredArguments).toContain('sandbox_path');
      expect(tool.requiredArguments).toContain('sandbox_filename');
    });

    test('SANDBOX_TOOLS should generate OpenAI tool schemas', () => {
      const schemas = SANDBOX_TOOLS.toOpenAIToolSchema();
      expect(Array.isArray(schemas)).toBe(true);
      expect(schemas.length).toBe(3);
      expect(schemas.every((s) => s.type === 'function')).toBe(true);
    });

    test('SANDBOX_TOOLS should generate Anthropic tool schemas', () => {
      const schemas = SANDBOX_TOOLS.toAnthropicToolSchema();
      expect(Array.isArray(schemas)).toBe(true);
      expect(schemas.length).toBe(3);
      expect(schemas.every((s) => s.name && s.input_schema)).toBe(true);
    });
  });

  describe('Sandbox Timeout Conversion', () => {
    const sandboxId = 'test-sandbox-id';
    const diskId = 'test-disk-id';

    function createSandboxCtx(client: MockAcontextClient) {
      return {
        client: client as unknown as import('../src/index').AcontextClient,
        sandboxId,
        diskId,
        mountedSkillPaths: new Map(),
        getContextPrompt: () => '',
        formatMountedSkills: () => '',
        mountSkills: async () => {},
      };
    }

    function mockExecRoute(client: MockAcontextClient) {
      client.mock().onPost(new RegExp(`/sandbox/.+/exec`), () => ({
        stdout: '',
        stderr: '',
        exit_code: 0,
      }));
    }

    test('BashTool should convert LLM timeout (seconds) to milliseconds', async () => {
      const tool = new BashTool();
      mockExecRoute(mockClient);
      const ctx = createSandboxCtx(mockClient);

      await tool.execute(ctx, { command: 'echo hi', timeout: 60 });

      const call = mockClient.requester.calls.find(
        (c) => c.method === 'POST' && c.path.includes('/exec')
      );
      expect(call).toBeDefined();
      expect((call!.options as any).timeout).toBe(60000);
    });

    test('BashTool should convert constructor default timeout (seconds) to milliseconds', async () => {
      const tool = new BashTool(30);
      mockExecRoute(mockClient);
      const ctx = createSandboxCtx(mockClient);

      await tool.execute(ctx, { command: 'echo hi' });

      const call = mockClient.requester.calls.find(
        (c) => c.method === 'POST' && c.path.includes('/exec')
      );
      expect(call).toBeDefined();
      expect((call!.options as any).timeout).toBe(30000);
    });

    test('BashTool should pass undefined timeout when none provided', async () => {
      const tool = new BashTool();
      mockExecRoute(mockClient);
      const ctx = createSandboxCtx(mockClient);

      await tool.execute(ctx, { command: 'echo hi' });

      const call = mockClient.requester.calls.find(
        (c) => c.method === 'POST' && c.path.includes('/exec')
      );
      expect(call).toBeDefined();
      expect((call!.options as any).timeout).toBeUndefined();
    });

    test('TextEditorTool should convert constructor timeout (seconds) to milliseconds', async () => {
      const tool = new TextEditorTool(45);
      mockExecRoute(mockClient);
      const ctx = createSandboxCtx(mockClient);

      await tool.execute(ctx, { command: 'view', path: '/workspace/test.txt' });

      const call = mockClient.requester.calls.find(
        (c) => c.method === 'POST' && c.path.includes('/exec')
      );
      expect(call).toBeDefined();
      expect((call!.options as any).timeout).toBe(45000);
    });

    test('TextEditorTool should pass undefined timeout when none provided', async () => {
      const tool = new TextEditorTool();
      mockExecRoute(mockClient);
      const ctx = createSandboxCtx(mockClient);

      await tool.execute(ctx, { command: 'view', path: '/workspace/test.txt' });

      const call = mockClient.requester.calls.find(
        (c) => c.method === 'POST' && c.path.includes('/exec')
      );
      expect(call).toBeDefined();
      expect((call!.options as any).timeout).toBeUndefined();
    });
  });

  describe('OpenAI Schema Array Validation', () => {
    /**
     * Validates that all array types in schema properties have 'items' defined.
     * OpenAI Function Calling requires array types to specify their items schema.
     */
    function validateArrayTypesHaveItems(
      properties: Record<string, unknown>,
      path: string = ''
    ): void {
      for (const [propName, propSchema] of Object.entries(properties)) {
        const currentPath = path ? `${path}.${propName}` : propName;
        const schema = propSchema as Record<string, unknown>;
        const propType = schema.type;

        // Handle type as array (e.g., ["array", "null"])
        const typesToCheck = Array.isArray(propType) ? propType : [propType];

        for (const t of typesToCheck) {
          if (t === 'array') {
            if (!('items' in schema)) {
              throw new Error(
                `Property '${currentPath}' has type 'array' but missing 'items'. OpenAI requires array schemas to define items.`
              );
            }
          }
        }

        // Recursively check nested properties
        if (schema.properties) {
          validateArrayTypesHaveItems(
            schema.properties as Record<string, unknown>,
            currentPath
          );
        }
      }
    }

    test('SANDBOX_TOOLS OpenAI schemas should have items for array types', () => {
      const schemas = SANDBOX_TOOLS.toOpenAIToolSchema();

      for (const schema of schemas) {
        const funcSchema = schema.function as Record<string, unknown>;
        const params = funcSchema.parameters as Record<string, unknown>;
        const properties = (params.properties || {}) as Record<string, unknown>;
        validateArrayTypesHaveItems(properties, funcSchema.name as string);
      }
    });

    test('TextEditorTool view_range should have correct schema with items', () => {
      const tool = new TextEditorTool();
      const schema = tool.toOpenAIToolSchema();
      const funcSchema = schema.function as Record<string, unknown>;
      const params = funcSchema.parameters as Record<string, unknown>;
      const properties = params.properties as Record<string, unknown>;
      const viewRange = properties.view_range as Record<string, unknown>;

      expect(viewRange.type).toEqual(['array', 'null']);
      expect(viewRange).toHaveProperty('items');
      expect((viewRange.items as Record<string, unknown>).type).toBe('integer');
    });

    test('All tool pools should have valid OpenAI array schemas', () => {
      const toolPools = [
        { name: 'DISK_TOOLS', pool: DISK_TOOLS },
        { name: 'SKILL_TOOLS', pool: SKILL_TOOLS },
        { name: 'SANDBOX_TOOLS', pool: SANDBOX_TOOLS },
      ];

      for (const { name, pool } of toolPools) {
        const schemas = pool.toOpenAIToolSchema();
        for (const schema of schemas) {
          const funcSchema = schema.function as Record<string, unknown>;
          const params = funcSchema.parameters as Record<string, unknown>;
          const properties = (params.properties || {}) as Record<string, unknown>;
          validateArrayTypesHaveItems(
            properties,
            `${name}.${funcSchema.name as string}`
          );
        }
      }
    });
  });
});
