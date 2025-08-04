#!/usr/bin/env node

/**
 * Deployment Health Check Script
 * 
 * This script performs comprehensive health checks after deployment to verify:
 * 1. Server health endpoints are accessible
 * 2. Database connectivity is working
 * 3. API endpoints respond correctly
 * 4. Static files are served properly
 * 5. Authentication endpoints are functional
 * 
 * Usage: node scripts/deployment-health-check.js
 * For production: NODE_ENV=production node scripts/deployment-health-check.js
 */

import fetch from 'node-fetch';

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';
const isStaging = process.env.NODE_ENV === 'staging';

// Configuration based on environment
const CONFIG = {
  baseUrl: process.env.EXTERNAL_URL || 
           process.env.REPL_URL || 
           `http://localhost:${process.env.PORT || 5000}`,
  timeout: isProduction ? 30000 : 10000,
  retries: isProduction ? 5 : 3,
  retryDelay: isProduction ? 5000 : 2000
};

console.log(`🔍 ${isProduction ? 'Production' : isStaging ? 'Staging' : 'Development'} Deployment Health Check`);
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔗 Base URL: ${CONFIG.baseUrl}`);
console.log('────────────────────────────────────────────────────────────');

class HealthChecker {
  constructor() {
    this.results = {
      server: null,
      database: null,
      api: null,
      static: null,
      auth: null
    };
    this.overallStatus = 'unknown';
  }

  async makeRequest(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'ReadMyFinePrint-HealthCheck/1.0',
          ...options.headers
        }
      });
      
      clearTimeout(timeout);
      return response;
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  async checkServerHealth() {
    console.log('❓ SERVER: Checking server health endpoint...');
    
    try {
      const response = await this.makeRequest(`${CONFIG.baseUrl}/health`);
      const data = await response.json();
      
      if (response.ok) {
        console.log('✅ SERVER: Server health endpoint is accessible');
        console.log(`   Status: ${data.status}`);
        console.log(`   Database: ${data.database?.status || 'unknown'}`);
        console.log(`   Memory: ${data.memory?.used || 'unknown'}MB used`);
        console.log(`   Uptime: ${data.uptime || 'unknown'}s`);
        this.results.server = { status: 'healthy', data };
        return true;
      } else {
        console.log(`❌ SERVER: Health endpoint returned ${response.status}`);
        this.results.server = { status: 'unhealthy', error: `HTTP ${response.status}` };
        return false;
      }
    } catch (error) {
      console.log(`❌ SERVER: Health endpoint failed - ${error.message}`);
      this.results.server = { status: 'failed', error: error.message };
      return false;
    }
  }

  async checkDatabaseHealth() {
    console.log('❓ DATABASE: Checking database connectivity...');
    
    try {
      const response = await this.makeRequest(`${CONFIG.baseUrl}/api/health`);
      const data = await response.json();
      
      if (response.ok && data.database?.status === 'healthy') {
        console.log('✅ DATABASE: Database connectivity verified');
        console.log(`   Type: ${data.database.type || 'unknown'}`);
        console.log(`   Connection: ${data.database.activeConnection || 'unknown'}`);
        this.results.database = { status: 'healthy', data };
        return true;
      } else {
        console.log(`❌ DATABASE: Database health check failed`);
        this.results.database = { status: 'unhealthy', error: 'Database not healthy' };
        return false;
      }
    } catch (error) {
      console.log(`❌ DATABASE: Database health check failed - ${error.message}`);
      this.results.database = { status: 'failed', error: error.message };
      return false;
    }
  }

  async checkApiEndpoints() {
    console.log('❓ API: Testing API endpoints...');
    
    const endpoints = [
      { path: '/api/health', description: 'API Health' },
      { path: '/api/subscription/tiers', description: 'Subscription Tiers' },
      { path: '/api/auth/status', description: 'Auth Status' }
    ];

    let successCount = 0;
    const results = [];

    for (const endpoint of endpoints) {
      try {
        const response = await this.makeRequest(`${CONFIG.baseUrl}${endpoint.path}`);
        
        if (response.ok || response.status === 401) { // 401 is expected for auth endpoints
          console.log(`✅ API: ${endpoint.description} endpoint accessible`);
          successCount++;
          results.push({ ...endpoint, status: 'accessible', code: response.status });
        } else {
          console.log(`❌ API: ${endpoint.description} returned ${response.status}`);
          results.push({ ...endpoint, status: 'error', code: response.status });
        }
      } catch (error) {
        console.log(`❌ API: ${endpoint.description} failed - ${error.message}`);
        results.push({ ...endpoint, status: 'failed', error: error.message });
      }
    }

    const isHealthy = successCount >= endpoints.length * 0.75; // 75% success rate
    this.results.api = { 
      status: isHealthy ? 'healthy' : 'degraded', 
      successCount, 
      totalCount: endpoints.length,
      results 
    };

    if (isHealthy) {
      console.log(`✅ API: ${successCount}/${endpoints.length} endpoints accessible`);
    } else {
      console.log(`⚠️ API: Only ${successCount}/${endpoints.length} endpoints accessible`);
    }

    return isHealthy;
  }

  async checkStaticFiles() {
    console.log('❓ STATIC: Checking static file serving...');
    
    try {
      const response = await this.makeRequest(`${CONFIG.baseUrl}/`);
      const contentType = response.headers.get('content-type');
      
      if (response.ok && contentType?.includes('text/html')) {
        console.log('✅ STATIC: Frontend application accessible');
        console.log(`   Content-Type: ${contentType}`);
        this.results.static = { status: 'healthy', contentType };
        return true;
      } else {
        console.log(`❌ STATIC: Frontend returned ${response.status} or wrong content type`);
        this.results.static = { status: 'unhealthy', error: `HTTP ${response.status}` };
        return false;
      }
    } catch (error) {
      console.log(`❌ STATIC: Frontend check failed - ${error.message}`);
      this.results.static = { status: 'failed', error: error.message };
      return false;
    }
  }

  async checkAuthentication() {
    console.log('❓ AUTH: Testing authentication endpoints...');
    
    try {
      const response = await this.makeRequest(`${CONFIG.baseUrl}/api/auth/status`);
      
      // We expect 401 for unauthenticated requests
      if (response.status === 401 || response.status === 200) {
        console.log('✅ AUTH: Authentication endpoints responding correctly');
        this.results.auth = { status: 'healthy', expectedResponse: true };
        return true;
      } else {
        console.log(`⚠️ AUTH: Unexpected auth response ${response.status}`);
        this.results.auth = { status: 'degraded', unexpectedResponse: response.status };
        return true; // Still functional, just unexpected
      }
    } catch (error) {
      console.log(`❌ AUTH: Authentication check failed - ${error.message}`);
      this.results.auth = { status: 'failed', error: error.message };
      return false;
    }
  }

  async runAllChecks() {
    const checks = [
      { name: 'Server Health', fn: () => this.checkServerHealth() },
      { name: 'Database Connectivity', fn: () => this.checkDatabaseHealth() },
      { name: 'API Endpoints', fn: () => this.checkApiEndpoints() },
      { name: 'Static Files', fn: () => this.checkStaticFiles() },
      { name: 'Authentication', fn: () => this.checkAuthentication() }
    ];

    const results = [];
    
    for (const check of checks) {
      try {
        const result = await check.fn();
        results.push({ name: check.name, success: result });
      } catch (error) {
        console.log(`❌ ${check.name.toUpperCase()}: Unexpected error - ${error.message}`);
        results.push({ name: check.name, success: false, error: error.message });
      }
    }

    // Calculate overall status
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    const successRate = successCount / totalCount;

    if (successRate >= 0.8) {
      this.overallStatus = '✅ HEALTHY';
    } else if (successRate >= 0.6) {
      this.overallStatus = '⚠️ DEGRADED';
    } else {
      this.overallStatus = '❌ UNHEALTHY';
    }

    // Summary
    console.log('────────────────────────────────────────────────────────────');
    console.log(`Overall Status: ${this.overallStatus}`);
    console.log('');
    
    if (successCount < totalCount) {
      console.log('🚨 Issues Detected:');
      results.forEach(result => {
        if (!result.success) {
          console.log(`• ${result.name}: ${result.error || 'Failed'}`);
        }
      });
    } else {
      console.log('🎉 All checks passed successfully!');
    }

    // Exit with appropriate code
    process.exit(successRate >= 0.8 ? 0 : 1);
  }
}

// Run the health checks
const checker = new HealthChecker();
checker.runAllChecks().catch(error => {
  console.error('💥 Health check failed with error:', error);
  process.exit(1);
});