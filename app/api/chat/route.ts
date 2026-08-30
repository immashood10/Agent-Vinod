import { NextRequest, NextResponse } from "next/server";
import { callGemini, GeminiMessage } from "@/lib/gemini";
import { AGENT_SYSTEM_PROMPT } from "@/lib/agent/planner";
import { FileChange, ImageAttachment } from "@/types/agent";

interface IncomingMessage {
  role: "user" | "assistant" | "model";
  content: string;
}

function toGeminiMessages(raw: IncomingMessage[]): GeminiMessage[] {
  return raw.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned || "image";
}

function uniquePath(basePath: string, files: Record<string, string>): string {
  if (!(basePath in files)) return basePath;

  const dot = basePath.lastIndexOf(".");
  const stem = dot > 0 ? basePath.slice(0, dot) : basePath;
  const ext = dot > 0 ? basePath.slice(dot) : "";

  let i = 1;
  let candidate = `${stem}-${i}${ext}`;
  while (candidate in files) {
    i++;
    candidate = `${stem}-${i}${ext}`;
  }
  return candidate;
}

function normalizePath(rawPath: string): string {
  const cleaned = rawPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const segments = cleaned.split("/").filter((s) => s && s !== ".");
  const resolved: string[] = [];

  for (const segment of segments) {
    if (segment === "..") {
      resolved.pop();
    } else {
      resolved.push(segment);
    }
  }

  return resolved.join("/");
}

// Operates on a plain in-request object, not any persisted store - the
// current file set comes in with the request and the updated set goes
// back out in the response. This keeps the route fully stateless, which
// is required for serverless platforms like Vercel (no shared memory or
// writable disk between invocations).
function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  files: Record<string, string>,
  changes: FileChange[]
): string {
  try {
    switch (toolName) {
      case "read_file": {
        const p = normalizePath(toolInput.path as string);
        if (!(p in files)) {
          throw new Error(`File not found: ${toolInput.path}`);
        }
        return files[p];
      }

      case "write_file": {
        const p = normalizePath(toolInput.path as string);
        const before = p in files ? files[p] : null;
        const content = toolInput.content as string;
        files[p] = content;
        changes.push({
          path: p,
          action: before === null ? "created" : "updated",
          before,
          after: content,
        });
        return `File created: ${p}`;
      }

      case "update_file": {
        const p = normalizePath(toolInput.path as string);
        if (!(p in files)) {
          throw new Error(`File not found: ${toolInput.path}`);
        }
        const before = files[p];
        const oldString = toolInput.oldString as string;
        if (!before.includes(oldString)) {
          throw new Error("Old string not found in file");
        }
        const after = before.replace(oldString, toolInput.newString as string);
        files[p] = after;
        changes.push({ path: p, action: "updated", before, after });
        return `File updated: ${p}`;
      }

      case "delete_file": {
        const p = normalizePath(toolInput.path as string);
        const before = p in files ? files[p] : null;
        delete files[p];
        changes.push({ path: p, action: "deleted", before, after: null });
        return `File deleted: ${p}`;
      }

      case "list_files": {
        const dir = normalizePath((toolInput.path as string) || "");
        const seen = new Set<string>();
        const entries: Array<{ name: string; type: "file" | "directory" }> = [];

        for (const key of Object.keys(files)) {
          if (dir && !key.startsWith(`${dir}/`)) continue;
          const rest = dir ? key.slice(dir.length + 1) : key;
          const [first, ...remainder] = rest.split("/");
          if (!first || seen.has(first)) continue;
          seen.add(first);
          entries.push({
            name: first,
            type: remainder.length > 0 ? "directory" : "file",
          });
        }

        return JSON.stringify(entries);
      }

      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (error) {
    const err = error as Error;
    return `Error: ${err.message}`;
  }
}

export async function POST(req: NextRequest) {
  try {
    const {
      messages,
      userPrompt,
      files: incomingFiles,
      images,
    } = await req.json();

    const files: Record<string, string> = { ...(incomingFiles || {}) };
    const changes: FileChange[] = [];

    const conversationMessages: GeminiMessage[] = toGeminiMessages(
      messages || []
    );

    if (userPrompt) {
      const imagePaths: string[] = [];
      const imageParts: Array<{
        inlineData: { mimeType: string; data: string };
      }> = [];

      if (Array.isArray(images)) {
        for (const img of images as ImageAttachment[]) {
          const path = uniquePath(
            `images/${sanitizeFileName(img.name)}`,
            files
          );
          const dataUri = `data:${img.mimeType};base64,${img.data}`;
          files[path] = dataUri;
          changes.push({ path, action: "created", before: null, after: dataUri });
          imagePaths.push(path);
          imageParts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
        }
      }

      const text =
        imagePaths.length > 0
          ? `${userPrompt}\n\n[Uploaded image(s) saved in the workspace at: ${imagePaths.join(
              ", "
            )}. Look at the attached image(s) and use them as a design/content reference. If you want to actually display an uploaded image in the site, reference it with its exact path above, e.g. <img src="${imagePaths[0]}">.]`
          : userPrompt;

      conversationMessages.push({
        role: "user",
        parts: [{ text }, ...imageParts],
      });
    }

    let { response, toolUses, modelContent } = await callGemini(
      conversationMessages,
      AGENT_SYSTEM_PROMPT
    );

    let iterations = 0;
    const maxIterations = 10;

    while (toolUses.length > 0 && iterations < maxIterations) {
      iterations++;

      const functionResponseParts = [];

      for (const toolUse of toolUses) {
        const result = executeTool(toolUse.name, toolUse.input, files, changes);
        functionResponseParts.push({
          functionResponse: {
            id: toolUse.id,
            name: toolUse.name,
            response: { result },
          },
        });
      }

      if (modelContent) {
        conversationMessages.push(modelContent);
      }

      conversationMessages.push({
        role: "user",
        parts: functionResponseParts,
      });

      const result = await callGemini(conversationMessages, AGENT_SYSTEM_PROMPT);
      response = result.response;
      toolUses = result.toolUses;
      modelContent = result.modelContent;
    }

    return NextResponse.json({
      response,
      files,
      changes,
      success: true,
    });
  } catch (error) {
    const err = error as Error;
    console.error("API Error:", err);
    return NextResponse.json(
      {
        error: err.message,
        success: false,
      },
      { status: 500 }
    );
  }
}
