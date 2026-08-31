interface WebMcpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => unknown;
}

interface WebMcpModelContext {
  registerTool: (tool: WebMcpToolDefinition) => void | Promise<void>;
  unregisterTool?: (name: string) => void | Promise<void>;
}

interface Document {
  modelContext?: WebMcpModelContext;
}
