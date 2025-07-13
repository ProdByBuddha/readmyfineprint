/**
 * User Preferences Routes
 * API endpoints for managing user preferences (theme, legal acceptance, etc.)
 */

import { Express, Request, Response } from 'express';
import { requireUserAuth } from './auth';
import { userPreferencesService } from './user-preferences-service';
import { securityLogger, SecurityEventType, SecuritySeverity, getClientInfo } from './security-logger';
import { z } from 'zod';

// Validation schemas
const themePreferenceSchema = z.object({
  theme: z.enum(['light', 'dark'])
});

const legalDisclaimerSchema = z.object({
  accepted: z.boolean()
});

const cookieConsentSchema = z.object({
  necessary: z.boolean().default(true),
  analytics: z.boolean().default(false),
  marketing: z.boolean().default(false)
});

const donationTrackingSchema = z.object({
  visited: z.boolean()
});

const deviceFingerprintSchema = z.object({
  fingerprint: z.string().min(1)
});

const bulkMigrationSchema = z.object({
  theme: z.enum(['light', 'dark']).optional(),
  legalDisclaimerAccepted: z.boolean().optional(),
  cookieConsent: z.object({
    necessary: z.boolean().default(true),
    analytics: z.boolean().default(false),
    marketing: z.boolean().default(false)
  }).optional(),
  donationPageVisited: z.boolean().optional(),
  deviceFingerprint: z.string().optional()
});

