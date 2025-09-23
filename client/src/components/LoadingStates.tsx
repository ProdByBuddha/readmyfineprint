import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  FileText,
  CheckCircle,
  Clock,
  Shield,
  Cpu,
  Sparkles
} from "lucide-react";

export type AnalysisStepStatus = "pending" | "active" | "complete";

export interface AnalysisStep {
  key: string;
  label: string;
  status: AnalysisStepStatus;
  description: string;
}

export interface AnalysisQueueDetails {
  queueLength: number;
  currentlyProcessing: number;
  concurrentLimit: number;
  userHasRequestInQueue: boolean;
  estimatedWaitSeconds: number;
  lastUpdatedSeconds: number;
}

export interface AnalysisProgressProps {
  headline: string;
  subheadline: string;
  progressPercent: number;
  steps: AnalysisStep[];
  elapsedSeconds: number;
  queueDetails?: AnalysisQueueDetails | null;
  queueStatusMessage?: string | null;
}

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

function formatElapsedTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function formatEstimate(seconds: number): string {
  if (seconds <= 0) {
    return "almost done";
  }

  if (seconds < 60) {
    const rounded = Math.max(5, Math.round(seconds / 5) * 5);
    return `${rounded}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  if (minutes >= 5) {
    return `${minutes}+ min`;
  }

  if (remainder === 0) {
    return `${minutes} min`;
  }

  const roundedSeconds = Math.round(remainder / 10) * 10;
  return `${minutes}m ${roundedSeconds === 60 ? 0 : roundedSeconds}s`;
}

export function AnalysisProgress({
  headline,
  subheadline,
  progressPercent,
  steps,
  elapsedSeconds,
  queueDetails,
  queueStatusMessage
}: AnalysisProgressProps) {
  const clampedProgress = Math.min(100, Math.max(0, progressPercent));
  const elapsedLabel = formatElapsedTime(elapsedSeconds);
  const showQueuePanel = !!queueDetails || !!queueStatusMessage;

  const getStatusIcon = (status: AnalysisStepStatus) => {
    if (status === "complete") {
      return <CheckCircle className="w-5 h-5 text-emerald-500" aria-hidden="true" />;
    }

    if (status === "active") {
      return (
        <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
          <Loader2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-spin" aria-hidden="true" />
        </div>
      );
    }

    return <div className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600 mt-2" aria-hidden="true" />;
  };

  const getStepIcon = (key: string) => {
    switch (key) {
      case "uploaded":
        return <FileText className="w-4 h-4 text-blue-500" aria-hidden="true" />;
      case "security":
        return <Shield className="w-4 h-4 text-emerald-500" aria-hidden="true" />;
      case "processing":
        return <Cpu className="w-4 h-4 text-indigo-500" aria-hidden="true" />;
      case "generating":
        return <Sparkles className="w-4 h-4 text-amber-500" aria-hidden="true" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen py-8">
      <div className="max-w-xl mx-auto w-full space-y-6 text-center">
        <div className="space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 mx-auto">
            <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {headline}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
              {subheadline}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <span>Elapsed</span>
            <span className="font-semibold text-gray-700 dark:text-gray-200">{elapsedLabel}</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 h-2 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${clampedProgress}%` }}
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="grid gap-4 text-left sm:grid-cols-2">
          {steps.map((step) => (
            <div
              key={step.key}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white/70 dark:bg-slate-900/40 backdrop-blur"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5" aria-hidden="true">
                  {getStatusIcon(step.status)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {getStepIcon(step.key)}
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {step.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    {step.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {showQueuePanel && (
          <div className="border border-blue-200 dark:border-blue-900 rounded-xl bg-blue-50/80 dark:bg-blue-950/20 p-5 text-left space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
              <Clock className="w-4 h-4" aria-hidden="true" />
              Live priority queue
            </div>

            {queueDetails && (
              <div className="grid gap-3 sm:grid-cols-3 text-sm text-blue-800 dark:text-blue-200">
                <div>
                  <p className="font-semibold">Queue ahead</p>
                  <p>
                    {queueDetails.queueLength === 0
                      ? "You're next"
                      : `${queueDetails.queueLength} document${queueDetails.queueLength === 1 ? "" : "s"}`}
                  </p>
                </div>
                <div>
                  <p className="font-semibold">Workers busy</p>
                  <p>
                    {queueDetails.currentlyProcessing}/{queueDetails.concurrentLimit}
                  </p>
                </div>
                <div>
                  <p className="font-semibold">Est. wait</p>
                  <p>{formatEstimate(queueDetails.estimatedWaitSeconds)}</p>
                </div>
              </div>
            )}

            {queueStatusMessage && (
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {queueStatusMessage}
              </p>
            )}

            {queueDetails && (
              <p className="text-xs text-blue-700/80 dark:text-blue-300/70">
                Updated {queueDetails.lastUpdatedSeconds <= 1 ? "just now" : `${queueDetails.lastUpdatedSeconds}s ago`} •
                {" "}
                {queueDetails.userHasRequestInQueue ? "Your request is locked in." : "Standing by for completion."}
              </p>
            )}
          </div>
        )}
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
