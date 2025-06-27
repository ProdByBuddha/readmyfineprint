import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Info, Download, Trash2, Shield, Eye, FileText } from 'lucide-react';
import { fetchWithCSRF } from '@/lib/csrfManager';

interface CcpaDisclosureProps {
  userEmail?: string;
  showInline?: boolean;
}

export function CcpaDisclosure({ userEmail, showInline = false }: CcpaDisclosureProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleDataRequest = async (requestType: 'access' | 'delete' | 'portability') => {
    if (!userEmail) {
      setError('Please log in to submit data requests');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetchWithCSRF('/api/ccpa/data-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType,
          email: userEmail,
          preferenceCenter: true
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuccessMessage(data.message);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to submit request');
      }
    } catch (err) {
      setError('Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const CcpaContent = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2 text-blue-900">Your California Privacy Rights</h3>
        <p className="text-sm text-blue-800">
          Under the California Consumer Privacy Act (CCPA) and California Privacy Rights Act (CPRA), 
          California residents have specific rights regarding their personal information.
        </p>
      </div>

      <div className="grid gap-4">
        <div className="space-y-3">
          <h4 className="font-medium">Categories of Personal Information We Collect</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">Required</Badge>
              <div>
                <strong>Account Information:</strong> Email address for authentication and service delivery
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="secondary" className="mt-0.5">Optional</Badge>
              <div>
                <strong>Usage Analytics:</strong> Anonymized document processing statistics (no document content stored)
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="secondary" className="mt-0.5">Security</Badge>
              <div>
                <strong>Security Data:</strong> Hashed IP addresses and session identifiers for fraud prevention
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-medium">How We Use Your Information</h4>
          <ul className="text-sm space-y-1 ml-4">
            <li>• Provide legal document analysis services</li>
            <li>• Authenticate your account and prevent fraud</li>
            <li>• Process payments through Stripe (we don't store payment data)</li>
            <li>• Send OpenAI anonymized, redacted document content for analysis</li>
            <li>• Comply with legal obligations</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h4 className="font-medium">Third-Party Data Sharing</h4>
          <div className="space-y-2 text-sm">
            <div>
              <strong>OpenAI:</strong> Anonymized, PII-redacted document content for analysis (Standard Contractual Clauses)
            </div>
            <div>
              <strong>Stripe:</strong> Payment processing only (PCI DSS compliant)
            </div>
            <div>
              <strong>No Data Sale:</strong> We do not sell personal information to third parties
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-medium">Data Retention</h4>
          <div className="text-sm space-y-1">
            <div>• <strong>Documents:</strong> Deleted immediately after analysis (zero retention)</div>
            <div>• <strong>Account Data:</strong> Retained while account is active</div>
            <div>• <strong>Security Logs:</strong> 90 days for fraud prevention</div>
            <div>• <strong>Payment Records:</strong> 7 years for tax compliance</div>
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <h4 className="font-medium mb-3">Exercise Your CCPA Rights</h4>
        <div className="grid gap-3">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              <div>
                <div className="font-medium">Right to Know</div>
                <div className="text-sm text-gray-600">Request details about data we collect</div>
              </div>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => handleDataRequest('access')}
              disabled={loading || !userEmail}
            >
              Request Access
            </Button>
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              <div>
                <div className="font-medium">Data Portability</div>
                <div className="text-sm text-gray-600">Download your data in portable format</div>
              </div>
            </div>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => handleDataRequest('portability')}
              disabled={loading || !userEmail}
            >
              Download Data
            </Button>
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              <div>
                <div className="font-medium">Right to Delete</div>
                <div className="text-sm text-gray-600">Request deletion of your personal data</div>
              </div>
            </div>
            <Button 
              size="sm" 
              variant="destructive"
              onClick={() => handleDataRequest('delete')}
              disabled={loading || !userEmail}
            >
              Delete Data
            </Button>
          </div>
        </div>

        {!userEmail && (
          <Alert className="mt-3">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Please log in to submit CCPA data requests. Requests are processed within 45 days.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mt-3">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert className="mt-3">
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
          <div className="font-medium mb-1">Contact Information</div>
          <div>For CCPA requests or questions about your privacy rights:</div>
          <div className="mt-1">
            <div>Email: privacy@readmyfineprint.com</div>
            <div>Response Time: Within 45 days</div>
            <div>Verification: Required for all requests</div>
          </div>
        </div>
      </div>
    </div>
  );

  if (showInline) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            California Privacy Rights (CCPA/CPRA)
          </CardTitle>
          <CardDescription>
            Your rights under California privacy law
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CcpaContent />
        </CardContent>
      </Card>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="link" className="h-auto p-0 text-blue-600">
          California Privacy Rights
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            California Privacy Rights (CCPA/CPRA)
          </DialogTitle>
          <DialogDescription>
            Your rights under the California Consumer Privacy Act and California Privacy Rights Act
          </DialogDescription>
        </DialogHeader>
        <CcpaContent />
      </DialogContent>
    </Dialog>
  );
}