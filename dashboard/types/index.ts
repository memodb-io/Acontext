import { PlanType } from "@/stores/plan";

export interface Organization {
  id: string
  name: string
  plan?: PlanType
  pending_plan?: PlanType  // Scheduled plan change (e.g., downgrade at period end)
  is_default?: boolean
  role?: "owner" | "member"
}

export interface OrganizationWithPlan {
  id: string
  name: string
  plan: PlanType
  pending_plan?: PlanType  // Scheduled plan change (e.g., downgrade at period end)
  is_default: boolean
  created_at: string
  role: "owner" | "member"
  project_count: number
}

export interface Project {
  id: string
  name: string
  organization_id: string
  created_at?: string
}

export interface Disk {
  id: string;
  project_id: string;
  user_id?: string;
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

export interface GetDisksResp {
  items: Disk[];
  next_cursor?: string;
  has_more: boolean;
}

// Session types
export interface Session {
  id: string;
  project_id?: string;
  user_id?: string;
  configs: Record<string, unknown>;
  disable_task_tracking?: boolean;
  created_at: string;
  updated_at: string;
}

export interface GetSessionsResp {
  items: Session[];
  next_cursor?: string;
  has_more: boolean;
}

export interface GetSessionConfigsResp {
  configs: Record<string, unknown>;
}

// Message types
export type MessageRole = "user" | "assistant";
export type PartType = "text" | "thinking" | "image" | "video" | "audio" | "file" | "data" | "tool-call" | "tool-result";

export interface Asset {
  sha256: string;
  mime: string;
  size_b: number;
}

export interface Part {
  type: PartType;
  text?: string;
  filename?: string;
  asset?: Asset;
  meta?: Record<string, unknown>;
}

export interface Message {
  id: string;
  session_id: string;
  role: MessageRole;
  parts: Part[];
  session_task_process_status: string;
  task_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GetMessagesResp {
  items: Message[];
  next_cursor?: string;
  has_more: boolean;
  public_urls?: Record<string, { url: string; expire_at: string }>;
}

export interface UploadedFile {
  id: string;
  file: File;
  type: PartType;
}

export interface ToolCall {
  id: string;
  name: string;
  call_id: string;
  parameters: string;
}

export interface ToolResult {
  id: string;
  tool_call_id: string;
  result: string;
}

// Task types
export type TaskStatus = "success" | "failed" | "running" | "pending";

export interface Task {
  id: string;
  session_id: string;
  order: number;
  status: TaskStatus;
  is_planning: boolean;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GetTasksResp {
  items: Task[];
  next_cursor?: string;
  has_more: boolean;
}

// User types
export interface User {
  id: string;
  identifier: string;
  project_id: string;
  created_at: string;
  updated_at: string;
}

export interface GetUsersResp {
  items: User[];
  next_cursor?: string;
  has_more: boolean;
}

export interface UserResourceCounts {
  disks_count: number;
  sessions_count: number;
  skills_count: number;
}

export interface GetUserResourcesResp {
  counts: UserResourceCounts;
}

// Agent Skill types
export interface AgentSkillFileIndex {
  path: string;
  mime: string;
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  file_index: AgentSkillFileIndex[];
  meta?: Record<string, unknown>;
  user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface AgentSkillListItem {
  id: string;
  name: string;
  description: string;
  meta?: Record<string, unknown>;
  user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface GetAgentSkillsResp {
  items: AgentSkillListItem[];
  next_cursor?: string;
  has_more: boolean;
}

export interface AgentSkillFileContent {
  type: string;
  raw: string;
}

export interface GetAgentSkillFileResp {
  path: string;
  mime: string;
  content?: AgentSkillFileContent | null;
  url?: string | null;
}

// Sandbox types
export interface HistoryCommand {
  command: string;
  exit_code: number;
}

export interface GeneratedFile {
  sandbox_path: string;
}

export interface SandboxLog {
  id: string;
  project_id: string;
  backend_type: string;
  backend_sandbox_id: string;
  created_at: string;
  updated_at: string;
  will_total_alive_seconds?: number;
  history_commands?: HistoryCommand[];
  generated_files?: GeneratedFile[];
}

export interface GetSandboxLogsResp {
  items: SandboxLog[];
  next_cursor?: string;
  has_more: boolean;
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
  status: "pending" | "running" | "completed" | "failed";
  created_at: string;
  updated_at: string;
}

export interface LearningSpaceSkill {
  id: string;
  learning_space_id: string;
  skill_id: string;
  created_at: string;
}
