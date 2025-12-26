import os, json, hashlib
from typing import List, Dict, Any
from dotenv import load_dotenv
from tqdm import tqdm

from openai import OpenAI
from pinecone.grpc import PineconeGRPC as Pinecone

load_dotenv()

OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
PINECONE_API_KEY = os.environ["PINECONE_API_KEY"]
PINECONE_INDEX = os.environ["PINECONE_INDEX"]
PINECONE_NAMESPACE = os.environ.get("PINECONE_NAMESPACE", "default")

# Good default embedding model for RAG
EMBED_MODEL = "text-embedding-3-small"  # OpenAI cookbook examples use this family. :contentReference[oaicite:3]{index=3}


def stable_id(author: str, ts: str, content: str) -> str:
    """Deterministic ID so re-running ingestion overwrites the same vectors."""
    raw = f"{author}|{ts}|{content}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:32]


def load_messages(path: str) -> List[Dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    # Expect: [{ts, author, content}, ...]
    return data


def chunk_messages(messages: List[Dict[str, Any]], window: int = 6, stride: int = 3) -> List[Dict[str, Any]]:
    """
    Easy “topic-ish” chunking for chat: sliding windows.
    Each chunk contains a few consecutive messages to preserve context,
    which helps for style/persona recall.
    """
    chunks = []
    i = 0
    while i < len(messages):
        group = messages[i : i + window]
        if not group:
            break

        # Build a small transcript
        lines = []
        for m in group:
            author = m.get("author", "unknown")
            ts = m.get("ts", "")
            content = (m.get("content") or "").strip()
            if not content:
                continue
            lines.append(f"[{ts}] {author}: {content}")

        text = "\n".join(lines).strip()
        if text:
            chunks.append({
                "chunk_text": text,
                "start_ts": group[0].get("ts"),
                "end_ts": group[-1].get("ts"),
                "authors": sorted({m.get("author","unknown") for m in group}),
                "size": len(group),
            })

        i += stride

    return chunks


def embed_texts(client: OpenAI, texts: List[str]) -> List[List[float]]:
    # OpenAI embeddings endpoint via official SDK. :contentReference[oaicite:4]{index=4}
    resp = client.embeddings.create(model=EMBED_MODEL, input=texts)
    return [d.embedding for d in resp.data]


def main():
    input_path = os.environ.get("MESSAGES_JSON", "data/messages.json")

    openai_client = OpenAI(api_key=OPENAI_API_KEY)
    pc = Pinecone(api_key=PINECONE_API_KEY)
    index = pc.Index(PINECONE_INDEX)

    messages = load_messages(input_path)
    chunks = chunk_messages(messages, window=6, stride=3)

    print(f"Loaded {len(messages)} messages")
    print(f"Built  {len(chunks)} chunks")

    # Batch embed + upsert
    batch_size = 64
    for b in tqdm(range(0, len(chunks), batch_size), desc="Upserting"):
        batch = chunks[b : b + batch_size]
        texts = [c["chunk_text"] for c in batch]
        vectors = embed_texts(openai_client, texts)

        upserts = []
        for c, v in zip(batch, vectors):
            # Make a stable ID (based on chunk content + time)
            _id = stable_id(",".join(c["authors"]), f"{c['start_ts']}->{c['end_ts']}", c["chunk_text"])
            metadata = {
                "start_ts": c["start_ts"],
                "end_ts": c["end_ts"],
                "authors": c["authors"],
                "size": c["size"],
                "text": c["chunk_text"],  # keep original chunk text as metadata for retrieval
            }
            upserts.append({"id": _id, "values": v, "metadata": metadata})

        # Pinecone upsert into a namespace. :contentReference[oaicite:5]{index=5}
        index.upsert(vectors=upserts, namespace=PINECONE_NAMESPACE)

    print("Done ✅")


if __name__ == "__main__":
    main()
