import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, FileText, Brain, CheckCircle } from "lucide-react";

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
  return (
    <Card className="p-8 mb-8">
      <CardContent className="text-center">
        <div className="flex flex-col items-center space-y-6">
          <div className="relative">
            <Loader2 className="w-16 h-16 text-primary animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Brain className="w-8 h-8 text-primary/60" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Analyzing Your Document
            </h3>
            <p className="text-gray-600 dark:text-gray-300 max-w-md">
              Our AI is carefully reviewing your document, identifying key terms, 
              and translating legal language into plain English.
            </p>
          </div>
          
          <div className="flex items-center space-x-8 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Document uploaded</span>
            </div>
            <div className="flex items-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Analyzing content</span>
            </div>
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-gray-400" />
              <span>Generating summary</span>
            </div>
          </div>
          
          <div className="text-xs text-gray-400 dark:text-gray-500">
            This typically takes 30-60 seconds depending on document length
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function UploadProgress({ fileName, progress }: { fileName: string; progress: number }) {
  return (
    <Card className="p-6 mb-8">
      <CardContent className="p-0">
        <div className="flex items-center space-x-4">
          <FileText className="w-8 h-8 text-primary" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900 dark:text-white truncate">
                {fileName}
              </span>
              <span className="text-sm text-gray-500">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}