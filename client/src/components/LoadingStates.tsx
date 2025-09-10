import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, FileText, CheckCircle } from "lucide-react";

export function DocumentLoadingSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-screen py-8">
      <div className="max-w-md mx-auto w-full space-y-6">
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
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 border-b">
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
      </div>
    </div>
  );
}

export function AnalysisProgress() {
  return (
    <div className="flex items-center justify-center min-h-screen py-8">
      <div className="max-w-md mx-auto w-full text-center space-y-4">
        {/* Main Status */}
        <div className="flex items-center justify-center space-x-3">
          <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Analyzing Document
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This usually takes 10-30 seconds
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
        </div>

        {/* Status Steps */}
        <div className="flex items-center justify-center space-x-6 text-sm">
          <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span>Uploaded</span>
          </div>
          <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
            <div className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
            <span>Processing</span>
          </div>
          <div className="flex items-center space-x-2 text-gray-400 dark:text-gray-500">
            <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600"></div>
            <span>Generating</span>
          </div>
        </div>
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
