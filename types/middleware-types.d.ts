// Shared middleware type utilities for Express handlers
import type { Request, Response, NextFunction } from 'express';

// Reusable type alias that accurately represents async/void Express middleware without
// overriding the global Function interface. This can be imported by server modules
// that want a strongly typed middleware signature.
export type MiddlewareHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

// Specific middleware type declarations
declare module 'express-serve-static-core' {
  interface Request {
    originalUrl: string;
    path: string;
  }

  interface Response {
    setHeader(name: string, value: string | string[]): this;
  }
}

export {};
