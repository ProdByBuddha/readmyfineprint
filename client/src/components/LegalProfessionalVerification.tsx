import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Scale, Shield, CheckCircle, Clock, AlertTriangle, Building2, GraduationCap } from 'lucide-react';
import { fetchWithCSRF } from '@/lib/csrfManager';

interface LegalProfessionalStatus {
  isVerified: boolean;
  verificationLevel?: string;
  practiceAreas?: string[];
  firmName?: string;
  barState?: string;
  privilegeProtectionEnabled: boolean;
  enhancedSecurityFeatures: boolean;
}

interface LegalProfessionalVerificationProps {
  onVerificationComplete?: (status: LegalProfessionalStatus) => void;
  onError?: (error: string) => void;
}

export function LegalProfessionalVerification({ 
  onVerificationComplete, 
  onError 
}: LegalProfessionalVerificationProps) {
  const [status, setStatus] = useState<LegalProfessionalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVerificationForm, setShowVerificationForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    barAdmission: {
      state: '',
      barNumber: '',
      admissionDate: '',
      status: 'active' as 'active' | 'inactive' | 'suspended'
    },
    lawFirm: {
      name: '',
      address: '',
      website: '',
      size: 'small' as 'solo' | 'small' | 'medium' | 'large' | 'biglaw'
    },
    practiceAreas: [] as string[],
    professionalLiability: {
      carrier: '',
      policyNumber: '',
      coverageAmount: '',
      expirationDate: ''
    },
    ethicsTraining: {
      completed: false,
      completionDate: '',
      provider: ''
    }
  });

  // Available practice areas
  const practiceAreaOptions = [
    'Corporate Law', 'Litigation', 'Real Estate', 'Family Law', 'Criminal Defense',
    'Personal Injury', 'Employment Law', 'Intellectual Property', 'Tax Law',
    'Estate Planning', 'Immigration', 'Environmental Law', 'Healthcare Law',
    'Securities Law', 'Bankruptcy', 'Contract Law', 'Mergers & Acquisitions',
    'Regulatory Compliance', 'International Law', 'Other'
  ];

  // US States
  const usStates = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
  ];

  useEffect(() => {
    checkVerificationStatus();
  }, []);

  const checkVerificationStatus = async () => {
    try {
      const response = await fetchWithCSRF('/api/legal/professional-status');
      if (response.ok) {
        const statusData = await response.json();
        setStatus(statusData);
        onVerificationComplete?.(statusData);
      }
    } catch (err) {
      // No verification status available
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitVerification = async () => {
    if (!validateForm()) {
      setError('Please complete all required fields');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetchWithCSRF('/api/legal/verify-professional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const result = await response.json();
        setShowVerificationForm(false);
        
        // Update status to pending
        const pendingStatus = {
          isVerified: false,
          verificationLevel: 'pending',
          privilegeProtectionEnabled: false,
          enhancedSecurityFeatures: false
        };
        setStatus(pendingStatus);
        onVerificationComplete?.(pendingStatus);

        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Verification submission failed');
        onError?.(errorData.error || 'Verification submission failed');
      }
    } catch (err) {
      setError('Failed to submit verification request');
      onError?.('Failed to submit verification request');
    } finally {
      setSubmitting(false);
    }
  };

  const validateForm = (): boolean => {
    return !!(
      formData.barAdmission.state &&
      formData.barAdmission.barNumber &&
      formData.barAdmission.admissionDate &&
      formData.lawFirm.name &&
      formData.lawFirm.address &&
      formData.practiceAreas.length > 0 &&
      formData.professionalLiability.carrier &&
      formData.professionalLiability.policyNumber &&
      formData.professionalLiability.coverageAmount &&
      formData.professionalLiability.expirationDate
    );
  };

  const handlePracticeAreaChange = (area: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        practiceAreas: [...prev.practiceAreas, area]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        practiceAreas: prev.practiceAreas.filter(a => a !== area)
      }));
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>Checking legal professional status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Verified status display
  if (status?.isVerified) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Legal Professional Verified
            <Badge variant="default">VERIFIED</Badge>
          </CardTitle>
          <CardDescription>
            Enhanced privilege protection and confidentiality features enabled
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span className="font-medium">Law Firm</span>
              </div>
              <p className="text-sm text-gray-600">{status.firmName || 'Not specified'}</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4" />
                <span className="font-medium">Bar Admission</span>
              </div>
              <p className="text-sm text-gray-600">{status.barState || 'Not specified'}</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                <span className="font-medium">Practice Areas</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {status.practiceAreas?.map((area, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {area}
                  </Badge>
                )) || <span className="text-sm text-gray-600">Not specified</span>}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span className="font-medium">Enhanced Features</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span>Attorney-client privilege protection</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span>Enhanced document anonymization</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span>Professional liability compliance</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span>Priority legal support</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Pending verification status
  if (status?.verificationLevel === 'pending') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-600" />
            Verification Pending
            <Badge variant="secondary">PENDING</Badge>
          </CardTitle>
          <CardDescription>
            Your legal professional verification is under review
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Our legal team is reviewing your credentials. You will be contacted within 2 business days. 
              Verification typically takes 1-3 business days to complete.
            </AlertDescription>
          </Alert>
          
          <div className="mt-4 space-y-2">
            <h4 className="font-medium">What happens next:</h4>
            <ul className="text-sm space-y-1 ml-4">
              <li>• Verification of bar admission with state bar database</li>
              <li>• Confirmation of law firm employment/association</li>
              <li>• Professional liability insurance validation</li>
              <li>• Email notification once verification is complete</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Verification form
  if (showVerificationForm) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="w-5 h-5" />
            Legal Professional Verification
          </CardTitle>
          <CardDescription>
            Verify your legal professional status to access enhanced privilege protection features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Bar Admission Information */}
          <div className="space-y-4">
            <h3 className="font-medium border-b pb-2">Bar Admission Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bar-state">State of Bar Admission *</Label>
                <Select value={formData.barAdmission.state} onValueChange={(value) => 
                  setFormData(prev => ({ ...prev, barAdmission: { ...prev.barAdmission, state: value } }))
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {usStates.map(state => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="bar-number">Bar Number *</Label>
                <Input
                  id="bar-number"
                  value={formData.barAdmission.barNumber}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    barAdmission: { ...prev.barAdmission, barNumber: e.target.value } 
                  }))}
                  placeholder="Enter your bar number"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="admission-date">Admission Date *</Label>
                <Input
                  id="admission-date"
                  type="date"
                  value={formData.barAdmission.admissionDate}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    barAdmission: { ...prev.barAdmission, admissionDate: e.target.value } 
                  }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="bar-status">Bar Status</Label>
                <Select value={formData.barAdmission.status} onValueChange={(value: any) => 
                  setFormData(prev => ({ ...prev, barAdmission: { ...prev.barAdmission, status: value } }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Law Firm Information */}
          <div className="space-y-4">
            <h3 className="font-medium border-b pb-2">Law Firm Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firm-name">Law Firm Name *</Label>
                <Input
                  id="firm-name"
                  value={formData.lawFirm.name}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    lawFirm: { ...prev.lawFirm, name: e.target.value } 
                  }))}
                  placeholder="Enter law firm name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="firm-size">Firm Size</Label>
                <Select value={formData.lawFirm.size} onValueChange={(value: any) => 
                  setFormData(prev => ({ ...prev, lawFirm: { ...prev.lawFirm, size: value } }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solo">Solo Practice</SelectItem>
                    <SelectItem value="small">Small (2-25 attorneys)</SelectItem>
                    <SelectItem value="medium">Medium (26-100 attorneys)</SelectItem>
                    <SelectItem value="large">Large (101-500 attorneys)</SelectItem>
                    <SelectItem value="biglaw">BigLaw (500+ attorneys)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="firm-address">Firm Address *</Label>
                <Input
                  id="firm-address"
                  value={formData.lawFirm.address}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    lawFirm: { ...prev.lawFirm, address: e.target.value } 
                  }))}
                  placeholder="Enter complete firm address"
                />
              </div>
              
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="firm-website">Firm Website</Label>
                <Input
                  id="firm-website"
                  type="url"
                  value={formData.lawFirm.website}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    lawFirm: { ...prev.lawFirm, website: e.target.value } 
                  }))}
                  placeholder="https://www.lawfirm.com"
                />
              </div>
            </div>
          </div>

          {/* Practice Areas */}
          <div className="space-y-4">
            <h3 className="font-medium border-b pb-2">Practice Areas *</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {practiceAreaOptions.map((area) => (
                <div key={area} className="flex items-center space-x-2">
                  <Checkbox
                    id={area}
                    checked={formData.practiceAreas.includes(area)}
                    onCheckedChange={(checked) => handlePracticeAreaChange(area, checked as boolean)}
                  />
                  <Label htmlFor={area} className="text-sm">{area}</Label>
                </div>
              ))}
            </div>
          </div>

          {/* Professional Liability Insurance */}
          <div className="space-y-4">
            <h3 className="font-medium border-b pb-2">Professional Liability Insurance *</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="insurance-carrier">Insurance Carrier *</Label>
                <Input
                  id="insurance-carrier"
                  value={formData.professionalLiability.carrier}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    professionalLiability: { ...prev.professionalLiability, carrier: e.target.value } 
                  }))}
                  placeholder="Insurance company name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="policy-number">Policy Number *</Label>
                <Input
                  id="policy-number"
                  value={formData.professionalLiability.policyNumber}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    professionalLiability: { ...prev.professionalLiability, policyNumber: e.target.value } 
                  }))}
                  placeholder="Policy number"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="coverage-amount">Coverage Amount *</Label>
                <Input
                  id="coverage-amount"
                  value={formData.professionalLiability.coverageAmount}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    professionalLiability: { ...prev.professionalLiability, coverageAmount: e.target.value } 
                  }))}
                  placeholder="e.g., $1,000,000"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="expiration-date">Policy Expiration *</Label>
                <Input
                  id="expiration-date"
                  type="date"
                  value={formData.professionalLiability.expirationDate}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    professionalLiability: { ...prev.professionalLiability, expirationDate: e.target.value } 
                  }))}
                />
              </div>
            </div>
          </div>

          {/* Ethics Training */}
          <div className="space-y-4">
            <h3 className="font-medium border-b pb-2">Ethics Training</h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="ethics-completed"
                  checked={formData.ethicsTraining.completed}
                  onCheckedChange={(checked) => setFormData(prev => ({ 
                    ...prev, 
                    ethicsTraining: { ...prev.ethicsTraining, completed: checked as boolean } 
                  }))}
                />
                <Label htmlFor="ethics-completed">
                  I have completed ethics training on technology use in legal practice
                </Label>
              </div>
              
              {formData.ethicsTraining.completed && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-6">
                  <div className="space-y-2">
                    <Label htmlFor="completion-date">Completion Date</Label>
                    <Input
                      id="completion-date"
                      type="date"
                      value={formData.ethicsTraining.completionDate}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        ethicsTraining: { ...prev.ethicsTraining, completionDate: e.target.value } 
                      }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="training-provider">Training Provider</Label>
                    <Input
                      id="training-provider"
                      value={formData.ethicsTraining.provider}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        ethicsTraining: { ...prev.ethicsTraining, provider: e.target.value } 
                      }))}
                      placeholder="CLE provider or organization"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
            <Button 
              onClick={handleSubmitVerification} 
              disabled={submitting || !validateForm()}
              className="flex-1"
            >
              {submitting ? 'Submitting Verification...' : 'Submit for Verification'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowVerificationForm(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="text-xs text-gray-500 border-t pt-3">
            <p><strong>Privacy Notice:</strong> All information will be verified with appropriate professional organizations. 
            Your data is encrypted and handled in accordance with attorney-client privilege protection standards.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Initial state - option to start verification
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="w-5 h-5" />
          Legal Professional Verification
        </CardTitle>
        <CardDescription>
          Get verified as a legal professional to access enhanced privilege protection features
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-semibold mb-2 text-blue-900">Enhanced Features for Legal Professionals</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Attorney-client privilege detection and protection</li>
            <li>• Enhanced document anonymization for confidential materials</li>
            <li>• Professional liability compliance documentation</li>
            <li>• Client consent form generation</li>
            <li>• Priority support for ethics and compliance questions</li>
            <li>• Comprehensive audit trails for bar association compliance</li>
          </ul>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">Verification Requirements:</h4>
          <ul className="text-sm space-y-1 ml-4">
            <li>• Active bar admission in any U.S. jurisdiction</li>
            <li>• Current professional liability insurance</li>
            <li>• Law firm employment or association verification</li>
            <li>• Ethics training certification (recommended)</li>
          </ul>
        </div>

        <Button 
          onClick={() => setShowVerificationForm(true)}
          className="w-full"
        >
          Start Legal Professional Verification
        </Button>

        <div className="text-xs text-gray-500">
          <p><strong>Verification Process:</strong> Our legal team will review your credentials within 2 business days. 
          You will be contacted if additional information is needed.</p>
        </div>
      </CardContent>
    </Card>
  );
}