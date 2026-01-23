import { getSandbox, type Sandbox } from '@cloudflare/sandbox';

export { Sandbox } from '@cloudflare/sandbox';

interface Env {
	Sandbox: DurableObjectNamespace<Sandbox>;
	AUTH_TOKEN?: string;
}

interface CreateSandboxRequest {
	sandbox_id: string;
	keepalive_seconds?: number;
	additional_configs?: Record<string, string>;
}

interface UpdateSandboxRequest {
	keepalive_longer_by_seconds: number;
}

interface ExecCommandRequest {
	command: string;
	keepalive_seconds?: number;
}

interface DownloadFileRequest {
	file_path: string;
	encoding?: 'utf-8' | 'base64';
	keepalive_seconds?: number;
}

interface UploadFileRequest {
	file_path: string;
	content: string;
	encoding?: 'utf-8' | 'base64';
	keepalive_seconds?: number;
}

function checkAuth(request: Request, env: Env): Response | null {
	if (env.AUTH_TOKEN) {
		const authHeader = request.headers.get('Authorization');
		const token = authHeader?.replace('Bearer ', '') || authHeader?.replace('bearer ', '');
		if (token !== env.AUTH_TOKEN) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	}
	return null;
}

async function handleCreateSandbox(request: Request, env: Env): Promise<Response> {
	try {
		const body: CreateSandboxRequest = await request.json();
		const { sandbox_id, keepalive_seconds } = body;

		if (!sandbox_id) {
			return new Response(JSON.stringify({ error: 'sandbox_id is required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const sandbox = getSandbox(env.Sandbox, sandbox_id, {
			sleepAfter: keepalive_seconds ? `${keepalive_seconds}s` : undefined,
		});

		try {
			// Trigger container initialization (container starts lazily on first operation)
			const initResult = await sandbox.exec('echo "sandbox initialized"');

			if (!initResult.success) {
				return new Response(JSON.stringify({ error: 'Failed to initialize sandbox', details: initResult.stderr }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			const now = new Date();
			return new Response(
				JSON.stringify({
					sandbox_id,
					sandbox_status: 'running',
					sandbox_created_at: now.toISOString(),
					sandbox_expires_at: keepalive_seconds
						? new Date(now.getTime() + keepalive_seconds * 1000).toISOString()
						: null,
				}),
				{
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				}
			);
		} catch (error: any) {
			return new Response(JSON.stringify({ error: error.message }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	} catch (error: any) {
		return new Response(JSON.stringify({ error: error.message }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

async function handleKillSandbox(sandboxId: string, env: Env): Promise<Response> {
	try {
		const sandbox = getSandbox(env.Sandbox, sandboxId);
		await sandbox.destroy();
		return new Response(
			JSON.stringify({ success: true }),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	} catch (error: any) {
		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

async function handleGetSandbox(sandboxId: string, request: Request, env: Env): Promise<Response> {
	try {
		let keepalive_seconds: number | undefined;

		// Try to parse keepalive_seconds from query params or body
		const url = new URL(request.url);
		const keepaliveParam = url.searchParams.get('keepalive_seconds');
		if (keepaliveParam) {
			keepalive_seconds = parseInt(keepaliveParam, 10);
		}

		const sandbox = getSandbox(env.Sandbox, sandboxId, {
			sleepAfter: keepalive_seconds ? `${keepalive_seconds}s` : undefined,
		});
		const checkResult = await sandbox.exec('echo "alive and well"');
		const status = checkResult.success ? 'running' : 'error';

		const now = new Date();
		return new Response(
			JSON.stringify({
				sandbox_id: sandboxId,
				sandbox_status: status,
				sandbox_created_at: now.toISOString(),
				sandbox_expires_at: keepalive_seconds
					? new Date(now.getTime() + keepalive_seconds * 1000).toISOString()
					: null,
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	} catch (error: any) {
		return new Response(JSON.stringify({
			sandbox_id: sandboxId,
			sandbox_status: 'unknown',
			error: error.message
		}), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

async function handleUpdateSandbox(sandboxId: string, request: Request, env: Env): Promise<Response> {
	try {
		const body: UpdateSandboxRequest = await request.json();
		const { keepalive_longer_by_seconds } = body;

		if (!keepalive_longer_by_seconds) {
			return new Response(JSON.stringify({ error: 'keepalive_longer_by_seconds is required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Use keepalive_longer_by_seconds as the new sleepAfter duration
		const sandbox = getSandbox(env.Sandbox, sandboxId, {
			sleepAfter: `${keepalive_longer_by_seconds}s`,
		});

		// Any operation resets the idle timer, effectively extending the lifetime
		const touchResult = await sandbox.exec('echo "keepalive"');

		if (!touchResult.success) {
			return new Response(JSON.stringify({ error: 'Failed to touch sandbox', details: touchResult.stderr }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const now = new Date();
		return new Response(
			JSON.stringify({
				sandbox_id: sandboxId,
				sandbox_status: 'running',
				sandbox_created_at: now.toISOString(),
				sandbox_expires_at: new Date(now.getTime() + keepalive_longer_by_seconds * 1000).toISOString(),
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	} catch (error: any) {
		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

async function handleExecCommand(sandboxId: string, request: Request, env: Env): Promise<Response> {
	try {
		const body: ExecCommandRequest = await request.json();
		const { command, keepalive_seconds } = body;

		if (!command) {
			return new Response(JSON.stringify({ error: 'command is required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const sandbox = getSandbox(env.Sandbox, sandboxId, {
			sleepAfter: keepalive_seconds ? `${keepalive_seconds}s` : undefined,
		});
		const result = await sandbox.exec(command);

		return new Response(
			JSON.stringify({
				stdout: result.stdout || '',
				stderr: result.stderr || '',
				exit_code: result.exitCode || (result.success ? 0 : 1),
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	} catch (error: any) {
		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

async function handleDownloadFile(sandboxId: string, request: Request, env: Env): Promise<Response> {
	try {
		const body: DownloadFileRequest = await request.json();
		const { file_path, keepalive_seconds } = body;

		if (!file_path) {
			return new Response(JSON.stringify({ error: 'file_path is required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const sandbox = getSandbox(env.Sandbox, sandboxId, {
			sleepAfter: keepalive_seconds ? `${keepalive_seconds}s` : undefined,
		});

		// Check file exists using SDK exists() method
		const existsResult = await sandbox.exists(file_path);
		if (!existsResult.exists) {
			return new Response(JSON.stringify({ error: `File not found: ${file_path}` }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Read file with base64 encoding
		const file = await sandbox.readFile(file_path, { encoding: 'base64' });

		return new Response(
			JSON.stringify({
				content: file.content,
				encoding: 'base64',
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	} catch (error: any) {
		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

async function handleUploadFile(sandboxId: string, request: Request, env: Env): Promise<Response> {
	try {
		const body: UploadFileRequest = await request.json();
		const { file_path, content, encoding = 'utf-8', keepalive_seconds } = body;

		if (!file_path || !content) {
			return new Response(JSON.stringify({ error: 'file_path and content are required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const sandbox = getSandbox(env.Sandbox, sandboxId, {
			sleepAfter: keepalive_seconds ? `${keepalive_seconds}s` : undefined,
		});

		// Extract parent directory from file_path and create it if needed
		const lastSlashIndex = file_path.lastIndexOf('/');
		if (lastSlashIndex > 0) {
			const parentDir = file_path.substring(0, lastSlashIndex);
			const dirResult = await sandbox.exists(parentDir);
			if (!dirResult.exists) {
				await sandbox.mkdir(parentDir, { recursive: true });
			}
		}

		// Write file with specified encoding (SDK handles base64 decoding)
		await sandbox.writeFile(file_path, content, { encoding });

		return new Response(
			JSON.stringify({ success: true }),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	} catch (error: any) {
		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const authResponse = checkAuth(request, env);
		if (authResponse) {
			return authResponse;
		}

		const url = new URL(request.url);
		const path = url.pathname;

		if (path === '/sandbox/create' && request.method === 'POST') {
			return handleCreateSandbox(request, env);
		}

		const killMatch = path.match(/^\/sandbox\/([^\/]+)\/kill$/);
		if (killMatch && request.method === 'POST') {
			return handleKillSandbox(killMatch[1], env);
		}

		const getMatch = path.match(/^\/sandbox\/([^\/]+)$/);
		if (getMatch && request.method === 'GET') {
			return handleGetSandbox(getMatch[1], request, env);
		}

		const updateMatch = path.match(/^\/sandbox\/([^\/]+)\/update$/);
		if (updateMatch && request.method === 'POST') {
			return handleUpdateSandbox(updateMatch[1], request, env);
		}

		const execMatch = path.match(/^\/sandbox\/([^\/]+)\/exec$/);
		if (execMatch && request.method === 'POST') {
			return handleExecCommand(execMatch[1], request, env);
		}

		const downloadMatch = path.match(/^\/sandbox\/([^\/]+)\/download$/);
		if (downloadMatch && request.method === 'POST') {
			return handleDownloadFile(downloadMatch[1], request, env);
		}

		const uploadMatch = path.match(/^\/sandbox\/([^\/]+)\/upload$/);
		if (uploadMatch && request.method === 'POST') {
			return handleUploadFile(uploadMatch[1], request, env);
		}

		return new Response(
			JSON.stringify({
				message: 'Cloudflare Sandbox Worker API',
				endpoints: [
					'POST /sandbox/create',
					'POST /sandbox/:id/kill',
					'GET /sandbox/:id',
					'POST /sandbox/:id/update',
					'POST /sandbox/:id/exec',
					'POST /sandbox/:id/download',
					'POST /sandbox/:id/upload',
				],
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	},
};
