"use client";

import React, { useState, useEffect } from "react";
import { RefreshCw, Eye, EyeOff, AlertCircle } from "lucide-react";

interface PreviewProps {
  isLoading?: boolean;
  buildStatus?: "idle" | "building" | "success" | "error";
  buildError?: string;
  srcDoc?: string;
}

export function Preview({
  isLoading = false,
  buildStatus = "idle",
  buildError,
  srcDoc = "",
}: PreviewProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const handleRefresh = () => {
    setIframeKey((prev) => prev + 1);
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-gray-900 to-gray-950 border-l border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between bg-gray-900 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-300">Preview</span>
          <span
            className={`px-2 py-0.5 rounded text-xs font-mono ${
              buildStatus === "success"
                ? "bg-green-900 text-green-300"
                : buildStatus === "building"
                  ? "bg-yellow-900 text-yellow-300"
                  : buildStatus === "error"
                    ? "bg-red-900 text-red-300"
                    : "bg-gray-700 text-gray-300"
            }`}
          >
            {buildStatus === "building" && "Building..."}
            {buildStatus === "success" && "Ready"}
            {buildStatus === "error" && "Error"}
            {buildStatus === "idle" && "Idle"}
          </span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="p-1 hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={`w-4 h-4 text-gray-400 ${isLoading ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative bg-white">
        {buildStatus === "error" && buildError && (
          <div className="absolute inset-0 bg-gray-950 flex items-center justify-center p-4 z-10">
            <div className="max-w-lg">
              <div className="flex gap-3 mb-3">
                <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-red-300 mb-2">
                    Build Error
                  </h3>
                  <pre className="text-sm text-gray-300 overflow-auto max-h-64 bg-gray-900 p-3 rounded border border-red-900">
                    {buildError}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {buildStatus === "success" && srcDoc && (
          <iframe
            key={iframeKey}
            srcDoc={srcDoc}
            title="Generated Website Preview"
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-popups allow-forms"
          />
        )}

        {buildStatus === "idle" && (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <EyeOff className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No preview available yet</p>
              <p className="text-xs mt-1">Create a website to see preview</p>
            </div>
          </div>
        )}

        {buildStatus === "building" && (
          <div className="flex items-center justify-center h-full bg-gray-950">
            <div className="text-center">
              <div className="inline-block">
                <div className="w-12 h-12 border-4 border-blue-900 border-t-blue-500 rounded-full animate-spin mx-auto mb-3"></div>
              </div>
              <p className="text-sm text-gray-300">Building your website...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
