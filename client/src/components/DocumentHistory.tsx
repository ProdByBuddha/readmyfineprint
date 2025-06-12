import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Clock, AlertTriangle, Shield, XCircle, Trash2 } from "lucide-react";
import { getAllDocuments, clearAllDocuments } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Document, DocumentAnalysis } from "@shared/schema";

interface DocumentHistoryProps {
  onSelectDocument: (documentId: number | null) => void;
  currentDocumentId?: number | null;
}

export function DocumentHistory({ onSelectDocument, currentDocumentId }: DocumentHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();

  const { data: documents = [], isLoading, isFetching } = useQuery({
    queryKey: ['/api/documents'],
    queryFn: getAllDocuments,
    staleTime: 30 * 1000, // Keep fresh for 30 seconds
    refetchOnMount: false,
  });

  const clearDocumentsMutation = useMutation({
    mutationFn: clearAllDocuments,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      onSelectDocument(null);
      toast({
        title: "Documents cleared",
        description: "All documents have been cleared. You can start fresh!",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to clear documents",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to clear all documents? This action cannot be undone.")) {
      clearDocumentsMutation.mutate();
    }
  };

  const getRiskIcon = (analysis: DocumentAnalysis | null) => {
    if (!analysis) return <Clock className="w-4 h-4 text-gray-400" />;

    switch (analysis.overallRisk) {
      case 'low':
        return <Shield className="w-4 h-4 text-green-600" />;
      case 'moderate':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'high':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getRiskColor = (analysis: DocumentAnalysis | null) => {
    if (!analysis) return 'bg-gray-100 text-gray-600';

    switch (analysis.overallRisk) {
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'moderate':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  // Only show loading skeleton on initial load, not on background refetches
  if (isLoading && !documents.length) {
    return (
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (documents.length === 0) {
    return null;
  }

  const recentDocuments = useMemo(() => 
    documents
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, isExpanded ? documents.length : 3),
    [documents, isExpanded]
  );

  return (
    <Card className="mb-8">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-primary" />
            <span>Current Session</span>
            <Badge variant="secondary" className="ml-2">
              {documents.length}
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
            {documents.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? 'Show Less' : 'Show All'}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              disabled={clearDocumentsMutation.isPending}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear All
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className={isExpanded ? "h-96" : "h-auto"}>
          <div className="space-y-3" style={{ minHeight: isFetching ? '100px' : 'auto' }}>
            {recentDocuments.map((document) => {
              const analysis = document.analysis as DocumentAnalysis | null;
              const isActive = currentDocumentId === document.id;

              return (
                <div
                  key={document.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    isActive ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700'
                  }`}
                  onClick={() => onSelectDocument(document.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        {getRiskIcon(analysis)}
                        <h4 className="font-medium text-gray-900 dark:text-white truncate">
                          {document.title}
                        </h4>
                        {analysis && (
                          <Badge
                            className={`text-xs ${getRiskColor(analysis)}`}
                          >
                            {analysis.overallRisk} risk
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                          <span>
                            {document.content.split(' ').length} words
                          </span>
                          <span>
                            {formatDistanceToNow(new Date(document.createdAt), { addSuffix: true })}
                          </span>
                        </div>

                        {!analysis && (
                          <Badge variant="outline" className="text-xs">
                            Pending Analysis
                          </Badge>
                        )}
                      </div>

                      {analysis && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">
                          {analysis.summary}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Documents are stored in your current session only. Refreshing will clear all data.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
