import { z } from "zod";
import { securityLogger } from "./security-logger";

// IndexNow submission schema
const indexNowSubmissionSchema = z.object({
  host: z.string(),
  key: z.string(),
  urlList: z.array(z.string().url()).max(10000) // IndexNow limit is 10,000 URLs
});

interface IndexNowSubmission {
  host: string;
  key: string;
  urlList: string[];
}

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
      console.error(`❌ IndexNow: Error submitting to ${searchEngine}:`, error);
      return {
        success: false,
        searchEngine,
        statusCode: 0,
        submittedUrls: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Submit URLs to all search engines
   */
  async submitUrls(urls: string[]): Promise<IndexNowResponse[]> {
    const promises = Object.entries(this.searchEngines).map(([engine, endpoint]) =>
      this.submitToSearchEngine(engine, endpoint, urls)
    );

    return Promise.all(promises);
  }

  /**
   * Submit all public URLs to search engines
   */
  async submitAllUrls(): Promise<IndexNowResponse[]> {
    const allUrls = this.getAllPublicUrls();
    return this.submitUrls(allUrls);
  }

  /**
   * Trigger submission when content changes
   */
  async notifyContentChange(changedUrls?: string[]): Promise<void> {
    const urlsToSubmit = changedUrls || this.getAllPublicUrls();

    console.log(`🔄 IndexNow: Notifying search engines of content changes (${urlsToSubmit.length} URLs)`);
    await this.submitUrls(urlsToSubmit);
  }

  /**
   * Get submission statistics
   */
  getSubmissionStats() {
    return {
      baseHost: this.baseHost,
      verificationKey: this.verificationKey,
      keyFileLocation: `https://${this.baseHost}/${this.verificationKey}.txt`,
      totalPublicUrls: this.getAllPublicUrls().length,
      supportedEngines: Object.keys(this.searchEngines)
    };
  }

  /**
   * Get IndexNow status
   */
  getStatus() {
    return {
      keyLocation: `https://${this.baseHost}/${this.verificationKey}.txt`,
      supportedEngines: Object.keys(this.searchEngines).length,
      monitoredUrls: this.getAllPublicUrls().length,
      lastSubmission: new Date().toISOString()
    };
  }
}

export const indexNowService = new IndexNowService();