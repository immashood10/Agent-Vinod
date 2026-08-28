import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import * as vfs from "@/lib/virtual-fs";
import { FileChange, Message } from "@/types/agent";

const HISTORY_DIR = path.join(process.cwd(), ".agent-history");
const HISTORY_FILE = path.join(HISTORY_DIR, "history.json");

export interface RecordedChange extends FileChange {
  before: string | null;
  after: string | null;
}

interface StoredTurn {
  id: string;
  timestamp: string;
  changes: RecordedChange[];
}

interface HistoryData {
  messages: Message[];
  turns: StoredTurn[];
}

function load(): HistoryData {
  try {
    const raw = fs.readFileSync(HISTORY_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { messages: [], turns: [] };
  }
}

function save(data: HistoryData): void {
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export function getHistory(): {
  messages: Message[];
  turns: Array<{ id: string; timestamp: string; changes: FileChange[] }>;
} {
  const data = load();
  return {
    messages: data.messages,
    turns: data.turns.map((t) => ({
      id: t.id,
      timestamp: t.timestamp,
      changes: t.changes.map(({ path: p, action }) => ({ path: p, action })),
    })),
  };
}

export function recordTurn(
  userContent: string,
  assistantContent: string,
  changes: RecordedChange[]
): { userMessage: Message; assistantMessage: Message } {
  const data = load();
  const now = new Date().toISOString();

  const userMessage: Message = {
    id: randomUUID(),
    role: "user",
    content: userContent,
    timestamp: now,
  };

  const assistantMessage: Message = {
    id: randomUUID(),
    role: "assistant",
    content: assistantContent,
    timestamp: now,
  };

  if (changes.length > 0) {
    const turnId = randomUUID();
    assistantMessage.turnId = turnId;
    assistantMessage.changes = changes.map(({ path: p, action }) => ({
      path: p,
      action,
    }));
    data.turns.push({ id: turnId, timestamp: now, changes });
  }

  data.messages.push(userMessage, assistantMessage);
  save(data);

  return { userMessage, assistantMessage };
}

export function clearHistory(): void {
  save({ messages: [], turns: [] });
}

export function rollbackTurn(turnId: string): { success: boolean; error?: string } {
  const data = load();
  const turn = data.turns.find((t) => t.id === turnId);

  if (!turn) {
    return { success: false, error: "Turn not found" };
  }

  try {
    for (const change of turn.changes) {
      if (change.before === null) {
        if (vfs.fileExists(change.path)) {
          vfs.deleteFile(change.path);
        }
      } else {
        vfs.writeFile(change.path, change.before);
      }
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
