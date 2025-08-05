'use client';

'use client';

'use client';

import { Card, CardContent } from "components/ui/card";
'use client';
import { Plus } from "lucide-react";
import { Button } from "components/ui/button";
import { Loader2 } from "lucide-react";
import { useStableCallback } from "hooks/useStableCallback";
import { usePreventFlicker } from "hooks/usePreventFlicker";
import { FileUpload } from "components/FileUpload";
import { AnalysisResults } from "components/AnalysisResults";
import { SampleContracts } from "components/SampleContracts";
import { DocumentHistory } from "components/DocumentHistory";
import { AnalysisProgress } from "components/LoadingStates";
import TradeSecretProtection from "components/TradeSecretProtection";

import { MobileAppWrapper } from "components/MobileAppWrapper";
import { useCombinedConsent } from "components/CombinedConsent";
import { CookieConsentBanner } from "components/CookieConsentBanner";
import { useAccessibility } from "hooks/useAccessibility";

import { analyzeDocument, getDocument, createDocument, getQueueStatus } from "lib/api";
import { useToast } from "hooks/use-toast";
import { queryClient } from "lib/queryClient";
import { usePathname, useRouter } from "next/navigation";
import type { Document } from "@shared/schema";
import { useSecurityQuestionsHandler } from "hooks/useSecurityQuestionsHandler";
import { SecurityQuestionsModal } from "components/SecurityQuestionsModal";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";

