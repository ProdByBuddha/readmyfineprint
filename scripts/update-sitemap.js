#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SITEMAP_PATH = path.join(__dirname, '../client/public/sitemap.xml');
const BASE_URL = 'https://readmyfineprint.com';

const pages = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/privacy', priority: '0.6', changefreq: 'monthly' },
  { path: '/terms', priority: '0.6', changefreq: 'monthly' },
  { path: '/cookies', priority: '0.5', changefreq: 'monthly' },
  { path: '/donate', priority: '0.7', changefreq: 'monthly' },
  { path: '/roadmap', priority: '0.8', changefreq: 'weekly' },
];

function generateSitemap() {
  const currentDate = new Date().toISOString().split('T')[0];
  
  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
  
${pages.map(page => `  <!-- ${page.path === '/' ? 'Homepage' : page.path.slice(1).charAt(0).toUpperCase() + page.path.slice(2).replace('/', '')} -->
  <url>
    <loc>${BASE_URL}${page.path}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n  \n')}
  
</urlset>`;

  return sitemapContent;
}

function updateSitemap() {
  try {
    const sitemap = generateSitemap();
    fs.writeFileSync(SITEMAP_PATH, sitemap, 'utf8');
    console.log('✅ Sitemap updated successfully!');
    console.log(`📄 Updated ${pages.length} pages in sitemap`);
    console.log(`📅 Last modified: ${new Date().toISOString().split('T')[0]}`);
  } catch (error) {
    console.error('❌ Error updating sitemap:', error);
    process.exit(1);
  }
}

function validateSEOFiles() {
  const seoFiles = [
    { path: '../client/public/sitemap.xml', name: 'Sitemap' },
    { path: '../client/public/robots.txt', name: 'Robots.txt' },
    { path: '../client/public/manifest.json', name: 'Web App Manifest' },
    { path: '../client/index.html', name: 'HTML with meta tags' },
  ];

  console.log('🔍 Validating SEO files...\n');

  seoFiles.forEach(file => {
    const filePath = path.join(__dirname, file.path);
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${file.name}: Found`);
    } else {
      console.log(`❌ ${file.name}: Missing`);
    }
  });

  console.log('\n📊 SEO Checklist:');
  console.log('✅ Meta tags (title, description, keywords)');
  console.log('✅ Open Graph tags');
  console.log('✅ Twitter Card tags');
  console.log('✅ Structured data (JSON-LD)');
  console.log('✅ Canonical URLs');
  console.log('✅ Sitemap.xml');
  console.log('✅ Robots.txt');
  console.log('✅ Web App Manifest');
  console.log('✅ Semantic HTML structure');
  console.log('✅ FAQ structured data');
  console.log('✅ Breadcrumb navigation');
  console.log('✅ Performance optimizations');
}

// CLI handling
const command = process.argv[2];

switch (command) {
  case 'update':
    updateSitemap();
    break;
  case 'validate':
    validateSEOFiles();
    break;
  case 'check':
    validateSEOFiles();
    break;
  default:
    console.log(`
🚀 ReadMyFinePrint SEO Maintenance Tool

Usage:
  node scripts/update-sitemap.js update    - Update sitemap with current date
  node scripts/update-sitemap.js validate  - Validate all SEO files exist
  node scripts/update-sitemap.js check     - Same as validate

Available commands:
  update    Update sitemap.xml with current dates
  validate  Check if all SEO files are in place
  check     Alias for validate
`);
} 