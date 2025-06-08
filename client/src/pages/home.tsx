import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { File, Menu, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { FileUpload } from "@/components/FileUpload";
import { AnalysisResults } from "@/components/AnalysisResults";
import { SampleContracts } from "@/components/SampleContracts";
import { DocumentHistory } from "@/components/DocumentHistory";
import { analyzeDocument, getDocument, createDocument } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/ThemeProvider";
import type { Document } from "@shared/schema";

export default function Home() {
  const [currentDocumentId, setCurrentDocumentId] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();

  const { data: currentDocument, isLoading: isLoadingDocument } = useQuery({
    queryKey: ['/api/documents', currentDocumentId],
    queryFn: () => currentDocumentId ? getDocument(currentDocumentId) : null,
    enabled: !!currentDocumentId,
  });

  const analyzeDocumentMutation = useMutation({
    mutationFn: (documentId: number) => analyzeDocument(documentId),
    onSuccess: (updatedDocument: Document) => {
      setIsAnalyzing(false);
      toast({
        title: "Analysis complete",
        description: "Your document has been analyzed successfully.",
      });
      // Update the current document data
      setCurrentDocumentId(updatedDocument.id);
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

  const handleDocumentCreated = async (documentId: number) => {
    setCurrentDocumentId(documentId);
    setIsAnalyzing(true);
    try {
      await analyzeDocumentMutation.mutateAsync(documentId);
    } catch (error) {
      console.error("Analysis error:", error);
    }
  };

  const handleNewAnalysis = () => {
    setCurrentDocumentId(null);
    setIsAnalyzing(false);
  };

  const handleSampleContract = async (title: string, content: string) => {
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
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <File className="text-white text-sm" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">LegalClear</h1>
            </div>
            <nav className="hidden md:flex items-center space-x-6">
              <a href="#" className="text-gray-600 dark:text-gray-300 hover:text-primary transition-colors">
                Features
              </a>
              <a href="#" className="text-gray-600 dark:text-gray-300 hover:text-primary transition-colors">
                Pricing
              </a>
              <a href="#" className="text-gray-600 dark:text-gray-300 hover:text-primary transition-colors">
                About
              </a>
              <Button
                onClick={toggleTheme}
                variant="ghost"
                size="sm"
                className="mr-2"
              >
                {theme === "light" ? (
                  <Moon className="w-4 h-4" />
                ) : (
                  <Sun className="w-4 h-4" />
                )}
              </Button>
              <Button className="bg-primary text-white hover:bg-primary/90">
                Get Started
              </Button>
            </nav>
            <div className="md:hidden flex items-center space-x-2">
              <Button
                onClick={toggleTheme}
                variant="ghost"
                size="sm"
              >
                {theme === "light" ? (
                  <Moon className="w-4 h-4" />
                ) : (
                  <Sun className="w-4 h-4" />
                )}
              </Button>
              <button className="p-2">
                <Menu className="text-gray-600 dark:text-gray-300" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Document History */}
        <DocumentHistory 
          onSelectDocument={setCurrentDocumentId}
          currentDocumentId={currentDocumentId}
        />

        {/* Hero Section */}
        {!currentDocumentId && (
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Understand Any Contract in{" "}
              <span className="text-primary">Plain English</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
              Upload or paste any legal document and get instant, clear summaries that
              highlight what matters most. No legal degree required.
            </p>
          </div>
        )}

        {/* Analysis in Progress */}
        {isAnalyzing && (
          <Card className="p-8 mb-8">
            <CardContent className="text-center">
              <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
              <h3 className="text-xl font-semibold text-text mb-2">Analyzing Document</h3>
              <p className="text-gray-600">
                Our AI is carefully reviewing your document. This may take a minute...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Upload Interface */}
        {!currentDocumentId && !isAnalyzing && (
          <>
            <FileUpload onDocumentCreated={handleDocumentCreated} />
            
            {/* Sample Contracts Section */}
            <div className="mt-16">
              <SampleContracts onSelectContract={handleSampleContract} />
            </div>
          </>
        )}

        {/* Analysis Results */}
        {currentDocument && currentDocument.analysis && !isAnalyzing && (
          <>
            <AnalysisResults document={currentDocument} />
            <div className="text-center">
              <Button
                onClick={handleNewAnalysis}
                variant="outline"
                className="mr-4"
              >
                Analyze Another Document
              </Button>
            </div>
          </>
        )}

        {/* Loading Document */}
        {isLoadingDocument && currentDocumentId && (
          <Card className="p-8">
            <CardContent className="text-center">
              <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-primary" />
              <p className="text-gray-600">Loading document...</p>
            </CardContent>
          </Card>
        )}

        {/* FAQ Section */}
        {!currentDocumentId && !isAnalyzing && (
          <Card className="p-8 mt-16">
            <CardContent>
              <h3 className="text-2xl font-semibold text-text mb-8 text-center">
                Frequently Asked Questions
              </h3>
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="border border-gray-200 rounded-lg p-6">
                  <h4 className="font-medium text-text mb-2">How accurate are the summaries?</h4>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    Our AI analyzes thousands of legal documents and is trained to identify
                    common patterns and concerning clauses. While highly accurate, we recommend
                    consulting with a legal professional for critical decisions.
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg p-6">
                  <h4 className="font-medium text-text mb-2">Is my document data secure?</h4>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    Yes, all documents are encrypted in transit and at rest. We don't store your
                    documents after analysis, and you can delete your summaries at any time.
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg p-6">
                  <h4 className="font-medium text-text mb-2">What types of documents can I analyze?</h4>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    We support contracts, terms of service, privacy policies, employment
                    agreements, rental agreements, and most other legal documents in English.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <File className="text-white text-sm" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">LegalClear</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Making legal documents understandable for everyone.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    API
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Careers
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Help Center
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Contact
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Privacy
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-800 mt-8 pt-8 text-center text-sm text-gray-600 dark:text-gray-300">
            <p>&copy; 2024 LegalClear. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
