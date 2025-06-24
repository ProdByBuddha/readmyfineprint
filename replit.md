# ReadMyFinePrint - Advanced Legal Document Analysis Platform

## Overview

ReadMyFinePrint is a sophisticated web application that transforms complex legal documents into accessible, plain-English summaries using advanced AI analysis. The platform provides comprehensive document analysis with risk assessment, key findings extraction, and professional reporting capabilities.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with optimized production builds
- **UI Framework**: Radix UI components with Tailwind CSS
- **State Management**: TanStack Query for server state, React hooks for local state
- **Routing**: Wouter for lightweight client-side routing
- **Accessibility**: Comprehensive WCAG 2.1 AA compliance with custom accessibility hooks

### Backend Architecture
- **Runtime**: Node.js with TypeScript (ESM modules)
- **Framework**: Express.js with security-first middleware stack
- **Database**: PostgreSQL with Drizzle ORM for user and subscription management
- **Storage**: Session-based storage for documents with database storage for users
- **File Processing**: Secure file upload with magic number validation and comprehensive security scanning
- **AI Integration**: OpenAI GPT-4o for document analysis
- **Payment Processing**: Stripe integration with multiple payment methods
- **Authentication**: Bcrypt password hashing with secure user management

## Key Components

### Document Processing Engine
- **File Validation**: Multi-layer security validation with magic number verification
- **Text Extraction**: Support for PDF, DOCX, DOC, and plain text files using Mammoth.js and built-in parsers
- **Analysis Pipeline**: OpenAI-powered analysis with structured output for risk assessment
- **Session Management**: Secure session-based storage with automatic cleanup

### Security Layer
- **Authentication**: Admin API key system with timing-safe comparison
- **Rate Limiting**: IP-based rate limiting with user agent fingerprinting
- **Security Logging**: Comprehensive security event logging with severity classification
- **File Security**: Enhanced file validation with suspicious pattern detection
- **CORS**: Configurable CORS with environment-specific origins

### Payment System
- **Stripe Integration**: Complete payment processing with Express Checkout (Apple Pay, Google Pay, Link, PayPal)
- **Webhook Handling**: Secure webhook processing for payment confirmations
- **Email Notifications**: Automated thank-you emails via SMTP
- **Donation Features**: QR code generation for PDF exports

### Accessibility Features
- **Screen Reader Support**: Full ARIA implementation with semantic HTML
- **Keyboard Navigation**: Complete keyboard accessibility with focus management
- **Visual Accessibility**: High contrast support, reduced motion preferences
- **Mobile Optimization**: Touch-friendly interface with pull-to-refresh

## Data Flow

1. **Document Upload**: Client uploads file → Server validates → Extracts text → Stores in session
2. **Analysis Process**: Text sent to OpenAI API → Structured analysis returned → Results cached in session
3. **Result Display**: Analysis rendered with risk assessment → PDF export available with donation QR codes
4. **Session Management**: 30-minute session timeout → Automatic cleanup → No persistent storage
5. **User Management**: Registration/login → Secure password hashing → Subscription tracking → Usage monitoring
6. **Subscription Flow**: User selects tier → Stripe payment processing → Database subscription record → Usage limits enforced

## External Dependencies

### Core Services
- **OpenAI API**: GPT-4o model for document analysis (required)
- **Stripe**: Payment processing for donations (required for payments)

### Email Services (Optional)
- **SMTP Configuration**: iCloud (default), Gmail, or custom SMTP for donation thank-you emails
- **Nodemailer**: Email service abstraction layer

### Development Dependencies
- **ESLint**: Code quality with accessibility rules
- **TypeScript**: Type safety across frontend and backend
- **Tailwind CSS**: Utility-first styling with custom design system

## Deployment Strategy

