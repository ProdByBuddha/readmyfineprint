// Shared Express request augmentations used throughout the server codebase.
// Keeping these definitions lean avoids conflicting with the official express
// type declarations provided by @types/express.

declare global {
  namespace Express {
    interface User {
      id: string;
      email?: string;
      role?: string;
      isAdmin?: boolean;
      [key: string]: unknown;
    }

    interface Request {
      user?: User;
      sessionId?: string;
      nonce?: string;
      cookies?: Record<string, string>;
    }
  }
}

export {};
