import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
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

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error boundary caught an error:', error, errorInfo);
  }

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
        <p className="text-gray-600 dark:text-gray-300">
          An unexpected error occurred while processing your request.
        </p>
        
        {error && (
          <details className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <summary className="cursor-pointer font-medium text-sm">
              Error Details
            </summary>
            <pre className="mt-2 text-xs text-gray-600 dark:text-gray-300 overflow-auto">
              {error.message}
            </pre>
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