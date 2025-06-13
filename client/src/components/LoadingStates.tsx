import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, FileText, Brain, CheckCircle } from "lucide-react";
import { useEffect } from "react";

export function DocumentLoadingSkeleton() {
  return (
    <Card className="p-8 mb-8">
      <CardContent className="p-0">
        <div className="animate-pulse space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex space-x-2">
              <Skeleton className="h-10 w-20" />
              <Skeleton className="h-10 w-20" />
            </div>
          </div>
          
          <Skeleton className="h-32 w-full" />
          
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-3">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-5 w-24" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
          
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border rounded-lg">
                <div className="bg-gray-50 p-4 border-b">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                </div>
                <div className="p-6">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-4/5 mb-4" />
                  <Skeleton className="h-16 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AnalysisProgress() {
  useEffect(() => {
    // Prevent body scrolling when modal is mounted
    document.body.classList.add('modal-open');
    
    return () => {
      // Re-enable body scrolling when modal is unmounted
      document.body.classList.remove('modal-open');
    };
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4">
        <Card className="p-6 bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-blue-950/95 dark:via-gray-900/95 dark:to-cyan-950/95 border-0 shadow-2xl">
          <CardContent className="text-center p-0">
            <div className="flex flex-col items-center space-y-5">
              {/* Animated Loading Icon */}
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 opacity-20 animate-pulse"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Brain className="w-6 h-6 text-blue-500 dark:text-blue-300" />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Title and Description */}
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Analysis in Progress
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 max-w-sm leading-relaxed">
                  Reviewing your document with advanced document analysis to identify key terms, risks, and translate legal language into clear insights.
                </p>
              </div>
              
              {/* Progress Steps - Mobile Optimized */}
              <div className="w-full max-w-sm">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm font-medium text-green-700 dark:text-green-400">Document Uploaded</span>
                    </div>
                    <div className="w-4 h-0.5 bg-green-500 rounded"></div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center animate-pulse">
                        <Loader2 className="w-3 h-3 text-white animate-spin" />
                      </div>
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Analyzing Content</span>
                    </div>
                    <div className="w-4 h-0.5 bg-blue-500 rounded animate-pulse"></div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                        <FileText className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">Generating Summary</span>
                    </div>
                    <div className="w-4 h-0.5 bg-gray-300 dark:bg-gray-600 rounded"></div>
                  </div>
                </div>
              </div>
              
              {/* Estimated Time */}
              <div className="bg-blue-50 dark:bg-blue-950/50 rounded-lg px-4 py-2 mt-2">
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                  Estimated time: 10-30 seconds
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function UploadProgress({ fileName, progress }: { fileName: string; progress: number }) {
  return (
    <Card className="p-5 mb-8 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800 shadow-lg">
      <CardContent className="p-0">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
              <FileText className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            {progress < 100 && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                <Loader2 className="w-2.5 h-2.5 text-white animate-spin" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900 dark:text-white truncate text-sm">
                {fileName}
              </span>
              <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                {progress}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-green-500 to-emerald-500 h-2.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {progress < 100 ? 'Uploading...' : 'Upload complete'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}