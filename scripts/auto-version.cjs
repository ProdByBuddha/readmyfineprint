#!/usr/bin/env node

/**
 * Automated Versioning System for ReadMyFinePrint
 * 
 * Analyzes git commit history to automatically increment version numbers
 * based on conventional commit patterns and semantic versioning.
 * 
 * Commit types and their version impact:
 * - feat: Minor version bump (1.0.0 -> 1.1.0)
 * - fix: Patch version bump (1.0.0 -> 1.0.1)
 * - BREAKING CHANGE: Major version bump (1.0.0 -> 2.0.0)
 * - perf, refactor, docs, style, test, chore: No version change (unless --force-patch)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class AutoVersioner {
  constructor() {
    this.packagePath = path.join(process.cwd(), 'package.json');
    this.package = this.loadPackage();
    this.currentVersion = this.package.version;
    this.dryRun = process.argv.includes('--dry-run');
    this.forcePatch = process.argv.includes('--force-patch');
    this.verbose = process.argv.includes('--verbose');
  }

  loadPackage() {
    try {
      return JSON.parse(fs.readFileSync(this.packagePath, 'utf8'));
    } catch (error) {
      console.error('❌ Failed to load package.json:', error.message);
      process.exit(1);
    }
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

  getLastVersionTag() {
    try {
      const result = execSync('git describe --tags --abbrev=0 --match="v*" 2>/dev/null || echo ""', { encoding: 'utf8' });
      return result.trim();
    } catch (error) {
      return '';
    }
  }

  getCommitsSinceLastVersion() {
    const lastTag = this.getLastVersionTag();
    
    try {
      let command;
      if (lastTag) {
        command = `git log ${lastTag}..HEAD --oneline --no-merges`;
        if (this.verbose) {
          console.log(`📋 Analyzing commits since last version tag: ${lastTag}`);
        }
      } else {
        command = 'git log --oneline --no-merges -10'; // Last 10 commits if no tags
        if (this.verbose) {
          console.log('📋 No version tags found, analyzing last 10 commits');
        }
      }

      const result = execSync(command, { encoding: 'utf8' });
      return result.trim().split('\n').filter(line => line.length > 0);
    } catch (error) {
      console.error('❌ Failed to get git commits:', error.message);
      return [];
    }
  }

  analyzeCommits(commits) {
    const analysis = {
      major: 0,
      minor: 0,
      patch: 0,
      details: []
    };

    for (const commit of commits) {
      const [hash, ...messageParts] = commit.split(' ');
      const message = messageParts.join(' ');
      
      const commitAnalysis = this.analyzeCommit(message);
      
      if (commitAnalysis.type !== 'none') {
        analysis[commitAnalysis.type]++;
        analysis.details.push({
          hash: hash.substring(0, 7),
          message: message,
          type: commitAnalysis.type,
          reason: commitAnalysis.reason
        });
      }

      if (this.verbose) {
        const typeEmoji = {
          major: '🔥',
          minor: '✨',
          patch: '🐛',
          none: '📝'
        };
        console.log(`${typeEmoji[commitAnalysis.type]} ${hash.substring(0, 7)} ${commitAnalysis.type.toUpperCase()}: ${message}`);
      }
    }

    return analysis;
  }

  analyzeCommit(message) {
    const lowerMessage = message.toLowerCase();

    // Check for breaking changes (major version bump)
    if (
      lowerMessage.includes('breaking change') ||
      lowerMessage.includes('breaking:') ||
      lowerMessage.match(/^[a-z]+!:/) || // feat!: or fix!: format
      lowerMessage.includes('major:')
    ) {
      return { type: 'major', reason: 'Breaking change detected' };
    }

    // Check for features (minor version bump)
    if (
      lowerMessage.startsWith('feat:') ||
      lowerMessage.startsWith('feature:') ||
      lowerMessage.includes('add ') ||
      lowerMessage.includes('implement ') ||
      lowerMessage.includes('new ') ||
      lowerMessage.match(/^(add|implement|create|introduce)\s/)
    ) {
      return { type: 'minor', reason: 'New feature detected' };
    }

    // Check for fixes (patch version bump)
    if (
      lowerMessage.startsWith('fix:') ||
      lowerMessage.startsWith('bugfix:') ||
      lowerMessage.includes('bug') ||
      lowerMessage.includes('error') ||
      lowerMessage.includes('issue') ||
      lowerMessage.match(/^(fix|resolve|correct|repair)\s/)
    ) {
      return { type: 'patch', reason: 'Bug fix detected' };
    }

    // Security fixes are treated as patches but prioritized
    if (
      lowerMessage.includes('security') ||
      lowerMessage.includes('vulnerability') ||
      lowerMessage.includes('cve-')
    ) {
      return { type: 'patch', reason: 'Security fix detected' };
    }

    // Performance improvements can be patches
    if (
      lowerMessage.startsWith('perf:') ||
      lowerMessage.includes('performance') ||
      lowerMessage.includes('optimize')
    ) {
      return this.forcePatch ? 
        { type: 'patch', reason: 'Performance improvement (--force-patch enabled)' } :
        { type: 'none', reason: 'Performance improvement (no version change)' };
    }

    // Other types that don't bump version by default
    if (
      lowerMessage.match(/^(docs?|style|refactor|test|chore|ci|build):/) ||
      lowerMessage.includes('documentation') ||
      lowerMessage.includes('readme') ||
      lowerMessage.includes('comment')
    ) {
      return this.forcePatch ? 
        { type: 'patch', reason: 'Maintenance change (--force-patch enabled)' } :
        { type: 'none', reason: 'Maintenance change (no version change)' };
    }

    // Default: if --force-patch is enabled, treat as patch
    return this.forcePatch ? 
      { type: 'patch', reason: 'Unclassified change (--force-patch enabled)' } :
      { type: 'none', reason: 'Unclassified change (no version change)' };
  }

  calculateNewVersion(analysis) {
    const [major, minor, patch] = this.currentVersion.split('.').map(Number);

    if (analysis.major > 0) {
      return `${major + 1}.0.0`;
    } else if (analysis.minor > 0) {
      return `${major}.${minor + 1}.0`;
    } else if (analysis.patch > 0) {
      return `${major}.${minor}.${patch + 1}`;
    }

    return this.currentVersion; // No changes
  }

  createVersionTag(newVersion) {
    if (this.dryRun) {
      console.log(`🔍 DRY RUN: Would create git tag v${newVersion}`);
      return;
    }

    try {
      execSync(`git tag -a v${newVersion} -m "Release version ${newVersion}"`, { stdio: 'inherit' });
      console.log(`🏷️  Created git tag: v${newVersion}`);
    } catch (error) {
      console.error('❌ Failed to create git tag:', error.message);
    }
  }

  generateChangelog(analysis, newVersion) {
    const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
    const date = new Date().toISOString().split('T')[0];
    
    let changelog = `## [${newVersion}] - ${date}\n\n`;
    
    const categories = {
      major: '### 💥 BREAKING CHANGES',
      minor: '### ✨ Features',
      patch: '### 🐛 Bug Fixes'
    };

    for (const [type, title] of Object.entries(categories)) {
      const commits = analysis.details.filter(detail => detail.type === type);
      if (commits.length > 0) {
        changelog += `${title}\n\n`;
        for (const commit of commits) {
          changelog += `- ${commit.message} (${commit.hash})\n`;
        }
        changelog += '\n';
      }
    }

    if (this.dryRun) {
      console.log('🔍 DRY RUN: Would update CHANGELOG.md with:');
      console.log(changelog);
      return;
    }

    // Prepend to existing changelog or create new one
    let existingChangelog = '';
    if (fs.existsSync(changelogPath)) {
      existingChangelog = fs.readFileSync(changelogPath, 'utf8');
      // Remove the first line if it's a header
      if (existingChangelog.startsWith('# Changelog')) {
        const lines = existingChangelog.split('\n');
        existingChangelog = lines.slice(2).join('\n'); // Skip header and empty line
      }
    }

    const fullChangelog = `# Changelog\n\n${changelog}${existingChangelog}`;
    fs.writeFileSync(changelogPath, fullChangelog);
    console.log('📝 Updated CHANGELOG.md');
  }

  run() {
    console.log('🔄 ReadMyFinePrint Automated Versioning System');
    console.log(`📦 Current version: ${this.currentVersion}`);
    
    const commits = this.getCommitsSinceLastVersion();
    
    if (commits.length === 0) {
      console.log('✅ No new commits found - version unchanged');
      return;
    }

    console.log(`📋 Analyzing ${commits.length} commits...`);
    
    const analysis = this.analyzeCommits(commits);
    const newVersion = this.calculateNewVersion(analysis);

    console.log('\n📊 Version Impact Analysis:');
    console.log(`   Breaking Changes: ${analysis.major}`);
    console.log(`   New Features: ${analysis.minor}`);
    console.log(`   Bug Fixes: ${analysis.patch}`);

    if (newVersion === this.currentVersion) {
      console.log('✅ No version changes required');
      return;
    }

    console.log(`\n🎯 Version change: ${this.currentVersion} → ${newVersion}`);

    if (this.verbose && analysis.details.length > 0) {
      console.log('\n📝 Detailed commit analysis:');
      for (const detail of analysis.details) {
        console.log(`   ${detail.hash}: ${detail.reason}`);
      }
    }

    // Update package.json
    this.package.version = newVersion;
    this.savePackage();

    // Generate changelog
    this.generateChangelog(analysis, newVersion);

    // Create git tag
    this.createVersionTag(newVersion);

    console.log(`\n🎉 Successfully updated version to ${newVersion}!`);
  }
}

// Help text
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
ReadMyFinePrint Automated Versioning System

Usage: node scripts/auto-version.js [options]

Options:
  --dry-run       Show what would be changed without making changes
  --force-patch   Treat all commits as patch-level changes (minimum)
  --verbose       Show detailed commit analysis
  --help, -h      Show this help message

Commit Type Analysis:
  Major (x.0.0):  BREAKING CHANGE, feat!, fix!, major:
  Minor (x.y.0):  feat:, add, implement, new features
  Patch (x.y.z):  fix:, bug fixes, security fixes
  None:           docs, style, refactor, test, chore (unless --force-patch)

Examples:
  node scripts/auto-version.js                    # Normal version bump
  node scripts/auto-version.js --dry-run          # Preview changes
  node scripts/auto-version.js --force-patch      # Ensure at least patch bump
  node scripts/auto-version.js --verbose          # Show detailed analysis
  `);
  process.exit(0);
}

// Run the versioning system
const versioner = new AutoVersioner();
versioner.run();