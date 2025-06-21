
import { z } from "zod";
import { securityLogger } from "./security-logger";

// IndexNow submission schema
const indexNowSubmissionSchema = z.object({
  host: z.string(),
  key: z.string(),
  urlList: z.array(z.string().url()).max(10000) // IndexNow limit is 10,000 URLs
});

interface IndexNowResponse {
  success: boolean;
  searchEngine: string;
  statusCode: number;
  submittedUrls: number;
  error?: string;
}

class IndexNowService {
  private readonly verificationKey: string;
  private readonly baseHost: string;
  
  // Supported search engines and their IndexNow endpoints
  private readonly searchEngines = {
    bing: 'https://api.indexnow.org/indexnow',
    yandex: 'https://yandex.com/indexnow',
    naver: 'https://searchadvisor.naver.com/indexnow',
    seznam: 'https://search.seznam.cz/indexnow'
  };

  constructor() {
    this.verificationKey = process.env.INDEXNOW_KEY || 'e3d1f7b82a904bd19f450d1e76c48a27';
    this.baseHost = process.env.BASE_HOST || 'readmyfineprint.com';
  }

  /**
   * Get all public URLs from your sitemap/routes
   */
  private getAllPublicUrls(): string[] {
    const baseUrl = `https://${this.baseHost}`;
    
    return [
      `${baseUrl}/`,
      `${baseUrl}/privacy`,
      `${baseUrl}/terms`,
      `${baseUrl}/cookies`,
      `${baseUrl}/donate`,
      `${baseUrl}/roadmap`,
      `${baseUrl}/subscription`,
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/robots.txt`,
      `${baseUrl}/manifest.json`,
      `${baseUrl}/${this.verificationKey}.txt`
    ];
  }

  /**
   * Submit URLs to a specific search engine
   */
  private async submitToSearchEngine(
    searchEngine: string, 
    endpoint: string, 
    urls: string[]
  ): Promise<IndexNowResponse> {
    try {
      const payload = {
        host: this.baseHost,
        key: this.verificationKey,
        urlList: urls
      };

      // Validate payload
      indexNowSubmissionSchema.parse(payload);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'User-Agent': 'ReadMyFinePrint-IndexNow/1.0'
        },
        body: JSON.stringify(payload)
      });

      const success = response.status === 200 || response.status === 202;
      
      // Log the submission
      securityLogger.logSecurityEvent({
        eventType: "API_ACCESS" as any,
        severity: "LOW" as any,
        message: `IndexNow submission to ${searchEngine}: ${success ? 'SUCCESS' : 'FAILED'}`,
        ip: 'server',
        userAgent: 'ReadMyFinePrint-IndexNow/1.0',
        endpoint: endpoint,
        details: { 
          searchEngine,
          statusCode: response.status,
          urlCount: urls.length,
          success
        }
      });

      return {
        success,
        searchEngine,
        statusCode: response.status,
        submittedUrls: urls.length,
        error: success ? undefined : `HTTP ${response.status}: ${response.statusText}`
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      securityLogger.logSecurityEvent({
        eventType: "API_ACCESS" as any,
        severity: "MEDIUM" as any,
        message: `IndexNow submission to ${searchEngine} failed: ${errorMessage}`,
        ip: 'server',
        userAgent: 'ReadMyFinePrint-IndexNow/1.0',
        endpoint: endpoint,
        details: { 
          searchEngine,
          error: errorMessage,
          urlCount: urls.length
        }
      });

      return {
        success: false,
        searchEngine,
        statusCode: 0,
        submittedUrls: 0,
        error: errorMessage
      };
    }
  }

  /**
   * Submit all URLs to all supported search engines
   */
  async submitAllUrls(): Promise<IndexNowResponse[]> {
    const urls = this.getAllPublicUrls();
    const results: IndexNowResponse[] = [];

    console.log(`🔄 Starting IndexNow submission for ${urls.length} URLs...`);

    // Submit to each search engine in parallel
    const submissions = Object.entries(this.searchEngines).map(([name, endpoint]) =>
      this.submitToSearchEngine(name, endpoint, urls)
    );

    const responses = await Promise.allSettled(submissions);

    responses.forEach((response, index) => {
      const searchEngine = Object.keys(this.searchEngines)[index];
      
      if (response.status === 'fulfilled') {
        results.push(response.value);
        
        if (response.value.success) {
          console.log(`✅ IndexNow: Successfully submitted ${response.value.submittedUrls} URLs to ${searchEngine}`);
        } else {
          console.log(`❌ IndexNow: Failed to submit to ${searchEngine}: ${response.value.error}`);
        }
      } else {
        console.log(`❌ IndexNow: Submission to ${searchEngine} threw an error: ${response.reason}`);
        results.push({
          success: false,
          searchEngine,
          statusCode: 0,
          submittedUrls: 0,
          error: `Promise rejected: ${response.reason}`
        });
      }
    });

    const successCount = results.filter(r => r.success).length;
    const totalEngines = results.length;
    
    console.log(`📊 IndexNow Summary: ${successCount}/${totalEngines} search engines notified successfully`);

    return results;
  }

  /**
   * Submit specific URLs (for when content is updated)
   */
  async submitSpecificUrls(urls: string[]): Promise<IndexNowResponse[]> {
    if (urls.length === 0) {
      return [];
    }

    if (urls.length > 10000) {
      throw new Error('Cannot submit more than 10,000 URLs at once');
    }

    console.log(`🔄 Starting IndexNow submission for ${urls.length} specific URLs...`);

    const results: IndexNowResponse[] = [];

    // Submit to each search engine
    const submissions = Object.entries(this.searchEngines).map(([name, endpoint]) =>
      this.submitToSearchEngine(name, endpoint, urls)
    );

    const responses = await Promise.allSettled(submissions);

    responses.forEach((response, index) => {
      const searchEngine = Object.keys(this.searchEngines)[index];
      
      if (response.status === 'fulfilled') {
        results.push(response.value);
      } else {
        results.push({
          success: false,
          searchEngine,
          statusCode: 0,
          submittedUrls: 0,
          error: `Promise rejected: ${response.reason}`
        });
      }
    });

    return results;
  }

  /**
   * Get submission statistics
   */
  getSubmissionStats() {
    return {
      verificationKey: this.verificationKey,
      baseHost: this.baseHost,
      supportedEngines: Object.keys(this.searchEngines),
      totalPublicUrls: this.getAllPublicUrls().length,
      keyFileLocation: `https://${this.baseHost}/${this.verificationKey}.txt`
    };
  }
}

