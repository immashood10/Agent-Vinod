"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Loader, RotateCcw, SquarePen, Paperclip, X } from "lucide-react";
import type { ImageAttachment, Message } from "@/types/agent";

interface ChatPanelProps {
  onSendMessage: (message: string, images: ImageAttachment[]) => Promise<void>;
  onRevertTurn?: (message: Message) => void;
  onNewChat?: () => void;
  isLoading: boolean;
  messages: Message[];
}

interface PendingImage extends ImageAttachment {
  previewUrl: string;
}

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB

function changeSymbol(action: "created" | "updated" | "deleted") {
  if (action === "created") return { char: "+", className: "text-green-400" };
  if (action === "deleted") return { char: "-", className: "text-red-400" };
  return { char: "~", className: "text-yellow-400" };
}

function readImageFile(file: File): Promise<PendingImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1] || "";
      resolve({
        name: file.name,
        mimeType: file.type || "image/png",
        data: base64,
        previewUrl: dataUrl,
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ChatPanel({
  onSendMessage,
  onRevertTurn,
  onNewChat,
  isLoading,
  messages,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    const tooBig = files.some((f) => f.size > MAX_IMAGE_BYTES);
    if (tooBig) {
      alert("Images must be under 4MB each.");
    }

    const accepted = files.filter((f) => f.size <= MAX_IMAGE_BYTES);
    const read = await Promise.all(accepted.map(readImageFile));
    setPendingImages((prev) => [...prev, ...read]);
  };

  const removePendingImage = (index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const sendCurrentInput = async () => {
    if ((!input.trim() && pendingImages.length === 0) || isLoading) return;

    const message = input;
    const images = pendingImages;
    setInput("");
    setPendingImages([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    await onSendMessage(
      message,
      images.map(({ name, mimeType, data }) => ({ name, mimeType, data }))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendCurrentInput();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendCurrentInput();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-gray-900 to-gray-800 border-l border-gray-700">
      {/* Header */}
      {onNewChat && (
        <div className="border-b border-gray-700 p-2">
          <button
            onClick={onNewChat}
            disabled={isLoading}
            title="Clear the current website and start a new chat"
            className="w-full flex items-center justify-center gap-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg px-3 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SquarePen className="w-4 h-4" />
            New Chat
          </button>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center text-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-300 mb-2">
                Agent Vinod
              </h2>
              <p className="text-xs text-gray-500 mb-2">(AI Frontend Agent)</p>
              <p className="text-sm text-gray-400">
                Describe your website idea in any language
              </p>
              <p className="text-xs text-gray-500 mt-4">
                English, Urdu, Roman Urdu, Hindi, Arabic, or mixed
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-none"
                  : "bg-gray-700 text-gray-100 rounded-bl-none"
              }`}
            >
              {msg.images && msg.images.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {msg.images.map((img, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={img.dataUrl}
                      alt={img.name}
                      className="w-16 h-16 object-cover rounded border border-white/20"
                    />
                  ))}
                </div>
              )}

              {msg.content && (
                <p className="text-sm whitespace-pre-wrap break-words">
                  {msg.content}
                </p>
              )}

              {msg.role === "assistant" && msg.changes && msg.changes.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-600/50">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs text-gray-400">
                      {msg.changes.length} file{msg.changes.length > 1 ? "s" : ""} changed
                    </span>
                    {onRevertTurn && (
                      <button
                        onClick={() => onRevertTurn(msg)}
                        disabled={isLoading}
                        title="Revert this change"
                        className="text-xs text-blue-300 hover:text-blue-200 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Revert
                      </button>
                    )}
                  </div>
                  <ul className="space-y-0.5">
                    {msg.changes.map((c) => {
                      const symbol = changeSymbol(c.action);
                      return (
                        <li
                          key={c.path}
                          className="text-xs font-mono flex items-center gap-1.5"
                        >
                          <span className={symbol.className}>{symbol.char}</span>
                          <span className="text-gray-300 truncate">{c.path}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-700 text-gray-100 px-4 py-2 rounded-lg rounded-bl-none flex items-center gap-2">
              <Loader className="w-4 h-4 animate-spin" />
              <span className="text-sm">Agent working...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-700 p-4 bg-gray-800">
        {pendingImages.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {pendingImages.map((img, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.previewUrl}
                  alt={img.name}
                  className="w-14 h-14 object-cover rounded border border-gray-600"
                />
                <button
                  type="button"
                  onClick={() => removePendingImage(i)}
                  title="Remove image"
                  className="absolute -top-1.5 -right-1.5 bg-gray-900 border border-gray-600 rounded-full p-0.5 hover:bg-red-600 transition-colors"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              void handleFilesSelected(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            title="Attach an image"
            className="bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300 rounded-lg px-3 py-2 flex items-center transition-colors disabled:opacity-50"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Describe your website..."
            disabled={isLoading}
            rows={1}
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 disabled:opacity-50 resize-none overflow-y-auto leading-relaxed max-h-[200px]"
          />
          <button
            type="submit"
            disabled={isLoading || (!input.trim() && pendingImages.length === 0)}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg px-3 py-2 flex items-center gap-2 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
