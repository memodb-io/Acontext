/**
 * Example demonstrating the use of structured TaskData in the Acontext TypeScript SDK.
 *
 * This example shows how to:
 * 1. Retrieve tasks from a session
 * 2. Access structured TaskData fields with proper type annotations
 * 3. Work with task descriptions, progresses, user preferences, and SOP thinking
 */

import { AcontextClient, Task, TaskData } from '@acontext/acontext';

/**
 * Get API credentials from environment variables
 */
function resolveCredentials(): { apiKey: string; baseUrl: string } {
    const apiKey = process.env.ACONTEXT_API_KEY || 'sk-ac-your-root-api-bearer-token';
    const baseUrl = process.env.ACONTEXT_BASE_URL || 'http://localhost:8029/api/v1';
    return { apiKey, baseUrl };
}

/**
 * Display structured TaskData with proper type annotations
 */
function displayTaskData(task: Task): void {
    console.log('\n' + '='.repeat(60));
    console.log(`Task #${task.order} (ID: ${task.id})`);
    console.log(`Status: ${task.status}`);
    console.log(`Planning: ${task.is_planning}`);
    console.log(`Space Digested: ${task.space_digested}`);
    console.log('='.repeat(60));

    // Access structured TaskData fields with type safety
    const data: TaskData = task.data;

    console.log('\n📝 Task Description:');
    console.log(`   ${data.task_description}`);

    if (data.progresses && data.progresses.length > 0) {
        console.log(`\n✅ Progress Updates (${data.progresses.length}):`);
        data.progresses.forEach((progress, i) => {
            console.log(`   ${i + 1}. ${progress}`);
        });
    }

    if (data.user_preferences && data.user_preferences.length > 0) {
        console.log(`\n⚙️  User Preferences (${data.user_preferences.length}):`);
        data.user_preferences.forEach((pref, i) => {
            console.log(`   ${i + 1}. ${pref}`);
        });
    }

    if (data.sop_thinking) {
        console.log('\n💭 SOP Thinking:');
        console.log(`   ${data.sop_thinking}`);
    }

    console.log('\n⏰ Timestamps:');
    console.log(`   Created: ${task.created_at}`);
    console.log(`   Updated: ${task.updated_at}`);
}

/**
 * Main function to demonstrate TaskData usage
 */
async function main(): Promise<void> {
    const { apiKey, baseUrl } = resolveCredentials();

    // Get session ID from environment or use a default
    const sessionId = process.env.ACONTEXT_SESSION_ID;
    if (!sessionId) {
        console.log('⚠️  Please set ACONTEXT_SESSION_ID environment variable');
        console.log("   Example: export ACONTEXT_SESSION_ID='your-session-uuid'");
        return;
    }

    const client = new AcontextClient({ apiKey, baseUrl });

    try {
        console.log(`🔍 Fetching tasks for session: ${sessionId}`);

        // Get tasks with structured TaskData
        const result = await client.sessions.getTasks(sessionId, {
            limit: 20,
            timeDesc: true, // Most recent first
        });

        console.log(`\n📊 Found ${result.items.length} task(s)`);
        console.log(`   Has more: ${result.has_more}`);
        if (result.next_cursor) {
            console.log(`   Next cursor: ${result.next_cursor.substring(0, 50)}...`);
        }

        // Display each task with structured data
        for (const task of result.items) {
            displayTaskData(task);
        }

        // Example: Filter tasks by status
        console.log('\n' + '='.repeat(60));
        console.log('Task Summary by Status:');
        console.log('='.repeat(60));

        const statusCounts: Record<string, number> = {};
        for (const task of result.items) {
            statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
        }

        Object.entries(statusCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .forEach(([status, count]) => {
                console.log(`  ${status.toUpperCase()}: ${count}`);
            });

        // Example: Show tasks with progresses
        const tasksWithProgress = result.items.filter(
            (t) => t.data.progresses && t.data.progresses.length > 0
        );
        console.log(`\n📈 Tasks with progress updates: ${tasksWithProgress.length}`);

        // Example: Show tasks with user preferences
        const tasksWithPrefs = result.items.filter(
            (t) => t.data.user_preferences && t.data.user_preferences.length > 0
        );
        console.log(`⚙️  Tasks with user preferences: ${tasksWithPrefs.length}`);

        // Example: Show tasks with SOP thinking
        const tasksWithSop = result.items.filter((t) => t.data.sop_thinking);
        console.log(`💭 Tasks with SOP thinking: ${tasksWithSop.length}`);
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

// Run the example
if (require.main === module) {
    main().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