export function registerUserPreferencesRoutes(app: Express) {
  
  /**
   * Get user theme preference
   * GET /api/user/preferences/theme
   */
  app.get('/api/user/preferences/theme', requireUserAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { ip, userAgent } = getClientInfo(req);
      
      const theme = await userPreferencesService.getUserPreference(userId, 'theme');
      
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.USER_ACTIVITY,
        severity: SecuritySeverity.LOW,
        message: 'User retrieved theme preference',
        ip,
        userAgent,
        endpoint: '/api/user/preferences/theme',
        details: { userId, theme }
      });
      
      res.json({ theme: theme || 'light' });
    } catch (error) {
      console.error('Error getting theme preference:', error);
      res.status(500).json({ error: 'Failed to get theme preference' });
    }
  });

  /**
   * Set user theme preference
   * POST /api/user/preferences/theme
   */
  app.post('/api/user/preferences/theme', requireUserAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { ip, userAgent } = getClientInfo(req);
      
      const { theme } = themePreferenceSchema.parse(req.body);
      
      await userPreferencesService.setUserPreference(userId, 'theme', theme);
      
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.USER_ACTIVITY,
        severity: SecuritySeverity.LOW,
        message: 'User updated theme preference',
        ip,
        userAgent,
        endpoint: '/api/user/preferences/theme',
        details: { userId, theme }
      });
      
      res.json({ success: true, theme });
    } catch (error) {
      console.error('Error setting theme preference:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid theme preference', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to set theme preference' });
    }
  });

  /**
   * Get user legal disclaimer acceptance
   * GET /api/user/preferences/legal-disclaimer
   */
  app.get('/api/user/preferences/legal-disclaimer', requireUserAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { ip, userAgent } = getClientInfo(req);
      
      const accepted = await userPreferencesService.getUserPreference(userId, 'legal_disclaimer_accepted');
      
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.USER_ACTIVITY,
        severity: SecuritySeverity.LOW,
        message: 'User retrieved legal disclaimer preference',
        ip,
        userAgent,
        endpoint: '/api/user/preferences/legal-disclaimer',
        details: { userId, accepted }
      });
      
      res.json({ accepted: accepted || false });
    } catch (error) {
      console.error('Error getting legal disclaimer preference:', error);
      res.status(500).json({ error: 'Failed to get legal disclaimer preference' });
    }
  });

  /**
   * Set user legal disclaimer acceptance
   * POST /api/user/preferences/legal-disclaimer
   */
  app.post('/api/user/preferences/legal-disclaimer', requireUserAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { ip, userAgent } = getClientInfo(req);
      
      const { accepted } = legalDisclaimerSchema.parse(req.body);
      
      await userPreferencesService.setUserPreference(userId, 'legal_disclaimer_accepted', accepted);
      
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.USER_ACTIVITY,
        severity: SecuritySeverity.MEDIUM,
        message: 'User updated legal disclaimer acceptance',
        ip,
        userAgent,
        endpoint: '/api/user/preferences/legal-disclaimer',
        details: { userId, accepted }
      });
      
      res.json({ success: true, accepted });
    } catch (error) {
      console.error('Error setting legal disclaimer preference:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid legal disclaimer preference', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to set legal disclaimer preference' });
    }
  });

  /**
   * Get user cookie consent preferences
   * GET /api/user/preferences/cookie-consent
   */
  app.get('/api/user/preferences/cookie-consent', requireUserAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { ip, userAgent } = getClientInfo(req);
      
      const cookieConsent = await userPreferencesService.getUserPreference(userId, 'cookie_consent');
      
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.USER_ACTIVITY,
        severity: SecuritySeverity.LOW,
        message: 'User retrieved cookie consent preferences',
        ip,
        userAgent,
        endpoint: '/api/user/preferences/cookie-consent',
        details: { userId, cookieConsent }
      });
      
      res.json({ 
        cookieConsent: cookieConsent || { 
          necessary: true, 
          analytics: false, 
          marketing: false 
        } 
      });
    } catch (error) {
      console.error('Error getting cookie consent preference:', error);
      res.status(500).json({ error: 'Failed to get cookie consent preference' });
    }
  });

  /**
   * Set user cookie consent preferences
   * POST /api/user/preferences/cookie-consent
   */
  app.post('/api/user/preferences/cookie-consent', requireUserAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { ip, userAgent } = getClientInfo(req);
      
      const cookieConsent = cookieConsentSchema.parse(req.body);
      
      await userPreferencesService.setUserPreference(userId, 'cookie_consent', cookieConsent);
      
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.USER_ACTIVITY,
        severity: SecuritySeverity.MEDIUM,
        message: 'User updated cookie consent preferences',
        ip,
        userAgent,
        endpoint: '/api/user/preferences/cookie-consent',
        details: { userId, cookieConsent }
      });
      
      res.json({ success: true, cookieConsent });
    } catch (error) {
      console.error('Error setting cookie consent preference:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid cookie consent preference', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to set cookie consent preference' });
    }
  });

  /**
   * Get user donation page tracking
   * GET /api/user/preferences/donation-tracking
   */
  app.get('/api/user/preferences/donation-tracking', requireUserAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { ip, userAgent } = getClientInfo(req);
      
      const visited = await userPreferencesService.getUserPreference(userId, 'donation_page_visited');
      
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.USER_ACTIVITY,
        severity: SecuritySeverity.LOW,
        message: 'User retrieved donation tracking preference',
        ip,
        userAgent,
        endpoint: '/api/user/preferences/donation-tracking',
        details: { userId, visited }
      });
      
      res.json({ visited: visited || false });
    } catch (error) {
      console.error('Error getting donation tracking preference:', error);
      res.status(500).json({ error: 'Failed to get donation tracking preference' });
    }
  });

  /**
   * Set user donation page tracking
   * POST /api/user/preferences/donation-tracking
   */
  app.post('/api/user/preferences/donation-tracking', requireUserAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { ip, userAgent } = getClientInfo(req);
      
      const { visited } = donationTrackingSchema.parse(req.body);
      
      await userPreferencesService.setUserPreference(userId, 'donation_page_visited', visited);
      
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.USER_ACTIVITY,
        severity: SecuritySeverity.LOW,
        message: 'User updated donation tracking preference',
        ip,
        userAgent,
        endpoint: '/api/user/preferences/donation-tracking',
        details: { userId, visited }
      });
      
      res.json({ success: true, visited });
    } catch (error) {
      console.error('Error setting donation tracking preference:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid donation tracking preference', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to set donation tracking preference' });
    }
  });

  /**
   * Get all user preferences
   * GET /api/user/preferences
   */
  app.get('/api/user/preferences', requireUserAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { ip, userAgent } = getClientInfo(req);
      
      const preferences = await userPreferencesService.getAllUserPreferences(userId);
      
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.USER_ACTIVITY,
        severity: SecuritySeverity.LOW,
        message: 'User retrieved all preferences',
        ip,
        userAgent,
        endpoint: '/api/user/preferences',
        details: { userId, preferenceCount: Object.keys(preferences).length }
      });
      
      res.json({ preferences });
    } catch (error) {
      console.error('Error getting all preferences:', error);
      res.status(500).json({ error: 'Failed to get preferences' });
    }
  });

  /**
   * Bulk migrate localStorage preferences to database
   * POST /api/user/preferences/migrate
   */
  app.post('/api/user/preferences/migrate', requireUserAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { ip, userAgent } = getClientInfo(req);
      
      const localStorageData = bulkMigrationSchema.parse(req.body);
      
      await userPreferencesService.migrateFromLocalStorage(userId, localStorageData);
      
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.PREFERENCE_MIGRATION,
        severity: SecuritySeverity.LOW,
        message: 'User migrated localStorage preferences to database',
        ip,
        userAgent,
        endpoint: '/api/user/preferences/migrate',
        details: { userId, migratedKeys: Object.keys(localStorageData) }
      });
      
      res.json({ success: true, migratedKeys: Object.keys(localStorageData) });
    } catch (error) {
      console.error('Error migrating preferences:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid migration data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to migrate preferences' });
    }
  });

  /**
   * Delete specific user preference
   * DELETE /api/user/preferences/:key
   */
  app.delete('/api/user/preferences/:key', requireUserAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { key } = req.params;
      const { ip, userAgent } = getClientInfo(req);
      
      await userPreferencesService.deleteUserPreference(userId, key);
      
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.PREFERENCE_DELETED,
        severity: SecuritySeverity.LOW,
        message: 'User deleted preference',
        ip,
        userAgent,
        endpoint: `/api/user/preferences/${key}`,
        details: { userId, key }
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting preference:', error);
      res.status(500).json({ error: 'Failed to delete preference' });
    }
  });

  /**
   * Get user device fingerprint backup
   * GET /api/user/preferences/device-fingerprint
   */
  app.get('/api/user/preferences/device-fingerprint', requireUserAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { ip, userAgent } = getClientInfo(req);
      
      const fingerprint = await userPreferencesService.getUserPreference(userId, 'device_fingerprint_backup');
      
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.USER_ACTIVITY,
        severity: SecuritySeverity.LOW,
        message: 'User retrieved device fingerprint backup',
        ip,
        userAgent,
        endpoint: '/api/user/preferences/device-fingerprint',
        details: { userId, hasFingerprint: !!fingerprint }
      });
      
      res.json({ fingerprint: fingerprint || null });
    } catch (error) {
      console.error('Error getting device fingerprint backup:', error);
      res.status(500).json({ error: 'Failed to get device fingerprint backup' });
    }
  });

  /**
   * Set user device fingerprint backup
   * POST /api/user/preferences/device-fingerprint
   */
  app.post('/api/user/preferences/device-fingerprint', requireUserAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { ip, userAgent } = getClientInfo(req);
      
      const { fingerprint } = deviceFingerprintSchema.parse(req.body);
      
      await userPreferencesService.setUserPreference(userId, 'device_fingerprint_backup', fingerprint);
      
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.USER_ACTIVITY,
        severity: SecuritySeverity.LOW,
        message: 'User updated device fingerprint backup',
        ip,
        userAgent,
        endpoint: '/api/user/preferences/device-fingerprint',
        details: { userId, fingerprintLength: fingerprint.length }
      });
      
      res.json({ success: true, fingerprint });
    } catch (error) {
      console.error('Error setting device fingerprint backup:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid device fingerprint', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to set device fingerprint backup' });
    }
  });

  /**
   * Delete all user preferences
   * DELETE /api/user/preferences
   */
  app.delete('/api/user/preferences', requireUserAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { ip, userAgent } = getClientInfo(req);
      
      await userPreferencesService.deleteAllUserPreferences(userId);
      
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.PREFERENCE_DELETED,
        severity: SecuritySeverity.MEDIUM,
        message: 'User deleted all preferences',
        ip,
        userAgent,
        endpoint: '/api/user/preferences',
        details: { userId }
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting all preferences:', error);
      res.status(500).json({ error: 'Failed to delete all preferences' });
    }
  });
} 