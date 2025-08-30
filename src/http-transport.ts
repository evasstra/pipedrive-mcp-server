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
            start: () => {
                let body = '';
                req.on('data', chunk => {
                    body += chunk.toString();
                });

                req.on('end', () => {
                    try {
                        if (body) {
                            const message = JSON.parse(body);
                            console.log(`[${new Date().toISOString()}] Parsed message:`, message);

                            // The server object has a private method `_processRequest` which seems to be the entry point for messages.
                            // We cast to `any` to bypass TypeScript's private access modifier.
                            if (typeof (server as any)._processRequest === 'function') {
                                (server as any)._processRequest(message);
                            } else {
                                console.error("FATAL: Could not find a method on the server to process the request.");
                                if (!res.headersSent) {
                                    res.status(500).json({ error: 'Server misconfiguration' });
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error parsing JSON or processing request:', error);
                        if (!res.headersSent) {
                            res.status(400).json({ error: 'Invalid JSON' });
                        }
                    }
                });

                req.on('close', () => {
                    console.log(`[${new Date().toISOString()}] Connection closed for session ${sessionId}`);
                    // TODO: We may need to notify the server about the connection closing.
                });
            },
            send: (message: any) => {
                console.log(`[${new Date().toISOString()}] Sending response for session ${sessionId}: ${JSON.stringify(message)}`);
                if (!res.headersSent) {
                    res.json(message);
                } else if (!res.writableEnded) {
                    // If headers are sent, we assume a stream might be open, so we write to it.
                    res.write(JSON.stringify(message));
                }
            },
            close: () => {
                console.log(`[${new Date().toISOString()}] Closing connection for session ${sessionId}`);
                if (!res.writableEnded) {
                    res.end();
                }
            }
        };

        // We cast to `any` because our transport object doesn't perfectly match the SDK's `Transport` type,
        // but it provides the `start`, `send`, and `close` methods that the SDK seems to require at runtime.
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
