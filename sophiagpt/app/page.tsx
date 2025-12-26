"use client";

import { useState, useRef, useEffect } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "ask me anything" },
  ]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text) return;

    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: next }),
    });

    const data = await res.json();
    setMessages([...next, { role: "assistant", content: data.text || "ngmi 💀" }]);
  }

  return (
    <main className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
      {/* Header */}
      <header className="border-b border-neutral-800 p-4 text-lg font-semibold">
        SophiaGPT
      </header>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm leading-relaxed
              ${m.role === "user"
                ? "ml-auto bg-blue-600 text-white"
                : "bg-neutral-800 text-neutral-100"
              }`}
          >
            {m.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-neutral-800 p-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => (e.key === "Enter" ? send() : null)}
          placeholder="type something..."
          className="flex-1 rounded-xl bg-neutral-900 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={send}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 transition"
        >
          Send
        </button>
      </div>
    </main>
  );
}

