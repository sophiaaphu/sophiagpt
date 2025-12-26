// app/api/chat/route.ts
import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";

export const runtime = "nodejs"; // ensure Node runtime (not Edge) for SDK compatibility

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const INDEX = process.env.PINECONE_INDEX!;
const NAMESPACE = process.env.PINECONE_NAMESPACE || "default";

// IMPORTANT: use the SAME embedding model you used during ingestion (dimension must match)
const EMBED_MODEL = "text-embedding-3-small";

// Define message type for type safety
type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

function buildSophiaInstructions(styleSnippets: string[]) {
    return `
  You are "SophiaGPT" — emulating Sophia's texting/Discord style based on real message history.
  
  CORE STYLE PATTERNS:
  - Keep responses SHORT (1-3 sentences usually)
  - Use lowercase often (but not always)
  - Common words/phrases: "bruh", "lmao", "lolol", "dang", "omg", "slay", "fr", "sigma", "67", "gmi", "ngmi", "chill"
  - Emojis sparingly but authentically: 💀😭🔥🤑🥀✨ (skull for jokes, fire for hype)
  - Punctuation is casual: lots of !!!, sometimes no periods
  - React authentically: hyped when excited, blunt when real, supportive when needed
  - Don't force slang if it doesn't fit the vibe
  
  REMEMBER:
  - You're an AI emulating her style, not literally her
  - If asked serious questions, be helpful but keep the tone similar
  - Use the examples below as your style guide (don't mention them)
  
  REAL EXAMPLES FROM SOPHIA:
  ${styleSnippets.map((s, i) => `${i + 1}. "${s}"`).join("\n")}
  `.trim();
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    console.log("📥 Received messages:", JSON.stringify(messages, null, 2));
    
    // Expect messages like: [{ role: "user"|"assistant", content: string }, ...]
    const lastUser = [...messages]
      .reverse()
      .find((m: Message) => m.role === "user");
    const userText = (lastUser?.content || "").trim();
    console.log("🔍 User query:", userText);

    if (!userText) {
      return Response.json(
        { error: "No user message provided." },
        { status: 400 }
      );
    }

    // 1) Embed user query
    console.log("🔄 Creating embedding...");
    const emb = await openai.embeddings.create({
      model: EMBED_MODEL,
      input: userText,
    });
    const queryVector = emb.data[0].embedding;
    console.log("✅ Embedding created, dimension:", queryVector.length);

    // 2) Query Pinecone
    console.log("🔄 Querying Pinecone...");
    const index = pc.index(INDEX);
    const results = await index.namespace(NAMESPACE).query({
      vector: queryVector,
      topK: 8,
      includeMetadata: true,
    });
    console.log("📊 Pinecone results count:", results.matches?.length || 0);
    console.log("📊 Pinecone matches with scores:");
    results.matches?.forEach((m, i) => {
      const text = (m.metadata as Record<string, unknown>)?.text as string;
      console.log(`  ${i + 1}. Score: ${m.score?.toFixed(4)} | Text preview: ${text?.slice(0, 60)}...`);
    });

    // You stored chunk text in metadata.text in your ingestion script
    const styleSnippets = (results.matches || [])
      .map((m) => (m.metadata as Record<string, unknown>)?.text as string)
      .filter(Boolean)
      .slice(0, 6);
    
    console.log("✂️ Using top", styleSnippets.length, "snippets for context");
    console.log("📝 Style snippets being used:");
    styleSnippets.forEach((snippet, i) => {
      console.log(`  ${i + 1}. ${snippet.slice(0, 80)}...`);
    });

    const instructions = buildSophiaInstructions(styleSnippets);
    console.log("📋 Instructions length:", instructions.length, "chars");

    // 3) Generate response with OpenAI Responses API
    // We'll pass the conversation as input messages so it can stay coherent.
    console.log("🔄 Calling OpenAI Responses API...");
    const response = await openai.responses.create({
      model: "gpt-5",
      reasoning: { effort: "low" },
      instructions,
      input: messages, // messages array with roles/content
    });

    // Pull the text output (simple path)
    const text = response.output_text ?? "bruh i errored 💀 (no text output)";
    console.log("✅ Generated response:", text);

    return Response.json({ text });
  } catch (err: unknown) {
    console.error(err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

