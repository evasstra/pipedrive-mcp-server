import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Duplex } from 'stream';
import express from 'express';
import { randomUUID } from 'crypto';

class McpRequestDuplex extends Duplex {
    private res: express.Response;
    private finished: boolean = false;

    constructor(res: express.Response) {
        super();
        this.res = res;
    }

    _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
        if (this.finished) {
            callback();
            return;
        }
        console.log(`[${new Date().toISOString()}] Sending response chunk: ${chunk.toString()}`);
        this.res.write(chunk);
        callback();
    }

    _read(size: number): void {
        // Data is pushed to the stream via the `pushRequestData` method
    }

    pushRequestData(data: any) {
        this.push(data);
    }

    _final(callback: (error?: Error | null) => void): void {
        if (!this.finished) {
            this.res.end();
            this.finished = true;
        }
        callback();
    }
}


export function setupHttpTransport(app: express.Express, server: McpServer) {
    app.post('/mcp', (req: express.Request, res: express.Response) => {
        const sessionId = req.header('mcp-session-id') || randomUUID();
        console.log(`[${new Date().toISOString()}] Received POST request for session ${sessionId}`);

        // Set headers for N8N workaround
        res.setHeader('mcp-session-id', sessionId);
        res.setHeader('content-type', 'application/json');
        res.setHeader('cache-control', 'no-cache');
        res.setHeader('connection', 'keep-alive');

        const duplex = new McpRequestDuplex(res);

        server.connect(duplex as any).catch(err => {
            console.error(`[${new Date().toISOString()}] Error connecting to MCP server:`, err);
            if (!res.headersSent) {
                res.status(500).send({ error: 'Failed to connect to MCP server' });
            }
        });

        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            console.log(`[${new Date().toISOString()}] Request body: ${body}`);
            duplex.pushRequestData(body);
            duplex.push(null); // No more data to push
        });

        req.on('close', () => {
            console.log(`[${new Date().toISOString()}] Connection closed for session ${sessionId}`);
            duplex.destroy();
        });
    });

    app.get('/mcp', (req: express.Request, res: express.Response) => {
        res.status(405).send('Method Not Allowed');
    });
}
