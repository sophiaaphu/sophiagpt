"use client";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { SquarePen, Search, ChevronRight, ChevronUp, MoreHorizontal, Pencil, Trash2, ArrowUp, Copy, Check } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import 'highlight.js/styles/github-dark.css';
import 'katex/dist/katex.min.css';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Msg = { role: "user" | "assistant"; content: string };
type Chat = { id: string; title: string; messages: Msg[] };

function CodeBlock({ children, className }: { children: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  
  // Extract language from className (e.g., "hljs language-python" -> "python")
  const language = className
    ?.split(' ')
    .find(cls => cls.startsWith('language-'))
    ?.replace('language-', '') || 'code';
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <div className="flex items-center justify-between bg-[#171717] px-4 pt-2 rounded-t-lg ">
        <span className="text-xs text-gray-300">{language}</span>
        <button
          onClick={copyToClipboard}
          className="p-1.5 rounded-md bg-[#171717]"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="size-3.5 text-gray-300" />
          ) : (
            <Copy className="size-3.5 text-gray-300" />
          )}
        </button>
      </div>
      <pre className={className} style={{ backgroundColor: '#171717' }}>
        <code>{children}</code>
      </pre>
    </div>
  );
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={copyToClipboard}
      className="-ml-2 flex items-center gap-2 text-xs text-gray-200 transition-colors hover:bg-[#303030] rounded-md p-2"
      aria-label="Copy message"
    >
      {copied ? (
        <>
          <Check className="size-3.5" />
        </>
      ) : (
        <>
          <Copy className="size-3.5" />
        </>
      )}
    </button>
  );
}

