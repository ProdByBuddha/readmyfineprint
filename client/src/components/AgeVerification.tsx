import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Calendar, AlertTriangle, CheckCircle, Users } from 'lucide-react';
import { fetchWithCSRF } from '@/lib/csrfManager';

interface AgeVerificationProps {
  onVerified: (isAdult: boolean, needsParentalConsent: boolean) => void;
  onError?: (error: string) => void;
  required?: boolean;
}

interface AgeVerificationStatus {
  verified: boolean;
  isAdult: boolean;
  needsParentalConsent: boolean;
  verificationDate?: string;
}

export function AgeVerification({ onVerified, onError, required = true }: AgeVerificationProps) {
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<AgeVerificationStatus | null>(null);
  const [parentEmail, setParentEmail] = useState('');
  const [showParentalConsent, setShowParentalConsent] = useState(false);

  // Check if user already has age verification
  useEffect(() => {
    checkExistingVerification();
  }, []);

  const checkExistingVerification = async () => {
    try {
      const response = await fetchWithCSRF('/api/age-verification/status');
      if (response.ok) {
        const status = await response.json();
        setVerificationStatus(status);
        if (status.verified) {
          onVerified(status.isAdult, status.needsParentalConsent);
        }
      }
    } catch (err) {
      // No existing verification, continue with form
    }
  };

  const calculateAge = (month: number, day: number, year: number): number => {
    const today = new Date();
    const birthDate = new Date(year, month - 1, day);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  const handleAgeVerification = async () => {
    if (!birthMonth || !birthDay || !birthYear) {
      setError('Please enter your complete birth date');
      return;
    }

    const month = parseInt(birthMonth);
    const day = parseInt(birthDay);
    const year = parseInt(birthYear);

    // Basic validation
    if (month < 1 || month > 12) {
      setError('Please enter a valid month');
      return;
    }

    if (day < 1 || day > 31) {
      setError('Please enter a valid day');
      return;
    }

    const currentYear = new Date().getFullYear();
    if (year < 1900 || year > currentYear) {
      setError('Please enter a valid birth year');
      return;
    }

    // Check for future dates
    const birthDate = new Date(year, month - 1, day);
    if (birthDate > new Date()) {
      setError('Birth date cannot be in the future');
      return;
    }

    const age = calculateAge(month, day, year);
    
    // COPPA compliance: Under 13 requires special handling
    if (age < 13) {
      setError('Our service is not available to users under 13 years old. Please contact support if you believe this is an error.');
      onError?.('User under minimum age requirement');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithCSRF('/api/age-verification/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          birthMonth: month,
          birthDay: day,
          birthYear: year,
          age: age
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setVerificationStatus(result);
        
        const isAdult = age >= 18;
        const needsParentalConsent = age >= 13 && age < 18;
        
        if (needsParentalConsent) {
          setShowParentalConsent(true);
        } else {
          onVerified(isAdult, needsParentalConsent);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Age verification failed');
        onError?.(errorData.error || 'Age verification failed');
      }
    } catch (err) {
      setError('Failed to verify age. Please try again.');
      onError?.('Age verification request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleParentalConsent = async () => {
    if (!parentEmail.trim()) {
      setError('Please enter a parent or guardian email address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithCSRF('/api/age-verification/parental-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentEmail: parentEmail.trim(),
          userAge: calculateAge(parseInt(birthMonth), parseInt(birthDay), parseInt(birthYear))
        }),
      });

      if (response.ok) {
        onVerified(false, true);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to send parental consent request');
      }
    } catch (err) {
      setError('Failed to send parental consent request');
    } finally {
      setLoading(false);
    }
  };

  // If already verified, show status
  if (verificationStatus?.verified && !showParentalConsent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Age Verification Complete
          </CardTitle>
          <CardDescription>
            Your age has been verified for COPPA compliance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Shield className="w-4 h-4" />
              <span>Verified on: {new Date(verificationStatus.verificationDate || '').toLocaleDateString()}</span>
            </div>
            {verificationStatus.needsParentalConsent && (
              <Alert>
                <Users className="h-4 w-4" />
                <AlertDescription>
                  Parental consent is on file for this account.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Age Verification
          {required && <span className="text-red-500">*</span>}
        </CardTitle>
        <CardDescription>
          {showParentalConsent 
            ? 'Parental consent required for users under 18'
            : 'Required for COPPA compliance and account security'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!showParentalConsent ? (
          <>
            <div className="bg-blue-50 p-3 rounded-lg text-sm">
              <div className="font-medium mb-1">Privacy Protection</div>
              <div className="text-blue-800">
                We only use your birth date to verify you meet our minimum age requirement (13+). 
                This information is encrypted and not shared with third parties.
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="birth-date">Birth Date</Label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Select value={birthMonth} onValueChange={setBirthMonth}>
                    <SelectTrigger>
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {new Date(2000, i).toLocaleDateString('en', { month: 'long' })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Select value={birthDay} onValueChange={setBirthDay}>
                    <SelectTrigger>
                      <SelectValue placeholder="Day" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {i + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Select value={birthYear} onValueChange={setBirthYear}>
                    <SelectTrigger>
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 100 }, (_, i) => {
                        const year = new Date().getFullYear() - i;
                        return (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleAgeVerification} 
              disabled={loading || !birthMonth || !birthDay || !birthYear}
              className="w-full"
            >
              {loading ? 'Verifying...' : 'Verify Age'}
            </Button>
          </>
        ) : (
          <>
            <div className="bg-orange-50 p-3 rounded-lg">
              <div className="font-medium mb-1 text-orange-900">Parental Consent Required</div>
              <div className="text-sm text-orange-800">
                Users under 18 require parental or guardian consent to use our service. 
                We'll send a consent form to the email address you provide.
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="parent-email">Parent or Guardian Email</Label>
              <Input
                id="parent-email"
                type="email"
                placeholder="parent@example.com"
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
              />
            </div>

            <div className="text-xs text-gray-600">
              <div className="font-medium mb-1">What happens next:</div>
              <ul className="space-y-1 ml-4">
                <li>• We'll email a consent form to the parent/guardian</li>
                <li>• They'll need to verify their identity and provide consent</li>
                <li>• You'll be notified once consent is approved</li>
                <li>• Account access will be enabled after approval</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleParentalConsent} 
                disabled={loading || !parentEmail.trim()}
                className="flex-1"
              >
                {loading ? 'Sending...' : 'Send Consent Request'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowParentalConsent(false)}
                disabled={loading}
              >
                Back
              </Button>
            </div>
          </>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-gray-500 border-t pt-3">
          <div className="font-medium mb-1">Why we need this:</div>
          <div>
            The Children's Online Privacy Protection Act (COPPA) requires us to verify that users 
            are at least 13 years old before collecting any personal information. This protects 
            children's privacy online.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}