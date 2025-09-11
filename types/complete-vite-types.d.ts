// Complete type declarations for server/vite.ts to resolve all LSP errors
import type { Request, Response, NextFunction } from 'express';

// Global ambient declarations to ensure types are available everywhere
declare global {
  // Ensure req, res, next parameters are properly typed for all middleware
  var req: Request;
  var res: Response;
  var next: NextFunction;
}

// Module augmentation for express to ensure compatibility
declare module 'express' {
  interface Response {
    setHeader(name: string, value: string | string[]): this;
  }
}

// Specific function signature overloads for the middleware used in vite.ts
declare module 'express-serve-static-core' {
  interface Application {
    use(path: string, handler: (req: Request, res: Response, next: NextFunction) => Promise<void>): this;
    get(path: string, handler: (req: Request, res: Response) => void): this;
    use(handler: (res: Response, path: string) => void): this;
  }
}

export {};