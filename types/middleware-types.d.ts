// Global middleware function type declarations
import type express from 'express';

declare global {
  // Add global function signature overrides for Express middleware
  interface Function {
    (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void>;
    (req: express.Request, res: express.Response): void;
  }
}

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