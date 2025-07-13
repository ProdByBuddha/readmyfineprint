/**
 * PII Detection Feedback Component
 * Allows users to vote on the accuracy of PII detections to help improve the system
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ThumbsUp, ThumbsDown, AlertTriangle, Eye, EyeOff, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface PIIDetection {
  id: string;
  type: 'ssn' | 'email' | 'phone' | 'creditCard' | 'address' | 'name' | 'dob' | 'custom' | 'attorney_client';
  detectedText: string;
  confidence: number;
  detectionMethod: 'regex' | 'context' | 'fuzzy' | 'composite' | 'llm';
  context?: string;
  startIndex: number;
  endIndex: number;
}

export interface FeedbackData {
  detectionId: string;
  vote: 'correct' | 'incorrect' | 'partially_correct';
  confidence: number;
  reason?: string;
}

interface PiiDetectionFeedbackProps {
  detections: PIIDetection[];
  documentType?: 'lease' | 'contract' | 'legal' | 'other';
  onFeedbackSubmit: (feedback: FeedbackData) => Promise<void>;
  className?: string;
}

const DETECTION_TYPE_LABELS = {
  ssn: 'Social Security Number',
  email: 'Email Address',
  phone: 'Phone Number',
  creditCard: 'Credit Card',
  address: 'Address',
  name: 'Personal Name',
  dob: 'Date of Birth',
  custom: 'Other PII',
  attorney_client: 'Attorney-Client Privileged'
};

const DETECTION_METHOD_LABELS = {
  regex: 'Pattern Matching',
  context: 'Context Analysis',
  fuzzy: 'Fuzzy Matching',
  composite: 'Multiple Methods',
  llm: 'AI Analysis'
};

const CONFIDENCE_COLORS = {
  high: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-red-100 text-red-800 border-red-200'
};

function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}

function DetectionFeedbackCard({ 
  detection, 
  onFeedbackSubmit, 
  documentType 
}: { 
  detection: PIIDetection; 
  onFeedbackSubmit: (feedback: FeedbackData) => Promise<void>;
  documentType?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [vote, setVote] = useState<'correct' | 'incorrect' | 'partially_correct' | null>(null);
  const [confidence, setConfidence] = useState<number>(3);
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showContext, setShowContext] = useState(false);

  const confidenceLevel = getConfidenceLevel(detection.confidence);

  const handleSubmit = async () => {
    if (!vote) return;
    
    setIsSubmitting(true);
    try {
      await onFeedbackSubmit({
        detectionId: detection.id,
        vote,
        confidence,
        reason: reason.trim() || undefined
      });
      setHasSubmitted(true);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="mb-4 border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                {detection.detectedText}
              </span>
              <Badge className={`${CONFIDENCE_COLORS[confidenceLevel]} text-xs`}>
                {Math.round(detection.confidence * 100)}% confident
              </Badge>
            </CardTitle>
            <CardDescription className="mt-2 flex items-center gap-2">
              <span>Detected as: <strong>{DETECTION_TYPE_LABELS[detection.type]}</strong></span>
              <span className="text-gray-400">•</span>
              <span>Method: {DETECTION_METHOD_LABELS[detection.detectionMethod]}</span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {detection.context && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowContext(!showContext)}
                className="text-gray-500"
              >
                {showContext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-blue-600"
            >
              {isExpanded ? 'Hide Feedback' : 'Give Feedback'}
            </Button>
          </div>
        </div>
        
        <AnimatePresence>
          {showContext && detection.context && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 p-3 bg-gray-50 rounded-md text-sm"
            >
              <Label className="text-xs font-medium text-gray-600">Context:</Label>
              <p className="mt-1 text-gray-700 font-mono">{detection.context}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </CardHeader>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <CardContent className="pt-0">
              {hasSubmitted ? (
                <div className="text-center py-4">
                  <div className="inline-flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-full">
                    <ThumbsUp className="h-4 w-4" />
                    <span>Thank you for your feedback!</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    Your input helps improve our PII detection accuracy.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">
                      Was this detection correct?
                    </Label>
                    <RadioGroup 
                      value={vote || ''} 
                      onValueChange={(value) => setVote(value as any)}
                      className="mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="correct" id="correct" />
                        <Label htmlFor="correct" className="flex items-center gap-2">
                          <ThumbsUp className="h-4 w-4 text-green-600" />
                          Correct - This is actual PII
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="incorrect" id="incorrect" />
                        <Label htmlFor="incorrect" className="flex items-center gap-2">
                          <ThumbsDown className="h-4 w-4 text-red-600" />
                          Incorrect - This is not PII
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="partially_correct" id="partially_correct" />
                        <Label htmlFor="partially_correct" className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          Partially correct - Close but not quite right
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {vote && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      <div>
                        <Label className="text-sm font-medium">
                          How confident are you in this assessment? ({confidence}/5)
                        </Label>
                        <div className="mt-2 flex items-center gap-2">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <Button
                              key={level}
                              variant={confidence >= level ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setConfidence(level)}
                              className="w-8 h-8 p-0"
                            >
                              {level}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="reason" className="text-sm font-medium">
                          Additional feedback (optional)
                        </Label>
                        <Textarea
                          id="reason"
                          placeholder="Help us understand why this detection was correct/incorrect..."
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          className="mt-2"
                          rows={3}
                          maxLength={500}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {reason.length}/500 characters
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </CardContent>

            {!hasSubmitted && vote && (
              <CardFooter className="pt-0">
                <Button 
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                </Button>
              </CardFooter>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export function PiiDetectionFeedback({ 
  detections, 
  documentType,
  onFeedbackSubmit,
  className = ''
}: PiiDetectionFeedbackProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [hasProfessionalAccess, setHasProfessionalAccess] = useState(false);

  // Check user's tier on component mount
  useEffect(() => {
    const checkUserTier = async () => {
      try {
        const subscriptionToken = localStorage.getItem('subscriptionToken');
        if (!subscriptionToken) {
          setHasProfessionalAccess(false);
          return;
        }

        const response = await fetch('/api/user/subscription', {
          headers: {
            'x-subscription-token': subscriptionToken,
          },
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          const tier = data.subscription?.tierId || 'free';
          
          // Professional tier or higher (professional, business, enterprise, ultimate)
          const professionalTiers = ['professional', 'business', 'enterprise', 'ultimate'];
          setHasProfessionalAccess(professionalTiers.includes(tier));
        } else {
          setHasProfessionalAccess(false);
        }
      } catch (error) {
        console.error('Error checking user tier:', error);
        setHasProfessionalAccess(false);
      }
    };

    checkUserTier();
  }, []);

  if (detections.length === 0) {
    return null;
  }

  // Hide feedback for non-Professional users - return null to not show anything
  if (!hasProfessionalAccess) {
    return null;
  }

  return (
    <div className={`mt-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            PII Detection Feedback
          </h3>
          <p className="text-sm text-gray-600">
            Help us improve by rating the accuracy of these {detections.length} PII detection{detections.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          variant={showFeedback ? 'outline' : 'default'}
          onClick={() => setShowFeedback(!showFeedback)}
          className="flex items-center gap-2"
        >
          {showFeedback ? (
            <>
              <EyeOff className="h-4 w-4" />
              Hide Feedback
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" />
              Review Detections
            </>
          )}
        </Button>
      </div>

      <AnimatePresence>
        {showFeedback && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md border border-blue-200">
              <strong>Privacy Notice:</strong> Your feedback is anonymous and helps improve our PII detection accuracy. 
              No personal information is stored with your feedback.
            </div>
            
            {detections.map((detection) => (
              <DetectionFeedbackCard
                key={detection.id}
                detection={detection}
                onFeedbackSubmit={onFeedbackSubmit}
                documentType={documentType}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}