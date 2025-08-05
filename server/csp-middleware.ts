/**
 * Content Security Policy Middleware
 * 
 * Implements secure CSP headers with nonce support to eliminate
 * the need for 'unsafe-inline' and 'unsafe-eval' directives.
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

// Generate a cryptographically secure nonce
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

// Extend Express Request interface to include nonce
declare global {
  namespace Express {
    interface Request {
      nonce?: string;
    }
  }
}

export function cspMiddleware(req: Request, res: Response, next: NextFunction) {
  // Generate nonce for inline styles
  const nonce = Math.random().toString(36).substring(2, 15);
  res.locals.nonce = nonce;

  // Only apply CSP in production and staging environments
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  // Environment-specific configuration
  const nodeEnv = process.env.NODE_ENV as string | undefined;
  const isDevelopment = nodeEnv === 'development';
  const isProduction = nodeEnv === 'production';
  const isStaging = nodeEnv !== 'development' && nodeEnv !== 'production'; // Any other environment is considered staging

  // Development sources (only in development)
  const replitSources = isDevelopment ? ' https://replit.com https://*.replit.com' : '';
  const devSources = isDevelopment ? ' localhost:* 127.0.0.1:*' : '';

  // Staging sources (only in staging)
  const stagingSources = isStaging ? ' https://*.staging.readmyfineprint.com' : '';

  // Build secure CSP with deny-by-default approach
  const cspDirectives = [
    "default-src 'none'",

    // Scripts: Use nonce instead of unsafe-inline, add unsafe-eval for webpack in dev
    `script-src 'self' 'nonce-${nonce}' https://js.stripe.com https://m.stripe.com${replitSources}${devSources}${stagingSources}${isDevelopment ? " 'unsafe-eval'" : ''}`,

    // Script elements (for external scripts)
    `script-src-elem 'self' 'nonce-${nonce}' https://js.stripe.com https://m.stripe.com${replitSources}${devSources}${stagingSources}`,

    // Styles: Use nonce for inline styles, allow external fonts, and unsafe-inline for React DOM
    `style-src 'self' 'nonce-${nonce}' data: https://fonts.googleapis.com${replitSources}${devSources}${stagingSources}${isDevelopment ? " 'unsafe-inline'" : ''}`,

    // Style elements (for inline styles) - React DOM needs unsafe-inline in development
    `style-src-elem 'self' 'nonce-${nonce}' data: https://fonts.googleapis.com${replitSources}${devSources}${stagingSources}${isDevelopment ? " 'unsafe-inline'" : ''}`,

    // Images: Allow data URLs for icons, shield badges, and Stripe
    "img-src 'self' data: https://img.shields.io https://js.stripe.com https://*.stripe.com",

    // Fonts
    "font-src 'self' https://fonts.gstatic.com",

    // Connect sources for API calls
    `connect-src 'self' https://api.openai.com https://api.stripe.com https://js.stripe.com https://m.stripe.com${replitSources}${devSources}${stagingSources}`,

    // Frames for Stripe checkout
    "frame-src https://js.stripe.com https://hooks.stripe.com https://m.stripe.com https://checkout.stripe.com",

    // Media sources
    "media-src 'self'",

    // Objects: None allowed for security
    "object-src 'none'",

    // Base URI restriction
    "base-uri 'self'",

    // Form actions
    "form-action 'self' https://js.stripe.com https://api.stripe.com",

    // Frame ancestors (clickjacking protection)
    "frame-ancestors 'none'",

    // Worker sources
    "worker-src 'self'",

    // Manifest
    "manifest-src 'self'",

    // Upgrade insecure requests in production
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"])
  ];

  // Set the CSP header
  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

  // Also set Report-Only header for testing in development
  if (isDevelopment) {
    res.setHeader('Content-Security-Policy-Report-Only', cspDirectives.join('; '));
  }

  next();
}

// Helper function to add nonce to HTML templates
export function addNonceToHTML(html: string, nonce: string): string {
  // Add nonce to script tags
  html = html.replace(/<script(?![^>]*nonce=)/g, `<script nonce="${nonce}"`);

  // Add nonce to style tags
  html = html.replace(/<style(?![^>]*nonce=)/g, `<style nonce="${nonce}"`);

  return html;
}

// Enhanced CSP for API endpoints
export function apiCSPMiddleware(req: Request, res: Response, next: NextFunction) {
  const nonce = generateNonce();
  req.nonce = nonce;

  // Stricter CSP for API endpoints
  const cspDirectives = [
    "default-src 'none'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'"
  ];

  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
  next();
}