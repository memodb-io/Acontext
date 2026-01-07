import os
from acontext import AcontextClient

client = AcontextClient(
    api_key=os.getenv("ACONTEXT_API_KEY"),
)

print(client.ping())

session = client.sessions.create()
client.sessions.store_message(
    session_id=session.id,
    blob={
        "role": "assistant",
        "content": """Here is my plan:
1. Use Next.js for the frontend
2. Use Supabase for the database
3. deploy to Cloudflare Pages
""",
    },
)
client.sessions.store_message(
    session_id=session.id,
    blob={
        "role": "user",
        "content": "Confirm, go ahead. Use tailwind for frontend styling.",
    },
)


messages = client.sessions.get_messages(session_id=session.id)
print(messages.items)
