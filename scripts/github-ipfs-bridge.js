#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration for GitHub repository
const GITHUB_REPO = process.env.GITHUB_REPO || 'username/readmyfineprint';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

async function createGitHubIPFSBridge() {
  try {
    console.log('🔗 Creating GitHub-IPFS resource bridge...');
    
    // Read the built index.html
    const indexPath = path.join(__dirname, '../dist/public/index.html');
    let indexContent = await fs.readFile(indexPath, 'utf-8');
    
    // Create resource mapping for GitHub integration
    const resourceMappings = {
      // Map CSS files to GitHub raw URLs as fallback
      '/assets/': `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/dist/public/assets/`,
      
      // Map static assets
      '/favicon.ico': `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/client/public/favicon.ico`,
      '/manifest.json': `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/client/public/manifest.json`,
      '/og-image.png': `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/client/public/og-image.png`,
      
      // Map API endpoints to your live Replit deployment
      '/api/': process.env.API_BASE_URL || 'https://your-repl-name.replit.app/api/'
    };
    
    // Inject GitHub fallback script
    const fallbackScript = `
    <script>
      // GitHub-IPFS Resource Bridge
      window.GITHUB_IPFS_BRIDGE = {
        repo: '${GITHUB_REPO}',
        branch: '${GITHUB_BRANCH}',
        apiBase: '${process.env.API_BASE_URL || 'https://your-repl-name.replit.app'}',
        
        // Fallback loader for failed resources
        loadFromGitHub: function(originalUrl) {
          const githubUrl = originalUrl.replace(window.location.origin, 
            \`https://raw.githubusercontent.com/\${this.repo}/\${this.branch}/dist/public\`);
          return githubUrl;
        },
        
        // API proxy for IPFS -> Replit
        proxyAPI: function(apiPath) {
          return \`\${this.apiBase}\${apiPath}\`;
        }
      };
      
      // Handle failed resource loads
      document.addEventListener('error', function(e) {
        if (e.target.tagName === 'LINK' || e.target.tagName === 'SCRIPT' || e.target.tagName === 'IMG') {
          const fallbackUrl = window.GITHUB_IPFS_BRIDGE.loadFromGitHub(e.target.src || e.target.href);
          console.log('🔄 Loading from GitHub fallback:', fallbackUrl);
          
          if (e.target.tagName === 'LINK') {
            e.target.href = fallbackUrl;
          } else {
            e.target.src = fallbackUrl;
          }
        }
      }, true);
      
      // Override fetch for API calls
      const originalFetch = window.fetch;
      window.fetch = function(url, options) {
        if (typeof url === 'string' && url.startsWith('/api/')) {
          url = window.GITHUB_IPFS_BRIDGE.proxyAPI(url);
        }
        return originalFetch(url, options);
      };
    </script>
    `;
    
    // Insert the bridge script before closing head tag
    indexContent = indexContent.replace('</head>', `${fallbackScript}\n</head>`);
    
    // Update service worker for IPFS compatibility
    const swScript = `
    <script>
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').then(function(registration) {
          console.log('SW registered: ', registration);
        }).catch(function(registrationError) {
          console.log('SW registration failed: ', registrationError);
        });
      }
    </script>
    `;
    
    indexContent = indexContent.replace('</body>', `${swScript}\n</body>`);
    
    // Write the modified index.html
    await fs.writeFile(indexPath, indexContent);
    
    // Create service worker for IPFS caching
    await createIPFSServiceWorker();
    
    console.log('✅ GitHub-IPFS bridge created successfully');
    
  } catch (error) {
    console.error('❌ Bridge creation failed:', error);
    process.exit(1);
  }
}

async function createIPFSServiceWorker() {
  const swContent = `
self.addEventListener('fetch', function(event) {
  // Handle API requests - proxy to Replit
  if (event.request.url.includes('/api/')) {
    const apiUrl = event.request.url.replace(self.location.origin, '${process.env.API_BASE_URL || 'https://your-repl-name.replit.app'}');
    
    event.respondWith(
      fetch(apiUrl, {
        method: event.request.method,
        headers: event.request.headers,
        body: event.request.body
      }).catch(function() {
        return new Response('API temporarily unavailable', { status: 503 });
      })
    );
    return;
  }
  
  // For static resources, try IPFS first, then GitHub fallback
  if (event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request).catch(function() {
        // Fallback to GitHub raw
        const githubUrl = event.request.url.replace(
          self.location.origin, 
          'https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/dist/public'
        );
        return fetch(githubUrl);
      })
    );
  }
});

self.addEventListener('install', function(event) {
  console.log('IPFS-GitHub bridge service worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('IPFS-GitHub bridge service worker activated');
  event.waitUntil(self.clients.claim());
});
`;

  const swPath = path.join(__dirname, '../dist/public/sw.js');
  await fs.writeFile(swPath, swContent);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createGitHubIPFSBridge();
}

export { createGitHubIPFSBridge };
