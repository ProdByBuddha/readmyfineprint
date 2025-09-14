import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    // Normalize non-Error objects that might be thrown
    const normalizedError = ErrorBoundary.normalizeError(error);
    return { hasError: true, error: normalizedError };
  }

  // Static method to normalize any thrown value into an Error object
  static normalizeError(error: any): Error {
    if (error instanceof Error) {
      return error;
    }
    
    // Handle different types of thrown values
    if (typeof error === 'string') {
      return new Error(error);
    }
    
    if (error && typeof error === 'object') {
      const message = error.message || error.toString() || 'Unknown error object';
      const normalizedError = new Error(message);
      // Preserve additional properties if they exist
      if (error.stack) normalizedError.stack = error.stack;
      return normalizedError;
    }
    
    // For primitives or null/undefined
    const errorString = error === null ? 'null' : error === undefined ? 'undefined' : String(error);
    return new Error(`Non-error thrown: ${errorString}`);
  }

  componentDidCatch(error: any, errorInfo: React.ErrorInfo) {
    const normalizedError = ErrorBoundary.normalizeError(error);
    console.error('🔴 [ErrorBoundary] ========== ERROR CAUGHT ==========');
    console.error('🔴 [ErrorBoundary] Raw error:', error);
    console.error('🔴 [ErrorBoundary] Error type:', typeof error);
    console.error('🔴 [ErrorBoundary] Is empty object:', error && typeof error === 'object' && Object.keys(error).length === 0);
    console.error('🔴 [ErrorBoundary] Error toString:', String(error));
    console.error('🔴 [ErrorBoundary] Error message:', error?.message || 'No message');
    console.error('🔴 [ErrorBoundary] Error stack:', error?.stack || 'No stack');
    console.error('🔴 [ErrorBoundary] Normalized error:', normalizedError);
    console.error('🔴 [ErrorBoundary] Component stack:', errorInfo.componentStack);
    if (error && typeof error === 'object') {
      console.error('🔴 [ErrorBoundary] Error keys:', Object.keys(error));
      console.error('🔴 [ErrorBoundary] Error constructor:', error.constructor?.name);
      try {
        console.error('🔴 [ErrorBoundary] Error JSON:', JSON.stringify(error, null, 2));
      } catch (e) {
        console.error('🔴 [ErrorBoundary] Error JSON failed:', e);
      }
    }
    console.error('🔴 [ErrorBoundary] ==================================');
    
    // Store errorInfo for better debugging
    this.setState(prevState => ({ 
      ...prevState, 
      error: normalizedError, 
      errorInfo 
    }));
    
    // Report error to backend for admin notification
    this.reportError(normalizedError, errorInfo);
  }

  private reportError = async (error: Error, errorInfo: React.ErrorInfo) => {
    try {
      const errorData = {
        errorType: 'frontend',
        severity: 'high', // React errors are usually high severity
        message: error.message || 'Unknown error message',
        stack: error.stack || 'No stack trace available',
        url: window.location.href,
        additionalContext: {
          componentStack: errorInfo.componentStack,
          errorBoundary: true,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          errorType: error.constructor.name,
          originalError: typeof error === 'object' ? JSON.stringify(error, null, 2) : String(error)
        }
      };

      const response = await fetch('/api/errors/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorData),
        credentials: 'include'
      });

      if (response.ok) {
        console.log('Error reported successfully to admin');
      } else {
        console.warn('Failed to report error to admin');
      }
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  };

  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }

      return <DefaultErrorFallback error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({ error, resetError }: { error?: Error; resetError: () => void }) {
  return (
    <Card className="max-w-2xl mx-auto mt-8">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-red-600">
          <AlertTriangle className="w-5 h-5" />
          <span>Something went wrong</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-gray-600 dark:text-gray-100">
          An unexpected error occurred while processing your request. The error has been reported automatically.
        </p>
        
        {error && (
          <details className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <summary className="cursor-pointer font-medium text-sm">
              Error Details
            </summary>
            <div className="mt-2 space-y-2">
              <div>
                <strong className="text-xs text-gray-700 dark:text-gray-200">Message:</strong>
                <pre className="text-xs text-gray-600 dark:text-gray-100 overflow-auto mt-1">
                  {error.message || 'No error message available'}
                </pre>
              </div>
              {error.stack && (
                <div>
                  <strong className="text-xs text-gray-700 dark:text-gray-200">Stack:</strong>
                  <pre className="text-xs text-gray-600 dark:text-gray-100 overflow-auto mt-1 max-h-32">
                    {error.stack}
                  </pre>
                </div>
              )}
              <div>
                <strong className="text-xs text-gray-700 dark:text-gray-200">Error Type:</strong>
                <span className="text-xs text-gray-600 dark:text-gray-100 ml-1">
                  {error.constructor?.name || 'Unknown'}
                </span>
              </div>
            </div>
          </details>
        )}
        
        <div className="flex space-x-3">
          <Button onClick={resetError} className="flex items-center space-x-2">
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </Button>
          <Button 
            variant="outline" 
            onClick={() => {
              // Reset the error boundary instead of reloading the page
              resetError();
              // Clear any cached state that might be causing issues
              if (window.sessionStorage) {
                window.sessionStorage.clear();
              }
            }}
          >
            Reset Application
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}