### Production Configuration
- **Build Process**: Vite production build with asset optimization
- **Static Serving**: Express serves built React application
- **Environment Variables**: Comprehensive validation with startup checks
- **Security Headers**: X-Frame-Options, CSP, and other security headers
- **Error Handling**: Graceful error boundaries with user-friendly messages

### Replit Deployment
- **Modules**: Node.js 20, Web, PostgreSQL 16 (PostgreSQL for future enhancements)
- **Build Command**: `npm run build`
- **Start Command**: `npm run start`
- **Port Configuration**: Main app on port 80, development on 5000

### Environment Requirements
```bash
# Required
OPENAI_API_KEY=sk-your-openai-api-key
ADMIN_API_KEY=your-secure-admin-key (minimum 16 characters)

# Payment Processing (Optional)
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
VITE_STRIPE_PUBLIC_KEY=pk_test_your-stripe-publishable-key

# Email Service (Optional)
SMTP_USER=your-email@provider.com
SMTP_PASS=your-app-specific-password
SECURITY_EMAIL_FROM=your-email@provider.com
```

### Admin Access
- **Admin Interface**: `/admin` route with comprehensive dashboard
- **Authentication**: Two-factor system (Admin API key + email verification)
- **Verification Emails**: admin@readmyfineprint.com, prodbybuddha@icloud.com
- **Security**: Protected endpoints, rate limiting, comprehensive logging
- **Features**: User management, system health, security monitoring, analytics

## Recent Changes
- **June 24, 2025**: Consent enforcement and PostgreSQL conversion with sample contract exemption
  - Converted consent logging system from Replit key-value store to PostgreSQL
  - Added consent_records table with proper schema and indexing
  - Updated all consent verification methods to use database queries
  - Enhanced consent statistics with accurate SQL-based counting
  - Implemented selective consent enforcement:
    - Sample contracts fully accessible without consent (creation, viewing, analysis)
    - Document viewing, creation, and deletion allowed without consent for all documents
    - Queue status checking allowed without consent
    - Document analysis requires consent only for non-sample documents
    - File uploads require consent (personal document processing)
  - Fixed frontend-backend consent synchronization:
    - Frontend now verifies localStorage consent against database
    - Consent modal triggers before analysis, not after API rejection
    - Automatic analysis continuation after consent acceptance
  - Admin endpoints remain exempt from all consent requirements
  - Improved performance and reliability with structured database storage

- **June 24, 2025**: Complete admin interface implementation
  - Built comprehensive admin dashboard with overview metrics, system health monitoring
  - Created user management interface with search, filtering, and user modification capabilities
  - Implemented security events viewer with real-time filtering by severity and timeframe
  - Added subscription and usage analytics with revenue tracking
  - Enhanced database schema with admin user support (email_verified, is_active, is_admin, last_login_at)
  - Created admin account: admin@readmyfineprint.com with full administrative privileges
  - Admin dashboard accessible at `/admin` route with secure authentication

- **June 21, 2025**: Enhanced Google structured data and SEO optimization
  - Added comprehensive structured data schemas (Organization, SoftwareApplication, WebSite, Service, HowTo, FAQ, Product)
  - Enhanced meta tags with Google-specific optimization directives
  - Updated sitemap.xml with current dates
  - Implemented multi-schema JSON-LD for rich search results
  - Added FAQ structured data for common legal document analysis questions
  - Enhanced robots.txt with proper crawl directives for search engines and AI bots

- **June 19, 2025**: Security hardening and environment-conditional features completed
  - Blocked access to sensitive files (.env, package.json, source code)
  - Enhanced payment endpoint validation with Zod schemas
  - Implemented comprehensive security headers
  - Added security logging for blocked access attempts
  - Addressed all critical OWASP ZAP vulnerabilities
  - Updated subscription management to show "coming soon" toast for production deployment

## Changelog
- June 13, 2025. Initial setup
- June 19, 2025. Security hardening and OWASP ZAP vulnerability fixes

## User Preferences

Preferred communication style: Simple, everyday language.