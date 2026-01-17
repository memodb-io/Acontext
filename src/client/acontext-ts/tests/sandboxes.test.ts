/**
 * Unit tests for the Sandboxes API with mocked requests.
 */

import { AcontextClient } from '../src/index';

// Mock the requester
const mockRequest = jest.fn();

describe('SandboxesAPI Mock Tests', () => {
  let client: AcontextClient;

  beforeEach(() => {
    client = new AcontextClient({
      apiKey: 'test-api-key',
      baseUrl: 'http://localhost:8029/api/v1',
    });
    // Replace the client's request method with our mock
    (client as any).request = mockRequest;
    mockRequest.mockReset();
  });

  describe('create', () => {
    it('should create a sandbox and return SandboxRuntimeInfo', async () => {
      const mockResponse = {
        sandbox_id: 'sandbox-123',
        sandbox_status: 'running',
        sandbox_created_at: '2024-01-01T00:00:00Z',
        sandbox_expires_at: '2024-01-01T01:00:00Z',
      };
      mockRequest.mockResolvedValue(mockResponse);

      const result = await client.sandboxes.create();

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith('POST', '/sandbox');
      expect(result).toEqual({
        sandbox_id: 'sandbox-123',
        sandbox_status: 'running',
        sandbox_created_at: '2024-01-01T00:00:00Z',
        sandbox_expires_at: '2024-01-01T01:00:00Z',
      });
    });
  });

  describe('execCommand', () => {
    it('should execute a command and return SandboxCommandOutput', async () => {
      const mockResponse = {
        stdout: 'Hello, World!',
        stderr: '',
        exit_code: 0,
      };
      mockRequest.mockResolvedValue(mockResponse);

      const result = await client.sandboxes.execCommand({
        sandboxId: 'sandbox-123',
        command: "echo 'Hello, World!'",
      });

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith(
        'POST',
        '/sandbox/sandbox-123/exec',
        { jsonData: { command: "echo 'Hello, World!'" } }
      );
      expect(result).toEqual({
        stdout: 'Hello, World!',
        stderr: '',
        exit_code: 0,
      });
    });

    it('should handle command execution with non-zero exit code', async () => {
      const mockResponse = {
        stdout: '',
        stderr: 'command not found: invalid_cmd',
        exit_code: 127,
      };
      mockRequest.mockResolvedValue(mockResponse);

      const result = await client.sandboxes.execCommand({
        sandboxId: 'sandbox-123',
        command: 'invalid_cmd',
      });

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith(
        'POST',
        '/sandbox/sandbox-123/exec',
        { jsonData: { command: 'invalid_cmd' } }
      );
      expect(result).toEqual({
        stdout: '',
        stderr: 'command not found: invalid_cmd',
        exit_code: 127,
      });
    });

    it('should handle command with both stdout and stderr', async () => {
      const mockResponse = {
        stdout: 'partial output',
        stderr: 'warning: something went wrong',
        exit_code: 1,
      };
      mockRequest.mockResolvedValue(mockResponse);

      const result = await client.sandboxes.execCommand({
        sandboxId: 'sandbox-456',
        command: 'some-command --with-warning',
      });

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith(
        'POST',
        '/sandbox/sandbox-456/exec',
        { jsonData: { command: 'some-command --with-warning' } }
      );
      expect(result.stdout).toBe('partial output');
      expect(result.stderr).toBe('warning: something went wrong');
      expect(result.exit_code).toBe(1);
    });
  });

  describe('kill', () => {
    it('should kill a sandbox and return FlagResponse', async () => {
      const mockResponse = {
        status: 0,
        errmsg: '',
      };
      mockRequest.mockResolvedValue(mockResponse);

      const result = await client.sandboxes.kill('sandbox-123');

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith('DELETE', '/sandbox/sandbox-123');
      expect(result).toEqual({
        status: 0,
        errmsg: '',
      });
    });

    it('should handle kill with error response', async () => {
      const mockResponse = {
        status: 1,
        errmsg: 'sandbox not found',
      };
      mockRequest.mockResolvedValue(mockResponse);

      const result = await client.sandboxes.kill('nonexistent-sandbox');

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith('DELETE', '/sandbox/nonexistent-sandbox');
      expect(result.status).toBe(1);
      expect(result.errmsg).toBe('sandbox not found');
    });

    it('should handle kill of already killed sandbox', async () => {
      const mockResponse = {
        status: 1,
        errmsg: 'sandbox already killed',
      };
      mockRequest.mockResolvedValue(mockResponse);

      const result = await client.sandboxes.kill('sandbox-already-killed');

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith('DELETE', '/sandbox/sandbox-already-killed');
      expect(result.status).toBe(1);
      expect(result.errmsg).toBe('sandbox already killed');
    });
  });
});
