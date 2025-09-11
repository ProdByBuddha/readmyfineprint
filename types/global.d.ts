// Global type declarations for server environment
declare global {
  interface Date {
    toLocaleTimeString(locale?: string, options?: Intl.DateTimeFormatOptions): string;
  }

  interface DateConstructor {
    new(): Date;
    new(value: number | string): Date;
    now(): number;
  }

  interface Error {
    name: string;
    message: string;
    stack?: string;
  }

  interface ErrorConstructor {
    new(message?: string): Error;
    (message?: string): Error;
    readonly prototype: Error;
  }

  interface Promise<T> {
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
    ): Promise<TResult1 | TResult2>;
    catch<TResult = never>(
      onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null
    ): Promise<T | TResult>;
  }

  interface PromiseConstructor {
    new <T>(executor: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void): Promise<T>;
    readonly prototype: Promise<any>;
  }

  // String methods
  interface String {
    trim(): string;
    replace(searchValue: string | RegExp, replaceValue: string): string;
  }

  var Date: DateConstructor;
  var Error: ErrorConstructor;
  var Promise: PromiseConstructor;

  // Express types for middleware functions
  namespace Express {
    interface Request {
      originalUrl: string;
      path: string;
    }
    
    interface Response {
      status(code: number): Response;
      set(headers: object): Response;
      end(data?: any): Response;
      sendFile(path: string): void;
      json(obj: any): Response;
    }
    
    interface NextFunction {
      (err?: any): void;
    }
  }
}

export {};