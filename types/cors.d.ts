declare module 'cors' {
  import { Request, Response, NextFunction } from 'express';

  interface CorsOptions {
    origin?: boolean | string | RegExp | (string | RegExp)[] | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void);
    credentials?: boolean;
    optionsSuccessStatus?: number;
    preflightContinue?: boolean;
    methods?: string | string[];
    allowedHeaders?: string | string[];
    exposedHeaders?: string | string[];
    maxAge?: number;
  }

  function cors(options?: CorsOptions): (req: Request, res: Response, next: NextFunction) => void;
  export = cors;
}