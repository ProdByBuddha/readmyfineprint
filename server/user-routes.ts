import { Express, Request, Response, NextFunction } from "express";
import { databaseStorage } from "./storage";
import { insertUserSchema, insertUserSubscriptionSchema, insertUsageRecordSchema } from "@shared/schema";
import { z } from "zod";
import { generateJWT, optionalUserAuth, requireUserAuth } from "./auth";
import { securityLogger } from "./security-logger";
import { hashPassword, verifyPassword } from "./argon2";

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerSchema = insertUserSchema.extend({
  password: z.string().min(8),
}).omit({ hashedPassword: true });

const subscriptionSchema = z.object({
  tierId: z.string(),
  stripeCustomerId: z.string().optional(),
  stripeSubscriptionId: z.string().optional(),
});

export function registerUserRoutes(app: Express) {
  // User registration
  app.post("/api/users/register", async (req: Request, res: Response) => {
    try {
      const userData = registerSchema.parse(req.body);

      // Check if user already exists
      const existingUser = await databaseStorage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
      }

      // Hash password with Argon2id
      const hashedPassword = await hashPassword(userData.password as string);

      // Create user
      const user = await databaseStorage.createUser({
        ...userData,
        hashedPassword,
      });

      // Generate JWT token for new user
      const token = generateJWT(user.id);

      // Remove password from response
      const { hashedPassword: _, ...userResponse } = user;
      res.status(201).json({
        user: userResponse,
        token
      });
    } catch (error) {
      console.error("Registration error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // User login
  app.post("/api/users/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const ip = req.ip || req.socket.remoteAddress as string;
      const userAgent = req.get('User-Agent') || 'unknown';

      // Find user
      const user = await databaseStorage.getUserByEmail(email);
      if (!user || !user.hashedPassword) {
        securityLogger.logFailedAuth(ip, userAgent, `User not found: ${email}`, '/api/login');
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Verify password with Argon2id
      let isValidPassword = await verifyPassword(password, user.hashedPassword);
      let needsPasswordMigration = false;

      // Check if it's a legacy bcrypt password that needs migration
      if (!isValidPassword && (user.hashedPassword.startsWith('$2b$') || 
                              user.hashedPassword.startsWith('$2a$') || 
                              user.hashedPassword.startsWith('$2y$'))) {
        try {
          const bcrypt = await import('bcrypt');
          isValidPassword = await bcrypt.compare(password, user.hashedPassword);
          needsPasswordMigration = isValidPassword;
        } catch (error) {
          console.error('Legacy bcrypt verification failed:', error);
        }
      }

      if (!isValidPassword) {
        securityLogger.logFailedAuth(ip, userAgent, `Invalid password for ${email}`, '/api/login');
        return res.status(401).json({
          error: "Invalid email or password"
        });
      }

      // Migrate legacy bcrypt password to Argon2id
      if (needsPasswordMigration) {
        try {
          console.log(`🔄 Migrating password for user ${email} from bcrypt to Argon2id`);
          const newHashedPassword = await hashPassword(password);
          await databaseStorage.updateUser(user.id, { hashedPassword: newHashedPassword });
          console.log(`✅ Password migration completed for user ${email}`);
        } catch (error) {
          console.error(`❌ Password migration failed for user ${email}:`, error);
          // Continue with login even if migration fails
        }
      }

      // Generate JWT token for logged-in user
      const token = generateJWT(user.id);

      // Remove password from response
      const { hashedPassword: _, ...userResponse } = user;
      res.json({
        user: userResponse,
        token
      });
    } catch (error) {
      console.error("Login error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Validate subscription token
  app.post("/api/users/validate-token", async (req: Request, res: Response) => {
    try {
      const token = req.headers['x-subscription-token'] as string;
      
      if (!token) {
        return res.status(400).json({ error: "Token is required" });
      }

      // Use the storage system to validate the token
      const { databaseStorage, storage } = await import("./storage");
      
      try {
        // Try to get token info from storage
        const tokenData = await storage.getToken(token);
        
        if (!tokenData) {
          return res.status(401).json({ error: "Invalid token" });
        }

        // Check if token is expired
        if (tokenData.expiresAt && new Date() > new Date(tokenData.expiresAt)) {
          return res.status(401).json({ error: "Token expired" });
        }

        // Token is valid
        res.json({ 
          valid: true, 
          userId: tokenData.userId,
          tierId: tokenData.tierId 
        });
      } catch (error) {
        console.error("Token validation error:", error);
        return res.status(401).json({ error: "Invalid token" });
      }
    } catch (error) {
      console.error("Validate token error:", error);
      res.status(500).json({ error: "Token validation failed" });
    }
  });

  // Get user profile
  app.get("/api/users/:id", async (req: Request, res: Response) => {
    try {
      const user = await databaseStorage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Remove password from response
      const { hashedPassword: _, ...userResponse } = user;
      res.json({ user: userResponse });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // Update user profile
  app.patch("/api/users/:id", async (req: Request, res: Response) => {
    try {
      const updates = insertUserSchema.partial().parse(req.body);

      const user = await databaseStorage.updateUser(req.params.id, updates);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Remove password from response
      const { hashedPassword: _, ...userResponse } = user;
      res.json({ user: userResponse });
    } catch (error) {
      console.error("Update user error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Get user subscription
  app.get("/api/users/:id/subscription", async (req: Request, res: Response) => {
    try {
      const subscription = await databaseStorage.getUserSubscription(req.params.id);
      if (!subscription) {
        return res.status(404).json({ error: "No subscription found" });
      }

      res.json({ subscription });
    } catch (error) {
      console.error("Get subscription error:", error);
      res.status(500).json({ error: "Failed to get subscription" });
    }
  });

  // Create user subscription
  app.post("/api/users/:id/subscription", async (req: Request, res: Response) => {
    try {
      const subscriptionData = subscriptionSchema.parse(req.body);

      const subscription = await databaseStorage.createUserSubscription({
        userId: req.params.id,
        ...subscriptionData,
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        cancelAtPeriodEnd: false,
      });

      res.status(201).json({ subscription });
    } catch (error) {
      console.error("Create subscription error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create subscription" });
    }
  });

  // Update user subscription
  app.patch("/api/users/:id/subscription/:subscriptionId", async (req: Request, res: Response) => {
    try {
      const updates = insertUserSubscriptionSchema.partial().parse(req.body);

      const subscription = await databaseStorage.updateUserSubscription(req.params.subscriptionId, updates);
      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      res.json({ subscription });
    } catch (error) {
      console.error("Update subscription error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update subscription" });
    }
  });

  // Cancel user subscription
  app.delete("/api/users/:id/subscription/:subscriptionId", async (req: Request, res: Response) => {
    try {
      const subscription = await databaseStorage.cancelUserSubscription(req.params.subscriptionId);
      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      res.json({ subscription });
    } catch (error) {
      console.error("Cancel subscription error:", error);
      res.status(500).json({ error: "Failed to cancel subscription" });
    }
  });

  // Get user usage
  app.get("/api/users/:id/usage", async (req: Request, res: Response) => {
    try {
      const period = req.query.period as string || new Date().toISOString().slice(0, 7); // YYYY-MM format

      const usage = await databaseStorage.getUserUsage(req.params.id, period);
      if (!usage) {
        return res.status(404).json({ error: "No usage data found" });
      }

      res.json({ usage });
    } catch (error) {
      console.error("Get usage error:", error);
      res.status(500).json({ error: "Failed to get usage data" });
    }
  });

  // Get user usage history
  app.get("/api/users/:id/usage/history", async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 12;

      const history = await databaseStorage.getUserUsageHistory(req.params.id, limit);
      res.json({ history });
    } catch (error) {
      console.error("Get usage history error:", error);
      res.status(500).json({ error: "Failed to get usage history" });
    }
  });

  // Track usage (for internal use)
  app.post("/api/users/:id/usage", async (req: Request, res: Response) => {
    try {
      const usageData = insertUsageRecordSchema.parse(req.body);

      const usage = await databaseStorage.createUsageRecord({
        ...usageData,
        userId: req.params.id, // Override userId from params
      });

      res.status(201).json({ usage });
    } catch (error) {
      console.error("Track usage error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      res.status(500).json({ error: "Failed to track usage" });
    }
  });
}