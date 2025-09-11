// Comprehensive type declarations for server/vite.ts
import type express from 'express';

declare global {
  // Ensure all Express types are properly available
  namespace Express {
    interface Request {
      originalUrl: string;
      path: string;
    }
    
    interface Response {
      setHeader(name: string, value: string | string[]): this;
      status(code: number): this;
      set(headers: object): this;
      end(data?: any): this;
      sendFile(path: string): void;
      json(obj: any): this;
    }
    
    interface NextFunction {
      (err?: any): void;
    }
  }
}

// Module augmentation for express to add missing methods
declare module 'express' {
  interface Response {
    setHeader(name: string, value: string | string[]): this;
  }
  
  interface Request {
    originalUrl: string;
    path: string;
  }
}

// Explicit parameter type declarations for middleware functions
export type ViteMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => Promise<void>;

export type StaticMiddleware = (
  req: express.Request,
  res: express.Response
) => void;

export {};