export const indexNowService = new IndexNowService();
import crypto from 'crypto';
import { securityLogger } from './security-logger';

interface IndexNowSubmission {
  host: string;
  key: string;
  urlList: string[];
}

class IndexNowService {
  private readonly baseUrl = 'https://readmyfineprint.com';
  private readonly indexNowKey = 'e3d1f7b82a904bd19f450d1e76c48a27';
  private readonly keyLocation = `${this.baseUrl}/${this.indexNowKey}.txt`;
  
  // Search engines that support IndexNow
  private readonly searchEngines = [
    'https://bing.com/indexnow',
    'https://yandex.com/indexnow',
    'https://search.seznam.cz/indexnow',
    'https://naver.com/indexnow'
  ];

  // All public URLs on your site
  private readonly allUrls = [
    `${this.baseUrl}/`,
    `${this.baseUrl}/privacy`,
    `${this.baseUrl}/terms`,
    `${this.baseUrl}/cookies`,
    `${this.baseUrl}/donate`,
    `${this.baseUrl}/roadmap`,
    `${this.baseUrl}/sitemap.xml`,
    `${this.baseUrl}/robots.txt`,
    `${this.baseUrl}/manifest.json`,
    `${this.baseUrl}/${this.indexNowKey}.txt`
  ];

  /**
   * Submit a single URL to all search engines
   */
  async submitUrl(url: string): Promise<void> {
    await this.submitUrls([url]);
  }

  /**
   * Submit multiple URLs to all search engines
   */
  async submitUrls(urls: string[]): Promise<void> {
    const submission: IndexNowSubmission = {
      host: 'readmyfineprint.com',
      key: this.indexNowKey,
      urlList: urls
    };

    const promises = this.searchEngines.map(engineUrl => 
      this.submitToEngine(engineUrl, submission)
    );

    await Promise.allSettled(promises);
  }

  /**
   * Submit all public URLs to search engines
   */
  async submitAllUrls(): Promise<void> {
    await this.submitUrls(this.allUrls);
  }

  /**
   * Submit to a specific search engine
   */
  private async submitToEngine(engineUrl: string, submission: IndexNowSubmission): Promise<void> {
    try {
      const response = await fetch(engineUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ReadMyFinePrint/1.0 (+https://readmyfineprint.com/)'
        },
        body: JSON.stringify(submission)
      });

      const engineName = new URL(engineUrl).hostname;
      
      if (response.ok) {
        securityLogger.logSecurityEvent({
          eventType: "API_ACCESS" as any,
          severity: "LOW" as any,
          message: `IndexNow submission successful to ${engineName}`,
          ip: 'server',
          userAgent: 'IndexNow-Service',
          endpoint: engineUrl,
          details: { 
            urlCount: submission.urlList.length,
            statusCode: response.status,
            engine: engineName
          }
        });
        
        console.log(`✅ IndexNow: Successfully submitted ${submission.urlList.length} URLs to ${engineName}`);
      } else {
        console.warn(`⚠️ IndexNow: Failed to submit to ${engineName} (${response.status})`);
      }
    } catch (error) {
      const engineName = new URL(engineUrl).hostname;
      console.error(`❌ IndexNow: Error submitting to ${engineName}:`, error);
    }
  }

  /**
   * Trigger submission when content changes
   */
  async notifyContentChange(changedUrls?: string[]): Promise<void> {
    const urlsToSubmit = changedUrls || this.allUrls;
    
    console.log(`🔄 IndexNow: Notifying search engines of content changes (${urlsToSubmit.length} URLs)`);
    await this.submitUrls(urlsToSubmit);
  }

  /**
   * Get IndexNow status
   */
  getStatus() {
    return {
      keyLocation: this.keyLocation,
      supportedEngines: this.searchEngines.length,
      monitoredUrls: this.allUrls.length,
      lastSubmission: new Date().toISOString()
    };
  }
}

export const indexNowService = new IndexNowService();
