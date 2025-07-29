#!/usr/bin/env node

/**
 * Set Major Version Script for ReadMyFinePrint
 * 
 * Manually sets the version to a major release (e.g., 2.0.0) when preparing
 * for deployment or significant releases that warrant a major version bump.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class MajorVersionSetter {
  constructor() {
    this.packagePath = path.join(process.cwd(), 'package.json');
    this.package = this.loadPackage();
    this.currentVersion = this.package.version;
    this.dryRun = process.argv.includes('--dry-run');
    this.targetVersion = this.getTargetVersion();
  }

  loadPackage() {
    try {
      return JSON.parse(fs.readFileSync(this.packagePath, 'utf8'));
    } catch (error) {
      console.error('❌ Failed to load package.json:', error.message);
      process.exit(1);
    }
  }

  getTargetVersion() {
    // Check if version was provided as argument
    const versionArg = process.argv.find(arg => arg.match(/^\d+\.\d+\.\d+$/));
    if (versionArg) {
      return versionArg;
    }

    // Default to next major version
    const [major] = this.currentVersion.split('.').map(Number);
    return `${major + 1}.0.0`;
  }

  savePackage() {
    if (this.dryRun) {
      console.log('🔍 DRY RUN: Would update package.json with new version');
      return;
    }

    try {
      fs.writeFileSync(this.packagePath, JSON.stringify(this.package, null, 2) + '\n');
      console.log('✅ Updated package.json with new version');
    } catch (error) {
      console.error('❌ Failed to update package.json:', error.message);
      process.exit(1);
    }
  }

  createVersionTag() {
    if (this.dryRun) {
      console.log(`🔍 DRY RUN: Would create git tag v${this.targetVersion}`);
      return;
    }

    try {
      execSync(`git tag -a v${this.targetVersion} -m "Major release version ${this.targetVersion}"`, { stdio: 'inherit' });
      console.log(`🏷️  Created git tag: v${this.targetVersion}`);
    } catch (error) {
      console.error('❌ Failed to create git tag:', error.message);
    }
  }

  updateChangelog() {
    const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
    const date = new Date().toISOString().split('T')[0];
    
    let changelog = `## [${this.targetVersion}] - ${date}\n\n`;
    changelog += `### 🚀 MAJOR RELEASE\n\n`;
    changelog += `- Major version release for production deployment\n`;
    changelog += `- All features and systems ready for live environment\n`;
    changelog += `- Complete CI/CD pipeline with staging and production workflows\n`;
    changelog += `- Automated versioning system implementation\n`;
    changelog += `- Comprehensive security and monitoring systems\n\n`;

    if (this.dryRun) {
      console.log('🔍 DRY RUN: Would update CHANGELOG.md with:');
      console.log(changelog);
      return;
    }

    // Prepend to existing changelog
    let existingChangelog = '';
    if (fs.existsSync(changelogPath)) {
      existingChangelog = fs.readFileSync(changelogPath, 'utf8');
      if (existingChangelog.startsWith('# Changelog')) {
        const lines = existingChangelog.split('\n');
        existingChangelog = lines.slice(2).join('\n');
      }
    }

    const fullChangelog = `# Changelog\n\n${changelog}${existingChangelog}`;
    fs.writeFileSync(changelogPath, fullChangelog);
    console.log('📝 Updated CHANGELOG.md with major release notes');
  }

  run() {
    console.log('🔄 ReadMyFinePrint Major Version Release');
    console.log(`📦 Current version: ${this.currentVersion}`);
    console.log(`🎯 Target version: ${this.targetVersion}`);

    if (this.currentVersion === this.targetVersion) {
      console.log('✅ Already at target version');
      return;
    }

    console.log(`\n🚀 Setting major version: ${this.currentVersion} → ${this.targetVersion}`);

    // Update package.json
    this.package.version = this.targetVersion;
    this.savePackage();

    // Update changelog
    this.updateChangelog();

    // Create git tag
    this.createVersionTag();

    console.log(`\n🎉 Successfully set major version to ${this.targetVersion}!`);
    console.log('\n📋 Next steps for deployment:');
    console.log('1. Review CHANGELOG.md for accuracy');
    console.log('2. Run "Full CI/CD Test" workflow to validate');
    console.log('3. Deploy to staging for final testing');
    console.log('4. Deploy to production when ready');
    console.log('5. Push tags: git push && git push --tags');
  }
}

// Help text
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
ReadMyFinePrint Major Version Release Tool

Usage: node scripts/set-major-version.cjs [version] [options]

Arguments:
  version         Specific version to set (e.g., 2.0.0, 3.1.0)
                  If not provided, increments to next major version

Options:
  --dry-run       Show what would be changed without making changes
  --help, -h      Show this help message

Examples:
  node scripts/set-major-version.cjs                # Next major (e.g., 1.1.0 -> 2.0.0)
  node scripts/set-major-version.cjs 2.0.0          # Set to specific version
  node scripts/set-major-version.cjs --dry-run      # Preview changes
  `);
  process.exit(0);
}

// Run the major version setter
const versionSetter = new MajorVersionSetter();
versionSetter.run();