export default function Home() {
  const { open, isMobile, openMobile, toggleSidebar } = useSidebar();
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
  const [isMultiline, setIsMultiline] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    setIsMultiline(false);

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
    <TooltipProvider>
      <Sidebar className="border-none text-white" collapsible="icon">
        <SidebarHeader className={`gap-0 ${open ? 'bg-[#181818]' : 'bg-[#212121] border-r border-white/10'}`}>
          {open ? (
            <div className="flex items-center justify-between px-4 py-2 mb-2">
              <Image src="/sophiagpt-white.png" alt="SophiaGPT" width={28} height={30} />
              <SidebarTrigger className="text-white hover:bg-[#3A3A3A] hover:text-white" />
            </div>
          ) : (
            <div className="flex items-center justify-center w-full py-2">
              <button 
                onClick={toggleSidebar}
                className="text-white hover:bg-[#3A3A3A] hover:text-white p-1 transition rounded-sm"
              >
                <Image src="/sophiagpt-white.png" alt="SophiaGPT" width={28} height={26} />
              </button>
            </div>
          )}
        </SidebarHeader>
        <SidebarContent className={`text-white ${open ? 'bg-[#181818]' : 'bg-[#212121] border-r border-white/10'}`}>
          {open ? (
            <>
              <div className="px-2">
                <button
                  onClick={newChat}
                  className="flex w-full items-center gap-2 rounded-md px-4 py-2 text-sm text-white hover:bg-[#2A2A2A] transition"
                >
                  <SquarePen className="size-4" />
                  New Chat
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-md px-4 py-2 text-sm text-white hover:bg-[#2A2A2A] transition"
                >
                  <Search className="size-4" />
                  Search Chats
                </button>
              </div>
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
            </>
          ) : !isMobile ? (
            <div className="flex flex-col items-center gap-0 px-2 mt-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={newChat}
                    className="aspect-square flex items-center justify-center p-1.75 rounded-sm text-white hover:bg-[#303030] transition"
                  >
                    <SquarePen className="size-4.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>New Chat</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="aspect-square flex items-center justify-center p-1.75 rounded-sm text-white hover:bg-[#303030] transition"
                  >
                    <Search className="size-4.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Search Chats</p>
                </TooltipContent>
              </Tooltip>
            </div>
          ) : null}
        </SidebarContent>
      </Sidebar>

      <SidebarInset className="flex h-screen flex-col bg-[#222222] text-neutral-100 overflow-hidden">
        {/* Header */}
        <header className="p-4 flex items-center gap-3">
          {isMobile && !openMobile && <SidebarTrigger className="text-white hover:bg-[#3A3A3A] hover:text-white" />}
          <span className={`text-lg font-semibold ${open && !isMobile ? 'px-2' : ''}`}>SophiaGPT</span>
        </header>

        {/* Chat area */}
        <div className={`flex-1 overflow-y-auto mx-auto w-full p-4 md:p-0 ${open ? 'max-w-2xl' : 'max-w-3xl'} [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
          {messages.length === 1 && messages[0].role === "assistant" ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 pb-48">
              <h2 className="text-2xl md:text-3xl text-white text-center">Anything ngmi on your mind?</h2>
              <div className="relative w-full">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    // If empty, reset to original state
                    if (e.target.value === '') {
                      e.target.style.height = '';
                      setIsMultiline(false);
                      return;
                    }
                    // Reset height to minimum to allow proper shrinking
                    e.target.style.height = '56px'; // minimum height for single line
                    const newHeight = Math.min(e.target.scrollHeight, 240); // max height ~8 lines
                    e.target.style.height = newHeight + 'px';
                    // Check if content has actually wrapped to multiple lines
                    setIsMultiline(newHeight > 60); // slightly above single line height
                    // Scroll to bottom when content changes
                    e.target.scrollTop = e.target.scrollHeight;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Ask anything"
                  rows={1}
                  className={`w-full rounded-4xl bg-[#303030] text-white px-4 py-4 text-base outline-none focus:outline-none resize-none overflow-y-auto max-h-60 ${isMultiline ? 'pb-12' : 'pr-14'} [scrollbar-width:thin] [scrollbar-color:transparent_transparent] hover:[scrollbar-color:#666_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-gray-500`}
                />
                <button
                  onClick={send}
                  className="absolute right-3 bottom-3.5 rounded-full bg-white p-2 hover:bg-gray-200 transition"
                >
                  <ArrowUp className="size-5 text-black" />
                </button>
              </div>
            </div>
          ) : (
            <>
              {messages.filter(m => !(m.role === "assistant" && m.content === "ask me anything")).map((m, i) => (
                <div
                  key={i}
                  className={`text-sm mb-4 wrap-break-word
                    ${m.role === "user"
                      ? "ml-auto bg-[#333333] text-white max-w-[75%] rounded-2xl px-4 py-2 w-fit"
                      : "text-neutral-100 pl-2"
                    }`}
                >
                  {m.role === "assistant" ? (
                    <>
                      <div className="markdown">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex, rehypeHighlight]}
                          components={{
                            pre: ({ children }) => {
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              const codeElement = children as any;
                              const codeContent = codeElement?.props?.children || '';
                              const codeClassName = codeElement?.props?.className || '';
                              return <CodeBlock className={codeClassName}>{codeContent}</CodeBlock>;
                            },
                          }}
                        >
                          {m.content}
                        </ReactMarkdown>
                      </div>
                      <CopyButton content={m.content} />
                    </>
                  ) : (
                    m.content
                  )}
                </div>
              ))}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input - only show when there are messages */}
        {!(messages.length === 1 && messages[0].role === "assistant") && (
          <>
            <div className={`p-0 px-4 md:px-0 mb-1 flex justify-center mx-auto w-full ${open ? 'max-w-2xl' : 'max-w-3xl'}`}>
              <div className="relative w-full">
                <textarea
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    // If empty, reset to original state
                    if (e.target.value === '') {
                      e.target.style.height = '';
                      setIsMultiline(false);
                      return;
                    }
                    // Reset height to minimum to allow proper shrinking
                    e.target.style.height = '56px'; // minimum height for single line
                    const newHeight = Math.min(e.target.scrollHeight, 240); // max height ~8 lines
                    e.target.style.height = newHeight + 'px';
                    // Check if content has actually wrapped to multiple lines
                    setIsMultiline(newHeight > 60); // slightly above single line height
                    // Scroll to bottom when content changes
                    e.target.scrollTop = e.target.scrollHeight;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Ask anything"
                  rows={1}
                  className={`w-full rounded-4xl bg-[#303030] text-white px-4 py-4 text-base outline-none focus:outline-none resize-none overflow-y-auto max-h-60 ${isMultiline ? 'pb-12' : 'pr-14'} [scrollbar-width:thin] [scrollbar-color:transparent_transparent] hover:[scrollbar-color:#666_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-gray-500`}
                />
                <button
                  onClick={send}
                  className="absolute right-3 bottom-3.5 rounded-full bg-white p-2 hover:bg-gray-200 transition"
                >
                  <ArrowUp className="size-5 text-black" />
                </button>
              </div>
            </div>
            <div className="text-center text-xs text-white pb-4">
              SophiaGPT can make mistakes. Check important info.
            </div>
          </>
        )}
      </SidebarInset>
    </TooltipProvider>
  );
}

