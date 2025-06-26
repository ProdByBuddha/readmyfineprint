# Database Fallback System

This document explains the automatic database fallback system that allows the application to switch between Neon (cloud) and local PostgreSQL databases.

## Overview

When the Neon database is unavailable (e.g., due to billing issues, endpoint disabled), the system automatically falls back to a local PostgreSQL database, ensuring continuous development and operation.

## Features

- **Automatic Detection**: Detects when Neon database is disabled
- **Seamless Fallback**: Automatically switches to local PostgreSQL
- **Health Monitoring**: Regular health checks with automatic reconnection attempts
- **Schema Mirroring**: Local database uses exact same schema as production
- **Zero Code Changes**: Application code remains unchanged

## Setup Instructions

### 1. Install PostgreSQL Locally

**macOS:**
```bash
brew install postgresql
brew services start postgresql
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download and install from [PostgreSQL official site](https://www.postgresql.org/download/windows/)

**Docker:**
```bash
docker run -d \
  --name postgres \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  postgres:latest
```

### 2. Create Local Database

Run the setup script:
```bash
npm run db:setup-local
```

This script will:
- Create the `readmyfineprint` database
- Set up all tables with proper schema
- Create indexes for performance
- Initialize the collective free tier user

### 3. Configure Environment (Optional)

The system works automatically in development mode. For custom configuration:

```bash
# .env.local
LOCAL_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/readmyfineprint
USE_DB_FALLBACK=true  # Force fallback mode even in production
```

## How It Works

1. **Initial Connection**: System tries Neon database first
2. **Health Check**: Runs `SELECT 1` query to verify connection
3. **Error Detection**: Detects "endpoint is disabled" errors
4. **Automatic Fallback**: Switches to local PostgreSQL
5. **Retry Logic**: Attempts to reconnect to Neon every 5 minutes

## Database Status

Check current database status:
```bash
npm run db:status
```

Output shows:
- Current database (Neon or Local PostgreSQL)
- Connection health
- Table statistics
- Server information

## Monitoring

The system logs database switches:
```
✅ Using Neon database
⚠️ Neon database health check failed, switching to local fallback...
🔄 Switched to local PostgreSQL database
🔄 Attempting to reconnect to Neon database...
```

## Troubleshooting

### Local PostgreSQL Not Connecting

1. **Check if PostgreSQL is running:**
   ```bash
   # macOS
   brew services list | grep postgresql
   
   # Linux
   sudo systemctl status postgresql
   
   # Docker
   docker ps | grep postgres
   ```

2. **Verify connection:**
   ```bash
   psql -U postgres -h localhost -p 5432 -d readmyfineprint
   ```

3. **Check logs:**
   - macOS: `/usr/local/var/log/postgresql@14.log`
   - Linux: `/var/log/postgresql/`
   - Docker: `docker logs postgres`

### Database Not Created

If the setup script fails:
```bash
# Create manually
psql -U postgres -c "CREATE DATABASE readmyfineprint;"

# Then run setup again
npm run db:setup-local
```

### Permission Issues

```bash
# Grant permissions
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE readmyfineprint TO postgres;"
```

## Development Workflow

1. **Start PostgreSQL** (if not running as service)
2. **Run application** - fallback activates automatically
3. **Monitor status** - check logs for database switches
4. **Test features** - everything works with local database

## Production Considerations

- **Backup Data**: Local database is for development/emergency use
- **Sync Strategy**: Data in local DB won't sync with Neon
- **Security**: Local DB uses default credentials (change for production)
- **Performance**: Local DB may be faster for development

## Advanced Configuration

### Custom Health Check Interval
```typescript
// In db-with-fallback.ts
const HEALTH_CHECK_INTERVAL = 60000; // Default: 1 minute
```

### Disable Automatic Fallback
```bash
USE_DB_FALLBACK=false npm run dev
```

### Force Local Database
```bash
DATABASE_URL="" LOCAL_DATABASE_URL="postgresql://..." npm run dev
```

## API Differences

None! The fallback system is transparent to application code. All Drizzle ORM operations work identically with both databases.

## Best Practices

1. **Regular Backups**: Backup local database if used for important data
2. **Schema Sync**: Run setup script after schema changes
3. **Monitor Logs**: Watch for fallback activations in production
4. **Test Both**: Ensure features work with both databases
5. **Document Issues**: Note any Neon-specific features used

## Emergency Procedures

If Neon is disabled in production:

1. **Immediate**: System auto-switches to local PostgreSQL
2. **Verify**: Run `npm run db:status` to confirm
3. **Monitor**: Check application logs for issues
4. **Resolve**: Address Neon billing/configuration
5. **Restore**: System auto-reconnects when Neon is available

## Related Commands

```bash
npm run db:setup-local    # Set up local PostgreSQL database
npm run db:status         # Check current database status
npm run dev              # Start with automatic fallback
```

## Support

For database-related issues:
1. Check this documentation
2. Review application logs
3. Run status check script
4. Verify PostgreSQL installation
5. Check environment variables