import { GoogleGenAI, Type } from "@google/genai";
import type { Content, FunctionDeclaration } from "@google/genai";
import { randomUUID } from "crypto";
import { ToolCall } from "@/types/agent";

// Configurable via env so it's easy to switch between free-tier-eligible
// models without code changes.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const tools: FunctionDeclaration[] = [
  {
    name: "read_file",
    description:
      "Read the contents of an in-memory file for this session. Returns the file contents as a string.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description: "Path to the file, e.g. index.html or css/style.css",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description:
      "Create a new in-memory file for this session with the specified content. Nothing is written to disk.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description: "Path where the file should be created, e.g. index.html",
        },
        content: {
          type: Type.STRING,
          description: "The content to write to the file",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "update_file",
    description: "Update an existing in-memory file with new content.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description: "Path to the file to update",
        },
        oldString: {
          type: Type.STRING,
          description: "The exact string to find and replace",
        },
        newString: {
          type: Type.STRING,
          description: "The new content to replace it with",
        },
      },
      required: ["path", "oldString", "newString"],
    },
  },
  {
    name: "delete_file",
    description: "Delete an in-memory file.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description: "Path to the file to delete",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "list_files",
    description: "List files and directories currently in memory for this session.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description: "Directory path to list (empty for root)",
        },
      },
      required: ["path"],
    },
  },
];

export { tools };
export type { Content as GeminiMessage };

// The API occasionally returns a completely empty candidate (no text, no
// function call) or the request fails with a transient network error
// (observed: ECONNRESET) with no indication in either case that anything
// is actually wrong with the request. Retrying a couple of times with a
// short backoff clears this up reliably in practice.
async function generateContentWithRetry(
  params: Parameters<typeof ai.models.generateContent>[0],
  attempts = 3
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const result = await ai.models.generateContent(params);
      const parts = result.candidates?.[0]?.content?.parts ?? [];
      const hasContent = parts.some((p) => p.text || p.functionCall);
      if (hasContent) return result;
      lastError = new Error("Gemini returned an empty response");
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function callGemini(
  messages: Content[],
  systemPrompt: string
): Promise<{
  response: string;
  toolUses: ToolCall[];
  modelContent: Content | null;
}> {
  const result = await generateContentWithRetry({
    model: GEMINI_MODEL,
    contents: messages,
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: 8192,
      // Cap the thinking budget so reasoning tokens can't consume the
      // entire maxOutputTokens window and leave no room for the actual
      // text/function-call output (observed on longer code-gen prompts).
      thinkingConfig: { thinkingBudget: 1024 },
      tools: [{ functionDeclarations: tools }],
    },
  });

  const content = result.candidates?.[0]?.content ?? null;
  const parts = content?.parts ?? [];

  let textContent = "";
  const toolUses: ToolCall[] = [];

  for (const part of parts) {
    if (part.text) {
      textContent += part.text;
    }
    if (part.functionCall?.name) {
      const id = part.functionCall.id ?? randomUUID();
      part.functionCall.id = id;
      toolUses.push({
        id,
        name: part.functionCall.name,
        input: part.functionCall.args ?? {},
      });
    }
  }

  return { response: textContent, toolUses, modelContent: content };
}
