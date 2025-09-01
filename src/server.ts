import 'dotenv/config';
import express, { Request, Response } from 'express';
import { SessionManager } from './types/session.js';
import { MCPHandler } from './handlers/mcpHandler.js';
import { MCPRequest } from './types/mcp.js';
import { requestLogger, errorHandler } from './middleware/logging.js';
import { extractSessionId } from './middleware/session.js';

export class MCPServer {
  private app: express.Application;
  private sessionManager: SessionManager;
  private mcpHandler: MCPHandler;
  private port: number;

  constructor(port: number = 3000) {
    console.log("[Server] Initializing...");
    this.app = express();
    this.port = port;
    this.sessionManager = new SessionManager();

    const pipedriveApiToken = process.env.PIPEDRIVE_API_TOKEN;
    if (!pipedriveApiToken) {
      console.error("ERROR: PIPEDRIVE_API_TOKEN environment variable is required. Server cannot start.");
      process.exit(1);
    }
    this.mcpHandler = new MCPHandler(pipedriveApiToken);
    console.log("[Server] MCPHandler initialized.");

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    console.log("[Server] Initialization complete.");
  }

  private setupMiddleware(): void {
    console.log("[Server] Setting up middleware...");
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id, x-session-id');
      res.header('Access-Control-Expose-Headers', 'mcp-session-id');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }
      next();
    });

    this.app.use(requestLogger);
    this.app.use(extractSessionId);
    console.log("[Server] Middleware setup complete.");
  }

  private setupRoutes(): void {
    console.log("[Server] Setting up routes...");
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'healthy', uptime: process.uptime() });
    });

    this.app.post('/mcp', async (req: Request, res: Response) => {
      await this.handleMCPRequest(req, res);
    });

    this.app.post('/', async (req: Request, res: Response) => {
      await this.handleMCPRequest(req, res);
    });

    this.app.post('/messages', async (req: Request, res: Response) => {
      await this.handleMCPRequest(req, res);
    });
    console.log("[Server] Routes setup complete: GET /health, POST /mcp, POST /, POST /messages");
  }

  private async handleMCPRequest(req: Request, res: Response): Promise<void> {
    try {
      const mcpRequest: MCPRequest = req.body;

      if (!mcpRequest || !mcpRequest.jsonrpc || mcpRequest.jsonrpc !== "2.0") {
        res.status(400).json({
          jsonrpc: "2.0", id: mcpRequest?.id || null,
          error: { code: -32600, message: "Invalid Request - missing or invalid jsonrpc version" }
        });
        return;
      }

      const [sessionId, session] = this.sessionManager.getOrCreateSession(req.sessionId);

      res.setHeader('mcp-session-id', sessionId);
      res.setHeader('content-type', 'application/json');
      res.setHeader('cache-control', 'no-cache');
      res.setHeader('connection', 'keep-alive');

      if (mcpRequest.method === 'initialize' || !session.initialized) {
        session.initialized = true;
        console.log(`Session ${sessionId} initialized/re-initialized`);
      }

      const response = await this.mcpHandler.processRequest(mcpRequest, session);
      res.json(response);

    } catch (error) {
      console.error('Error handling MCP request:', error);
      res.status(500).json({
        jsonrpc: "2.0", id: req.body?.id || null,
        error: { code: -32603, message: `Internal error: ${error instanceof Error ? error.message : 'Unknown error'}` }
      });
    }
  }

  private setupErrorHandling(): void {
    console.log("[Server] Setting up error handling.");
    this.app.use(errorHandler);
  }

  public start(): void {
    try {
      this.app.listen(this.port, '0.0.0.0', () => {
        console.log(`🚀 MCP Server running on http://localhost:${this.port}`);
      });
    } catch (error) {
      console.error(`[MCP Server] Error during server startup: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  }
}

const port = parseInt(process.env.PORT || '3000', 10);
if (!process.env.PIPEDRIVE_API_TOKEN) {
  console.error("ERROR: PIPEDRIVE_API_TOKEN environment variable is required.");
  process.exit(1);
}
const server = new MCPServer(port);
server.start();
