# 🔧 Environment Configuration Guide

This guide covers the required environment variables for secure operation of ReadMyFinePrint.

## ✨ **NEW: Automatic Environment Validation**

ReadMyFinePrint now includes **automatic environment validation** on startup! The server will:
- ✅ Validate all required environment variables
- ✅ Check API key formats
- ✅ Provide helpful error messages
- ✅ Show security warnings for production environments

## 🔑 Required Environment Variables

### **Critical (Required for Operation)**

```bash
# OpenAI API Configuration (REQUIRED)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Database Configuration (Provided by Replit)
REPLIT_DB_URL=https://kv.replit.com/v0/your-db-url

# Consent System Master Key (Generate a secure random string)
CONSENT_MASTER_KEY=your-very-secure-random-string-here
```

### **Security (Required for All Environments)**

```bash
# Admin API Key (REQUIRED - for accessing admin endpoints)
# Must be 16+ characters, used for /api/consent/stats, /api/security/stats
ADMIN_API_KEY=your-secure-admin-api-key-here

# CORS Origins (comma-separated list)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Node Environment
NODE_ENV=production
```

## 🛠️ Environment Setup Instructions

### **Development Environment**

1. **Create `.env` file** (DO NOT commit this):
```bash
# Create .env file and fill in your values:
cat > .env << 'EOF'
OPENAI_API_KEY=sk-your-development-key
CONSENT_MASTER_KEY=dev-master-key-123
ADMIN_API_KEY=dev-admin-key-456-minimum-16-chars
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
EOF
```

2. **Automatic Validation**: The server will now validate your environment on startup:
```bash
npm run dev
# You'll see output like:
# 🔍 Validating environment variables...
# ✅ OPENAI_API_KEY: sk-***
# ✅ ADMIN_API_KEY: dev-admin-key-456
# ✅ Environment validation passed
```

3. **Generate Secure Keys**:
```bash
# Generate a secure consent master key (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate a secure admin API key
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

### **Production Environment**

1. **Set Environment Variables** in your hosting platform:
   - Replit: Use the "Secrets" tab
   - Vercel: Project Settings > Environment Variables
   - Railway: Variables section
   - Render: Environment tab

2. **Security Checklist**:
   - ✅ Use strong, unique keys for all secrets
   - ✅ Set `NODE_ENV=production`
   - ✅ Configure proper CORS origins
   - ✅ Set up admin API key for stats access
   - ✅ Never commit `.env` files

## 🔐 Admin Authentication

**⚠️ REQUIRED**: Admin authentication is now enforced in ALL environments for security.

### **Accessing Admin Endpoints**

To access admin endpoints, include the admin key in headers:

```bash
# Example API call
curl -H "X-Admin-Key: your-admin-api-key" \
     https://yourdomain.com/api/consent/stats
```

### **Admin Endpoints Available**

- `GET /api/consent/stats` - View consent statistics
  - Requires: `X-Admin-Key` header
  - Returns: Total consents, unique users, daily stats

- `GET /api/security/stats` - View security statistics
  - Requires: `X-Admin-Key` header
  - Returns: Security events, failed auth attempts, rate limits

- `GET /api/security/events` - View recent security events
  - Requires: `X-Admin-Key` header
  - Returns: Recent security events (up to 1000)

## 🚨 Security Warnings

### **DO NOT**
- ❌ Commit `.env` files to version control
- ❌ Use weak or default keys in production
- ❌ Share admin API keys
- ❌ Log environment variables in production

### **DO**
- ✅ Use strong, random keys (32+ characters)
- ✅ Rotate keys regularly
- ✅ Use different keys for dev/staging/production
- ✅ Monitor admin endpoint access
- ✅ Set up proper CORS origins

## 🔄 Rate Limiting Configuration

Current rate limits (configurable in `server/index.ts`):

- **General API**: 100 requests per 15 minutes per IP
- **Document Processing**: 10 requests per minute per IP
- **File Upload**: 10 requests per minute per IP

To adjust limits, modify the rate limiting configuration in `server/index.ts`.

## 🔍 Security Headers

The following security headers are automatically added:

- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `X-XSS-Protection: 1; mode=block` - XSS protection
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` - Basic CSP rules

## 📞 Troubleshooting

### **API Key Issues**
```bash
# Test OpenAI API key
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/models
```

### **Database Connection**
```bash
# Test Replit DB connection
curl "$REPLIT_DB_URL/test"
```

### **Admin Access**
```bash
# Test admin authentication
curl -H "X-Admin-Key: $ADMIN_API_KEY" \
     http://localhost:5000/api/consent/stats
```

---

**⚠️ Security Reminder**: Keep all keys secure and rotate them regularly!
