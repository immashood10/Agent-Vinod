"use client";

import React, { useState, useEffect, useCallback } from "react";
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

export function Workspace() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [fileContent, setFileContent] = useState<string>("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [buildStatus, setBuildStatus] = useState<
    "idle" | "building" | "success" | "error"
  >("idle");
  const [buildError, setBuildError] = useState<string>("");

  const refreshFiles = useCallback(async (): Promise<FileItem[]> => {
    try {
      const response = await fetch("/api/files");
      const data = await response.json();
      if (data.success) {
        setFiles(data.files);
        return data.files;
      }
    } catch {
      // File explorer just won't update; not fatal to the chat workflow.
    }
    return [];
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/history");
      const data = await response.json();
      if (data.success) {
        setMessages(data.messages);
      }
    } catch {
      // No saved history yet, or it failed to load - start with an empty chat.
    }
  }, []);

  // The generated site is in-memory only (never written to disk), so the
  // "preview" is just: does index.html currently exist for this session?
  const updatePreview = useCallback((currentFiles: FileItem[]) => {
    const hasIndex = currentFiles.some(
      (f) => f.type === "file" && f.name === "index.html"
    );
    if (hasIndex) {
      setPreviewUrl(`/api/preview-serve/index.html?v=${Date.now()}`);
      setBuildStatus("success");
      setBuildError("");
    } else {
      setPreviewUrl("");
      setBuildStatus("idle");
      setBuildError("");
    }
  }, []);

  const refreshWorkspace = useCallback(async () => {
    const fetchedFiles = await refreshFiles();
    updatePreview(fetchedFiles);
  }, [refreshFiles, updatePreview]);

  const handleFileSelect = useCallback(async (filePath: string) => {
    setSelectedFile(filePath);
    try {
      const response = await fetch(
        `/api/files/content?path=${encodeURIComponent(filePath)}`
      );
      const data = await response.json();
      setFileContent(data.success ? data.content : `// ${data.error}`);
    } catch (error) {
      setFileContent(`// Error loading file: ${(error as Error).message}`);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      // Generated site code is ephemeral by design: every fresh page load
      // clears whatever was in memory before, so a refresh always starts
      // from a clean workspace. Chat history is unaffected by this.
      await fetch("/api/workspace/reset", { method: "POST" }).catch(() => {});
      await loadHistory();
      await refreshWorkspace();
    })();
  }, [loadHistory, refreshWorkspace]);

  const handleSendMessage = useCallback(async (userPrompt: string) => {
    const pendingUserMessage: Message = {
      id: `pending-${Date.now()}`,
      role: "user",
      content: userPrompt,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, pendingUserMessage]);
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
          messages: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== pendingUserMessage.id),
          data.userMessage,
          data.assistantMessage,
        ]);
        await refreshWorkspace();
      } else {
        setBuildError(data.error || "Failed to process request");
        setBuildStatus("error");

        setMessages((prev) => [
          ...prev,
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
      setBuildStatus("error");

      setMessages((prev) => [
        ...prev,
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
  }, [messages, refreshWorkspace]);

  const handleNewChat = useCallback(async () => {
    try {
      await Promise.all([
        fetch("/api/workspace/reset", { method: "POST" }),
        fetch("/api/history/clear", { method: "POST" }),
      ]);
    } finally {
      setMessages([]);
      setSelectedFile("");
      setFileContent("");
      await refreshWorkspace();
    }
  }, [refreshWorkspace]);

  const handleRevertTurn = useCallback(async (turnId: string) => {
    try {
      const response = await fetch("/api/history/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnId }),
      });
      const data = await response.json();
      if (data.success) {
        await refreshWorkspace();
      } else {
        setBuildError(data.error || "Revert failed");
        setBuildStatus("error");
      }
    } catch (error) {
      setBuildError((error as Error).message);
      setBuildStatus("error");
    }
  }, [refreshWorkspace]);

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-purple-900 border-b border-gray-700 px-6 py-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Agent Vinod</h1>
            <p className="text-sm text-blue-200">(AI Frontend Agent)</p>
          </div>
          <div className="text-right text-xs text-blue-200">
            <p>HTML • CSS • Bootstrap • JS</p>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: File Explorer */}
        <div className="w-64 flex flex-col border-r border-gray-700 bg-gray-900">
          <FileExplorer
            files={files}
            onFileSelect={handleFileSelect}
            isLoading={false}
          />
        </div>

        {/* Center: Code Editor (only shown when a file is selected) */}
        {selectedFile && (
          <div className="flex-1 flex flex-col min-w-0 border-r border-gray-700">
            <CodeEditor
              fileName={selectedFile}
              content={fileContent}
              onClose={() => {
                setSelectedFile("");
                setFileContent("");
              }}
            />
          </div>
        )}

        {/* Right: Preview */}
        <div className="flex-1 flex flex-col border-r border-gray-700">
          <Preview
            isLoading={isLoading}
            buildStatus={buildStatus}
            buildError={buildError}
            previewUrl={previewUrl}
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
