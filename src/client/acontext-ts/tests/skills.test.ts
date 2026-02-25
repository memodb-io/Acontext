/**
 * Tests for SkillsAPI.download() — downloads skill files to a local directory.
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { createMockClient, MockAcontextClient, mockSkill, resetMockIds } from './mocks';

describe('SkillsAPI.download', () => {
  let client: MockAcontextClient;
  let tmpDir: string;

  beforeEach(async () => {
    client = createMockClient();
    resetMockIds();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'acontext-test-'));
  });

  afterEach(async () => {
    client.reset();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const skillId = 'skill-1';

  function registerSkillMocks(
    fileIndex: Array<{ path: string; mime: string }>,
    fileResponses: Record<string, { content?: { type: string; raw: string }; url?: string }>
  ) {
    const skill = mockSkill({
      id: skillId,
      name: 'test-skill',
      description: 'A test skill',
      file_index: fileIndex,
    });

    client.mock().onGet(`/agent_skills/${skillId}`, () => skill);

    client.mock().onGet(`/agent_skills/${skillId}/file`, (options) => {
      const filePath = options?.params?.file_path as string;
      const resp = fileResponses[filePath];
      if (!resp) throw new Error(`No mock file response for ${filePath}`);
      return {
        path: filePath,
        mime: fileIndex.find((f) => f.path === filePath)?.mime ?? 'application/octet-stream',
        content: resp.content ?? null,
        url: resp.url ?? null,
      };
    });
  }

  test('should download text files preserving directory structure', async () => {
    registerSkillMocks(
      [
        { path: 'SKILL.md', mime: 'text/markdown' },
        { path: 'scripts/main.py', mime: 'text/x-python' },
      ],
      {
        'SKILL.md': { content: { type: 'text', raw: '# My Skill' } },
        'scripts/main.py': { content: { type: 'code', raw: "print('hello')" } },
      }
    );

    const dest = path.join(tmpDir, 'my-skill');
    const result = await client.skills.download(skillId, { path: dest });

    expect(result.name).toBe('test-skill');
    expect(result.description).toBe('A test skill');
    expect(result.dirPath).toBe(dest);
    expect(result.files).toEqual(['SKILL.md', 'scripts/main.py']);

    const skillMd = await fs.readFile(path.join(dest, 'SKILL.md'), 'utf-8');
    expect(skillMd).toBe('# My Skill');

    const mainPy = await fs.readFile(path.join(dest, 'scripts/main.py'), 'utf-8');
    expect(mainPy).toBe("print('hello')");
  });

  test('should download binary files from presigned URL', async () => {
    const binaryContent = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

    registerSkillMocks(
      [
        { path: 'SKILL.md', mime: 'text/markdown' },
        { path: 'images/logo.png', mime: 'image/png' },
      ],
      {
        'SKILL.md': { content: { type: 'text', raw: '# Skill' } },
        'images/logo.png': { url: 'https://s3.example.com/logo.png?signed=1' },
      }
    );

    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(binaryContent.buffer.slice(
        binaryContent.byteOffset,
        binaryContent.byteOffset + binaryContent.byteLength
      )),
    });

    try {
      const dest = path.join(tmpDir, 'binary-skill');
      const result = await client.skills.download(skillId, { path: dest });

      expect(result.files).toEqual(['SKILL.md', 'images/logo.png']);
      expect(global.fetch).toHaveBeenCalledWith('https://s3.example.com/logo.png?signed=1');

      const logoBytes = await fs.readFile(path.join(dest, 'images/logo.png'));
      expect(logoBytes).toEqual(binaryContent);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('should create deeply nested directories', async () => {
    registerSkillMocks(
      [
        { path: 'a/b/c/deep.txt', mime: 'text/plain' },
      ],
      {
        'a/b/c/deep.txt': { content: { type: 'text', raw: 'deep content' } },
      }
    );

    const dest = path.join(tmpDir, 'nested');
    const result = await client.skills.download(skillId, { path: dest });

    expect(result.files).toEqual(['a/b/c/deep.txt']);
    const content = await fs.readFile(path.join(dest, 'a/b/c/deep.txt'), 'utf-8');
    expect(content).toBe('deep content');
  });

  test('should create destination directory if it does not exist', async () => {
    registerSkillMocks(
      [{ path: 'SKILL.md', mime: 'text/markdown' }],
      { 'SKILL.md': { content: { type: 'text', raw: '# Test' } } }
    );

    const dest = path.join(tmpDir, 'nonexistent', 'deep', 'path');
    const result = await client.skills.download(skillId, { path: dest });

    expect(result.files).toEqual(['SKILL.md']);
    const stat = await fs.stat(dest);
    expect(stat.isDirectory()).toBe(true);
  });

  test('should throw on failed binary download', async () => {
    registerSkillMocks(
      [{ path: 'data.bin', mime: 'application/octet-stream' }],
      { 'data.bin': { url: 'https://s3.example.com/data.bin' } }
    );

    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });

    try {
      const dest = path.join(tmpDir, 'fail-skill');
      await expect(
        client.skills.download(skillId, { path: dest })
      ).rejects.toThrow('Failed to download data.bin: 403 Forbidden');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
