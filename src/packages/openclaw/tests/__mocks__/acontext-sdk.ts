/**
 * Mock for @acontext/acontext SDK.
 *
 * Provides a MockAcontextClient that records calls and returns
 * configurable responses for each method.
 */

export class MockSessionsAPI {
  calls: Array<{ method: string; args: unknown[] }> = [];
  responses: Record<string, unknown> = {};

  setResponse(method: string, value: unknown) {
    this.responses[method] = value;
  }

  private record(method: string, ...args: unknown[]) {
    this.calls.push({ method, args });
    const resp = this.responses[method];
    if (typeof resp === "function") return resp(...args);
    return resp;
  }

  async list(options?: unknown) {
    return this.record("list", options) ?? { items: [], has_more: false };
  }
  async create(options?: unknown) {
    return this.record("create", options) ?? { id: "mock-session-id" };
  }
  async storeMessage(sessionId: string, blob: unknown, options?: unknown) {
    return this.record("storeMessage", sessionId, blob, options) ?? { id: "mock-msg-id" };
  }
  async flush(sessionId: string) {
    return this.record("flush", sessionId) ?? { status: 0, errmsg: "" };
  }
  async messagesObservingStatus(sessionId: string) {
    return this.record("messagesObservingStatus", sessionId) ?? { observed: 0, in_process: 0, pending: 0 };
  }
  async getTasks(sessionId: string, options?: unknown) {
    return this.record("getTasks", sessionId, options) ?? { items: [], has_more: false };
  }
  async getSessionSummary(sessionId: string, options?: unknown) {
    return this.record("getSessionSummary", sessionId, options) ?? "";
  }
}

export class MockLearningSpacesAPI {
  calls: Array<{ method: string; args: unknown[] }> = [];
  responses: Record<string, unknown> = {};

  setResponse(method: string, value: unknown) {
    this.responses[method] = value;
  }

  private record(method: string, ...args: unknown[]) {
    this.calls.push({ method, args });
    const resp = this.responses[method];
    if (typeof resp === "function") return resp(...args);
    return resp;
  }

  async list(options?: unknown) {
    return this.record("list", options) ?? { items: [], has_more: false };
  }
  async create(options?: unknown) {
    return this.record("create", options) ?? { id: "mock-space-id" };
  }
  async listSkills(spaceId: string) {
    return this.record("listSkills", spaceId) ?? [];
  }
  async learn(options: unknown) {
    return this.record("learn", options) ?? { id: "mock-learning-id" };
  }
}

export class MockSkillsAPI {
  calls: Array<{ method: string; args: unknown[] }> = [];
  responses: Record<string, unknown> = {};

  setResponse(method: string, value: unknown) {
    this.responses[method] = value;
  }

  private record(method: string, ...args: unknown[]) {
    this.calls.push({ method, args });
    const resp = this.responses[method];
    if (typeof resp === "function") return resp(...args);
    return resp;
  }

  async getFile(options: unknown) {
    return this.record("getFile", options) ?? { content: null, url: null };
  }
}

export class MockArtifactsAPI {
  calls: Array<{ method: string; args: unknown[] }> = [];
  responses: Record<string, unknown> = {};

  setResponse(method: string, value: unknown) {
    this.responses[method] = value;
  }

  private record(method: string, ...args: unknown[]) {
    this.calls.push({ method, args });
    const resp = this.responses[method];
    if (typeof resp === "function") return resp(...args);
    return resp;
  }

  async grepArtifacts(diskId: string, options: unknown) {
    return this.record("grepArtifacts", diskId, options) ?? [];
  }
}

export class AcontextClient {
  sessions = new MockSessionsAPI();
  learningSpaces = new MockLearningSpacesAPI();
  skills = new MockSkillsAPI();
  artifacts = new MockArtifactsAPI();

  constructor(public options: { apiKey?: string; baseUrl?: string }) {}

  reset() {
    this.sessions = new MockSessionsAPI();
    this.learningSpaces = new MockLearningSpacesAPI();
    this.skills = new MockSkillsAPI();
    this.artifacts = new MockArtifactsAPI();
  }
}

let mockClientInstance: AcontextClient | null = null;

export function __setMockClient(client: AcontextClient) {
  mockClientInstance = client;
}

export function __getMockClient(): AcontextClient | null {
  return mockClientInstance;
}
