export interface MCPRequest {
  jsonrpc: "2.0";
  id: any;
  method: string;
  params?: any;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

export interface MCPResponse {
  jsonrpc: "2.0";
  id: any;
  result?: any;
  error?: MCPError;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
}
