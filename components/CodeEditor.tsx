"use client";

import React from "react";
import { Copy, Download, X } from "lucide-react";

interface CodeEditorProps {
  fileName?: string;
  content: string;
  onClose?: () => void;
  language?: string;
}

export function CodeEditor({
  fileName = "untitled",
  content,
  onClose,
  language = "typescript",
}: CodeEditorProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
  };

  const getLineNumbers = () => {
    return content.split("\n").map((_, i) => i + 1);
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 border-r border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between bg-gray-900 border-b border-gray-700 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-gray-300">{fileName}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            title="Copy code"
            className="p-1 hover:bg-gray-800 rounded transition-colors"
          >
            <Copy className="w-4 h-4 text-gray-400" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              title="Close"
              className="p-1 hover:bg-gray-800 rounded transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Code Area */}
      <div className="flex-1 overflow-auto">
        <pre className="h-full bg-gray-950 text-gray-100 p-4 font-mono text-sm leading-relaxed">
          <code>{content}</code>
        </pre>
      </div>

      {/* Stats */}
      <div className="bg-gray-900 border-t border-gray-700 px-4 py-2 text-xs text-gray-400 flex justify-between">
        <span>{content.split("\n").length} lines</span>
        <span>{content.length} bytes</span>
      </div>
    </div>
  );
}
