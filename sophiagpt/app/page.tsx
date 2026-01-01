"use client";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { SquarePen, Search, ChevronRight, ChevronUp, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  SidebarInset,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Msg = { role: "user" | "assistant"; content: string };
type Chat = { id: string; title: string; messages: Msg[] };

export default function Home() {
  const { open, isMobile, openMobile } = useSidebar();
  const [chats, setChats] = useState<Chat[]>([
    {
      id: "1",
      title: "New Chat",
      messages: [{ role: "assistant", content: "ask me anything" }],
    },
  ]);
  const [currentChatId, setCurrentChatId] = useState("1");
  const [input, setInput] = useState("");
  const [chatsExpanded, setChatsExpanded] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const currentChat = chats.find((c) => c.id === currentChatId);
  const messages = currentChat?.messages || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentChat?.messages]);

  async function send() {
    const text = input.trim();
    if (!text || !currentChat) return;

    const next: Msg[] = [...messages, { role: "user", content: text }];
    updateMessages(next);
    setInput("");

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: next }),
    });

    const data = await res.json();
    updateMessages([...next, { role: "assistant", content: data.text || "ngmi 💀" }]);
  }

  function updateMessages(newMessages: Msg[]) {
    setChats((prev) =>
      prev.map((c) =>
        c.id === currentChatId
          ? {
              ...c,
              messages: newMessages,
              title:
                newMessages.length > 1
                  ? newMessages[1].content.slice(0, 30) + "..."
                  : "New Chat",
            }
          : c
      )
    );
  }

  function newChat() {
    const id = Date.now().toString();
    setChats((prev) => [
      ...prev,
      {
        id,
        title: "New Chat",
        messages: [{ role: "assistant", content: "ask me anything" }],
      },
    ]);
    setCurrentChatId(id);
  }

  function deleteChat(id: string) {
    setChats((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      if (filtered.length === 0) {
        const newId = Date.now().toString();
        setCurrentChatId(newId);
        return [
          {
            id: newId,
            title: "New Chat",
            messages: [{ role: "assistant", content: "ask me anything" }],
          },
        ];
      }
      if (currentChatId === id) {
        setCurrentChatId(filtered[0].id);
      }
      return filtered;
    });
  }

  function startRename(id: string, currentTitle: string) {
    setRenamingId(id);
    setRenameValue(currentTitle);
  }

  function saveRename(id: string) {
    if (renameValue.trim()) {
      setChats((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: renameValue.trim() } : c))
      );
    }
    setRenamingId(null);
    setRenameValue("");
  }

  return (
    <>
      <Sidebar className="border-none text-white">
        <SidebarHeader className="bg-[#181818] gap-0">
          <div className="flex items-center justify-between px-4 py-2 mb-2">
            <Image src="/sophiagpt-white.png" alt="SophiaGPT" width={28} height={30} />
            <SidebarTrigger className="text-white hover:bg-[#3A3A3A] hover:text-white" />
          </div>
          <button
            onClick={newChat}
            className="flex w-full items-center gap-2 rounded-sm px-4 py-2 text-sm text-white hover:bg-[#2A2A2A] transition"
          >
            <SquarePen className="size-4" />
            New Chat
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-sm px-4 py-2 text-sm text-white hover:bg-[#2A2A2A] transition"
          >
            <Search className="size-4" />
            Search Chats
          </button>
        </SidebarHeader>
        <SidebarContent className="bg-[#181818] text-white">
          <div className="px-6 pt-4">
            <button
              onClick={() => setChatsExpanded(!chatsExpanded)}
              className="group/chats-toggle flex gap-1 items-center text-sm text-[#A6A6A6] transition"
            >
              <span className="text-sm text-[#A6A6A6]">Your chats</span>
              {chatsExpanded ? (
                <ChevronUp className="size-4 opacity-0 group-hover/chats-toggle:opacity-100 transition-opacity" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </button>
          </div>
          {chatsExpanded && (
            <SidebarMenu>
              {chats.map((chat) => (
                <SidebarMenuItem key={chat.id}>
                  <div className={`group/chat-item flex items-center mx-2 rounded-md hover:bg-[#2F2F2F] transition ${chat.id === currentChatId ? 'bg-[#222222]' : ''}`}>
                    {renamingId === chat.id ? (
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveRename(chat.id);
                          if (e.key === "Escape") {
                            setRenamingId(null);
                            setRenameValue("");
                          }
                        }}
                        onBlur={() => saveRename(chat.id)}
                        autoFocus
                        className="flex-1 bg-neutral-800 text-white px-4 py-1.5 text-sm rounded-md outline-none focus:outline-none"
                      />
                    ) : (
                      <>
                        <SidebarMenuButton
                          isActive={chat.id === currentChatId}
                          onClick={() => setCurrentChatId(chat.id)}
                          className="flex-1 text-white hover:text-white hover:bg-transparent transition data-[active=true]:bg-transparent data-[active=true]:text-white data-[active=true]:font-normal"
                        >
                          <span className="truncate text-sm p-2">{chat.title}</span>
                        </SidebarMenuButton>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="opacity-0 group-hover/chat-item:opacity-100 data-[state=open]:opacity-100 p-2 rounded-md transition outline-none focus:outline-none focus-visible:ring-0">
                              <MoreHorizontal className="size-4 text-neutral-300" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-40 bg-[#3A3A3A] border-neutral-700">
                            <DropdownMenuItem
                              onClick={() => startRename(chat.id, chat.title)}
                              className="text-white hover:bg-[#4A4A4A] focus:bg-[#4A4A4A] focus:text-white cursor-pointer"
                            >
                              <Pencil className="size-4 text-white" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-neutral-600" />
                            <DropdownMenuItem
                              onClick={() => deleteChat(chat.id)}
                              variant="destructive"
                              className="cursor-pointer"
                            >
                              <Trash2 className="size-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </div>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          )}
        </SidebarContent>
      </Sidebar>

      <SidebarInset className="flex h-screen flex-col bg-[#222222] text-neutral-100">
        {/* Header */}
        <header className="border-b border-neutral-800 p-4 flex items-center gap-3">
          {((isMobile && !openMobile) || (!isMobile && !open)) && <SidebarTrigger className="text-white hover:bg-[#3A3A3A] hover:text-white" />}
          <span className={`text-lg font-semibold ${open && !isMobile ? 'px-2' : ''}`}>SophiaGPT</span>
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
      </SidebarInset>
    </>
  );
}

