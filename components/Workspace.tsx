"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { FileExplorer } from "@/components/FileExplorer";
import { CodeEditor } from "@/components/CodeEditor";
import { Preview } from "@/components/Preview";
import type { Message } from "@/types/agent";

interface FileItem {
  name: string;
  type: "file" | "directory";
  path: string;
  children?: FileItem[];
}

const CHAT_STORAGE_KEY = "agent-vinod-chat-history";

function buildFileTree(files: Record<string, string>): FileItem[] {
  function listDir(prefix: string): FileItem[] {
    const seen = new Set<string>();
    const items: FileItem[] = [];

    for (const key of Object.keys(files)) {
      if (prefix && !key.startsWith(`${prefix}/`)) continue;
      const rest = prefix ? key.slice(prefix.length + 1) : key;
      const [first, ...remainder] = rest.split("/");
      if (!first || seen.has(first)) continue;
      seen.add(first);

      const entryPath = prefix ? `${prefix}/${first}` : first;
      if (remainder.length > 0) {
        items.push({
          name: first,
          path: entryPath,
          type: "directory",
          children: listDir(entryPath),
        });
      } else {
        items.push({ name: first, path: entryPath, type: "file" });
      }
    }

    return items;
  }

  return listDir("");
}

// Inlines local <link rel="stylesheet"> / <script src="..."> references so
// the whole site can be rendered via a single iframe srcDoc with no server
// round-trip. External URLs (CDNs like Bootstrap) are left untouched.
function buildPreviewDoc(files: Record<string, string>): string {
  const index = files["index.html"];
  if (index === undefined) return "";

  const isExternal = (url: string) => /^([a-z]+:)?\/\//i.test(url);
  const resolveLocal = (href: string) => {
    const key = href.replace(/^\.?\//, "");
    return files[key] !== undefined ? key : null;
  };

  let html = index.replace(/<link\b[^>]*>/gi, (tag) => {
    const relMatch = /rel=["']([^"']+)["']/i.exec(tag);
    const hrefMatch = /href=["']([^"']+)["']/i.exec(tag);
    if (!relMatch || !hrefMatch) return tag;
    if (relMatch[1].toLowerCase() !== "stylesheet") return tag;
    if (isExternal(hrefMatch[1])) return tag;
    const key = resolveLocal(hrefMatch[1]);
    return key ? `<style>\n${files[key]}\n</style>` : tag;
  });

  html = html.replace(
    /<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi,
    (full, before, src, after) => {
      if (isExternal(src)) return full;
      const key = resolveLocal(src);
      return key ? `<script${before}${after}>\n${files[key]}\n</script>` : full;
    }
  );

  return html;
}

export function Workspace() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [files, setFiles] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [buildError, setBuildError] = useState<string>("");

  // Chat history is the only thing that survives a refresh - it's kept in
  // localStorage (client-owned), never sent anywhere for server storage.
  // The generated site itself lives only in React state, so it is cleared
  // automatically on every page load.
  useEffect(() => {
    (() => {
      try {
        const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
        if (raw) setMessages(JSON.parse(raw));
      } catch {
        // Corrupt or inaccessible storage - just start with an empty chat.
      }
    })();
  }, []);

  const persistMessages = useCallback((next: Message[]) => {
    setMessages(next);
    try {
      window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage full/unavailable (e.g. private browsing) - chat still
      // works for this session, it just won't survive a refresh.
    }
  }, []);

  const fileTree = useMemo(() => buildFileTree(files), [files]);
  const previewDoc = useMemo(() => buildPreviewDoc(files), [files]);

  const buildStatus: "idle" | "building" | "success" | "error" = isLoading
    ? "building"
    : buildError
      ? "error"
      : previewDoc
        ? "success"
        : "idle";

  const handleFileSelect = useCallback((filePath: string) => {
    setSelectedFile(filePath);
  }, []);

  const handleSendMessage = useCallback(async (userPrompt: string) => {
    const pendingUserMessage: Message = {
      id: `pending-${Date.now()}`,
      role: "user",
      content: userPrompt,
      timestamp: new Date().toISOString(),
    };

    const historyBeforeSend = messages;
    persistMessages([...historyBeforeSend, pendingUserMessage]);
    setIsLoading(true);
    setBuildError("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userPrompt,
          messages: historyBeforeSend.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          files,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setFiles(data.files);

        const userMessage: Message = {
          ...pendingUserMessage,
          id: `user-${Date.now()}`,
        };
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.response,
          timestamp: new Date().toISOString(),
          changes: data.changes && data.changes.length > 0 ? data.changes : undefined,
        };

        persistMessages([...historyBeforeSend, userMessage, assistantMessage]);
      } else {
        setBuildError(data.error || "Failed to process request");

        persistMessages([
          ...historyBeforeSend,
          pendingUserMessage,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `Error: ${data.error}`,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (error) {
      const err = error as Error;
      const errorMsg = `Connection error: ${err.message}`;
      setBuildError(errorMsg);

      persistMessages([
        ...historyBeforeSend,
        pendingUserMessage,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: errorMsg,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, files, persistMessages]);

  const handleRevertTurn = useCallback((message: Message) => {
    if (!message.changes) return;
    setFiles((prev) => {
      const next = { ...prev };
      for (const change of message.changes!) {
        if (change.before === null) {
          delete next[change.path];
        } else {
          next[change.path] = change.before;
        }
      }
      return next;
    });
  }, []);

  const handleNewChat = useCallback(() => {
    setFiles({});
    setSelectedFile("");
    setBuildError("");
    persistMessages([]);
  }, [persistMessages]);

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-purple-900 border-b border-gray-700 px-6 py-3 shadow-lg">
        <div>
          <h1 className="text-2xl font-bold text-white">Agent Vinod</h1>
          <p className="text-sm text-blue-200">(AI Frontend Agent)</p>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: File Explorer */}
        <div className="w-64 flex flex-col border-r border-gray-700 bg-gray-900">
          <FileExplorer
            files={fileTree}
            onFileSelect={handleFileSelect}
            isLoading={false}
          />
        </div>

        {/* Center: Code Editor (only shown when a file is selected) */}
        {selectedFile && (
          <div className="flex-1 flex flex-col min-w-0 border-r border-gray-700">
            <CodeEditor
              fileName={selectedFile}
              content={files[selectedFile] ?? ""}
              onClose={() => setSelectedFile("")}
            />
          </div>
        )}

        {/* Right: Preview */}
        <div className="flex-1 flex flex-col border-r border-gray-700">
          <Preview
            isLoading={isLoading}
            buildStatus={buildStatus}
            buildError={buildError}
            srcDoc={previewDoc}
          />
        </div>

        {/* Far Right: Chat Panel */}
        <div className="w-80 flex flex-col">
          <ChatPanel
            messages={messages}
            onSendMessage={handleSendMessage}
            onRevertTurn={handleRevertTurn}
            onNewChat={handleNewChat}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
