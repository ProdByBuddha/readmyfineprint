import { useState, useMemo, useCallback, useEffect } from "react";
import { useStableCallback } from "@/hooks/useStableCallback";
import { usePreventFlicker } from "@/hooks/usePreventFlicker";
import { useMutation, useQuery } from "@tanstack/react-query";
import { File, Plus, Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { FileUpload } from "@/components/FileUpload";
import { AnalysisResults } from "@/components/AnalysisResults";
import { SampleContracts } from "@/components/SampleContracts";
import { DocumentHistory } from "@/components/DocumentHistory";
import { AnalysisProgress } from "@/components/LoadingStates";

import { MobileAppWrapper } from "@/components/MobileAppWrapper";
import { useCombinedConsent, CombinedConsent } from "@/components/CombinedConsent";
import { useAccessibility } from "@/hooks/useAccessibility";
import { analyzeDocument, getDocument, createDocument } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { generateFAQSchema, updateSEO } from "@/lib/seo";
import type { Document } from "@shared/schema";

export default function Home() {
  const [currentDocumentId, setCurrentDocumentId] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();
  const { isAccepted: consentAccepted } = useCombinedConsent();
  const { announce } = useAccessibility();
  const containerRef = usePreventFlicker();

  // Add FAQ structured data for SEO
  useEffect(() => {
    const faqData = [
      {
        question: "How accurate are the summaries?",
        answer: "Our advanced analysis engine has processed thousands of legal documents and is trained to identify common patterns and concerning clauses. While highly accurate, we recommend consulting with a legal professional for critical decisions."
      },
      {
        question: "Is my document data secure?",
        answer: "Yes, all documents are encrypted in transit and at rest. We don't store your documents after analysis, and you can delete your summaries at any time."
      },
      {
        question: "What types of documents can I analyze?",
        answer: "We support contracts, terms of service, privacy policies, employment agreements, rental agreements, and most other legal documents in English."
      }
    ];

    updateSEO({
      structuredData: generateFAQSchema(faqData)
    });
  }, []);

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
  });

  const analyzeDocumentMutation = useMutation({
    mutationFn: (documentId: number) => analyzeDocument(documentId),
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
      const errorMessage = error instanceof Error ? error.message : "Failed to analyze document";
      announce(`Analysis failed: ${errorMessage}`, 'assertive');
      toast({
        title: "Analysis failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleDocumentCreated = useCallback(async (documentId: number) => {
    // Check if consent is accepted
    if (!consentAccepted) {
      const message = "Please accept the terms and privacy policy to process documents.";
      announce(message, 'assertive');
      toast({
        title: "Consent Required",
        description: message,
        variant: "destructive",
      });
      return;
    }

    setCurrentDocumentId(documentId);
    setIsAnalyzing(true);
    announce("Starting document analysis", 'polite');
    try {
      await analyzeDocumentMutation.mutateAsync(documentId);
    } catch (error) {
      console.error("Analysis error:", error);
    }
  }, [consentAccepted, toast, analyzeDocumentMutation, announce]);

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

  const handleSampleContract = useCallback(async (title: string, content: string) => {
    // Check if consent is accepted
    if (!consentAccepted) {
      const message = "Please accept the terms and privacy policy to process documents.";
      announce(message, 'assertive');
      toast({
        title: "Consent Required",
        description: message,
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    announce(`Loading sample contract: ${title}`, 'polite');
    try {
      const document = await createDocument({
        title: `Sample: ${title}`,
        content,
      });
      await handleDocumentCreated(document.id);
    } catch (error) {
      setIsAnalyzing(false);
      const errorMessage = error instanceof Error ? error.message : "Failed to load sample contract";
      announce(`Failed to load sample: ${errorMessage}`, 'assertive');
      toast({
        title: "Failed to load sample",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [consentAccepted, toast, handleDocumentCreated, announce]);

  // Show combined consent if not accepted
  if (!consentAccepted) {
    return <CombinedConsent onAccept={() => {
      // The hook will automatically update and trigger a re-render
    }} />;
  }

  return (
    <div ref={containerRef} className="bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-slate-800 page-transition min-h-full">
      <MobileAppWrapper>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Document History */}
          <section aria-label="Document history" className="animate-fade-in-scale">
            <DocumentHistory
              onSelectDocument={handleDocumentSelect}
              currentDocumentId={currentDocumentId}
            />
          </section>

          {/* Hero Section */}
          {!currentDocumentId && (
            <section className="text-center mb-12 animate-fade-in-scale" role="banner" aria-labelledby="main-heading">
              <h1 id="main-heading" className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4">
                Understand Any Contract in{" "}
                <span className="text-primary">Plain English</span>
              </h1>
              <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-4 max-w-3xl mx-auto">
                Upload or paste any legal document and get instant, clear summaries that
                highlight what matters most. No legal degree required.
              </p>

              {/* Features highlight for SEO */}
              <div className="mb-6 max-w-4xl mx-auto">
                <h2 className="sr-only">Key Features</h2>
                <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-300" role="list">
                  <li className="flex items-center justify-center gap-2">
                    <span className="w-2 h-2 bg-primary rounded-full" aria-hidden="true"></span>
                    <span>Advanced Analysis</span>
                  </li>
                  <li className="flex items-center justify-center gap-2">
                    <span className="w-2 h-2 bg-primary rounded-full" aria-hidden="true"></span>
                    <span>Privacy-First Processing</span>
                  </li>
                  <li className="flex items-center justify-center gap-2">
                    <span className="w-2 h-2 bg-primary rounded-full" aria-hidden="true"></span>
                    <span>Instant Results</span>
                  </li>
                </ul>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 max-w-2xl mx-auto" role="alert" aria-labelledby="privacy-notice">
                <h3 id="privacy-notice" className="sr-only">Privacy Notice</h3>
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Session-based tool:</strong> All data is temporary and will be cleared when you refresh the page.
                  Your documents are never permanently stored.
                </p>
              </div>
            </section>
          )}

          {/* Main Content Area */}
          {!currentDocumentId && (
            <div className="animate-fade-in-scale">
              <section aria-labelledby="upload-heading" className="mb-8">
                <h2 id="upload-heading" className="sr-only">Upload Document</h2>
                <FileUpload
                  onDocumentCreated={handleDocumentCreated}
                  disabled={isAnalyzing}
                />
              </section>

              <section aria-labelledby="samples-heading" className="mb-8">
                <h2 id="samples-heading" className="sr-only">Sample Contracts</h2>
                <SampleContracts
                  onSelectContract={handleSampleContract}
                  disabled={isAnalyzing}
                />
              </section>
            </div>
          )}

          {/* Analysis Progress */}
          {isAnalyzing && (
            <section aria-labelledby="analysis-progress" aria-live="polite" className="animate-fade-in-scale">
              <h2 id="analysis-progress" className="sr-only">Analysis in Progress</h2>
              <AnalysisProgress />
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

          {/* FAQ Section */}
          {!currentDocumentId && !isAnalyzing && (
            <section aria-labelledby="faq-heading" className="mt-16 animate-fade-in-scale">
              <Card className="p-6 md:p-8">
                <CardContent>
                  <h3 id="faq-heading" className="text-xl md:text-2xl font-semibold mb-6 md:mb-8 text-center text-gray-900 dark:text-white">
                    Frequently Asked Questions
                  </h3>
                  <div className="max-w-3xl mx-auto space-y-4 md:space-y-6">
                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 md:p-6 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <h4 className="font-medium mb-2 text-gray-900 dark:text-white">How accurate are the summaries?</h4>
                      <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                        Our advanced analysis engine has processed thousands of legal documents and is trained to identify
                        common patterns and concerning clauses. While highly accurate, we recommend
                        consulting with a legal professional for critical decisions.
                      </p>
                    </div>
                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 md:p-6 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <h4 className="font-medium mb-2 text-gray-900 dark:text-white">Is my document data secure?</h4>
                      <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                        Yes, all documents are encrypted in transit and at rest. We don't store your documents after analysis, 
                        and you can delete your summaries at any time. Your privacy is our top priority.
                      </p>
                    </div>
                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 md:p-6 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <h4 className="font-medium mb-2 text-gray-900 dark:text-white">What types of documents can I analyze?</h4>
                      <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                        We support contracts, terms of service, privacy policies, employment agreements, rental agreements, 
                        and most other legal documents in English. Upload PDFs, Word docs, or paste text directly.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
    </div>
  );
}
