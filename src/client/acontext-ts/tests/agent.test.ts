/**
 * Integration tests for agent tools.
 * These tests require a running Acontext API instance.
 */

import { AcontextClient } from '../src/index';
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
  CreateSkillTool,
  GetSkillTool,
  ListSkillsTool,
  UpdateSkillTool,
  DeleteSkillTool,
  GetSkillFileTool,
} from '../src/agent';

describe('Agent Tools Tests', () => {
  const apiKey = process.env.ACONTEXT_API_KEY || 'sk-ac-your-root-api-bearer-token';
  const baseUrl = process.env.ACONTEXT_BASE_URL || 'http://localhost:8029/api/v1';

  let client: AcontextClient;
  let createdDiskId: string | null = null;

  beforeAll(() => {
    client = new AcontextClient({ apiKey, baseUrl });
  });

  afterAll(async () => {
    // Cleanup: delete created disk
    if (createdDiskId) {
      try {
        await client.disks.delete(createdDiskId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Tool Schema Conversion', () => {
    test('WriteFileTool should convert to OpenAI schema correctly', () => {
      const tool = new WriteFileTool();
      const schema = tool.toOpenAIToolSchema();

      expect(schema).toHaveProperty('type', 'function');
      expect(schema).toHaveProperty('function');
      
      const functionSchema = schema.function as Record<string, unknown>;
      expect(functionSchema).toHaveProperty('name', 'write_file');
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

      expect(schema).toHaveProperty('name', 'write_file');
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
      expect(tool.name).toBe('read_file');
      expect(tool.description).toBeTruthy();
      expect(tool.requiredArguments).toContain('filename');
      expect(tool.arguments).toHaveProperty('filename');
      expect(tool.arguments).toHaveProperty('file_path');
      expect(tool.arguments).toHaveProperty('line_offset');
      expect(tool.arguments).toHaveProperty('line_limit');
    });

    test('ReplaceStringTool should have correct properties', () => {
      const tool = new ReplaceStringTool();
      expect(tool.name).toBe('replace_string');
      expect(tool.description).toBeTruthy();
      expect(tool.requiredArguments).toContain('filename');
      expect(tool.requiredArguments).toContain('old_string');
      expect(tool.requiredArguments).toContain('new_string');
    });

    test('ListTool should have correct properties', () => {
      const tool = new ListTool();
      expect(tool.name).toBe('list_artifacts');
      expect(tool.description).toBeTruthy();
      expect(tool.requiredArguments).toContain('file_path');
    });
  });

  describe('ToolPool Management', () => {
    test('should add and check tool existence', () => {
      const pool = new DiskToolPool();
      const tool = new WriteFileTool();

      expect(pool.toolExists('write_file')).toBe(false);
      pool.addTool(tool);
      expect(pool.toolExists('write_file')).toBe(true);
    });

    test('should remove tool', () => {
      const pool = new DiskToolPool();
      const tool = new WriteFileTool();

      pool.addTool(tool);
      expect(pool.toolExists('write_file')).toBe(true);
      pool.removeTool('write_file');
      expect(pool.toolExists('write_file')).toBe(false);
    });

    test('should extend tool pool', () => {
      const pool1 = new DiskToolPool();
      const pool2 = new DiskToolPool();

      pool1.addTool(new WriteFileTool());
      pool2.addTool(new ReadFileTool());

      expect(pool1.toolExists('write_file')).toBe(true);
      expect(pool1.toolExists('read_file')).toBe(false);

      pool1.extendToolPool(pool2);

      expect(pool1.toolExists('write_file')).toBe(true);
      expect(pool1.toolExists('read_file')).toBe(true);
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
        client,
        diskId: 'dummy-id',
      };

      await expect(
        pool.executeTool(ctx, 'non_existent_tool', {})
      ).rejects.toThrow("Tool 'non_existent_tool' not found");
    });
  });

  describe('Disk Tools Integration', () => {
    beforeAll(async () => {
      // Create a disk for testing
      const disk = await client.disks.create();
      createdDiskId = disk.id;
    });

    test('DISK_TOOLS should be pre-configured with all tools', () => {
      expect(DISK_TOOLS.toolExists('write_file')).toBe(true);
      expect(DISK_TOOLS.toolExists('read_file')).toBe(true);
      expect(DISK_TOOLS.toolExists('replace_string')).toBe(true);
      expect(DISK_TOOLS.toolExists('list_artifacts')).toBe(true);
    });

    test('should write file to disk', async () => {
      if (!createdDiskId) {
        throw new Error('Disk not created');
      }

      const ctx = DISK_TOOLS.formatContext(client, createdDiskId);
      const result = await DISK_TOOLS.executeTool(ctx, 'write_file', {
        filename: 'test.txt',
        file_path: '/test/',
        content: 'Hello, World!',
      });

      expect(result).toContain('test.txt');
      expect(result).toContain('written successfully');
    });

    test('should read file from disk', async () => {
      if (!createdDiskId) {
        throw new Error('Disk not created');
      }

      const ctx = DISK_TOOLS.formatContext(client, createdDiskId);
      const result = await DISK_TOOLS.executeTool(ctx, 'read_file', {
        filename: 'test.txt',
        file_path: '/test/',
      });

      expect(result).toContain('test.txt');
      expect(result).toContain('Hello, World!');
      expect(result).toContain('showing L');
    });

    test('should read file with line offset and limit', async () => {
      if (!createdDiskId) {
        throw new Error('Disk not created');
      }

      // Write a multi-line file
      const ctx = DISK_TOOLS.formatContext(client, createdDiskId);
      await DISK_TOOLS.executeTool(ctx, 'write_file', {
        filename: 'multiline.txt',
        file_path: '/test/',
        content: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5',
      });

      const result = await DISK_TOOLS.executeTool(ctx, 'read_file', {
        filename: 'multiline.txt',
        file_path: '/test/',
        line_offset: 1,
        line_limit: 2,
      });

      expect(result).toContain('showing L1-3');
      expect(result).toContain('Line 2');
      expect(result).toContain('Line 3');
      expect(result).not.toContain('Line 1');
      expect(result).not.toContain('Line 4');
    });

    test('should replace string in file', async () => {
      if (!createdDiskId) {
        throw new Error('Disk not created');
      }

      const ctx = DISK_TOOLS.formatContext(client, createdDiskId);
      const result = await DISK_TOOLS.executeTool(ctx, 'replace_string', {
        filename: 'test.txt',
        file_path: '/test/',
        old_string: 'Hello',
        new_string: 'Hi',
      });

      expect(result).toContain('replaced it');

      // Verify the replacement
      const readResult = await DISK_TOOLS.executeTool(ctx, 'read_file', {
        filename: 'test.txt',
        file_path: '/test/',
      });
      expect(readResult).toContain('Hi, World!');
      expect(readResult).not.toContain('Hello, World!');
    });

    test('should handle string replacement when string not found', async () => {
      if (!createdDiskId) {
        throw new Error('Disk not created');
      }

      const ctx = DISK_TOOLS.formatContext(client, createdDiskId);
      const result = await DISK_TOOLS.executeTool(ctx, 'replace_string', {
        filename: 'test.txt',
        file_path: '/test/',
        old_string: 'NonExistentString',
        new_string: 'NewString',
      });

      expect(result).toContain('not found in file');
    });

    test('should list artifacts in directory', async () => {
      if (!createdDiskId) {
        throw new Error('Disk not created');
      }

      const ctx = DISK_TOOLS.formatContext(client, createdDiskId);
      const result = await DISK_TOOLS.executeTool(ctx, 'list_artifacts', {
        file_path: '/test/',
      });

      expect(result).toContain('[Listing in /test/]');
      expect(result).toContain('test.txt');
      expect(result).toContain('multiline.txt');
    });

    test('should list artifacts in root directory', async () => {
      if (!createdDiskId) {
        throw new Error('Disk not created');
      }

      const ctx = DISK_TOOLS.formatContext(client, createdDiskId);
      const result = await DISK_TOOLS.executeTool(ctx, 'list_artifacts', {
        file_path: '/',
      });

      expect(result).toContain('[Listing in /]');
    });

    test('should handle write file without file_path', async () => {
      if (!createdDiskId) {
        throw new Error('Disk not created');
      }

      const ctx = DISK_TOOLS.formatContext(client, createdDiskId);
      const result = await DISK_TOOLS.executeTool(ctx, 'write_file', {
        filename: 'root_file.txt',
        content: 'Content in root',
      });

      expect(result).toContain('root_file.txt');
      expect(result).toContain('written successfully');
    });

    test('should handle read file without file_path', async () => {
      if (!createdDiskId) {
        throw new Error('Disk not created');
      }

      const ctx = DISK_TOOLS.formatContext(client, createdDiskId);
      const result = await DISK_TOOLS.executeTool(ctx, 'read_file', {
        filename: 'root_file.txt',
      });

      expect(result).toContain('root_file.txt');
      expect(result).toContain('Content in root');
    });

    test('should throw error when required arguments missing', async () => {
      if (!createdDiskId) {
        throw new Error('Disk not created');
      }

      const ctx = DISK_TOOLS.formatContext(client, createdDiskId);

      await expect(
        DISK_TOOLS.executeTool(ctx, 'write_file', {
          filename: 'test.txt',
          // Missing content
        })
      ).rejects.toThrow('content is required');

      await expect(
        DISK_TOOLS.executeTool(ctx, 'read_file', {
          // Missing filename
        })
      ).rejects.toThrow('filename is required');
    });
  });

  describe('Skill Tools Integration', () => {
    let createdSkillId: string | null = null;

    test('SKILL_TOOLS should be pre-configured with all tools', () => {
      expect(SKILL_TOOLS.toolExists('create_skill')).toBe(true);
      expect(SKILL_TOOLS.toolExists('get_skill')).toBe(true);
      expect(SKILL_TOOLS.toolExists('list_skills')).toBe(true);
      expect(SKILL_TOOLS.toolExists('update_skill')).toBe(true);
      expect(SKILL_TOOLS.toolExists('delete_skill')).toBe(true);
      expect(SKILL_TOOLS.toolExists('get_skill_file')).toBe(true);
    });

    test('should list skills', async () => {
      const ctx = SKILL_TOOLS.formatContext(client);
      const result = await SKILL_TOOLS.executeTool(ctx, 'list_skills', {
        limit: 10,
      });

      expect(result).toContain('skill(s)');
    });

    test('should get skill by ID', async () => {
      // First, list skills to get an ID if available
      const skills = await client.skills.list({ limit: 1 });
      if (skills.items.length > 0) {
        const skillId = skills.items[0].id;
        const ctx = SKILL_TOOLS.formatContext(client);
        const result = await SKILL_TOOLS.executeTool(ctx, 'get_skill', {
          skill_id: skillId,
        });

        expect(result).toContain(skills.items[0].name);
        expect(result).toContain('file(s)');
      }
    });

    test('should get skill by name', async () => {
      // First, list skills to get a name if available
      const skills = await client.skills.list({ limit: 1 });
      if (skills.items.length > 0) {
        const skillName = skills.items[0].name;
        const ctx = SKILL_TOOLS.formatContext(client);
        const result = await SKILL_TOOLS.executeTool(ctx, 'get_skill', {
          name: skillName,
        });

        expect(result).toContain(skillName);
      }
    });

    test('should update skill', async () => {
      // First, list skills to get an ID if available
      const skills = await client.skills.list({ limit: 1 });
      if (skills.items.length > 0) {
        const skillId = skills.items[0].id;
        const originalName = skills.items[0].name;
        const ctx = SKILL_TOOLS.formatContext(client);
        const result = await SKILL_TOOLS.executeTool(ctx, 'update_skill', {
          skill_id: skillId,
          description: 'Updated description for testing',
        });

        expect(result).toContain('updated successfully');
        expect(result).toContain(originalName);

        // Restore original description
        await client.skills.update(skillId, {
          description: skills.items[0].description,
        });
      }
    });

    test('should throw error when skill_id or name not provided', async () => {
      const ctx = SKILL_TOOLS.formatContext(client);
      await expect(
        SKILL_TOOLS.executeTool(ctx, 'get_skill', {})
      ).rejects.toThrow('Either skill_id or name must be provided');
    });

    test('should throw error when skill_id missing for update', async () => {
      const ctx = SKILL_TOOLS.formatContext(client);
      await expect(
        SKILL_TOOLS.executeTool(ctx, 'update_skill', {})
      ).rejects.toThrow('skill_id is required');
    });

    test('should throw error when no update fields provided', async () => {
      const skills = await client.skills.list({ limit: 1 });
      if (skills.items.length > 0) {
        const ctx = SKILL_TOOLS.formatContext(client);
        await expect(
          SKILL_TOOLS.executeTool(ctx, 'update_skill', {
            skill_id: skills.items[0].id,
          })
        ).rejects.toThrow(
          'At least one of name, description, or meta must be provided'
        );
      }
    });

    test('should throw error when skill_id missing for delete', async () => {
      const ctx = SKILL_TOOLS.formatContext(client);
      await expect(
        SKILL_TOOLS.executeTool(ctx, 'delete_skill', {})
      ).rejects.toThrow('skill_id is required');
    });

    test('should throw error when skill_id missing for get_file', async () => {
      const ctx = SKILL_TOOLS.formatContext(client);
      await expect(
        SKILL_TOOLS.executeTool(ctx, 'get_skill_file', {
          file_path: 'test.json',
        })
      ).rejects.toThrow('skill_id is required');
    });

    test('should throw error when file_path missing for get_file', async () => {
      const skills = await client.skills.list({ limit: 1 });
      if (skills.items.length > 0) {
        const ctx = SKILL_TOOLS.formatContext(client);
        await expect(
          SKILL_TOOLS.executeTool(ctx, 'get_skill_file', {
            skill_id: skills.items[0].id,
          })
        ).rejects.toThrow('file_path is required');
      }
    });
  });

  describe('Skill Tool Schema Conversion', () => {
    test('CreateSkillTool should convert to OpenAI schema correctly', () => {
      const tool = new CreateSkillTool();
      const schema = tool.toOpenAIToolSchema();

      expect(schema).toHaveProperty('type', 'function');
      expect(schema).toHaveProperty('function');

      const functionSchema = schema.function as Record<string, unknown>;
      expect(functionSchema).toHaveProperty('name', 'create_skill');
      expect(functionSchema).toHaveProperty('description');
      expect(functionSchema).toHaveProperty('parameters');

      const parameters = functionSchema.parameters as Record<string, unknown>;
      expect(parameters).toHaveProperty('type', 'object');
      expect(parameters).toHaveProperty('properties');
      expect(parameters).toHaveProperty('required');
      expect(Array.isArray(parameters.required)).toBe(true);
      expect((parameters.required as string[])).toContain('file_path');
    });

    test('GetSkillTool should have correct properties', () => {
      const tool = new GetSkillTool();
      expect(tool.name).toBe('get_skill');
      expect(tool.description).toBeTruthy();
      expect(tool.requiredArguments.length).toBe(0); // Either skill_id or name
      expect(tool.arguments).toHaveProperty('skill_id');
      expect(tool.arguments).toHaveProperty('name');
    });

    test('ListSkillsTool should have correct properties', () => {
      const tool = new ListSkillsTool();
      expect(tool.name).toBe('list_skills');
      expect(tool.description).toBeTruthy();
      expect(tool.requiredArguments.length).toBe(0);
      expect(tool.arguments).toHaveProperty('limit');
      expect(tool.arguments).toHaveProperty('time_desc');
    });

    test('UpdateSkillTool should have correct properties', () => {
      const tool = new UpdateSkillTool();
      expect(tool.name).toBe('update_skill');
      expect(tool.description).toBeTruthy();
      expect(tool.requiredArguments).toContain('skill_id');
      expect(tool.arguments).toHaveProperty('skill_id');
      expect(tool.arguments).toHaveProperty('name');
      expect(tool.arguments).toHaveProperty('description');
      expect(tool.arguments).toHaveProperty('meta');
    });

    test('DeleteSkillTool should have correct properties', () => {
      const tool = new DeleteSkillTool();
      expect(tool.name).toBe('delete_skill');
      expect(tool.description).toBeTruthy();
      expect(tool.requiredArguments).toContain('skill_id');
    });

    test('GetSkillFileTool should have correct properties', () => {
      const tool = new GetSkillFileTool();
      expect(tool.name).toBe('get_skill_file');
      expect(tool.description).toBeTruthy();
      expect(tool.requiredArguments).toContain('skill_id');
      expect(tool.requiredArguments).toContain('file_path');
      expect(tool.arguments).toHaveProperty('skill_id');
      expect(tool.arguments).toHaveProperty('file_path');
      expect(tool.arguments).toHaveProperty('expire');
    });

    test('SKILL_TOOLS should generate OpenAI tool schemas', () => {
      const schemas = SKILL_TOOLS.toOpenAIToolSchema();
      expect(Array.isArray(schemas)).toBe(true);
      expect(schemas.length).toBe(6); // All 6 skill tools
      expect(schemas.every((s) => s.type === 'function')).toBe(true);
    });

    test('SKILL_TOOLS should generate Anthropic tool schemas', () => {
      const schemas = SKILL_TOOLS.toAnthropicToolSchema();
      expect(Array.isArray(schemas)).toBe(true);
      expect(schemas.length).toBe(6);
      expect(schemas.every((s) => s.name && s.input_schema)).toBe(true);
    });
  });
});

