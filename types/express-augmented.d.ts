// Express type augmentation for server environment
import express from 'express';

// Module augmentation for express Response to add missing methods
declare module 'express' {
  interface Response {
    setHeader(name: string, value: string | string[]): this;
  }
}

declare global {
  // Extend Express namespace to ensure types are available
  namespace Express {
    interface Request extends express.Request {
      originalUrl: string;
      path: string;
    }
    
    interface Response extends express.Response {
      setHeader(name: string, value: string | string[]): this;
    }
    
    interface NextFunction {
      (err?: any): void;
    }
  }
}

export {};