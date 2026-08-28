"use client";

import React, { useState, useEffect } from "react";
import { ChevronRight, ChevronDown, File, Folder, Code } from "lucide-react";

interface FileItem {
  name: string;
  type: "file" | "directory";
  path: string;
  children?: FileItem[];
  isOpen?: boolean;
}

interface FileExplorerProps {
  onFileSelect: (path: string) => void;
  files: FileItem[];
  isLoading?: boolean;
}

function getFileIcon(name: string) {
  if (name.endsWith(".ts") || name.endsWith(".tsx")) return Code;
  if (name.endsWith(".json")) return Code;
  if (name.endsWith(".css")) return Code;
  return File;
}

export function FileExplorer({
  onFileSelect,
  files,
  isLoading = false,
}: FileExplorerProps) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  const toggleDir = (path: string) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedDirs(newExpanded);
  };

  const renderItem = (item: FileItem, level: number = 0) => {
    const isOpen = expandedDirs.has(item.path);

    return (
      <div key={item.path}>
        <div
          className={`flex items-center gap-1 px-2 py-1 hover:bg-gray-700 cursor-pointer text-sm ${
            level > 0 ? "" : ""
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
        >
          {item.type === "directory" ? (
            <>
              <button
                onClick={() => toggleDir(item.path)}
                className="p-0 hover:bg-gray-600 rounded"
              >
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>
              <Folder className="w-4 h-4 text-blue-400" />
              <span className="text-gray-200">{item.name}</span>
            </>
          ) : (
            <>
              <div className="w-4" /> {/* Spacer for alignment */}
              {React.createElement(getFileIcon(item.name), {
                className: "w-4 h-4 text-gray-400",
              })}
              <button
                onClick={() => onFileSelect(item.path)}
                className="text-gray-300 hover:text-white flex-1 text-left"
              >
                {item.name}
              </button>
            </>
          )}
        </div>

        {item.type === "directory" && isOpen && item.children && (
          <div>
            {item.children.map((child) => renderItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        Loading files...
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full bg-gray-900 border-r border-gray-700">
      <div className="p-2">
        <h3 className="text-xs font-semibold text-gray-400 px-2 py-1 mb-2">
          PROJECT FILES
        </h3>
        <div className="space-y-0">
          {files.map((item) => renderItem(item))}
        </div>
      </div>
    </div>
  );
}
