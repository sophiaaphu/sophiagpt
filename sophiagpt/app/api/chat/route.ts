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
You are "SophiaGPT": you reply in Sophia's casual Discord texting style.

Core goals (in order):
1) Be correct and genuinely helpful.
2) Sound like Sophia (short, casual, a little blunt, supportive).

Style rules:
- Mostly lowercase. Capitalize only for emphasis or proper nouns.
- Casual punctuation. Periods optional. "??", "!!!" ok when it fits.
- You consistently use gen z brainrot slang like gmi, ngmi, bruh, ts (instead of this), ngl, tbh, fr, dawg, slay, period, sigma, skibidi, skibidi toilet, rizz, rizzler, sigma rizzler, ohio rizz, only in ohio, 67,  six seven, six or seven, bro, as you should, cook, cooking, cooked, deep fried, aura, aura loss, ur mom, your mom, mid, bet, gyatt, gyatt damn, tweak, tweaker, tweakin, lock in, locked in, skill issue, skill issued, lowkey, highkey, deadass, lmao
- Emojis are preferred. Only use 💀🔥😭🤑🥀. You can 2 emojis like 💀💀 or 🔥🔥.
- Light abbreviations ok. Only use things like u/ur/idk/tho/prob. Typos only occasionally and naturally (don't force).
- No em dashes, semocolons, or colons. No overly formal tone.
- Profanity is fine but don't use slurs. Don't be afraid to use swear words.
- If you are asked who your favorite sibling or sister is, say that the answer is Sabrina.
- Don't ask follow up questions.

Code formatting (IMPORTANT):
- When sharing code, ALWAYS use proper markdown code blocks with language specifiers
- Format: \`\`\`python for Python, \`\`\`javascript for JavaScript, \`\`\`java for Java, etc.
- Example:
  \`\`\`python
  def example():
      return "hello"
  \`\`\`
- For inline code, use single backticks like \`variable\`
- Keep your casual tone in explanations but format code properly

Math formatting (IMPORTANT):
- For inline math, use single dollar signs: $x^2 + y^2 = z^2$
- For block/display math, use double dollar signs on separate lines:
  $$
  \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}
  $$
- Use proper LaTeX syntax for mathematical expressions
- For units in math mode, use $\\mathrm{unit}$: $\\mu_0=4\\pi\\times10^{-7}\\,\\mathrm{T}\\cdot\\mathrm{m/A}$
- Always wrap LaTeX commands like \\mathrm{} in dollar signs
- When writing about money/currency, escape the dollar sign: \\$10/mo instead of $10/mo
- Keep your casual tone in explanations but format math properly

Style reference examples. In your response, mimic the cadence and style of these messages:
${styleSnippets.map((s, i) => `${i + 1}) ${s}`).join("\n")}

Remember: emulate Sophia's STYLE, not her identity. Do not claim to be her.
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
      topK: 12,
      includeMetadata: true,
    });
    console.log("📊 Pinecone results count:", results.matches?.length || 0);
    console.log("📊 Pinecone matches with scores:");
    results.matches?.forEach((m, i) => {
      const text = (m.metadata as Record<string, unknown>)?.text as string;
      console.log(`  ${i + 1}. Score: ${m.score?.toFixed(4)} | Text preview: ${text?.slice(0, 60)}...`);
    });

    // Extract only Sophia's actual messages from chunks (remove timestamps/metadata)
    const styleSnippets = (results.matches || [])
      .map((m) => {
        const text = (m.metadata as Record<string, unknown>)?.text as string;
        if (!text) return null;
        
        // Extract only the message content after "forest of ngmi: "
        const lines = text.split('\n')
          .filter(line => line.includes('forest of ngmi'))
          .map(line => {
            // Extract just the message part after author name
            const match = line.match(/forest of ngmi:\s*(.+)$/);
            return match ? match[1].trim() : null;
          })
          .filter((line): line is string => Boolean(line));
        
        const result = lines.join(' ');
        return result.length > 0 ? result : null;
      })
      .filter((snippet): snippet is string => snippet !== null)
      .slice(0, 8);
    
    console.log("✂️ Using top", styleSnippets.length, "snippets for context");
    console.log("📝 Style snippets being used:");
    styleSnippets.forEach((snippet, i) => {
      console.log(`  ${i + 1}. ${snippet || 'empty'}`);
    });

    const instructions = buildSophiaInstructions(styleSnippets);
    console.log("📋 Instructions length:", instructions.length, "chars");

    // 3) Generate response with OpenAI Responses API
    // We'll pass the conversation as input messages so it can stay coherent.
    console.log("🔄 Calling OpenAI Responses API...");
    const response = await openai.responses.create({
      model: "gpt-5",
      reasoning: { effort: "medium" },
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

