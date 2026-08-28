export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  turnId?: string;
  changes?: FileChange[];
}

export interface FileChange {
  path: string;
  action: 'created' | 'updated' | 'deleted';
}

export interface WorkspaceFile {
  path: string;
  name: string;
  type: 'file' | 'directory';
  content?: string;
  size?: number;
}

export interface AgentState {
  messages: Message[];
  files: WorkspaceFile[];
  isGenerating: boolean;
  buildStatus: 'idle' | 'building' | 'success' | 'error';
  buildError?: string;
  projectRoot?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface CodeGenRequest {
  userPrompt: string;
  context?: string;
}

export interface FileOperation {
  type: 'read' | 'write' | 'update' | 'delete' | 'list';
  path: string;
  content?: string;
  oldContent?: string;
  newContent?: string;
}
