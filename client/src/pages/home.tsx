import { useState, useMemo, useCallback } from "react";
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
import { LegalDisclaimer } from "@/components/LegalDisclaimer";
import { useCookieConsent } from "@/components/CookieConsent";
import { analyzeDocument, getDocument, createDocument } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Document } from "@shared/schema";

export default function Home() {
  const [currentDocumentId, setCurrentDocumentId] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const { toast } = useToast();
  const { isAccepted: cookiesAccepted } = useCookieConsent();
  const containerRef = usePreventFlicker();

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
      toast({
        title: "Analysis failed",
        description: error instanceof Error ? error.message : "Failed to analyze document",
        variant: "destructive",
      });
    },
  });

  const handleDocumentCreated = useCallback(async (documentId: number) => {
    // Check if both disclaimer and cookies are accepted
    if (!disclaimerAccepted || !cookiesAccepted) {
      toast({
        title: "Consent Required",
        description: "Please accept both the legal disclaimer and cookie consent to process documents.",
        variant: "destructive",
      });
      return;
    }

    setCurrentDocumentId(documentId);
    setIsAnalyzing(true);
    try {
      await analyzeDocumentMutation.mutateAsync(documentId);
    } catch (error) {
      console.error("Analysis error:", error);
    }
  }, [disclaimerAccepted, cookiesAccepted, toast, analyzeDocumentMutation]);

  const handleDocumentSelect = useStableCallback((documentId: number | null) => {
    setCurrentDocumentId(documentId);
    setIsAnalyzing(false);
  });

  const handleNewAnalysis = useCallback(() => {
    setCurrentDocumentId(null);
    setIsAnalyzing(false);
  }, []);

  const handleSampleContract = useCallback(async (title: string, content: string) => {
    // Check if both disclaimer and cookies are accepted
    if (!disclaimerAccepted || !cookiesAccepted) {
      toast({
        title: "Consent Required",
        description: "Please accept both the legal disclaimer and cookie consent to process documents.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const document = await createDocument({
        title: `Sample: ${title}`,
        content,
      });
      await handleDocumentCreated(document.id);
    } catch (error) {
      setIsAnalyzing(false);
      toast({
        title: "Failed to load sample",
        description: error instanceof Error ? error.message : "Failed to load sample contract",
        variant: "destructive",
      });
    }
  }, [disclaimerAccepted, cookiesAccepted, toast, handleDocumentCreated]);

  // Show disclaimer if not accepted
  if (!disclaimerAccepted) {
    return <LegalDisclaimer onAccept={() => setDisclaimerAccepted(true)} />;
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-slate-800 page-transition">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-40">
        {/* Document History */}
        <DocumentHistory
          onSelectDocument={handleDocumentSelect}
          currentDocumentId={currentDocumentId}
        />

        {/* Hero Section */}
        {!currentDocumentId && (
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Understand Any Contract in{" "}
              <span className="text-primary">Plain English</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-4 max-w-3xl mx-auto">
              Upload or paste any legal document and get instant, clear summaries that
              highlight what matters most. No legal degree required.
            </p>
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 max-w-2xl mx-auto">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Session-based tool:</strong> All data is temporary and will be cleared when you refresh the page.
                Your documents are never permanently stored.
              </p>
            </div>
          </div>
        )}

        {/* Analysis in Progress */}
        {isAnalyzing && <AnalysisProgress />}

        {/* Upload Interface */}
        {!currentDocumentId && !isAnalyzing && (
          <>
            {/* Cookie Consent Required Notice */}
            {!cookiesAccepted && (
              <Card className="mb-8 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                <CardContent className="p-6 text-center">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Cookie className="w-6 h-6 text-amber-600" />
                    <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200">
                      Cookie Consent Required
                    </h3>
                  </div>
                  <p className="text-amber-700 dark:text-amber-300 mb-4">
                    To process documents, please accept our essential cookies. We use minimal,
                    privacy-first cookies for session management only.
                  </p>
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Look for the cookie banner at the bottom of the page to accept.
                  </p>
                </CardContent>
              </Card>
            )}

            <FileUpload
              onDocumentCreated={handleDocumentCreated}
              disabled={!cookiesAccepted}
            />

            {/* Sample Contracts Section */}
            <div className="mt-16">
              <SampleContracts
                onSelectContract={handleSampleContract}
                disabled={!cookiesAccepted}
              />
            </div>
          </>
        )}

        {/* Analysis Results */}
        {currentDocument && currentDocument.analysis && !isAnalyzing && (
          <>
            <AnalysisResults document={currentDocument} />
            
          </>
        )}

        {/* Loading Document */}
        {isLoadingDocument && currentDocumentId && (
          <Card className="p-8">
            <CardContent className="text-center">
              <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-primary" />
              <p className="text-gray-600 dark:text-gray-300">Loading document...</p>
            </CardContent>
          </Card>
        )}

        {/* FAQ Section */}
        {!currentDocumentId && !isAnalyzing && (
          <Card className="p-8 mt-16">
            <CardContent>
              <h3 className="text-2xl font-semibold mb-8 text-center text-gray-900 dark:text-[#c7d3d9]">
                Frequently Asked Questions
              </h3>
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                  <h4 className="font-medium mb-2 text-gray-900 dark:text-[#c7d3d9]">How accurate are the summaries?</h4>
                  <p className="text-sm leading-relaxed text-gray-700 dark:text-[#8a9cb8]">
                    Our advanced analysis engine has processed thousands of legal documents and is trained to identify
                    common patterns and concerning clauses. While highly accurate, we recommend
                    consulting with a legal professional for critical decisions.
                  </p>
                </div>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                  <h4 className="font-medium mb-2 text-gray-900 dark:text-[#c7d3d9]">Is my document data secure?</h4>
                  <p className="text-sm leading-relaxed text-gray-700 dark:text-[#8a9cb8]">
                    Yes, all documents are encrypted in transit and at rest. We don't store your
                    documents after analysis, and you can delete your summaries at any time.
                  </p>
                </div>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                  <h4 className="font-medium mb-2 text-gray-900 dark:text-[#c7d3d9]">What types of documents can I analyze?</h4>
                  <p className="text-sm leading-relaxed text-gray-700 dark:text-[#8a9cb8]">
                    We support contracts, terms of service, privacy policies, employment
                    agreements, rental agreements, and most other legal documents in English.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
