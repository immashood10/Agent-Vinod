import { NextRequest, NextResponse } from "next/server";
import { callGemini, GeminiMessage } from "@/lib/gemini";
import { AGENT_SYSTEM_PROMPT } from "@/lib/agent/planner";
import * as vfs from "@/lib/virtual-fs";
import { recordTurn, RecordedChange } from "@/lib/history-store";

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

function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  changes: RecordedChange[]
): string {
  try {
    switch (toolName) {
      case "read_file":
        return vfs.readFile(toolInput.path as string);

      case "write_file": {
        const filePath = toolInput.path as string;
        const before = vfs.fileExists(filePath) ? vfs.readFile(filePath) : null;
        vfs.writeFile(filePath, toolInput.content as string);
        changes.push({
          path: filePath,
          action: before === null ? "created" : "updated",
          before,
          after: toolInput.content as string,
        });
        return `File created: ${filePath}`;
      }

      case "update_file": {
        const filePath = toolInput.path as string;
        const before = vfs.readFile(filePath);
        vfs.updateFile(
          filePath,
          toolInput.oldString as string,
          toolInput.newString as string
        );
        const after = vfs.readFile(filePath);
        changes.push({ path: filePath, action: "updated", before, after });
        return `File updated: ${filePath}`;
      }

      case "delete_file": {
        const filePath = toolInput.path as string;
        const before = vfs.fileExists(filePath) ? vfs.readFile(filePath) : null;
        vfs.deleteFile(filePath);
        changes.push({ path: filePath, action: "deleted", before, after: null });
        return `File deleted: ${filePath}`;
      }

      case "list_files":
        return JSON.stringify(vfs.listFiles(toolInput.path as string));

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
    const { messages, userPrompt } = await req.json();

    // Initialize conversation if starting fresh
    const conversationMessages: GeminiMessage[] = toGeminiMessages(
      messages || []
    );

    if (userPrompt) {
      conversationMessages.push({
        role: "user",
        parts: [{ text: userPrompt }],
      });
    }

    // Call Gemini with tools
    let { response, toolUses, modelContent } = await callGemini(
      conversationMessages,
      AGENT_SYSTEM_PROMPT
    );

    // Execute tools in a loop until no more tool calls
    let iterations = 0;
    const maxIterations = 10;
    const changes: RecordedChange[] = [];

    while (toolUses.length > 0 && iterations < maxIterations) {
      iterations++;

      // Execute all tools and collect results
      const functionResponseParts = [];

      for (const toolUse of toolUses) {
        const result = executeTool(toolUse.name, toolUse.input, changes);
        functionResponseParts.push({
          functionResponse: {
            id: toolUse.id,
            name: toolUse.name,
            response: { result },
          },
        });
      }

      // Add the model's turn (including its function calls) back to the conversation
      if (modelContent) {
        conversationMessages.push(modelContent);
      }

      // Add tool results to conversation
      conversationMessages.push({
        role: "user",
        parts: functionResponseParts,
      });

      // Call Gemini again with tool results
      const result = await callGemini(conversationMessages, AGENT_SYSTEM_PROMPT);
      response = result.response;
      toolUses = result.toolUses;
      modelContent = result.modelContent;
    }

    // Final response
    conversationMessages.push({
      role: "model",
      parts: [{ text: response }],
    });

    const { userMessage, assistantMessage } = recordTurn(
      userPrompt || "",
      response,
      changes
    );

    return NextResponse.json({
      response,
      userMessage,
      assistantMessage,
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
