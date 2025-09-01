import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  console.log(`[Request] ---> ${req.method} ${req.originalUrl} from ${req.ip}`);
  console.log('[Request] Headers:', JSON.stringify(req.headers, null, 2));


  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[Request] <--- ${req.method} ${req.originalUrl} - ${res.statusCode} [${duration}ms]`);
  });

  next();
}

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  console.error(`[Error] An unexpected error occurred:`, err.stack);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    jsonrpc: "2.0",
    id: (req.body as any)?.id || null,
    error: {
      code: -32603,
      message: 'Internal Server Error',
      data: err.message
    }
  });
}
