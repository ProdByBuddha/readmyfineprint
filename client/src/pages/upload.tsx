import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Shield, Clock, Zap, FileText, Users, ArrowRight, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { safeDispatchEvent } from "@/lib/safeDispatchEvent";
import { useAccessibility } from "@/hooks/useAccessibility";
import { usePreventFlicker } from "@/hooks/usePreventFlicker";
import { useStableCallback } from "@/hooks/useStableCallback";

// Component imports
import { FileUpload } from "@/components/FileUpload";
import { AnalysisResults } from "@/components/AnalysisResults";
import { SampleContracts } from "@/components/SampleContracts";
import { DocumentHistory } from "@/components/DocumentHistory";
import { AnalysisProgress, type AnalysisProgressProps } from "@/components/LoadingStates";
import { MobileAppWrapper } from "@/components/MobileAppWrapper";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { SecurityQuestionsModal } from "@/components/SecurityQuestionsModal";
// Temporarily disabled TradeSecretProtection due to interference with app functionality
// import TradeSecretProtection from "@/components/TradeSecretProtection";

// Hooks and services
import { useCombinedConsent } from "@/components/CombinedConsent";
import { useSecurityQuestionsHandler } from "@/hooks/useSecurityQuestionsHandler";

// API functions
import {
  analyzeDocument,
  getDocument,
  createDocument,
  getQueueStatus
} from "@/lib/api";
import type { Document } from "@shared/schema";

// Feature highlights for hero section
const features = [
  {
    icon: Shield,
    title: "Privacy-First Analysis",
    description: "Your documents are processed securely and not stored permanently. Strong encryption protects your data.",
    testId: "feature-privacy"
  },
  {
    icon: Zap,
    title: "AI-Powered Insights",
    description: "Advanced AI identifies risks, red flags, and opportunities in plain English.",
    testId: "feature-ai"
  },
  {
    icon: FileText,
    title: "Multiple Formats",
    description: "Support for PDF, DOCX, and text documents up to 25MB.",
    testId: "feature-formats"
  },
  {
    icon: Users,
    title: "Legal Expertise",
    description: "Insights based on thousands of legal documents and common contract issues.",
    testId: "feature-expertise"
  }
];

type QueueStatusResponse = Awaited<ReturnType<typeof getQueueStatus>>;
type QueueStatusSnapshot = QueueStatusResponse & { updatedAt: number };
type AnalysisStage = "preflight" | "queued" | "processing" | "generating";

const createInitialAnalysisDisplay = (): AnalysisProgressProps => ({
  headline: "Preparing secure analysis",
  subheadline: "Encrypting upload & calibrating privacy filters...",
  progressPercent: 18,
  steps: [
    {
      key: "uploaded",
      label: "Upload Received",
      status: "pending",
      description: "Waiting to begin secure processing."
    },
    {
      key: "security",
      label: "Security Screening",
      status: "pending",
      description: "Running zero-trust malware and privacy checks."
    },
    {
      key: "processing",
      label: "AI Analysis",
      status: "pending",
      description: "Clause and risk detection pipeline warming up."
    },
    {
      key: "generating",
      label: "Report Generation",
      status: "pending",
      description: "Summary builder standing by."
    }
  ],
  elapsedSeconds: 0,
  queueDetails: null,
  queueStatusMessage: null
});

