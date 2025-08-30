import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import express from 'express';
import { randomUUID } from 'crypto';

export function setupHttpTransport(app: express.Express, server: McpServer) {
    app.post('/mcp', (req: express.Request, res: express.Response) => {
        const sessionId = req.header('mcp-session-id') || randomUUID();
        console.log(`[${new Date().toISOString()}] Received POST request for session ${sessionId}`);

        // Set headers for N8N workaround
        res.setHeader('mcp-session-id', sessionId);
        res.setHeader('content-type', 'application/json');
        res.setHeader('cache-control', 'no-cache');
        res.setHeader('connection', 'keep-alive');

        const transportObject = {
            start: (onMessage: (message: any) => void, onClose: () => void) => {
                let body = '';
                req.on('data', chunk => {
                    body += chunk.toString();
                });
                req.on('end', () => {
                    try {
                        if (body) {
                            onMessage(JSON.parse(body));
                        }
                    } catch (error) {
                        console.error('Error parsing JSON:', error);
                        if (!res.headersSent) {
                            res.status(400).json({ error: 'Invalid JSON' });
                        }
                    }
                });
                req.on('close', () => {
                    console.log(`[${new Date().toISOString()}] Connection closed for session ${sessionId}`);
                    onClose();
                });
            },
            send: (message: any) => {
                console.log(`[${new Date().toISOString()}] Sending response for session ${sessionId}: ${JSON.stringify(message)}`);
                if (!res.headersSent) {
                    res.json(message);
                }
            },
            close: () => {
                console.log(`[${new Date().toISOString()}] Closing connection for session ${sessionId}`);
                if (!res.writableEnded) {
                    res.end();
                }
            }
        };

        server.connect(transportObject as any).catch(err => {
            console.error(`[${new Date().toISOString()}] Error connecting to MCP server for session ${sessionId}:`, err);
            if (!res.headersSent) {
                res.status(500).send({ error: 'Failed to connect to MCP server' });
            }
        });
    });

    app.get('/mcp', (req: express.Request, res: express.Response) => {
        res.status(405).send('Method Not Allowed');
    });
}
