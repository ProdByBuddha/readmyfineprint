# Security Tools Setup Guide

This guide helps you set up the complete security testing suite for ReadMyFinePrint.

## Quick Setup

```bash
# Install all security tools
npm run security:setup
```

## Manual Installation

### 1. Semgrep (Static Analysis)
```bash
# Install Semgrep
npm install -g @semgrep/cli

# Verify installation
semgrep --version

# Run scan
semgrep --config=auto .
```

### 2. OWASP ZAP (Web App Security)
```bash
# Download ZAP (requires Java 17+)
curl -L -o zap.tar.gz https://github.com/zaproxy/zaproxy/releases/latest/download/ZAP_WEEKLY_Linux.tar.gz
tar -xzf zap.tar.gz

# Start ZAP daemon
./ZAP_*/zap.sh -daemon -port 8080

# Or use Docker
docker run -p 8080:8080 zaproxy/zap-stable zap.sh -daemon -host 0.0.0.0 -port 8080
```

### 3. Nuclei (Infrastructure Scanner)
```bash
# Download Nuclei
curl -L -o nuclei.zip https://github.com/projectdiscovery/nuclei/releases/latest/download/nuclei_linux_amd64.zip
unzip nuclei.zip && chmod +x nuclei

# Verify installation
./nuclei -version

# Run scan
./nuclei -u http://localhost:5000
```

### 4. Snyk (Dependency Scanner)
```bash
# Install Snyk
npm install -g snyk

# Authenticate (requires account)
snyk auth

# Run scan
snyk test
```

## Configuration

### Environment Variables
Add to your `.env` file:
```bash
# Security tool configuration
ZAP_TARGET_URL=http://localhost:5173
ZAP_PORT=8080
ZAP_API_KEY=your-zap-api-key

NUCLEI_TARGET_URL=http://localhost:5000

SECURITY_WEBHOOK_URL=https://your-monitoring-service.com/webhook
```

### GitHub Secrets (for CI/CD)
Add these secrets to your GitHub repository:

1. Go to Settings > Secrets and variables > Actions
2. Add the following secrets:

```bash
SNYK_TOKEN=your-snyk-api-token
SEMGREP_APP_TOKEN=your-semgrep-token
SECURITY_WEBHOOK_URL=your-monitoring-webhook
```

## Running Security Scans

### Comprehensive Scan
```bash
npm run security:scan
```

### Individual Tools
```bash
# Static analysis
npm run security:semgrep

# Dependency scan
npm run security:snyk

# Infrastructure scan
npm run security:nuclei

# Web app scan (requires ZAP running)
npm run security:zap
```

## CI/CD Integration

The security pipeline runs automatically on:
- Pull requests to main branch
- Daily at 2 AM UTC
- Manual workflow dispatch

### Workflow Features
- Parallel security tool execution
- SARIF report upload to GitHub Security
- Security summary in PR comments
- Artifact storage for 30 days

## Troubleshooting

### Common Issues

**Semgrep: "No rules found"**
```bash
# Update Semgrep rules
semgrep --update
```

**ZAP: "Connection refused"**
```bash
# Check if ZAP is running
curl http://localhost:8080/JSON/core/view/version/
```

**Nuclei: "No templates found"**
```bash
# Update templates
./nuclei -update-templates
```

**Snyk: "Authentication required"**
```bash
# Login to Snyk
snyk auth
```

### Performance Optimization

**Large Codebase Scanning**
```bash
# Exclude node_modules and build files
echo "node_modules/" >> .semgrepignore
echo "dist/" >> .semgrepignore
```

**Faster Nuclei Scans**
```bash
# Use specific severity levels
./nuclei -u target -severity critical,high
```

## Security Tool Comparison

| Tool | Type | Speed | Coverage | Setup |
|------|------|-------|----------|-------|
| Semgrep | SAST | Fast | Code | Easy |
| ZAP | DAST | Slow | Web App | Medium |
| Nuclei | DAST | Medium | Infrastructure | Easy |
| Snyk | SCA | Fast | Dependencies | Easy |

## Best Practices

1. **Run scans regularly**: Daily automated scans
2. **Fix high-severity issues first**: Prioritize by CVSS score
3. **Review false positives**: Use ignore files appropriately
4. **Monitor trends**: Track vulnerability counts over time
5. **Integrate with workflow**: Make security part of development

## Support

- Documentation: [Security Policy](.github/SECURITY.md)
- Issues: [GitHub Issues](https://github.com/your-repo/issues)
- Security: security@readmyfineprint.com