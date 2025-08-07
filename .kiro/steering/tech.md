# Technology Stack & Build System

## Frontend Stack
- **Framework**: Next.js 15.4.5 (App Router)
- **Language**: TypeScript 5.8.3
- **Styling**: Tailwind CSS 4.1.11 with shadcn/ui components
- **UI Library**: Radix UI primitives with custom theming
- **State Management**: React Query (@tanstack/react-query)
- **Forms**: React Hook Form with Zod validation

## Backend Stack
- **Runtime**: Node.js with Express 5.1.0
- **Language**: TypeScript (ESNext modules)
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT with JOSE, Argon2 password hashing
- **File Processing**: Multer, PDF parsing, document analysis
- **AI Integration**: OpenAI GPT-4o with privacy protection

## Security & Privacy
- **PII Detection**: Custom enhanced detection with local LLM fallback
- **Encryption**: Hybrid crypto service with tweetnacl
- **Rate Limiting**: Express rate limit with IP-based throttling
- **CSRF Protection**: Custom token-based protection
- **Session Management**: Distributed session storage with PostgreSQL

## Payment & Subscriptions
- **Payment Processing**: Stripe integration
- **Subscription Management**: Custom tier system with usage tracking
- **Email**: SendGrid for transactional emails

## Development Tools
- **Build System**: Next.js with custom webpack configuration
- **Type Checking**: TypeScript with strict mode
- **Linting**: ESLint with React and accessibility plugins
- **Package Manager**: npm with package-lock.json
- **Process Management**: Concurrently for dev server coordination

## Common Commands

### Development
```bash
npm run dev                    # Start development servers (frontend + backend)
npm run dev:staging           # Start in staging mode
npm run dev:with-llm          # Start with local LLM server
```

### Building & Deployment
```bash
npm run build                 # Build for production
npm run build:staging         # Build for staging
npm run start                 # Start production server
npm run start:staging         # Start staging server
```

### Database Operations
```bash
npm run db:setup-local        # Setup local database
npm run db:migrate            # Run database migrations
npm run db:status             # Check database status
```

### Testing & Validation
```bash
npm run lint                  # Run ESLint
npm run check                 # TypeScript type checking
npm run test                  # Run Jest tests
npm run validate:all          # Full validation pipeline
npm run security:verify       # Security validation
```

### Monitoring & Health
```bash
npm run monitor               # Production monitoring
npm run monitor:continuous    # Continuous monitoring
```

## Environment Configuration
- **Development**: Uses local PostgreSQL or Neon database
- **Staging**: APP_ENV=staging with separate database
- **Production**: Full security headers and rate limiting
- **Replit**: Special handling for Replit deployment environment