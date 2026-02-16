export interface Disk {
  id: string;
  project_id: string;
  created_at: string;
  updated_at: string;
}

export interface Artifact {
  disk_id: string;
  path: string;
  filename: string;
  meta: {
    __artifact_info__: {
      filename: string;
      mime: string;
      path: string;
      size: number;
    };
    [key: string]: unknown;
  };
  created_at: string;
  updated_at: string;
}

export interface ListArtifactsResp {
  artifacts: Artifact[];
  directories: string[];
}

export interface FileContent {
  type: string; // "text", "json", "csv", "code"
  raw: string;  // Raw text content
}

export interface GetArtifactResp {
  artifact: Artifact;
  public_url: string | null;
  content?: FileContent | null;
}

export interface Session {
  id: string;
  project_id: string;
  user_id: string | null;
  disable_task_tracking: boolean;
  configs: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Part {
  type: string;
  text?: string;
  asset?: {
    bucket: string;
    s3_key: string;
    etag: string;
    sha256: string;
    mime: string;
    size_b: number;
  };
  filename?: string;
  meta?: Record<string, unknown>;
}

export interface Message {
  id: string;
  session_id: string;
  parent_id: string | null;
  role: string;
  meta?: Record<string, unknown>;
  parts: Part[];
  task_id?: string | null;
  session_task_process_status: string;
  created_at: string;
  updated_at: string;
}

export interface GetMessagesResp {
  items: Message[];
  next_cursor?: string;
  has_more: boolean;
  public_urls?: Record<string, { url: string; expire_at: string }>;
}

export interface Task {
  id: string;
  session_id: string;
  project_id: string;
  order: number;
  data: Record<string, unknown>;
  status: "pending" | "running" | "success" | "failed";
  is_planning: boolean;
  created_at: string;
  updated_at: string;
}

export interface GetTasksResp {
  items: Task[];
  next_cursor?: string;
  has_more: boolean;
}

export interface GetSessionsResp {
  items: Session[];
  next_cursor?: string;
  has_more: boolean;
}

export interface GetDisksResp {
  items: Disk[];
  next_cursor?: string;
  has_more: boolean;
}

// Add types for new API entities

export interface AgentSkill {
  id: string;
  user_id: string | null;
  name: string;
  description: string;
  file_index: { path: string; mime: string }[];
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GetAgentSkillsResp {
  items: AgentSkill[];
  next_cursor?: string;
  has_more: boolean;
}

export interface User {
  id: string;
  project_id: string;
  identifier: string;
  created_at: string;
  updated_at: string;
}

export interface GetUsersResp {
  items: User[];
  next_cursor?: string;
  has_more: boolean;
}

export interface UserResources {
  counts: {
    sessions_count: number;
    disks_count: number;
    skills_count: number;
  };
}

// Learning Space types

export interface LearningSpace {
  id: string;
  user_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface GetLearningSpacesResp {
  items: LearningSpace[];
  next_cursor?: string;
  has_more: boolean;
}

export interface LearningSpaceSession {
  id: string;
  learning_space_id: string;
  session_id: string;
  status: "pending" | "done" | "failed";
  created_at: string;
  updated_at: string;
}

export interface LearningSpaceSkill {
  id: string;
  learning_space_id: string;
  skill_id: string;
  created_at: string;
}

// Message related types
export type MessageRole = "user" | "assistant";

export type PartType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "file"
  | "tool-call"
  | "tool-result"
  | "data";

export interface UploadedFile {
  id: string;
  file: globalThis.File; // Browser File API
  type: PartType;
}

// UI-only type for creating tool-call parts
export interface ToolCall {
  id: string; // Temporary ID for UI list management
  name: string; // Unified field name (maps to part.meta.name)
  call_id: string; // The actual tool call ID (maps to part.meta.id)
  parameters: string; // JSON string (maps to part.meta.arguments)
}

// UI-only type for creating tool-result parts
export interface ToolResult {
  id: string; // Temporary ID for UI list management
  tool_call_id: string; // Reference to tool call (maps to part.meta.tool_call_id)
  result: string; // Tool result content (stored in part.text or part.meta.result)
}

// Message part input type for creating messages
export interface MessagePartIn {
  type: PartType;
  text?: string;
  file_field?: string;
  meta?: Record<string, unknown>;
}

// Jaeger API types
export interface JaegerTrace {
  traceID: string;
  spans: JaegerSpan[];
  processes: Record<string, JaegerProcess>;
  warnings?: string[] | null;
}

export interface JaegerSpan {
  traceID: string;
  spanID: string;
  flags: number;
  operationName: string;
  references: JaegerReference[];
  startTime: number;
  duration: number;
  tags: JaegerTag[];
  logs: JaegerLog[];
  processID: string;
  warnings?: string[] | null;
}

export interface JaegerReference {
  refType: string;
  traceID: string;
  spanID: string;
}

export interface JaegerTag {
  key: string;
  value: string | number | boolean;
  type?: string;
}

export interface JaegerLog {
  timestamp: number;
  fields: JaegerTag[];
}

export interface JaegerProcess {
  serviceName: string;
  tags: JaegerTag[];
}

export interface JaegerTracesResponse {
  data: JaegerTrace[];
  total: number;
  limit: number;
  offset: number;
  errors?: unknown[] | null;
}
