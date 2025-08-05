import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Mail, 
  Shield, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  User,
  HelpCircle,
  Lock
} from 'lucide-react';
import type { SecurityQuestion, SecurityAnswers } from '@shared/schema';

interface EmailRecoveryFormProps {
  onSuccess?: (requestId: string) => void;
  className?: string;
}

interface SecurityQuestionsState {
  questions: SecurityQuestion[];
  answers: SecurityAnswers;
}

export function EmailRecoveryForm({ onSuccess, className = '' }: EmailRecoveryFormProps) {
  const [step, setStep] = useState<'form' | 'security' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  
  // Form data
  const [currentEmail, setCurrentEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [reason, setReason] = useState('');
  
  // Security questions
  const [securityQuestions, setSecurityQuestions] = useState<SecurityQuestionsState>({
    questions: [],
    answers: {}
  });

  // Load security questions on component mount
  useEffect(() => {
    fetchSecurityQuestions();
  }, []);

  const fetchSecurityQuestions = async () => {
    try {
      const response = await fetch('/api/auth/security-questions');
      if (response.ok) {
        const data = await response.json();
        setSecurityQuestions(prev => ({ ...prev, questions: data.questions }));
      }
    } catch (error) {
      console.error('Failed to load security questions:', error);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/request-email-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Fingerprint': generateDeviceFingerprint()
        },
        body: JSON.stringify({
          currentEmail: currentEmail.trim(),
          newEmail: newEmail.trim(),
          reason: reason.trim(),
          securityAnswers: securityQuestions.answers
        })
      });

      const data = await response.json();

      if (response.ok) {
        setRequestId(data.requestId);
        setStep('success');
        onSuccess?.(data.requestId);
      } else {
        setError(data.error || 'Failed to submit email change request');
      }
    } catch (error) {
      setError('Network error. Please try again.');
      console.error('Email change request error:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateDeviceFingerprint = (): string => {
    // Simple device fingerprinting
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx?.fillText('fingerprint', 10, 10);
    
    return window.btoa([
      navigator.userAgent,
      navigator.language,
      window.screen.width + 'x' + window.screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL()
    ].join('|')).slice(0, 32);
  };

  const updateSecurityAnswer = (questionId: string, answer: string) => {
    setSecurityQuestions(prev => ({
      ...prev,
      answers: { ...prev.answers, [questionId]: answer }
    }));
  };

  const isFormValid = () => {
    return currentEmail.trim() && 
           newEmail.trim() && 
           reason.trim().length >= 10 &&
           currentEmail !== newEmail;
  };

  const getRequiredQuestionsCount = () => {
    return securityQuestions.questions.filter(q => q.required).length;
  };

  const getAnsweredRequiredCount = () => {
    return securityQuestions.questions
      .filter(q => q.required && securityQuestions.answers[q.id]?.trim())
      .length;
  };

  if (step === 'success') {
    return (
      <Card className={`border-green-200 dark:border-green-800 ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-green-700 dark:text-green-300">
            <CheckCircle className="h-5 w-5" />
            <span>Email Change Request Submitted</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <Shield className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700 dark:text-green-300">
              <div className="space-y-2">
                <p><strong>Request ID:</strong> <code className="bg-green-100 dark:bg-green-900/40 px-2 py-1 rounded text-sm">{requestId}</code></p>
                <p>Your email change request has been submitted successfully and will be reviewed by our security team within 72 hours.</p>
              </div>
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">What happens next:</h4>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-start space-x-2">
                <Clock className="h-4 w-4 mt-0.5 text-blue-500" />
                <span>Our security team will review your request within 72 hours</span>
              </div>
              <div className="flex items-start space-x-2">
                <Mail className="h-4 w-4 mt-0.5 text-blue-500" />
                <span>You'll receive email notifications at both addresses about the status</span>
              </div>
              <div className="flex items-start space-x-2">
                <Shield className="h-4 w-4 mt-0.5 text-blue-500" />
                <span>If approved, your new email will become your login email</span>
              </div>
            </div>
          </div>

          <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <HelpCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
              <strong>Need help?</strong> If you have questions about your request, contact support@readmyfineprint.com and include your Request ID.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-orange-200 dark:border-orange-800 ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-orange-700 dark:text-orange-300">
          <Mail className="h-5 w-5" />
          <span>Request Email Change</span>
        </CardTitle>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Lost access to your email? Request a secure email change with admin review.
        </p>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmitRequest} className="space-y-6">
          {error && (
            <Alert className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700 dark:text-red-300">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Email addresses */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentEmail">Current Email Address</Label>
              <Input
                id="currentEmail"
                type="email"
                value={currentEmail}
                onChange={(e) => setCurrentEmail(e.target.value)}
                placeholder="your.current@email.com"
                required
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                The email address currently associated with your account
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newEmail">New Email Address</Label>
              <Input
                id="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="your.new@email.com"
                required
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                The email address you want to change to (must be accessible to you)
              </p>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Email Change</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please explain why you need to change your email address (minimum 10 characters)"
              required
              minLength={10}
              maxLength={500}
              rows={3}
              className="w-full"
            />
            <p className="text-xs text-gray-500">
              {reason.length}/500 characters (minimum 10 required)
            </p>
          </div>

          {/* Security Questions */}
          {securityQuestions.questions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Lock className="h-4 w-4 text-blue-600" />
                <h4 className="font-medium text-gray-900 dark:text-gray-100">
                  Security Questions (Optional but Recommended)
                </h4>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Answering security questions helps verify your identity and speeds up the review process.
                {getRequiredQuestionsCount() > 0 && ` At least ${getRequiredQuestionsCount()} questions are recommended.`}
              </p>
              
              <div className="space-y-3">
                {securityQuestions.questions.map((question) => (
                  <div key={question.id} className="space-y-2">
                    <Label htmlFor={`security-${question.id}`} className="flex items-center space-x-1">
                      <span>{question.question}</span>
                      {question.required && <span className="text-orange-500">*</span>}
                    </Label>
                    <Input
                      id={`security-${question.id}`}
                      type="text"
                      value={securityQuestions.answers[question.id] || ''}
                      onChange={(e) => updateSecurityAnswer(question.id, e.target.value)}
                      placeholder="Your answer"
                      className="w-full"
                    />
                  </div>
                ))}
              </div>

              {getRequiredQuestionsCount() > 0 && (
                <p className="text-xs text-gray-500">
                  Answered: {getAnsweredRequiredCount()}/{getRequiredQuestionsCount()} recommended questions
                </p>
              )}
            </div>
          )}

          {/* Security Notice */}
          <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <Shield className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
              <div className="space-y-2">
                <p><strong>Security Notice:</strong></p>
                <ul className="space-y-1 text-xs">
                  <li>• All email change requests require manual security team review</li>
                  <li>• Review process takes up to 72 hours</li>
                  <li>• You'll receive notifications at both email addresses</li>
                  <li>• Providing security answers helps expedite the process</li>
                  <li>• Suspicious requests may require additional verification</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={!isFormValid() || loading}
            className="w-full"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Submitting Request...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Submit Email Change Request
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}