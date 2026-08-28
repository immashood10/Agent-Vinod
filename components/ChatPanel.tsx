"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Loader, RotateCcw, SquarePen } from "lucide-react";
import type { Message } from "@/types/agent";

interface ChatPanelProps {
  onSendMessage: (message: string) => Promise<void>;
  onRevertTurn?: (message: Message) => void;
  onNewChat?: () => void;
  isLoading: boolean;
  messages: Message[];
}

function changeSymbol(action: "created" | "updated" | "deleted") {
  if (action === "created") return { char: "+", className: "text-green-400" };
  if (action === "deleted") return { char: "-", className: "text-red-400" };
  return { char: "~", className: "text-yellow-400" };
}

export function ChatPanel({
  onSendMessage,
  onRevertTurn,
  onNewChat,
  isLoading,
  messages,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendCurrentInput = async () => {
    if (!input.trim() || isLoading) return;

    const message = input;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    await onSendMessage(message);
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
              <p className="text-sm whitespace-pre-wrap break-words">
                {msg.content}
              </p>

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
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
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
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg px-3 py-2 flex items-center gap-2 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
