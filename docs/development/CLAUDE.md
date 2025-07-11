# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ReadMyFinePrint is a full-stack legal document analysis web application that uses AI to transform complex legal documents into accessible summaries. The application consists of a React frontend with Vite, a Node.js/Express backend, and uses OpenAI GPT-4o for document analysis.

## Architecture

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui components
- **Backend**: Node.js + Express + TypeScript (ESM modules)
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI GPT-4o for document analysis
- **Payments**: Stripe integration
- **Routing**: Uses Wouter for client-side routing
- **State**: TanStack Query for server state management

## Directory Structure

```
client/           # React frontend application
├── src/
│   ├── components/  # UI components using shadcn/ui and Radix
│   ├── pages/      # Page components
│   ├── hooks/      # Custom React hooks
│   ├── lib/        # API functions and utilities
│   └── utils/      # Helper functions
server/           # Express backend
├── index.ts      # Main server entry point
├── routes.ts     # API route definitions
├── auth.ts       # Authentication middleware
├── openai.ts     # OpenAI integration
└── db.ts         # Database configuration
shared/           # Shared TypeScript types and Zod schemas
scripts/          # Utility scripts (SEO, security, subscriptions)
```

## Common Commands

### Development
```bash
npm run dev          # Start development server
npm run check        # TypeScript type checking
```

### Production
```bash
npm run build        # Production build (includes SEO sitemap update)
npm run start        # Start production server
```

### Code Quality
```bash
npm run lint         # ESLint with auto-fix
npm run lint:check   # ESLint check only
npm run a11y:test    # Run accessibility tests
npm run security:verify  # Run security verification
```

### Features
```bash
npm run seo:update      # Update sitemap
npm run indexnow:submit # Submit URLs to IndexNow API
npm run subscription:init  # Initialize subscription tiers
npm run tokens:test     # Test token storage system
npm run tokens:test-multidevice  # Test multi-device support
npx tsx scripts/sync-stripe-customer-ids.ts    # Sync Stripe customer IDs to users table
npx tsx scripts/verify-stripe-consistency.ts   # Verify Stripe data consistency
npx tsx scripts/test-stripe-sync.ts            # Test Stripe sync functionality
npm run blog:setup      # Initialize blog database and seed topics
npm run llm:setup       # Set up local LLM for PII detection
npm run llm:start       # Start local LLM server
npm run dev:with-llm    # Start both LLM server and development server
```

## Key Technical Details

### Security Features
- Comprehensive security headers and CORS configuration
- Rate limiting with IP-based throttling
- File validation with magic number verification
- Session-based document storage with automatic cleanup

### Accessibility
- WCAG 2.1 AA compliance with comprehensive ESLint rules
- Full keyboard navigation and screen reader support
- Uses `@axe-core/react` for runtime accessibility testing

### Component System
- Uses shadcn/ui components (New York style) with Radix UI primitives
- Tailwind CSS with custom design system
- Framer Motion for animations

### Database & API
- Drizzle ORM with PostgreSQL
- RESTful API design with Express
- Zod schemas for type-safe validation
- JWT-based authentication
- Automatic Stripe customer ID synchronization between users and subscriptions tables

### Document Processing
- Supports PDF, DOCX, DOC, TXT formats
- Uses OpenAI GPT-4o for analysis (requires OPENAI_API_KEY)
- Session-based storage (documents not persisted permanently)

### Auto-Blogging SEO System
- AI-powered content generation using OpenAI GPT-4o
- Automated blog posting with configurable schedules
- Topic management with similarity detection to avoid duplicate content
- SEO optimization with meta tags, structured data, and keyword targeting
- Content categories: contract law, employment law, intellectual property, business law
- Admin interface for blog management and analytics
- Automatic sitemap updates and IndexNow submissions

## Environment Variables Required

```bash
OPENAI_API_KEY=         # Required for document analysis and blog generation
STRIPE_SECRET_KEY=      # Required for payments
STRIPE_PUBLISHABLE_KEY= # Required for payments
ADMIN_API_KEY=          # Required for admin operations

# Blog Configuration (Optional)
BLOG_SCHEDULER_ENABLED=true    # Enable automated blog posting
BLOG_POSTS_PER_DAY=3           # Number of posts to generate per day
BLOG_POST_HOURS=9,13,17        # Hours to post (24h format, comma-separated)
MIN_HOURS_BETWEEN_POSTS=4      # Minimum hours between posts
```

## Testing Notes

The project currently uses:
- ESLint with accessibility rules for code quality
- TypeScript for compile-time validation
- Custom security and accessibility test scripts
- No formal unit testing framework (Jest/Vitest) is configured

## Development Notes

- The application is optimized for Replit deployment but can run anywhere
- Uses ESM modules throughout (type: "module" in package.json)
- Security-first approach with comprehensive middleware
- SEO-optimized with structured data and automatic sitemap generation
- Payment processing includes Express Checkout (Apple Pay, Google Pay)