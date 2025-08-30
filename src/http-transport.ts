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

                            // --- Start of inspection code ---
                            console.log("--- Inspecting server object ---");
                            let props: string[] = [];
                            let obj: object = server;
                            do {
                                props = props.concat(Object.getOwnPropertyNames(obj));
                            } while (obj = Object.getPrototypeOf(obj));

                            console.log("All server methods (including non-enumerable and inherited):", props.sort().filter(function (e: string, i: number, arr: string[]) {
                                if (e != arr[i + 1] && typeof (server as any)[e] === 'function') return true;
                            }));
                            console.log("--- End of inspection ---");
                            // --- End of inspection code ---

                            console.error("Next, provide the server logs so I can identify the correct message handling function.");
                            if (!res.headersSent) {
                                res.status(500).json({ error: 'Server inspection running. See logs.' });
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
