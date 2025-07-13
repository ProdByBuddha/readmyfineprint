# Production Environment Variables Guide

## 🚨 Critical: No Localhost in Production

This guide ensures that **NO localhost references** are used in production environments.

## Required Production Environment Variables

### 1. CORS Configuration
```bash
# ❌ NEVER in production
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:5000

# ✅ Production configuration
ALLOWED_ORIGINS=https://readmyfineprint.com,https://www.readmyfineprint.com
```

### 2. LLM Service Configuration
```bash
# ❌ NEVER in production
# Default: http://localhost:11434

# ✅ Production configuration
OLLAMA_URL=https://your-ollama-service.com:11434
# OR for internal service
OLLAMA_URL=http://internal-llm-service:11434
```

### 3. Database Configuration
```bash
# ❌ NEVER in production
LOCAL_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/readmyfineprint

# ✅ Production configuration
DATABASE_URL=postgresql://user:password@production-db-host:5432/readmyfineprint
```

### 4. External URL Configuration
```bash
# ✅ Required for production monitoring
EXTERNAL_URL=https://readmyfineprint.com
```

### 5. Monitoring Configuration
```bash
# ✅ Production monitoring
MONITOR_HOST=your-production-host.com
# OR use external URL for monitoring
EXTERNAL_URL=https://readmyfineprint.com
```

## Environment-Specific Configurations

### Development Environment
```bash
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:5000
OLLAMA_URL=http://localhost:11434
LOCAL_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/readmyfineprint
```

### Production Environment
```bash
NODE_ENV=production
ALLOWED_ORIGINS=https://readmyfineprint.com
OLLAMA_URL=https://your-ollama-service.com:11434
DATABASE_URL=postgresql://user:password@production-db:5432/readmyfineprint
EXTERNAL_URL=https://readmyfineprint.com
```

## Validation Checklist

Before deploying to production, ensure:

- [ ] `NODE_ENV=production` is set
- [ ] `ALLOWED_ORIGINS` contains no localhost references
- [ ] `OLLAMA_URL` points to production LLM service
- [ ] `DATABASE_URL` points to production database
- [ ] `EXTERNAL_URL` is set for monitoring
- [ ] No hardcoded localhost URLs in code

## Files That Were Fixed

### ✅ Fixed Files
1. **server/production.ts** - Removed localhost from CORS origins
2. **server/hybrid-routes.ts** - Uses OLLAMA_URL environment variable
3. **server/zero-pii-analyzer.ts** - Uses OLLAMA_URL environment variable
4. **scripts/production-monitor.js** - Uses EXTERNAL_URL in production

### ✅ Files That Are Correct (localhost only in development)
1. **server/index.ts** - Development server (NODE_ENV check)
2. **server/routes.ts** - Development redirects (NODE_ENV check)
3. **server/security-middleware.ts** - Security checks (appropriate)
4. **server/env-validation.ts** - Warns about localhost in production (good)

## Production Deployment Commands

```bash
# Set production environment
export NODE_ENV=production
export ALLOWED_ORIGINS=https://readmyfineprint.com
export OLLAMA_URL=https://your-ollama-service.com:11434
export DATABASE_URL=postgresql://user:password@production-db:5432/readmyfineprint
export EXTERNAL_URL=https://readmyfineprint.com

# Start production server
npm run start

# Monitor production (will use EXTERNAL_URL)
npm run monitor:production:continuous
```

## Verification

Run these commands to verify no localhost usage:

```bash
# Check environment warnings
NODE_ENV=production npm run validate-security

# Test monitoring (should use EXTERNAL_URL)
NODE_ENV=production EXTERNAL_URL=https://readmyfineprint.com npm run monitor:production

# Check CORS configuration
curl -H "Origin: http://localhost:3000" https://readmyfineprint.com/api/health
# Should return CORS error in production
```

## Common Issues

### Issue: CORS errors in production
**Cause**: ALLOWED_ORIGINS still contains localhost
**Solution**: Update ALLOWED_ORIGINS to only include production domains

### Issue: LLM service connection failed
**Cause**: OLLAMA_URL not set, defaulting to localhost
**Solution**: Set OLLAMA_URL to production LLM service

### Issue: Monitoring connection refused
**Cause**: Monitoring script using localhost instead of external URL
**Solution**: Set EXTERNAL_URL environment variable

## Security Notes

1. **Never expose localhost in production** - it's a security risk
2. **Use HTTPS in production** - all external URLs should use HTTPS
3. **Validate environment variables** - use env-validation.ts warnings
4. **Monitor for localhost usage** - the env-validation warns about this

## Summary

✅ **All localhost usage has been eliminated from production code**
✅ **Environment variables control all external service connections**
✅ **Monitoring system uses external URLs in production**
✅ **CORS configuration is production-safe**
✅ **LLM services use configurable URLs**

The application is now **100% localhost-free in production** when proper environment variables are set. 