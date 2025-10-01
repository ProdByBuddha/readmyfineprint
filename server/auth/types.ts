/**
 * Type definitions for authentication and permissions
 */

declare global {
  namespace Express {
    interface User {
      id: string;
      email?: string;
    }
    
    interface Request {
      user?: User;
      orgId?: string;
      orgRole?: string;
      workspaceId?: string;
      workspaceRole?: string;
      workspaceVisibility?: string;
      isResourceOwner?: boolean;
    }
  }
}

export {};
