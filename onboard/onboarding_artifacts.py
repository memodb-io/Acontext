import json
import os
from acontext import AcontextClient
from acontext.agent.disk import DISK_TOOLS
from openai import OpenAI

# Initialize clients
acontext_client = AcontextClient(
    api_key=os.getenv("ACONTEXT_API_KEY"),
)
openai_client = OpenAI()

# Create a disk and tool context
disk = acontext_client.disks.create()
ctx = DISK_TOOLS.format_context(acontext_client, disk.id)

# Get tool schemas for OpenAI
tools = DISK_TOOLS.to_openai_tool_schema()
print(tools)
# Simple agentic loop
messages = [
    {
        "role": "user",
        "content": "Create a todo.md file with 3 tasks. Then check the content in this file",
    }
]

while True:
    response = openai_client.chat.completions.create(
        model="gpt-4.1",
        messages=messages,
        tools=tools,
    )

    message = response.choices[0].message
    messages.append(message)

    # Break if no tool calls
    if not message.tool_calls:
        print(f"🤖 Assistant: {message.content}")
        break

    # Execute each tool call
    for tool_call in message.tool_calls:
        print(f"⚙️ Called {tool_call.function.name}")
        result = DISK_TOOLS.execute_tool(
            ctx, tool_call.function.name, json.loads(tool_call.function.arguments)
        )
        print(f"🔍 Result: {result}")
        messages.append(
            {"role": "tool", "tool_call_id": tool_call.id, "content": result}
        )
