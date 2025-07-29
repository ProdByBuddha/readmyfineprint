# Automated Versioning System

ReadMyFinePrint uses an automated versioning system that analyzes git commit history to intelligently increment version numbers based on [Semantic Versioning](https://semver.org/) and [Conventional Commits](https://conventionalcommits.org/).

## How It Works

The system analyzes your commit messages and automatically determines the appropriate version bump:

- **Major Version (x.0.0)**: Breaking changes that require updates to dependent code
- **Minor Version (x.y.0)**: New features that are backward compatible  
- **Patch Version (x.y.z)**: Bug fixes and small improvements

## Commit Message Patterns

### Major Version Bumps (Breaking Changes)
```bash
git commit -m "feat!: redesign authentication API endpoints"
git commit -m "fix!: change user data structure format" 
git commit -m "BREAKING CHANGE: remove deprecated payment methods"
git commit -m "major: restructure database schema"
```

### Minor Version Bumps (New Features)
```bash
git commit -m "feat: add user profile customization"
git commit -m "feature: implement dark mode toggle"
git commit -m "add automated backup system"
git commit -m "implement real-time notifications"
```

### Patch Version Bumps (Bug Fixes)
```bash
git commit -m "fix: resolve login session timeout issue"
git commit -m "bugfix: correct calculation in billing service"
git commit -m "fix bug with document upload validation"
git commit -m "resolve security vulnerability in auth"
```

### No Version Change (Maintenance)
```bash
git commit -m "docs: update README installation steps"
git commit -m "style: fix code formatting and linting"
git commit -m "refactor: improve database query performance"
git commit -m "test: add unit tests for auth service"
git commit -m "chore: update dependencies to latest versions"
```

## Available Commands

### Preview Version Changes
```bash
npm run version:preview
```
Shows what version changes would be made without actually changing anything. Great for checking before committing.

### Automatic Versioning
```bash
npm run version:auto
```
Analyzes commits and automatically updates the version in package.json, creates a CHANGELOG.md entry, and creates a git tag.

### Force Patch Version
```bash
npm run version:patch
```
Treats all commits as at least patch-level changes. Useful when you want to ensure version increments even for docs/style changes.

### Complete Version Release
```bash
npm run version:tag
```
Runs auto-versioning, commits the version changes, and is ready for pushing tags to remote.

## Replit Workflows

### "Version Release" Workflow
1. Previews version changes
2. Creates new version and git tag
3. Updates package.json and CHANGELOG.md

### "Full CI/CD Test" Workflow
Includes automatic versioning as the final step after all tests pass.

### "Deploy Staging" Workflow
Shows version preview before deployment to help track what's being deployed.

## Git Hooks

The system includes helpful git hooks:

### Post-Commit Hook
After each commit, automatically shows what version impact your commit would have and suggests next steps.

### Prepare-Commit-MSG Hook
When writing commit messages, provides helpful guidance about conventional commit formats in your editor.

## Manual Version Control

You can still use standard npm versioning commands if needed:
```bash
npm version patch   # 1.0.0 -> 1.0.1
npm version minor   # 1.0.0 -> 1.1.0  
npm version major   # 1.0.0 -> 2.0.0
```

## Examples

### Feature Development Workflow
```bash
# Work on a new feature
git add .
git commit -m "feat: add user dashboard analytics"

# Check what version this would create
npm run version:preview

# Create the version and tag
npm run version:tag

# Push to remote (includes tags)
git push && git push --tags
```

### Bug Fix Workflow
```bash
# Fix a bug
git add .
git commit -m "fix: resolve memory leak in document processing"

# Automatically version and tag
npm run version:auto

# The version is now updated (e.g., 1.2.1 -> 1.2.2)
```

### Release Workflow Using Replit
1. Complete your feature/fix commits
2. Run the **"Version Release"** workflow in Replit
3. Review the generated CHANGELOG.md
4. Push changes to deploy

## CHANGELOG.md

The system automatically maintains a CHANGELOG.md file with:
- Version numbers and release dates
- Categorized changes (Breaking Changes, Features, Bug Fixes)
- Commit hashes for reference
- Follows [Keep a Changelog](https://keepachangelog.com/) format

## Best Practices

1. **Use conventional commit messages** - helps the system correctly categorize changes
2. **Run `npm run version:preview`** before important releases to verify version bumps
3. **Group related changes** in single commits when possible
4. **Use descriptive commit messages** - they become part of your changelog
5. **Test the "Full CI/CD Test" workflow** before major releases
6. **Review generated CHANGELOG.md** entries for accuracy

## Troubleshooting

### Version not incrementing?
- Check that your commit messages follow the patterns above
- Use `npm run version:patch --force-patch` to force at least a patch bump
- Verify you're not in a detached HEAD state

### Want to skip versioning for a commit?
Use maintenance prefixes like `docs:`, `style:`, `chore:`, `test:`, or `refactor:`.

### Need to fix an incorrect version?
1. Edit package.json manually
2. Update or recreate the git tag: `git tag -d v1.2.3 && git tag v1.2.4`
3. Update CHANGELOG.md if needed

The automated versioning system helps maintain consistent, semantic versioning while providing clear changelogs and git history for your ReadMyFinePrint releases.