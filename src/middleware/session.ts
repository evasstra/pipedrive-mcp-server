import { Request, Response, NextFunction } from 'express';

// Extend the Express Request type to include our custom property
// This allows us to attach the sessionId to the request object in a type-safe way.
declare global {
  namespace Express {
    interface Request {
      sessionId?: string | null;
    }
  }
}

export function extractSessionId(req: Request, res: Response, next: NextFunction): void {
  const sessionId = req.header('mcp-session-id') || req.header('x-session-id') || null;
  req.sessionId = sessionId;
  if (sessionId) {
    console.log(`[Session] Extracted session ID from header: ${sessionId}`);
  }
  next();
}
