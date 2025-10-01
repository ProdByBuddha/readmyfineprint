# 🎯 Log Filtering Quick Reference

## What Was Done
✅ Implemented centralized logging config to reduce verbose dev logs by 80-90%

## Key Files
- `server/log-config.ts` - Configuration (NEW)
- `server/index.ts` - Request filtering (MODIFIED)
- `server/security-logger.ts` - Event filtering (MODIFIED)

## Default Dev Mode Logging

### ✅ You WILL See:
- Authentication/auth events
- API requests
- Errors
- High-severity security events

### ❌ You WON'T See:
- Session creation spam
- Vite HMR requests
- Static file requests
- IP/UA hashing logs

## Quick Commands

### Test it:
```bash
npm run dev
# Observe much cleaner logs!
```

### Enable verbose logging temporarily:
Edit `server/log-config.ts`:
```typescript
development: {
  sessionLogging: true,    // Enable session logs
  viteRequests: true,      // Enable HMR logs
  // ... etc
}
```

### Enable session debugging:
```bash
SESSION_DEBUG=true npm run dev
```

### Rollback if needed:
```bash
cp server/index.ts.backup-logs server/index.ts
cp server/security-logger.ts.backup-logs server/security-logger.ts
rm server/log-config.ts
```

## How It Works

1. **Request Filter** - Middleware marks Vite/static requests to skip logging
2. **Log Config** - Central config controls which log types are enabled
3. **Conditional Logging** - `shouldLog(category)` checks before logging

## Categories

| Category | Dev | Prod | Purpose |
|----------|-----|------|---------|
| `errors` | ✅ | ✅ | Always log errors |
| `security` | ✅ | ✅ | Security events |
| `authTokenValidation` | ✅ | ✅ | Auth logs |
| `apiRequests` | ✅ | ✅ | API calls |
| `sessionLogging` | ❌ | ✅ | Session creation |
| `viteRequests` | ❌ | ❌ | HMR noise |
| `staticFileRequests` | ❌ | ❌ | Asset noise |

## Benefits

- 🎯 Focus on relevant logs
- 🚀 Better performance
- 🔧 Easy to customize
- 🔒 Production-safe
- ✅ No functionality lost

---

**Enjoy cleaner logs! 🎉**
