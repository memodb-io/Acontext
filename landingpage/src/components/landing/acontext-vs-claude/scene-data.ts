// Scene data for Acontext vs Claude API comparison module

export interface ColorStop {
  pos: number
  color: string
}

export interface CodeLine {
  content: string
  type?: 'comment' | 'keyword' | 'string' | 'function' | 'number' | 'operator' | 'normal'
}

export interface CardData {
  title: string
  subtitle: string
  description: string
  code: CodeLine[][] // Array of code blocks
  isHighlighted?: boolean
  // For the last scene's alternative card style
  isPlaceholder?: boolean
  placeholderIcon?: string
  placeholderTitle?: string
  placeholderSubtitle?: string
}

export interface Scene {
  id: number
  badge: string
  title: string
  acontext: CardData
  claude: CardData
  colorScheme: ColorStop[]
}

// Color schemes for each scene (spiral petal gradients)
export const colorSchemes: Record<number, ColorStop[]> = {
  1: [ // Green/Teal theme - Sandbox
    { pos: 0.17, color: '#e8fff0' },
    { pos: 0.27, color: '#a7f3d0' },
    { pos: 0.37, color: '#34d399' },
    { pos: 0.58, color: '#059669' },
    { pos: 0.74, color: '#022c22' },
  ],
  2: [ // Purple theme - Model Support
    { pos: 0.17, color: '#f7f4f0' },
    { pos: 0.27, color: '#c8d4ff' },
    { pos: 0.37, color: '#8a9de0' },
    { pos: 0.58, color: '#3a18a0' },
    { pos: 0.74, color: '#030045' },
  ],
  3: [ // Red/Orange theme - Execution
    { pos: 0.17, color: '#fff5f0' },
    { pos: 0.27, color: '#fed7aa' },
    { pos: 0.37, color: '#f97316' },
    { pos: 0.58, color: '#c2410c' },
    { pos: 0.74, color: '#431407' },
  ],
  4: [ // Cyan/Blue theme - Context Engineering
    { pos: 0.17, color: '#f0fdff' },
    { pos: 0.27, color: '#a5f3fc' },
    { pos: 0.37, color: '#22d3ee' },
    { pos: 0.58, color: '#0e7490' },
    { pos: 0.74, color: '#083344' },
  ],
}