export default function Upload() {
  const [currentDocumentId, setCurrentDocumentId] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [consentRevoked, setConsentRevoked] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
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

  // Listen for consent revocation events
  useEffect(() => {
    const handleConsentRevoked = () => {
      console.log('Consent revoked - enabling gray mode');
      setConsentRevoked(true);
    };

    const handleConsentChanged = () => {
      // Reset revoked state when consent is accepted again
      if (consentAccepted) {
        setConsentRevoked(false);
      }
    };

    window.addEventListener('consentRevoked', handleConsentRevoked as EventListener);
    window.addEventListener('consentChanged', handleConsentChanged as EventListener);

    return () => {
      window.removeEventListener('consentRevoked', handleConsentRevoked as EventListener);
      window.removeEventListener('consentChanged', handleConsentChanged as EventListener);
    };
  }, [announce, toast, consentAccepted]);

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
    retry: (failureCount, error) => {
      // Don't retry on 404 - document was likely deleted
      if (error instanceof Error && error.message.includes('404')) {
        // Clear the current document ID since it no longer exists
        setCurrentDocumentId(null);
        return false;
      }
      // Retry other errors up to 3 times
      return failureCount < 3;
    },
  });

  const analyzeDocumentMutation = useMutation({
    mutationFn: async (documentId: number) => {
      // Show initial queue status
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
      announce("Document analysis completed successfully", 'polite');
      toast({
        title: "Analysis complete",
        description: "Your document has been analyzed successfully.",
      });
      // Update the query cache with the analyzed document
      queryClient.setQueryData(['/api/documents', updatedDocument.id], updatedDocument);
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    },
    onError: (error) => {
      setIsAnalyzing(false);
      
      // Check if this is a security questions requirement error
      if (!handleApiError(error)) {
        // If not a security questions error, show the regular error message
        const errorMessage = error instanceof Error ? error.message : "Failed to analyze document";
        announce(`Analysis failed: ${errorMessage}`, 'assertive');
        toast({
          title: "Analysis failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    },
  });

  const handleDocumentCreated = useCallback(async (documentId: number) => {
    setCurrentDocumentId(documentId);
    
    // Check if consent is revoked
    if (consentRevoked && !consentAccepted) {
      announce("Cannot analyze documents while consent is revoked", 'assertive');
      toast({
        title: "Consent Required",
        description: "Please accept our terms and conditions to analyze documents",
        variant: "destructive",
      });
      return;
    }
    
    // Check if this is a sample contract
    const documentsQuery = queryClient.getQueryData(['/api/documents']) as Document[] | undefined;
    const document = documentsQuery?.find(d => d.id === documentId);
    const isSampleContract = document && document.title && [
      'sample', 'example', 'demo', 'template',
      'residential lease', 'employment agreement', 'nda',
      'service agreement', 'rental agreement'
    ].some(keyword => document.title.toLowerCase().includes(keyword.toLowerCase()));
    
    // Always require consent for document analysis (including sample contracts)
    if (!consentAccepted) {
      console.log('Document analysis requires consent, triggering consent modal');
      // Trigger consent modal via custom event
      window.dispatchEvent(new CustomEvent('consentRequired', { 
        detail: { reason: 'Document analysis requires consent' }
      }));
      announce("Please accept our terms to analyze documents", 'polite');
      toast({
        title: "Consent Required",
        description: "Please accept our terms and conditions before analyzing any documents",
        variant: "destructive",
      });
      return;
    }
    
    setIsAnalyzing(true);
    announce("Starting document analysis", 'polite');
    try {
      await analyzeDocumentMutation.mutateAsync(documentId);
    } catch (error) {
      console.error("Analysis error:", error);
    }
  }, [analyzeDocumentMutation, announce, consentAccepted, consentRevoked, toast, queryClient]);

  const handleDocumentSelect = useStableCallback((documentId: number | null) => {
    setCurrentDocumentId(documentId);
    setIsAnalyzing(false);
    if (documentId) {
      announce("Document selected from history", 'polite');
    }
  });

  const handleNewAnalysis = useCallback(() => {
    setCurrentDocumentId(null);
    setIsAnalyzing(false);
    announce("Starting new document analysis", 'polite');
  }, [announce]);

  // Check if user has a subscription (non-free tier)
  const hasSubscription = useCallback(() => {
    const subscriptionToken = localStorage.getItem('subscriptionToken');
    return !!subscriptionToken;
  }, []);

  const handleSampleContract = useCallback(async (title: string, content: string) => {
    // Always check if consent is accepted before processing any documents
    if (!consentAccepted) {
      const message = "Please accept the terms and privacy policy to process any documents, including sample contracts.";
      announce(message, 'assertive');
      
      // Trigger consent modal
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
      
      // Use the existing document creation and analysis flow
      const document = await createDocument({ title: `Sample: ${title}`, content });
      console.log("Sample document created:", document);
      
      await handleDocumentCreated(document.id);
    } catch (error) {
      console.error("Error with sample contract:", error);
      
      // Check if this is a security questions requirement error
      if (handleApiError(error)) {
        return; // Error handled by security questions modal
      }
      
      // Handle different types of errors
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
      
      announce(`Sample contract processing failed: ${errorMessage}`, 'assertive');
      toast({
        title: "Sample contract failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [consentAccepted, toast, announce, handleDocumentCreated]);

  return (
    <div ref={containerRef} className="bg-gray-50 dark:bg-gray-900 page-transition min-h-screen">
      <TradeSecretProtection />
      <MobileAppWrapper>
        {/* Cookie Consent Banner */}
        {!consentAccepted && (
          <CookieConsentBanner onAccept={() => {
            // The event listener in the hook will trigger the update
          }} />
        )}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Document History */}
          <section aria-label="Document history" className="animate-fade-in-scale">
            <DocumentHistory
              onSelectDocument={handleDocumentSelect}
              currentDocumentId={currentDocumentId}
            />
          </section>

          {/* Page Header */}
          {!currentDocumentId && (
            <section className="text-center mb-12 animate-fade-in-scale" role="banner" aria-labelledby="upload-heading">
              <h1 id="upload-heading" className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4">
                Upload & Analyze Documents
              </h1>
              <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-4 max-w-3xl mx-auto">
                Upload your contracts, agreements, and legal documents to get AI-powered analysis and insights.
              </p>
            </section>
          )}

          {/* Main Content Area - Upload and Samples */}
          {!currentDocumentId && !isAnalyzing && (
            <div className="animate-fade-in-scale">
              <section aria-labelledby="upload-section" className="mb-8">
                <h2 id="upload-section" className="sr-only">Upload Document</h2>
                <FileUpload
                  onDocumentCreated={handleDocumentCreated}
                  disabled={!consentAccepted}
                  consentAccepted={consentAccepted}
                />
              </section>

              {/* Only show sample contracts for free tier users */}
              {!hasSubscription() && (
                <section aria-labelledby="samples-section" className="mb-8">
                  <h2 id="samples-section" className="sr-only">Sample Contracts</h2>
                  <SampleContracts
                    onSelectContract={handleSampleContract}
                    disabled={false}
                  />
                </section>
              )}
            </div>
          )}

          {/* Analysis Progress */}
          {isAnalyzing && (
            <section aria-labelledby="analysis-progress" aria-live="polite" className="animate-fade-in-scale flex items-center justify-center min-h-[60vh]">
              <h2 id="analysis-progress" className="sr-only">Analysis in Progress</h2>
              <div className="w-full max-w-2xl">
                <AnalysisProgress />
              </div>
            </section>
          )}

          {/* Analysis Results */}
          {currentDocument && !isAnalyzing && (
            <section aria-labelledby="analysis-results" className="animate-fade-in-scale">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h2 id="analysis-results" className="text-2xl font-bold text-gray-900 dark:text-white">
                  Analysis Results
                </h2>
                <Button
                  onClick={handleNewAnalysis}
                  variant="outline"
                  className="flex items-center gap-2"
                  aria-label="Start a new document analysis"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  New Analysis
                </Button>
              </div>
              <AnalysisResults document={currentDocument} />
            </section>
          )}

          {/* Loading State */}
          {isLoadingDocument && (
            <section aria-labelledby="loading-document" aria-live="polite" className="flex justify-center items-center py-12">
              <h2 id="loading-document" className="sr-only">Loading Document</h2>
              <div className="flex items-center space-x-3 text-gray-600 dark:text-gray-300">
                <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
                <span>Loading document...</span>
              </div>
            </section>
          )}
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