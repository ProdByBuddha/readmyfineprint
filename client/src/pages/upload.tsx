import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Shield, Clock, Zap, FileText, Users, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useAccessibility } from "@/hooks/useAccessibility";
import { usePreventFlicker } from "@/hooks/usePreventFlicker";
import { useStableCallback } from "@/hooks/useStableCallback";

// Component imports
import { FileUpload } from "@/components/FileUpload";
import { AnalysisResults } from "@/components/AnalysisResults";
import { SampleContracts } from "@/components/SampleContracts";
import { DocumentHistory } from "@/components/DocumentHistory";
import { AnalysisProgress } from "@/components/LoadingStates";
import { MobileAppWrapper } from "@/components/MobileAppWrapper";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { SecurityQuestionsModal } from "@/components/SecurityQuestionsModal";
import TradeSecretProtection from "@/components/TradeSecretProtection";

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
    description: "Your documents never leave our secure servers. Enterprise-grade encryption protects your data.",
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

export default function Upload() {
  // State management
  const [currentDocumentId, setCurrentDocumentId] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [consentRevoked, setConsentRevoked] = useState(false);

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
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    notifyOnChangeProps: ['data', 'error'],
    structuralSharing: false,
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
      
      queryClient.setQueryData(['/api/documents', updatedDocument.id], updatedDocument);
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
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
      window.dispatchEvent(new CustomEvent('consentRequired', { 
        detail: { reason: 'Document analysis requires consent' }
      }));
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
      
      window.dispatchEvent(new CustomEvent('consentRequired', { 
        detail: { reason: 'Sample contract processing requires consent' }
      }));
      
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
      className="text-center mb-12 animate-fade-in-scale" 
      role="banner" 
      aria-labelledby="hero-heading"
      data-testid="hero-section"
    >
      <div className="max-w-4xl mx-auto">
        <h1 
          id="hero-heading" 
          className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6"
          data-testid="hero-title"
        >
          Analyze Your Documents with AI
        </h1>
        
        <p 
          className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto"
          data-testid="hero-description"
        >
          Upload contracts, agreements, and legal documents to get instant AI-powered analysis 
          highlighting risks, opportunities, and key insights in plain English.
        </p>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
          {features.map((feature, index) => (
            <Card 
              key={feature.testId}
              className="text-center p-6 hover:shadow-lg transition-shadow duration-300"
              data-testid={feature.testId}
            >
              <CardContent className="p-0">
                <feature.icon 
                  className="w-12 h-12 text-primary mx-auto mb-4" 
                  aria-hidden="true"
                />
                <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Privacy Badge */}
        <div className="mt-12 inline-flex items-center gap-2 bg-green-50 dark:bg-green-950/20 px-4 py-2 rounded-full">
          <Shield className="w-5 h-5 text-green-600 dark:text-green-400" aria-hidden="true" />
          <span className="text-green-800 dark:text-green-200 font-medium text-sm">
            Enterprise-Grade Security & Privacy
          </span>
        </div>
      </div>
    </section>
  );

  // Render upload workflow
  const renderUploadWorkflow = () => (
    <div className="space-y-12" data-testid="upload-workflow">
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
        <section aria-labelledby="samples-section" data-testid="sample-contracts-section">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Try Our Sample Contracts
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Get started instantly with these example contracts. Perfect for understanding 
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
        <AnalysisProgress />
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
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 
              id="analysis-results" 
              className="text-3xl font-bold text-gray-900 dark:text-white mb-2"
              data-testid="results-title"
            >
              Analysis Results
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              AI-powered insights for your document
            </p>
          </div>
          
          <Button
            onClick={handleNewAnalysis}
            size="lg"
            className="flex items-center gap-2 bg-primary hover:bg-primary/90"
            aria-label="Start a new document analysis"
            data-testid="button-new-analysis"
          >
            <Plus className="w-5 h-5" aria-hidden="true" />
            New Analysis
          </Button>
        </div>
      </div>

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
      className="bg-gray-50 dark:bg-gray-900 min-h-screen"
      data-testid="upload-page"
    >
      <TradeSecretProtection />
      
      <MobileAppWrapper>
        {/* Cookie Consent Banner */}
        {!consentAccepted && (
          <CookieConsentBanner 
            onAccept={() => {
              // The event listener will trigger the update
            }} 
          />
        )}
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Document History - Always show if documents exist */}
          <section aria-label="Document history" className="animate-fade-in-scale">
            <DocumentHistory
              onSelectDocument={handleDocumentSelect}
              currentDocumentId={currentDocumentId}
            />
          </section>

          {/* Main Content */}
          <main>
            {/* Hero Section - Only show when no current document */}
            {!currentDocumentId && !isAnalyzing && renderHeroSection()}

            {/* Upload Workflow - Show when no document or analysis */}
            {!currentDocumentId && !isAnalyzing && renderUploadWorkflow()}

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