export const scenes: Scene[] = [
  {
    id: 1,
    badge: 'Sandbox',
    title: 'Upload, Manage, Execute Skill in One API',
    acontext: {
      title: 'Acontext',
      subtitle: 'User-Scoped · Direct Control · Self-Hostable',
      description: 'Upload skills per user, mount to sandbox, execute directly.',
      isHighlighted: true,
      code: [[
        { content: 'from acontext import AcontextClient', type: 'keyword' },
        { content: 'from acontext.agent import SANDBOX_TOOLS', type: 'keyword' },
        { content: 'from openai import OpenAI', type: 'keyword' },
        { content: '' },
        { content: 'client = AcontextClient()', type: 'normal' },
        { content: 'llm = OpenAI(base_url="https://openrouter.ai/api/v1")', type: 'normal' },
        { content: '' },
        { content: '# 1. Upload skill with user identifier', type: 'comment' },
        { content: 'skill = client.skills.create(', type: 'function' },
        { content: '    file=("my_skill.zip", open("my_skill.zip", "rb")),', type: 'string' },
        { content: '    user="alice@example.com"', type: 'string' },
        { content: ')', type: 'normal' },
        { content: '' },
        { content: '# 2. Composable: Sandbox + Disk + Skills', type: 'comment' },
        { content: 'sandbox = client.sandboxes.create()', type: 'function' },
        { content: 'disk = client.disks.create()', type: 'function' },
        { content: 'ctx = SANDBOX_TOOLS.format_context(client, sandbox.sandbox_id, disk.id, mount_skills=[skill.id])', type: 'function' },
        { content: '' },
        { content: '# 3. Use ANY LLM via OpenRouter', type: 'comment' },
        { content: 'response = llm.chat.completions.create(', type: 'function' },
        { content: '    model="openai/gpt-4o",  # Or anthropic/claude-3.5-sonnet, deepseek/deepseek-r1...', type: 'comment' },
        { content: '    messages=[{"role": "system", "content": ctx.get_context_prompt()},', type: 'string' },
        { content: '              {"role": "user", "content": "Run"}],', type: 'string' },
        { content: '    tools=SANDBOX_TOOLS.to_openai_tool_schema()', type: 'function' },
        { content: ')', type: 'normal' },
      ]],
    },
    claude: {
      title: 'Claude API',
      subtitle: 'Workspace-Scoped · No Direct Control',
      description: 'Upload skills to workspace, use via container parameter only.',
      code: [[
        { content: 'import anthropic', type: 'keyword' },
        { content: 'from anthropic.lib import files_from_dir', type: 'keyword' },
        { content: '' },
        { content: 'client = anthropic.Anthropic()', type: 'normal' },
        { content: '' },
        { content: '# 1. Upload skill (workspace-scoped only)', type: 'comment' },
        { content: 'skill = client.beta.skills.create(', type: 'function' },
        { content: '    display_title="My Skill",', type: 'string' },
        { content: '    files=files_from_dir("/path/to/skill"),', type: 'string' },
        { content: '    betas=["skills-2025-10-02"]', type: 'string' },
        { content: ')', type: 'normal' },
        { content: '' },
        { content: '# 2. Use skill in container (no sandbox control)', type: 'comment' },
        { content: 'response = client.beta.messages.create(', type: 'function' },
        { content: '    model="claude-sonnet-4-5-20250929",', type: 'string' },
        { content: '    max_tokens=4096,', type: 'number' },
        { content: '    betas=["code-execution-2025-08-25", "skills-2025-10-02"],', type: 'string' },
        { content: '    container={"skills": [{"type": "custom", "skill_id": skill.id, "version": "latest"}]},', type: 'string' },
        { content: '    messages=[{"role": "user", "content": "Run"}],', type: 'string' },
        { content: '    tools=[{"type": "code_execution_20250825", "name": "code_execution"}]', type: 'string' },
        { content: ')', type: 'normal' },
      ]],
    },
    colorScheme: colorSchemes[1],
  },
  {
    id: 2,
    badge: 'Model Support',
    title: 'Any LLM + Skills + SANDBOX TOOLS',
    acontext: {
      title: 'Acontext',
      subtitle: 'OpenAI · Anthropic · Gemini · OpenRouter',
      description: 'Mount skills, get context prompt, use any LLM with tool schemas.',
      isHighlighted: true,
      code: [[
        { content: 'from acontext import AcontextClient', type: 'keyword' },
        { content: 'from acontext.agent import SANDBOX_TOOLS', type: 'keyword' },
        { content: 'from openai import OpenAI', type: 'keyword' },
        { content: '' },
        { content: 'client = AcontextClient()', type: 'normal' },
        { content: 'sandbox = client.sandboxes.create()', type: 'function' },
        { content: 'disk = client.disks.create()', type: 'function' },
        { content: '' },
        { content: '# Mount skills via SANDBOX_TOOLS', type: 'comment' },
        { content: 'ctx = SANDBOX_TOOLS.format_context(client, sandbox.sandbox_id, disk.id, mount_skills=[skill.id])', type: 'function' },
        { content: '' },
        { content: '# Use ANY LLM via OpenRouter', type: 'comment' },
        { content: 'llm = OpenAI(base_url="https://openrouter.ai/api/v1")', type: 'normal' },
        { content: 'response = llm.chat.completions.create(', type: 'function' },
        { content: '    model="deepseek/deepseek-r1",', type: 'string' },
        { content: '    messages=[{"role": "system", "content": ctx.get_context_prompt()},', type: 'string' },
        { content: '              {"role": "user", "content": "..."}],', type: 'string' },
        { content: '    tools=SANDBOX_TOOLS.to_openai_tool_schema()', type: 'function' },
        { content: ')', type: 'normal' },
      ]],
    },
    claude: {
      title: 'Claude API',
      subtitle: 'Claude Models Only',
      description: 'Locked to Claude models, no custom tool schemas.',
      code: [[
        { content: 'import anthropic', type: 'keyword' },
        { content: '' },
        { content: 'client = anthropic.Anthropic()', type: 'normal' },
        { content: '' },
        { content: '# Locked to Claude models only', type: 'comment' },
        { content: 'response = client.beta.messages.create(', type: 'function' },
        { content: '    model="claude-sonnet-4-5-20250929",', type: 'string' },
        { content: '    max_tokens=4096,', type: 'number' },
        { content: '    betas=["code-execution-2025-08-25", "skills-2025-10-02"],', type: 'string' },
        { content: '    container={"skills": [{"type": "custom", "skill_id": skill.id, "version": "latest"}]},', type: 'string' },
        { content: '    messages=[{"role": "user", "content": "..."}],', type: 'string' },
        { content: '    tools=[{"type": "code_execution_20250825", "name": "code_execution"}]', type: 'string' },
        { content: ')', type: 'normal' },
        { content: '' },
        { content: '# Cannot use GPT-4o, Gemini, DeepSeek...', type: 'comment' },
        { content: '# Cannot customize tool schemas', type: 'comment' },
      ]],
    },
    colorScheme: colorSchemes[2],
  },
  {
    id: 3,
    badge: 'Execution',
    title: 'Transparent and Controllable',
    acontext: {
      title: 'Acontext',
      subtitle: 'Direct Control · Full Observability',
      description: 'Direct tool execution, full sandbox logs, persistent state.',
      isHighlighted: true,
      code: [[
        { content: 'from acontext import AcontextClient', type: 'keyword' },
        { content: 'from acontext.agent import SANDBOX_TOOLS', type: 'keyword' },
        { content: '' },
        { content: 'client = AcontextClient()', type: 'normal' },
        { content: '' },
        { content: '# Full control: create, execute, inspect', type: 'comment' },
        { content: 'sandbox = client.sandboxes.create()', type: 'function' },
        { content: 'disk = client.disks.create()', type: 'function' },
        { content: 'ctx = SANDBOX_TOOLS.format_context(', type: 'function' },
        { content: '    client, sandbox.sandbox_id, disk.id,', type: 'normal' },
        { content: '    mount_skills=[skill.id]', type: 'normal' },
        { content: ')', type: 'normal' },
        { content: '' },
        { content: '# Direct command execution', type: 'comment' },
        { content: 'result = SANDBOX_TOOLS.execute_tool(', type: 'function' },
        { content: '    ctx, "bash_execution_sandbox",', type: 'string' },
        { content: '    {"command": "python3 script.py"}', type: 'string' },
        { content: ')', type: 'normal' },
        { content: '' },
        { content: '# Full observability', type: 'comment' },
        { content: 'logs = client.sandboxes.get_logs(limit=100)', type: 'function' },
        { content: 'for log in logs.items:', type: 'keyword' },
        { content: '    for cmd in log.history_commands:', type: 'keyword' },
        { content: '        print(cmd.command, cmd.exit_code)', type: 'function' },
      ]],
    },
    claude: {
      title: 'Claude API',
      subtitle: 'Black Box · No Direct Control',
      description: 'No direct execution, no logs API, isolated per request.',
      code: [[
        { content: 'import anthropic', type: 'keyword' },
        { content: '' },
        { content: 'client = anthropic.Anthropic()', type: 'normal' },
        { content: '' },
        { content: '# Black box: no direct sandbox control', type: 'comment' },
        { content: 'response = client.beta.messages.create(', type: 'function' },
        { content: '    model="claude-sonnet-4-5-20250929",', type: 'string' },
        { content: '    max_tokens=4096,', type: 'number' },
        { content: '    betas=["code-execution-2025-08-25", "skills-2025-10-02"],', type: 'string' },
        { content: '    container={"skills": [{"type": "custom", "skill_id": skill.id}]},', type: 'string' },
        { content: '    messages=[...],', type: 'normal' },
        { content: '    tools=[{"type": "code_execution_20250825", "name": "code_execution"}]', type: 'string' },
        { content: ')', type: 'normal' },
        { content: '' },
        { content: '# No direct command execution', type: 'comment' },
        { content: '# No sandbox logs API', type: 'comment' },
        { content: '# Container managed by Claude, not by you', type: 'comment' },
      ]],
    },
    colorScheme: colorSchemes[3],
  },
  {
    id: 4,
    badge: 'Context Engineering',
    title: 'Simple Context Storage',
    acontext: {
      title: 'Acontext Sessions',
      subtitle: 'Store · Retrieve · Multi-Provider Format',
      description: 'Store and retrieve context in OpenAI, Anthropic, or Gemini format with one simple API.',
      isHighlighted: true,
      code: [
        [
          { content: 'from acontext import AcontextClient', type: 'keyword' },
          { content: '' },
          { content: 'client = AcontextClient()', type: 'normal' },
          { content: '' },
          { content: '# Create a session', type: 'comment' },
          { content: 'session = client.sessions.create()', type: 'function' },
          { content: '' },
          { content: '# Store messages (OpenAI format)', type: 'comment' },
          { content: 'client.sessions.store_message(session.id, blob={"role": "user", "content": "Hello!"})', type: 'function' },
          { content: '' },
          { content: '# Retrieve in any format: openai, anthropic, gemini', type: 'comment' },
          { content: 'messages = client.sessions.get_messages(session.id, format="anthropic")', type: 'function' },
        ],
        [
          { content: '# Get token-efficient session summary for prompt injection', type: 'comment' },
          { content: 'summary = client.sessions.get_session_summary(session.id, limit=5)', type: 'function' },
          { content: '' },
          { content: '# Apply edit strategies to manage context window size', type: 'comment' },
          { content: 'result = client.sessions.get_messages(', type: 'function' },
          { content: '    session.id,', type: 'normal' },
          { content: '    edit_strategies=[', type: 'normal' },
          { content: '        {"type": "remove_tool_result", "params": {"keep_recent_n_tool_results": 3}},', type: 'string' },
          { content: '        {"type": "token_limit", "params": {"limit_tokens": 30000}}', type: 'string' },
          { content: '    ]', type: 'normal' },
          { content: ')', type: 'normal' },
          { content: 'print(f"Tokens: {result.this_time_tokens}")', type: 'function' },
        ],
      ],
    },
    claude: {
      title: 'Claude API',
      subtitle: '',
      description: '',
      isPlaceholder: true,
      placeholderIcon: '?',
      placeholderTitle: 'Reinvent the Wheel for Each Provider',
      placeholderSubtitle: 'Focus on creating, not adapting.',
      code: [],
    },
    colorScheme: colorSchemes[4],
  },
]

// Badge texts for typewriter effect
export const badgeTexts = scenes.map(s => s.badge)

// Title texts for rotating effect
export const titleTexts = scenes.map(s => s.title)
