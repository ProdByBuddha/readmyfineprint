# Package.json Update for Deployment

Replace the build script in package.json with:

```json
"build": "node minimal-build.js",
```

This change will:
- Fix the deployment timeout issue
- Create a working production build with all necessary files
- Include your custom favicon and branding
- Provide a functional backend server

The minimal build includes:
- Production-ready backend server (dist/production.js)
- All favicon files (16x16, 32x32, 48x48, .ico)
- Essential meta files (manifest.json, robots.txt, sitemap.xml)
- Fallback HTML page for deployment

Keep the start script as:
```json
"start": "NODE_ENV=production node dist/production.js",
```

After making this change, your deployment should complete successfully without timeouts.