export default function Upload() {
  // State management
  const [currentDocumentId, setCurrentDocumentId] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [consentRevoked, setConsentRevoked] = useState(false);
  const [analysisDisplay, setAnalysisDisplay] = useState<AnalysisProgressProps>(() => createInitialAnalysisDisplay());
  const [queueSnapshot, setQueueSnapshot] = useState<QueueStatusSnapshot | null>(null);
  const [queueStatusError, setQueueStatusError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Hooks
  const { toast } = useToast();
  const { isAccepted: consentAccepted } = useCombinedConsent();
  const { announce } = useAccessibility();
  const containerRef = usePreventFlicker();

  const {
    showSecurityQuestionsModal,
    handleApiError,
    handleSecurityQuestionsComplete,
    closeSecurityQuestionsModal
  } = useSecurityQuestionsHandler();

  const computeAnalysisDisplay = useCallback((
    elapsed: number,
    queue: QueueStatusSnapshot | null,
    queueError: string | null
  ): AnalysisProgressProps => {
    const stage: AnalysisStage = queue && queue.queueLength > 0
      ? "queued"
      : elapsed < 3
        ? "preflight"
        : elapsed < 12
          ? "processing"
          : "generating";

    const steps: AnalysisProgressProps["steps"] = [
      {
        key: "uploaded",
        label: "Upload Received",
        status: "complete",
        description: "Document stored in our encrypted workspace."
      },
      {
        key: "security",
        label: "Security Screening",
        status: stage === "preflight" ? "active" : "complete",
        description: stage === "preflight"
          ? "Running zero-trust malware scans and privacy redaction checks."
          : "Zero-trust scans cleared — privacy guardrails are active."
      },
      {
        key: "processing",
        label: "AI Analysis",
        status: stage === "processing" ? "active" : stage === "generating" ? "complete" : "pending",
        description: stage === "queued"
          ? queue
            ? `Waiting for secure worker (${queue.currentlyProcessing}/${queue.concurrentLimit} in use).`
            : "Waiting for secure worker allocation."
          : stage === "processing"
            ? "Extracting risky clauses, obligations, and unusual fees."
            : "Standing by to launch the AI review."
      },
      {
        key: "generating",
        label: "Report Generation",
        status: stage === "generating" ? "active" : "pending",
        description: stage === "generating"
          ? "Formatting summary, recommendations, and compliance checklist."
          : "Will assemble highlights immediately after analysis."
      }
    ];

    const headlineMap: Record<AnalysisStage, string> = {
      preflight: "Preparing secure workspace",
      queued: "Queued for priority processing",
      processing: "AI review in progress",
      generating: "Writing your summary"
    };

    let subheadline: string;
    if (stage === "preflight") {
      subheadline = "Encrypting your upload, validating file integrity, and calibrating privacy filters.";
    } else if (stage === "queued") {
      subheadline = queue
        ? `Priority queue active — ${queue.queueLength} ahead, ${queue.currentlyProcessing}/${queue.concurrentLimit} workers busy.`
        : "Priority queue active — holding your place in line.";
    } else if (stage === "processing") {
      subheadline = "Reading every clause, scoring risk, and cross-checking compliance baselines.";
    } else {
      subheadline = "Stitching together insights, obligations, and negotiation-ready highlights.";
    }

    let queueDetails: AnalysisProgressProps["queueDetails"] = null;
    let queueStatusMessage: string | null = queueError ?? null;

    if (queue) {
      const lastUpdatedSeconds = Math.max(0, Math.round((Date.now() - queue.updatedAt) / 1000));
      const estimatedWaitSeconds = Math.max(
        0,
        stage === "queued"
          ? queue.queueLength * 12 + 8
          : queue.userHasRequestInQueue
            ? 5
            : 0
      );

      queueDetails = {
        queueLength: queue.queueLength,
        currentlyProcessing: queue.currentlyProcessing,
        concurrentLimit: queue.concurrentLimit,
        userHasRequestInQueue: queue.userHasRequestInQueue,
        estimatedWaitSeconds,
        lastUpdatedSeconds
      };

      if (!queueError) {
        if (stage === "queued") {
          queueStatusMessage = queue.queueLength > 0
            ? `Holding your spot — ${queue.queueLength} document${queue.queueLength === 1 ? "" : "s"} ahead.`
            : "You're next — preparing a secure worker now.";
        } else if (stage === "processing") {
          queueStatusMessage = `Your document is processing on ${queue.concurrentLimit} secure workers (${queue.currentlyProcessing} active).`;
        } else if (stage === "generating") {
          queueStatusMessage = "Finalizing narrative summary and action items…";
        }
      }
    }

    let progressPercent: number;
    if (stage === "preflight") {
      progressPercent = Math.min(45, 18 + elapsed * 9);
    } else if (stage === "queued") {
      const waitBoost = Math.min(elapsed, 12);
      progressPercent = Math.min(62, Math.round(38 + waitBoost * 1.5));
    } else if (stage === "processing") {
      progressPercent = Math.min(85, Math.max(60, Math.round(55 + elapsed * 3.5)));
    } else {
      progressPercent = Math.min(97, Math.max(86, Math.round(78 + (elapsed - 10) * 2.5)));
    }

    return {
      headline: headlineMap[stage],
      subheadline,
      progressPercent: Math.min(99, Math.max(12, progressPercent)),
      steps,
      elapsedSeconds: Math.max(0, elapsed),
      queueDetails,
      queueStatusMessage,
    };
  }, []);

  useEffect(() => {
    if (!isAnalyzing) {
      setAnalysisDisplay(createInitialAnalysisDisplay());
      setQueueSnapshot(null);
      setQueueStatusError(null);
      setElapsedSeconds(0);
      return;
    }

    setAnalysisDisplay(computeAnalysisDisplay(0, queueSnapshot, queueStatusError));
  }, [computeAnalysisDisplay, isAnalyzing, queueSnapshot, queueStatusError]);

  useEffect(() => {
    if (!isAnalyzing || typeof window === "undefined") {
      return;
    }

    setElapsedSeconds(0);

    const timer = window.setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isAnalyzing]);

  useEffect(() => {
    if (!isAnalyzing) {
      return;
    }

    let cancelled = false;

    const refreshQueueStatus = async () => {
      try {
        const status = await getQueueStatus();
        if (!cancelled) {
          setQueueSnapshot({ ...status, updatedAt: Date.now() });
          setQueueStatusError(null);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to refresh queue status", error);
          setQueueStatusError("Unable to refresh live queue right now. We'll keep retrying automatically.");
        }
      }
    };

    refreshQueueStatus();

    if (typeof window === "undefined") {
      return () => {
        cancelled = true;
      };
    }

    const interval = window.setInterval(refreshQueueStatus, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isAnalyzing]);

  useEffect(() => {
    if (!isAnalyzing) {
      return;
    }

    setAnalysisDisplay(computeAnalysisDisplay(elapsedSeconds, queueSnapshot, queueStatusError));
  }, [computeAnalysisDisplay, elapsedSeconds, isAnalyzing, queueSnapshot, queueStatusError]);

  // Consent management
  useEffect(() => {
    const handleConsentRevoked = () => {
      console.log('Consent revoked - enabling privacy mode');
      setConsentRevoked(true);
    };

    const handleConsentChanged = () => {
      if (consentAccepted) {
        setConsentRevoked(false);
      }
    };

    window.addEventListener('consentRevoked', handleConsentRevoked);
    window.addEventListener('consentChanged', handleConsentChanged);

    return () => {
      window.removeEventListener('consentRevoked', handleConsentRevoked);
      window.removeEventListener('consentChanged', handleConsentChanged);
    };
  }, [consentAccepted]);

  // Document fetching
  const { data: currentDocument, isLoading: isLoadingDocument } = useQuery({
    queryKey: ['/api/documents', currentDocumentId],
    queryFn: () => currentDocumentId ? getDocument(currentDocumentId) : null,
    enabled: !!currentDocumentId,
    staleTime: 0, // Allow immediate refetch when analysis completes
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    notifyOnChangeProps: ['data', 'error'],
    structuralSharing: false,
    refetchInterval: isAnalyzing ? 2000 : false, // Poll every 2s during analysis
    retry: (failureCount: number, error: unknown) => {
      if (error instanceof Error && error.message.includes('404')) {
        setCurrentDocumentId(null);
        return false;
      }
      return failureCount < 3;
    },
  });

  // Document analysis mutation
  const analyzeDocumentMutation = useMutation({
    mutationFn: async (documentId: number) => {
      try {
        const queueStatus = await getQueueStatus();
        if (queueStatus.queueLength > 0) {
          toast({
            title: "Document queued for analysis",
            description: `Your document is in the processing queue. ${queueStatus.queueLength} documents ahead of you.`,
          });
        }
      } catch (error) {
        console.warn("Could not get queue status:", error);
      }

      return analyzeDocument(documentId);
    },
    onSuccess: (updatedDocument: Document) => {
      setIsAnalyzing(false);
      announce("Document analysis completed successfully", "polite");
      toast({
        title: "Analysis complete",
        description: "Your document has been analyzed successfully.",
      });

      // Force update both the individual document and the documents list
      queryClient.setQueryData(['/api/documents', updatedDocument.id], updatedDocument);
      queryClient.invalidateQueries({ queryKey: ['/api/documents', updatedDocument.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });

      // Force a refetch of the current document to ensure UI updates
      queryClient.refetchQueries({ queryKey: ['/api/documents', updatedDocument.id] });
    },
    onError: (error: unknown) => {
      setIsAnalyzing(false);

      if (!handleApiError(error)) {
        const errorMessage = error instanceof Error ? error.message : "Failed to analyze document";
        announce(`Analysis failed: ${errorMessage}`, "assertive");
        toast({
          title: "Analysis failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    },
  });

  // Event handlers
  const handleDocumentCreated = useCallback(async (documentId: number) => {
    setCurrentDocumentId(documentId);

    if (consentRevoked && !consentAccepted) {
      announce("Cannot analyze documents while consent is revoked", "assertive");
      toast({
        title: "Consent Required",
        description: "Please accept our terms and conditions to analyze documents",
        variant: "destructive",
      });
      return;
    }

    if (!consentAccepted) {
      console.log('Document analysis requires consent, triggering consent modal');
      safeDispatchEvent('consentRequired', {
        detail: { reason: 'Document analysis requires consent' },
      });
      announce("Please accept our terms to analyze documents", "polite");
      toast({
        title: "Consent Required",
        description: "Please accept our terms and conditions before analyzing any documents",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    announce("Starting document analysis", "polite");

    try {
      await analyzeDocumentMutation.mutateAsync(documentId);
    } catch (error) {
      console.error("Analysis error:", error);
    }
  }, [analyzeDocumentMutation, announce, consentAccepted, consentRevoked, toast]);

  const handleDocumentSelect = useStableCallback((documentId: number | null) => {
    setCurrentDocumentId(documentId);
    setIsAnalyzing(false);

    if (documentId) {
      announce("Document selected from history", "polite");
    }
  });

  const handleNewAnalysis = useCallback(() => {
    setCurrentDocumentId(null);
    setIsAnalyzing(false);
    announce("Starting new document analysis", "polite");
  }, [announce]);

  const hasSubscription = useCallback(() => {
    const subscriptionToken = localStorage.getItem('subscriptionToken');
    return !!subscriptionToken;
  }, []);

  const handleSampleContract = useCallback(async (title: string, content: string) => {
    if (!consentAccepted) {
      const message = "Please accept the terms and privacy policy to process any documents, including sample contracts.";
      announce(message, "assertive");

      safeDispatchEvent('consentRequired', {
        detail: { reason: 'Sample contract processing requires consent' },
      });

      toast({
        title: "Consent Required",
        description: message,
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("Creating sample document:", title);

      const document = await createDocument({
        title: `Sample: ${title}`,
        content
      });

      console.log("Sample document created:", document);
      await handleDocumentCreated(document.id);
    } catch (error) {
      console.error("Error with sample contract:", error);

      if (handleApiError(error)) {
        return;
      }

      let errorMessage = "Failed to process sample contract";

      if (error instanceof Error) {
        if (error.message.includes("<!DOCTYPE") || error.message.includes("not valid JSON")) {
          errorMessage = "Server error occurred. Please refresh the page and try again.";
        } else if (error.message.includes("Network")) {
          errorMessage = "Network connection issue. Please check your connection and try again.";
        } else {
          errorMessage = error.message;
        }
      }

      announce(`Sample contract processing failed: ${errorMessage}`, "assertive");
      toast({
        title: "Sample contract failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [consentAccepted, toast, announce, handleDocumentCreated, handleApiError]);

  // Render hero section
  const renderHeroSection = () => (
    <section
      className="text-center mb-16 animate-fade-in-scale"
      role="banner"
      aria-labelledby="hero-heading"
      data-testid="hero-section"
    >
      <div className="max-w-5xl mx-auto">

        <h1
          id="hero-heading"
          className="text-5xl md:text-6xl lg:text-7xl font-black mb-8 leading-[0.9] tracking-tight"
          data-testid="hero-title"
        >
          <span className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 dark:from-white dark:via-blue-100 dark:to-white bg-clip-text text-transparent">
            Transform Legal
          </span>
          <br />
          <span className="bg-gradient-to-r from-primary via-blue-600 to-secondary bg-clip-text text-transparent">
            Document Analysis
          </span>
        </h1>

        <p
          className="text-xl md:text-2xl lg:text-3xl text-slate-700 dark:text-slate-300 mb-12 max-w-4xl mx-auto leading-relaxed font-light"
          data-testid="hero-description"
        >
          Upload contracts, agreements, and legal documents to get <span className="font-semibold text-primary">instant AI-powered analysis</span> highlighting risks, opportunities, and key insights with <span className="font-semibold text-secondary">strong security</span>.
        </p>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mt-16" data-testid="features-grid">
          {features.map((feature, index) => (
            <Card
              key={feature.testId}
              className="group text-center p-8 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-xl hover:shadow-primary/10"
              data-testid={feature.testId}
            >
              <CardContent className="p-0">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 dark:from-primary/20 dark:to-secondary/20 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <feature.icon
                    className="w-8 h-8 text-primary"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="font-bold text-xl mb-4 text-slate-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Privacy Notice */}
        <Card
          className="max-w-4xl mx-auto mt-16 p-8 bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-blue-50/80 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-blue-950/30 border-0 shadow-2xl backdrop-blur-lg"
          role="alert"
          aria-labelledby="privacy-notice"
          data-testid="privacy-notice"
        >
          <CardContent className="p-0">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-teal-600/20 dark:from-emerald-400/10 dark:to-teal-500/10 rounded-xl">
                <Shield className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-xl font-bold text-emerald-800 dark:text-emerald-200 mb-3">
                  🔐 Strong Security & Privacy
                </h3>
                <p className="text-emerald-700 dark:text-emerald-300 leading-relaxed text-lg">
                  Your documents are processed with <strong>strong encryption</strong> and our proprietary
                  privacy-preserving AI. <strong className="text-emerald-800 dark:text-emerald-200">Zero permanent storage</strong> —
                  confidentiality with immediate deletion after analysis.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );

  // Render upload workflow
  const renderUploadWorkflow = () => (
    <div className="space-y-12" data-testid="upload-workflow">
      {/* Compact Intro Section */}
      <section className="text-center mb-8" data-testid="upload-intro">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black mb-4 leading-tight tracking-tight">
            <span className="bg-gradient-to-r from-primary via-blue-600 to-secondary bg-clip-text text-transparent">
              Upload & Analyze Documents
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-700 dark:text-slate-300 mb-6 max-w-3xl mx-auto leading-relaxed">
            Get instant AI-powered analysis of contracts, agreements, and legal documents with
            <span className="font-semibold text-primary"> strong security</span> and
            <span className="font-semibold text-secondary"> privacy protection</span>.
          </p>
        </div>
      </section>

      {/* File Upload Section */}
      <section aria-labelledby="upload-section" data-testid="file-upload-section">
        <h2 id="upload-section" className="sr-only">Upload Document</h2>
        <FileUpload
          onDocumentCreated={handleDocumentCreated}
          disabled={!consentAccepted}
          consentAccepted={consentAccepted}
        />
      </section>

      {/* Sample Contracts - Only show for free tier users */}
      {!hasSubscription() && (
        <section aria-labelledby="samples-section" data-testid="sample-contracts-section" className="mt-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-6 leading-tight">
              Try Our Sample
              <br />
              <span className="bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                Legal Documents
              </span>
            </h2>
            <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 max-w-4xl mx-auto leading-relaxed font-light">
              Get started instantly with these <strong className="font-semibold text-primary">example contracts</strong>. Perfect for understanding
              how our AI analysis works before uploading your own documents.
            </p>
          </div>
          <SampleContracts
            onSelectContract={handleSampleContract}
            disabled={false}
          />
        </section>
      )}
    </div>
  );

  // Render analysis progress
  const renderAnalysisProgress = () => (
    <section
      aria-labelledby="analysis-progress"
      aria-live="polite"
      className="animate-fade-in-scale flex items-center justify-center min-h-[60vh]"
      data-testid="analysis-progress-section"
    >
      <h2 id="analysis-progress" className="sr-only">Analysis in Progress</h2>
      <div className="w-full max-w-2xl">
        <AnalysisProgress {...analysisDisplay} />
      </div>
    </section>
  );

  // Render results section
  const renderResults = () => (
    <section
      aria-labelledby="analysis-results"
      className="animate-fade-in-scale space-y-8"
      data-testid="analysis-results-section"
    >
      {/* Results Header */}
      <Card className="bg-gradient-to-r from-primary/5 via-blue-50/50 to-secondary/5 dark:from-primary/10 dark:via-slate-800/50 dark:to-secondary/10 border-0 shadow-xl backdrop-blur-xl p-8">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl">
                <CheckCircle className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2
                  id="analysis-results"
                  className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-2 leading-tight"
                  data-testid="results-title"
                >
                  Analysis Complete
                </h2>
                <p className="text-xl text-slate-600 dark:text-slate-300 font-light">
                  AI-powered insights for your document
                </p>
                <Badge className="mt-2 px-3 py-1 bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700/30">
                  <Zap className="w-3 h-3 mr-1" />
                  Professional Analysis
                </Badge>
              </div>
            </div>

            <Button
              onClick={handleNewAnalysis}
              size="lg"
              className="group bg-gradient-to-r from-primary via-blue-600 to-primary hover:from-primary/90 hover:via-blue-600/90 hover:to-primary/90 text-white px-8 py-4 text-lg font-bold shadow-xl hover:shadow-primary/25 transition-all duration-300 transform hover:-translate-y-1"
              aria-label="Start a new document analysis"
              data-testid="button-new-analysis"
            >
              <Plus className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform duration-300" aria-hidden="true" />
              New Analysis
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Results Component */}
      {currentDocument && <AnalysisResults document={currentDocument} />}
    </section>
  );

  // Render loading state
  const renderLoadingState = () => (
    <section
      aria-labelledby="loading-document"
      aria-live="polite"
      className="flex justify-center items-center py-12"
      data-testid="document-loading-section"
    >
      <h2 id="loading-document" className="sr-only">Loading Document</h2>
      <div className="flex items-center space-x-3 text-gray-600 dark:text-gray-300">
        <Clock className="w-6 h-6 animate-pulse" aria-hidden="true" />
        <span>Loading document...</span>
      </div>
    </section>
  );

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-blue-950"
      data-testid="upload-page"
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5 dark:opacity-10" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
      {/* Temporarily disabled TradeSecretProtection due to interference with app functionality */}
      {/* <TradeSecretProtection /> */}

      <MobileAppWrapper>
        {/* Cookie Consent Banner */}
        {!consentAccepted && (
          <CookieConsentBanner
            onAccept={() => {
              // The event listener will trigger the update
            }}
          />
        )}

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 pb-20">
          {/* Document History - Always show if documents exist */}
          <section aria-label="Document history" className="animate-fade-in-scale mb-8">
            <DocumentHistory
              onSelectDocument={handleDocumentSelect}
              currentDocumentId={currentDocumentId}
            />
          </section>

          {/* Main Content */}
          <main>
            {/* Upload Workflow - Show when no document or analysis - PRIORITY PLACEMENT */}
            {!currentDocumentId && !isAnalyzing && renderUploadWorkflow()}

            {/* Hero Section - Only show when no current document - MOVED BELOW UPLOAD */}
            {!currentDocumentId && !isAnalyzing && renderHeroSection()}

            {/* Analysis Progress */}
            {isAnalyzing && renderAnalysisProgress()}

            {/* Analysis Results */}
            {currentDocument && !isAnalyzing && renderResults()}

            {/* Document Loading State */}
            {isLoadingDocument && renderLoadingState()}
          </main>
        </div>
      </MobileAppWrapper>

      {/* Security Questions Modal */}
      <SecurityQuestionsModal
        isOpen={showSecurityQuestionsModal}
        onComplete={handleSecurityQuestionsComplete}
        onClose={closeSecurityQuestionsModal}
        allowClose={false}
        title="Security Questions Required"
        description="To continue using document analysis features, please set up security questions to help protect your account."
      />
    </div>
  );
}