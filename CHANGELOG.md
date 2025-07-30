# Changelog

## [1.5.0] - 2025-07-30

### ✨ Features

- security: implement deny-by-default CSP with default-src 'none' (af1f24e)
- feat: implement automated git-based versioning system (eeede29)

### 🐛 Bug Fixes

- Fix JWT token salt consistency for existing tokens (b18aaa7)
- Debug JWT token validation with detailed logging (5a51699)
- Fix cookie parsing in Replit staging environment (b890555)
- fix: optimize Deploy Staging workflow to prevent server conflicts (66449c0)
- fix: improve Content Security Policy to remove unsafe directives (8c3b52e)

## [1.1.0] - 2025-07-29

### ✨ Features

- Implement complete CI/CD pipeline with staging support and fix TypeScript errors (1209dac)
- Add new Bash commands to settings.local.json for improved script execution (29dbd2c)
- Implement device fingerprint backup and enhance consent management (fbac9f5)

