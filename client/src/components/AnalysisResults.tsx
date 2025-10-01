import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, ThumbsUp, AlertTriangle, XCircle, InfoIcon, FileText, Settings, Crown, Lock, CheckCircle, Zap, Plus, ArrowRight } from "lucide-react";
import type { Document, DocumentAnalysis } from "@shared/schema";
import { exportAnalysisToPDF } from "@/utils/pdfExport";
import { PIIRedactionInfoComponent } from "@/components/PIIRedactionInfo";
import { PiiDetectionFeedback, type PIIDetection, type FeedbackData } from "@/components/PiiDetectionFeedback";
import { submitPiiDetectionFeedback } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useEffect } from "react";

interface AnalysisResultsProps {
  document: Document;
}

export function AnalysisResults({ document }: AnalysisResultsProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportQuality, setExportQuality] = useState<'standard' | 'high'>('high');
  const [userTier, setUserTier] = useState<string>('free');
  const [hasProfessionalAccess, setHasProfessionalAccess] = useState(false);
  const { toast } = useToast();

  const rawAnalysis = document.analysis as unknown;

  const parsedAnalysis = useMemo<Partial<DocumentAnalysis> | null>(() => {
    if (!rawAnalysis) {
      return null;
    }

    if (typeof rawAnalysis === 'string') {
      try {
        const json = JSON.parse(rawAnalysis) as Partial<DocumentAnalysis>;
        return json && typeof json === 'object' ? json : null;
      } catch (error) {
        console.error('Failed to parse analysis JSON:', error);
        return null;
      }
    }

    if (typeof rawAnalysis === 'object') {
      return rawAnalysis as Partial<DocumentAnalysis>;
    }

    return null;
  }, [rawAnalysis]);

  const analysis = useMemo((): DocumentAnalysis => {
    const fallbackRisk: DocumentAnalysis['overallRisk'] = 'moderate';

    const ensureStringArray = (value: unknown): string[] =>
      Array.isArray(value)
        ? value
            .filter((item): item is string => typeof item === 'string')
            .map(item => item.trim())
            .filter(item => item.length > 0)
        : [];

    const normalizeRisk = (risk: unknown): DocumentAnalysis['overallRisk'] => {
      if (risk === 'low' || risk === 'moderate' || risk === 'high') {
        return risk;
      }
      return fallbackRisk;
    };

    if (!parsedAnalysis) {
      return {
        summary: 'Analysis data is unavailable. Please try again or contact support.',
        overallRisk: fallbackRisk,
        keyFindings: {
          goodTerms: [],
          reviewNeeded: [],
          redFlags: [],
        },
        sections: [],
        userAdvocacy: undefined,
      };
    }

    const normalizedSections = Array.isArray(parsedAnalysis.sections)
      ? parsedAnalysis.sections
          .filter((section): section is DocumentAnalysis['sections'][number] =>
            !!section && typeof section === 'object'
          )
          .map(section => ({
            title: typeof section.title === 'string' && section.title.trim().length > 0
              ? section.title
              : 'Untitled Section',
            riskLevel: normalizeRisk(section.riskLevel),
            summary: typeof section.summary === 'string' && section.summary.trim().length > 0
              ? section.summary
              : 'No summary provided for this section.',
            concerns: ensureStringArray(section.concerns),
          }))
      : [];

    const normalizedAdvocacy = parsedAnalysis.userAdvocacy && typeof parsedAnalysis.userAdvocacy === 'object'
      ? {
          negotiationStrategies: ensureStringArray(parsedAnalysis.userAdvocacy.negotiationStrategies),
          counterOffers: ensureStringArray(parsedAnalysis.userAdvocacy.counterOffers),
          fairnessReminders: ensureStringArray(parsedAnalysis.userAdvocacy.fairnessReminders),
          leverageOpportunities: ensureStringArray(parsedAnalysis.userAdvocacy.leverageOpportunities),
        }
      : undefined;

    return {
      summary:
        typeof parsedAnalysis.summary === 'string' && parsedAnalysis.summary.trim().length > 0
          ? parsedAnalysis.summary
          : 'No summary available for this analysis.',
      overallRisk: normalizeRisk(parsedAnalysis.overallRisk),
      keyFindings: {
        goodTerms: ensureStringArray(parsedAnalysis.keyFindings?.goodTerms),
        reviewNeeded: ensureStringArray(parsedAnalysis.keyFindings?.reviewNeeded),
        redFlags: ensureStringArray(parsedAnalysis.keyFindings?.redFlags),
      },
      sections: normalizedSections,
      userAdvocacy: normalizedAdvocacy,
    };
  }, [parsedAnalysis]);

  // Check user's tier on component mount
  useEffect(() => {
    const checkUserTier = async () => {
      try {
        // Use session-based authentication instead of localStorage token
        const response = await fetch('/api/user/subscription', {
          credentials: 'include' // This sends the httpOnly sessionId cookie
        });

        if (response.ok) {
          const data = await response.json();
          const tier = data.subscription?.tierId || 'free';
          setUserTier(tier);

          // Starter tier or higher (starter, professional, business, enterprise, ultimate)
          const pdfExportTiers = ['starter', 'professional', 'business', 'enterprise', 'ultimate'];
          setHasProfessionalAccess(pdfExportTiers.includes(tier));
          console.log(`🔍 Analysis Component: User tier: ${tier}, PDF Export access: ${pdfExportTiers.includes(tier)}`);
        } else {
          setUserTier('free');
          setHasProfessionalAccess(false);
          console.log(`🔍 Analysis Component: No subscription found, defaulting to free tier`);
        }
      } catch (error) {
        console.error('Error checking user tier:', error);
        setUserTier('free');
        setHasProfessionalAccess(false);
      }
    };

    checkUserTier();
  }, []);

  // Convert PII matches to feedback format with detection session ID
  const piiDetections: PIIDetection[] = useMemo(() => {
    if (!document.redactionInfo?.matches) return [];

    const detectionSessionId = `doc_${document.id}_${Date.now()}`;

    return document.redactionInfo.matches.map((match, index) => ({
      id: `${detectionSessionId}_${index}`,
      type: match.type,
      detectedText: match.value,
      confidence: match.confidence,
      detectionMethod: 'composite', // Default since we don't have this info in current schema
      context: document.content.substring(
        Math.max(0, match.start - 50),
        Math.min(document.content.length, match.end + 50)
      ),
      startIndex: match.start,
      endIndex: match.end
    }));
  }, [document]);

  // Handle feedback submission
  const handlePiiFeedback = async (feedbackData: FeedbackData) => {
    try {
      const detection = piiDetections.find(d => d.id === feedbackData.detectionId);
      if (!detection) {
        throw new Error('Detection not found');
      }

      await submitPiiDetectionFeedback({
        detectionSessionId: detection.id.split('_').slice(0, -1).join('_'),
        detectedText: detection.detectedText,
        detectionType: detection.type,
        detectionMethod: detection.detectionMethod,
        confidence: detection.confidence,
        context: detection.context,
        userVote: feedbackData.vote,
        feedbackConfidence: feedbackData.confidence,
        feedbackReason: feedbackData.reason,
        documentType: 'contract', // Default, could be enhanced to detect document type
        documentLength: document.content.length
      });

      toast({
        title: "Feedback submitted",
        description: "Thank you for helping improve our PII detection accuracy!",
      });
    } catch (error) {
      console.error('Failed to submit PII feedback:', error);
      toast({
        title: "Failed to submit feedback",
        description: "Please try again later.",
        variant: "destructive",
      });
    }
  };

  if (!parsedAnalysis) {
    return (
      <Card className="p-8">
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600 dark:text-gray-300">
            Analysis is being processed or not yet available for this document.
          </p>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline" 
            size="sm"
          >
            Refresh Page
          </Button>
        </CardContent>
      </Card>
    );
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'bg-secondary/20 text-secondary';
      case 'moderate':
        return 'bg-warning/20 text-warning';
      case 'high':
        return 'bg-danger/20 text-danger';
      default:
        return 'bg-gray-200 text-gray-700';
    }
  };

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case 'low':
        return <Shield className="w-5 h-5 text-secondary" />;
      case 'moderate':
        return <AlertTriangle className="w-5 h-5 text-warning" />;
      case 'high':
        return <XCircle className="w-5 h-5 text-danger" />;
      default:
        return <InfoIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  const handleExport = async (quality: 'standard' | 'high' = exportQuality) => {
    // Check tier access before proceeding
    if (!hasProfessionalAccess) {
      toast({
        title: "Starter Tier Required",
        description: "PDF export is available for Starter tier and above. Please upgrade your subscription.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsExporting(true);

      await exportAnalysisToPDF(document, {
        includeHeader: true,
        includeLogo: true,
        includeQRCode: true,
        donateUrl: window.location.origin + '/donate',
        highQuality: quality === 'high'
      });

    } catch (error) {
      console.error('PDF export failed:', error);

      // Enhanced fallback to text export with better formatting
      const advocacyExport = userAdvocacy && totalAdvocacyItems > 0
        ? `
ADVOCACY & NEGOTIATION GUIDE
===========================
${(userAdvocacy.negotiationStrategies?.length ?? 0) > 0 ? `Negotiation Strategies:
${(userAdvocacy.negotiationStrategies ?? []).map(term => `• ${term}`).join('\n')}

` : ''}${(userAdvocacy.counterOffers?.length ?? 0) > 0 ? `Counteroffers & Edits:
${(userAdvocacy.counterOffers ?? []).map(term => `• ${term}`).join('\n')}

` : ''}${(userAdvocacy.fairnessReminders?.length ?? 0) > 0 ? `Fairness Reminders:
${(userAdvocacy.fairnessReminders ?? []).map(term => `• ${term}`).join('\n')}

` : ''}${(userAdvocacy.leverageOpportunities?.length ?? 0) > 0 ? `Leverage Opportunities:
${(userAdvocacy.leverageOpportunities ?? []).map(term => `• ${term}`).join('\n')}

` : ''}`
        : '';

      const exportContent = `
Document Analysis Report
========================

Document: ${document.title}
Generated: ${new Date().toLocaleString()}
Overall Assessment: ${analysis.overallRisk.toUpperCase()} RISK

EXECUTIVE SUMMARY
=================
${analysis.summary}

KEY FINDINGS
============

[+] Positive Terms:
${analysis.keyFindings.goodTerms.map(term => `• ${term}`).join('\n')}

[!] Requires Review:
${analysis.keyFindings.reviewNeeded.map(term => `• ${term}`).join('\n')}

[X] Red Flags:
${analysis.keyFindings.redFlags.map(term => `• ${term}`).join('\n')}

${advocacyExport}
DETAILED ANALYSIS
=================
${analysis.sections.map((section, index) => `
${index + 1}. ${section.title} (${section.riskLevel.toUpperCase()} RISK)
${'-'.repeat(section.title.length + 5)}
${section.summary}
${section.concerns && section.concerns.length > 0 ? '\n[!] Concerns:\n' + section.concerns.map(concern => `• ${concern}`).join('\n') : ''}
`).join('\n')}

Report generated by ReadMyFinePrint
Visit: www.readmyfineprint.com
Support our mission: ${window.location.origin + '/donate'}
      `;

      if (typeof window !== 'undefined' && window.document) {
        const blob = new Blob([exportContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().slice(0, 10);
        const cleanTitle = document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 50);
        a.download = `${cleanTitle}_analysis_${timestamp}.txt`;
        window.document.body.appendChild(a);
        a.click();
        window.document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleNewAnalysis = () => {
    // Implement logic to trigger a new analysis or redirect
    console.log("New analysis initiated");
    window.location.reload(); // Example: reload to start fresh
  };

  const hasAdvocacyAccess = ['starter', 'professional', 'business', 'enterprise', 'ultimate'].includes(userTier);
  const userAdvocacy = analysis.userAdvocacy;
  const totalAdvocacyItems =
    (userAdvocacy?.negotiationStrategies?.length ?? 0) +
    (userAdvocacy?.counterOffers?.length ?? 0) +
    (userAdvocacy?.fairnessReminders?.length ?? 0) +
    (userAdvocacy?.leverageOpportunities?.length ?? 0);
  const renderAdvocacySection = (label: string, items?: string[], accent?: string) => {
    if (!items || items.length === 0) {
      return null;
    }

    return (
      <div className="bg-white/60 dark:bg-gray-900/60 border border-primary/20 dark:border-primary/30 rounded-lg p-3 sm:p-4 shadow-sm">
        <h5 className={`font-semibold text-sm mb-2 flex items-center space-x-2 ${accent ?? 'text-primary'}`}>
          <CheckCircle className={`w-4 h-4 ${accent ? '' : 'text-primary'}`} />
          <span>{label}</span>
        </h5>
        <ul className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
          {items.map((item, index) => (
            <li key={`${label}-${index}`} className="flex items-start space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <Card className="p-3 sm:p-4 lg:p-6 mb-6">
      <CardContent className="p-0">
        {/* Render results section */}
        <section 
          aria-labelledby="analysis-results" 
          className="animate-fade-in-scale space-y-8"
          data-testid="analysis-results-section"
        >
          {/* New Analysis Button */}
          <div className="flex justify-end mb-6">
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

          {/* Analysis Results Component */}
          <h2 id="analysis-results" className="sr-only">Analysis Results</h2>

          {/* PII Redaction Information */}
          {document.redactionInfo && (
            <PIIRedactionInfoComponent
              redactionInfo={document.redactionInfo}
              className="mb-4 sm:mb-5"
            />
          )}

          {/* PII Detection Feedback */}
          {piiDetections.length > 0 && (
            <PiiDetectionFeedback
              detections={piiDetections}
              documentType="contract"
              onFeedbackSubmit={handlePiiFeedback}
              className="mb-4 sm:mb-5"
            />
          )}

          {/* Overall Assessment */}
          <div className="bg-gradient-to-r from-secondary/10 to-primary/10 rounded-lg p-3 sm:p-4 mb-4 sm:mb-5">
            <div className="flex items-start space-x-3 mb-2 sm:mb-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-secondary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                {getRiskIcon(analysis.overallRisk)}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-base font-semibold text-gray-900 dark:text-white">Overall Assessment</h4>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Risk Level:{" "}
                  <span className={`font-medium ${
                    analysis.overallRisk === 'low' ? 'text-secondary dark:text-secondary' :
                    analysis.overallRisk === 'moderate' ? 'text-warning dark:text-warning' : 'text-danger dark:text-danger'
                  }`}>
                    {analysis.overallRisk.charAt(0).toUpperCase() + analysis.overallRisk.slice(1)}
                  </span>
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{analysis.summary}</p>
          </div>

          {/* Key Findings Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-secondary/5 dark:bg-secondary/10 border border-secondary/20 dark:border-secondary/30 rounded-lg p-3 sm:p-4">
              <div className="flex items-center space-x-2 mb-2">
                <ThumbsUp className="text-secondary w-4 h-4 flex-shrink-0" />
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Good Terms</h4>
              </div>
              <ul className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
                {analysis.keyFindings.goodTerms.map((term, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="w-1.5 h-1.5 bg-secondary rounded-full mt-2 flex-shrink-0"></span>
                    <span>{term}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-warning/5 dark:bg-warning/10 border border-warning/20 dark:border-warning/30 rounded-lg p-3 sm:p-4">
              <div className="flex items-center space-x-2 mb-2">
                <AlertTriangle className="text-warning w-4 h-4 flex-shrink-0" />
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Review Needed</h4>
              </div>
              <ul className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
                {analysis.keyFindings.reviewNeeded.map((term, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="w-1.5 h-1.5 bg-warning rounded-full mt-2 flex-shrink-0"></span>
                    <span>{term}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-danger/5 dark:bg-danger/10 border border-danger/20 dark:border-danger/30 rounded-lg p-3 sm:p-4">
              <div className="flex items-center space-x-2 mb-2">
                <XCircle className="text-danger w-4 h-4 flex-shrink-0" />
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Red Flags</h4>
              </div>
              <ul className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
                {analysis.keyFindings.redFlags.map((term, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="w-1.5 h-1.5 bg-danger rounded-full mt-2 flex-shrink-0"></span>
                    <span>{term}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Advocacy & Negotiation Guidance */}
          {hasAdvocacyAccess ? (
            <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/40 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
              <div className="flex items-start space-x-3 mb-3">
                <div className="w-9 h-9 bg-primary text-white rounded-full flex items-center justify-center shadow-sm">
                  <Crown className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-base sm:text-lg font-semibold text-primary dark:text-primary-foreground">Fair Terms Action Plan</h4>
                  <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                    Tailored negotiation ideas and fairness advocacy generated from this analysis.
                  </p>
                </div>
              </div>

              {userAdvocacy && totalAdvocacyItems > 0 ? (
                <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                  {renderAdvocacySection('Negotiation Strategies', userAdvocacy.negotiationStrategies, 'text-primary')}
                  {renderAdvocacySection('Counteroffers & Edits', userAdvocacy.counterOffers, 'text-primary')}
                  {renderAdvocacySection('Fairness Reminders', userAdvocacy.fairnessReminders, 'text-primary')}
                  {renderAdvocacySection('Leverage Opportunities', userAdvocacy.leverageOpportunities, 'text-primary')}
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                  No additional advocacy recommendations were required for this document. Everything already looks balanced.
                </p>
              )}
            </div>
          ) : (
            <div className="border border-dashed border-primary/40 dark:border-primary/50 rounded-lg p-4 sm:p-5 mb-4 sm:mb-6 bg-white/60 dark:bg-gray-900/60">
              <div className="flex items-start space-x-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-1">Advocacy guidance requires Starter tier</h4>
                  <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                    Upgrade to the Starter plan or above to unlock counteroffers, negotiation angles, and fairness advocacy tailored to your documents.
                  </p>
                  <div className="mt-3">
                    <Button size="sm" variant="outline" className="border-primary text-primary hover:bg-primary/10" onClick={() => window.location.assign('/pricing')}>
                      Explore Starter Benefits
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Detailed Breakdown */}
          <div className="space-y-3 sm:space-y-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Detailed Breakdown
            </h4>

            {analysis.sections.map((section, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-800 px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-start sm:items-center justify-between gap-2">
                    <h5 className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-2 flex-1 min-w-0">{section.title}</h5>
                    <Badge className={`${getRiskColor(section.riskLevel)} text-[10px] px-1.5 py-0.5 flex-shrink-0`}>
                      {section.riskLevel.charAt(0).toUpperCase() + section.riskLevel.slice(1)}
                    </Badge>
                  </div>
                </div>
                <div className="p-3 sm:p-4 bg-white dark:bg-gray-800">
                  <div className="mb-2 sm:mb-3">
                    <h6 className="font-medium text-gray-900 dark:text-white mb-1 text-xs">Plain English Summary:</h6>
                    <p className="text-gray-700 dark:text-gray-300 text-xs leading-relaxed">{section.summary}</p>
                  </div>
                  {section.concerns && section.concerns.length > 0 && (
                    <div className={`border-l-4 p-2 sm:p-3 rounded-r ${
                      section.riskLevel === 'high' ? 'bg-danger/5 dark:bg-danger/10 border-danger' :
                      section.riskLevel === 'moderate' ? 'bg-warning/5 dark:bg-warning/10 border-warning' :
                      'bg-secondary/5 dark:bg-secondary/10 border-secondary'
                    }`}>
                      <div className="flex items-start space-x-2">
                        <div className="flex-shrink-0 mt-0.5">
                          {getRiskIcon(section.riskLevel)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`font-medium text-xs mb-1 ${
                            section.riskLevel === 'high' ? 'text-danger dark:text-danger' :
                            section.riskLevel === 'moderate' ? 'text-warning dark:text-warning' :
                            'text-secondary dark:text-secondary'
                          }`}>
                            {section.riskLevel === 'high' ? 'Important Concern:' :
                             section.riskLevel === 'moderate' ? 'Important Note:' :
                             'Good to Know:'}
                          </p>
                          <ul className="text-gray-700 dark:text-gray-300 text-xs space-y-0.5">
                            {section.concerns.map((concern, concernIndex) => (
                              <li key={concernIndex} className="leading-relaxed">• {concern}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}