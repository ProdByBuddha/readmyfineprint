/**
 * Global error reporting utility for sending errors to admin
 */

interface ErrorReportData {
  errorType: 'frontend' | 'api' | 'network' | 'authentication' | 'validation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  stack?: string;
  url?: string;
  userId?: string;
  userEmail?: string;
  additionalContext?: Record<string, any>;
  reproductionSteps?: string[];
}

class ErrorReporter {
  private static instance: ErrorReporter;
  private isEnabled = true;
  private reportedErrors = new Set<string>(); // Prevent duplicate reports

  static getInstance(): ErrorReporter {
    if (!ErrorReporter.instance) {
      ErrorReporter.instance = new ErrorReporter();
    }
    return ErrorReporter.instance;
  }

  private constructor() {
    // Set up global error handlers
    this.setupGlobalErrorHandlers();
  }

  private setupGlobalErrorHandlers() {
    // Only set up global error handlers in a browser environment
    if (typeof window !== 'undefined') {
      // Handle unhandled JavaScript errors
      window.addEventListener('error', (event) => {
        this.reportError({
          errorType: 'frontend',
          severity: 'high',
          message: event.message,
          stack: event.error?.stack,
          url: event.filename,
          additionalContext: {
            lineno: event.lineno,
            colno: event.colno,
            globalError: true
          }
        });
      });

      // Handle unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        this.reportError({
          errorType: 'frontend',
          severity: 'high',
          message: `Unhandled promise rejection: ${event.reason}`,
          stack: event.reason?.stack,
          additionalContext: {
            promiseRejection: true,
            reason: event.reason
          }
        });
      });
    }
  }

  /**
   * Report an API error with context
   */
  async reportApiError(error: any, endpoint: string, method: string = 'GET') {
    const severity = this.determineSeverity(error);
    
    await this.reportError({
      errorType: 'api',
      severity,
      message: `API Error: ${error.message || error.toString()}`,
      stack: error.stack,
      additionalContext: {
        endpoint,
        method,
        status: error.status,
        statusText: error.statusText,
        apiError: true
      }
    });
  }

  /**
   * Report a network error
   */
  async reportNetworkError(error: any, url: string) {
    await this.reportError({
      errorType: 'network',
      severity: 'medium',
      message: `Network Error: ${error.message || 'Connection failed'}`,
      additionalContext: {
        url,
        networkError: true
      }
    });
  }

  /**
   * Report an authentication error
   */
  async reportAuthError(message: string, context?: Record<string, any>) {
    await this.reportError({
      errorType: 'authentication',
      severity: 'medium',
      message: `Auth Error: ${message}`,
      additionalContext: {
        ...context,
        authError: true
      }
    });
  }

  /**
   * Main error reporting function
   */
  async reportError(errorData: ErrorReportData) {
    if (!this.isEnabled) {
      return;
    }

    try {
      // Create error hash to prevent duplicates
      const errorHash = this.createErrorHash(errorData);
      if (this.reportedErrors.has(errorHash)) {
        return; // Skip duplicate errors
      }
      this.reportedErrors.add(errorHash);

      // Clear old hashes periodically (keep last 100)
      if (this.reportedErrors.size > 100) {
        const hashArray = Array.from(this.reportedErrors);
        this.reportedErrors = new Set(hashArray.slice(-50));
      }

      const payload = {
        ...errorData,
        url: errorData.url || window.location.href,
        additionalContext: {
          ...errorData.additionalContext,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          screenSize: `${window.screen.width}x${window.screen.height}`,
          viewportSize: `${window.innerWidth}x${window.innerHeight}`
        }
      };

      // Add retry logic for network failures
      let attempts = 0;
      const maxAttempts = 3;
      let lastError: any;

      while (attempts < maxAttempts) {
        try {
          const response = await fetch('/api/errors/report', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            credentials: 'include',
            // Add timeout to prevent hanging requests
            signal: AbortSignal.timeout(10000) // 10 second timeout
          });

          if (response.ok) {
            console.log('Error reported to admin successfully');
            return;
          } else {
            console.warn('Failed to report error to admin:', response.status);
            lastError = new Error(`HTTP ${response.status}`);
          }
        } catch (fetchError: any) {
          lastError = fetchError;
          console.warn(`Error reporting attempt ${attempts + 1} failed:`, fetchError.message);
          
          // Don't retry for non-network errors
          if (!fetchError.message?.includes('fetch') && !fetchError.name?.includes('Abort')) {
            break;
          }
        }

        attempts++;
        if (attempts < maxAttempts) {
          // Exponential backoff: 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts - 1) * 1000));
        }
      }

      console.error('Failed to report error after all attempts:', lastError);
    } catch (reportingError) {
      console.error('Error reporting failed:', reportingError);
      // Don't try to report the reporting error to avoid infinite loops
    }
  }

  /**
   * Determine error severity based on error type and content
   */
  private determineSeverity(error: any): 'low' | 'medium' | 'high' | 'critical' {
    if (error.status === 401 || error.status === 403) {
      return 'medium'; // Auth errors
    }
    if (error.status >= 500) {
      return 'high'; // Server errors
    }
    if (error.message?.includes('Network Error') || error.message?.includes('Failed to fetch')) {
      return 'medium'; // Network issues
    }
    if (error.message?.includes('TypeError') || error.message?.includes('ReferenceError')) {
      return 'high'; // Code errors
    }
    return 'medium'; // Default
  }

  /**
   * Create a hash for error deduplication
   */
  private createErrorHash(errorData: ErrorReportData): string {
    const key = `${errorData.errorType}:${errorData.message}:${errorData.url}`;
    return btoa(key).substring(0, 16);
  }

  /**
   * Enable or disable error reporting
   */
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  /**
   * Report a critical error that needs immediate attention
   */
  async reportCriticalError(message: string, context?: Record<string, any>) {
    await this.reportError({
      errorType: 'frontend',
      severity: 'critical',
      message,
      additionalContext: {
        ...context,
        critical: true
      }
    });
  }
}

// Export singleton instance
export const errorReporter = ErrorReporter.getInstance();

// Export utility functions for easy use
export const reportApiError = (error: any, endpoint: string, method?: string) => 
  errorReporter.reportApiError(error, endpoint, method);

export const reportNetworkError = (error: any, url: string) => 
  errorReporter.reportNetworkError(error, url);

export const reportAuthError = (message: string, context?: Record<string, any>) => 
  errorReporter.reportAuthError(message, context);

export const reportCriticalError = (message: string, context?: Record<string, any>) => 
  errorReporter.reportCriticalError(message, context);