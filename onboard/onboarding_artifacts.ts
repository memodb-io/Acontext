import { AcontextClient, DISK_TOOLS } from '@acontext/acontext';
import OpenAI from 'openai';

// Initialize clients
const acontextClient = new AcontextClient({
    apiKey: 'sk-ac-your-token',
    baseUrl: 'http://localhost:8029/api/v1'
});
const openaiClient = new OpenAI({ apiKey: 'sk-your-openai-key' });

// Create a disk and tool context
const disk = await acontextClient.disks.create();
const ctx = DISK_TOOLS.formatContext(acontextClient, disk.id);

// Get tool schemas for OpenAI
const tools = DISK_TOOLS.toOpenAIToolSchema();
console.log(tools);
// Simple agentic loop
const messages = [
    {
        role: 'user',
        content: 'Create a todo.md file with 3 tasks. Then check the content in this file',
    },
];

while (true) {
    const response = await openaiClient.chat.completions.create({
        model: 'gpt-4.1',
        messages,
        tools,
    });

    const message = response.choices[0].message;
    messages.push(message);

    // Break if no tool calls
    if (!message.tool_calls) {
        console.log(`🤖 Assistant: ${message.content}`);
        break;
    }

    // Execute each tool call
    for (const toolCall of message.tool_calls) {
        console.log(`⚙️ Called ${toolCall.function.name}`);
        const result = await DISK_TOOLS.executeTool(
            ctx,
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments)
        );
        console.log(`🔍 Result: ${result}`);
        messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result,
        });
    }
}