
import { AcontextClient } from "@acontext/acontext";

const client = new AcontextClient({
    apiKey: process.env.ACONTEXT_API_KEY,
});

async function main() {
    console.log(await client.ping());

    const session = await client.sessions.create();
    await client.sessions.storeMessage(session.id, {
        role: "assistant",
        content: `Here is my plan:
1. Use Next.js for the frontend
2. Use Supabase for the database
3. deploy to Cloudflare Pages
`,
    });
    await client.sessions.storeMessage(session.id, {
        role: "user",
        content: "Confirm, go ahead. Use tailwind for frontend styling.",
    });

    const messages = await client.sessions.getMessages(session.id);
    console.log(messages.items);
}

main();

