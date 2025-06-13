#!/bin/bash

# Create public repository directory structure
mkdir -p ../readmyfineprint-public/client/src/components
mkdir -p ../readmyfineprint-public/client/src/hooks
mkdir -p ../readmyfineprint-public/client/src/lib
mkdir -p ../readmyfineprint-public/server
mkdir -p ../readmyfineprint-public/scripts

# Copy safe technical files
cp -r client/src/components/ui ../readmyfineprint-public/client/src/components/
cp -r client/src/hooks ../readmyfineprint-public/client/src/
cp -r client/src/lib ../readmyfineprint-public/client/src/
cp -r scripts ../readmyfineprint-public/

# Copy security architecture (without business logic)
cp server/security-logger.ts ../readmyfineprint-public/server/
cp server/enhanced-file-validation.ts ../readmyfineprint-public/server/
cp server/security-alert.ts ../readmyfineprint-public/server/
cp server/encrypted-storage.ts ../readmyfineprint-public/server/
cp server/env-validation.ts ../readmyfineprint-public/server/
cp server/auth.ts ../readmyfineprint-public/server/

# Copy accessibility implementations
cp client/src/components/SkipLinks.tsx ../readmyfineprint-public/client/src/components/
cp client/src/components/ErrorBoundary.tsx ../readmyfineprint-public/client/src/components/

# Copy documentation (safe versions)
cp ACCESSIBILITY.md ../readmyfineprint-public/
cp SECURITY_VERIFICATION_GUIDE.md ../readmyfineprint-public/
cp FILE_UPLOAD_SECURITY_ENHANCEMENTS.md ../readmyfineprint-public/
cp ENVIRONMENT_SETUP.md ../readmyfineprint-public/

# Copy configuration files
cp package.json ../readmyfineprint-public/
cp tsconfig.json ../readmyfineprint-public/
cp tailwind.config.ts ../readmyfineprint-public/
cp .eslintrc.json ../readmyfineprint-public/
cp components.json ../readmyfineprint-public/

# Copy the public-specific files
cp README-public.md ../readmyfineprint-public/README.md
cp .gitignore-public ../readmyfineprint-public/.gitignore

echo "Public repository created at ../readmyfineprint-public"
echo "Safe to push to GitHub for showcasing technical capabilities"
