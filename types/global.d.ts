// Global type declarations for server and client environment
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
    includes(searchString: string, position?: number): boolean;
  }

  // Number global
  interface NumberConstructor {
    POSITIVE_INFINITY: number;
  }

  // Global objects
  var Date: DateConstructor;
  var Error: ErrorConstructor;
  var Promise: PromiseConstructor;
  var Number: NumberConstructor;
  var JSON: {
    parse(text: string): any;
    stringify(value: any): string;
  };
  var console: {
    log(...data: any[]): void;
    error(...data: any[]): void;
  };
  var crypto: {
    getRandomValues<T extends ArrayBufferView | null>(array: T): T;
  };
  // DOM types for client-side code
  interface Storage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
  }

  interface Window {
    dispatchEvent(event: Event): boolean;
    location: Location;
  }

  var window: Window & typeof globalThis;
  var localStorage: Storage;
  var sessionStorage: Storage;

  // Record type utility
  type Record<K extends keyof any, T> = {
    [P in K]: T;
  };

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