# Project Structure & Organization

## Root Directory Layout
```
readmyfineprint/
├── app/                    # Next.js App Router pages and layouts
├── components/             # Reusable React components
├── server/                 # Express.js backend services
├── shared/                 # Shared types and schemas
├── lib/                    # Frontend utilities and helpers
├── hooks/                  # Custom React hooks
├── contexts/               # React context providers
├── styles/                 # Global CSS and theme files
├── scripts/                # Database migrations and utilities
├── docs/                   # Documentation and compliance
└── types/                  # TypeScript type definitions
```

## Frontend Architecture (Next.js App Router)

### App Directory Structure
- `app/layout.tsx` - Root layout with theme provider and global components
- `app/page.tsx` - Homepage
- `app/*/page.tsx` - Route-specific pages
- `app/globals.css` - Global styles and CSS variables

### Component Organization
- `components/` - All React components (flat structure)
- `components/ui/` - shadcn/ui base components
- `components/providers/` - Context providers and wrappers

### Utilities & Hooks
- `lib/` - Frontend utilities (API client, session management, etc.)
- `hooks/` - Custom React hooks for reusable logic
- `contexts/` - React context definitions

## Backend Architecture (Express.js)

### Server Directory Structure
- `server/index.ts` - Main server entry point with middleware setup
- `server/routes.ts` - Route registration and API endpoint definitions
- `server/auth.ts` - Authentication and authorization logic
- `server/db.ts` - Database connection and configuration
- `server/*-service.ts` - Business logic services
- `server/*-routes.ts` - Route handlers for specific features

### Key Backend Services
- **Authentication**: JWT, session management, 2FA
- **Database**: PostgreSQL with Drizzle ORM
- **Security**: PII detection, encryption, rate limiting
- **Subscriptions**: Stripe integration and tier management
- **Document Processing**: File upload, analysis, AI integration

## Database Schema (shared/schema.ts)
- **Users & Authentication**: User accounts, sessions, 2FA
- **Subscriptions**: Tiers, usage tracking, payments
- **Security**: PII storage, audit logs, permissions
- **Content**: Documents, blog posts, mailing lists

## Configuration Files
- `package.json` - Dependencies and npm scripts
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `components.json` - shadcn/ui configuration
- `next.config.js` - Next.js build configuration

## Development Scripts Location
- `scripts/` - Database setup, migrations, testing utilities
- `scripts/setup-*.ts` - Environment setup scripts
- `scripts/test-*.ts` - Testing and validation scripts
- `scripts/add-*.ts` - Database migration scripts

## Documentation Structure
- `docs/` - Technical documentation
- `docs/compliance/` - Legal and compliance documentation
- `docs/security/` - Security policies and procedures
- `docs/development/` - Development guides and setup

## Naming Conventions
- **Files**: kebab-case for components, camelCase for utilities
- **Components**: PascalCase React components
- **Services**: camelCase with descriptive suffixes (-service, -routes)
- **Database**: snake_case for table and column names
- **Types**: PascalCase interfaces, camelCase for type aliases

## Import Patterns
- Use relative imports within the same directory level
- Use absolute imports with `@/` prefix for cross-directory imports
- Shared types imported from `@shared/` alias
- UI components imported from `@/components/ui/`

## Security Considerations
- All sensitive files are in `.gitignore`
- Environment variables in `.env` (not committed)
- Database credentials and API keys stored securely
- PII handling follows strict privacy protocols