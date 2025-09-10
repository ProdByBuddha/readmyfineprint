import { useState } from 'react';
import { EmailRecoveryForm } from '@/components/EmailRecoveryForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Mail, 
  Shield, 
  HelpCircle, 
  Search,
  ArrowLeft,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

export function EmailRecoveryPage() {
  const [view, setView] = useState<'main' | 'request' | 'status'>('main');
  const [requestId, setRequestId] = useState<string>('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusData, setStatusData] = useState<any>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const handleRequestSuccess = (newRequestId: string) => {
    setRequestId(newRequestId);
    // User will already see success state in the form
  };

  const handleCheckStatus = async () => {
    if (!requestId.trim()) return;

    setStatusLoading(true);
    setStatusError(null);
    setStatusData(null);

    try {
      const response = await fetch(`/api/auth/email-change-status/${requestId.trim()}`);
      const data = await response.json();

      if (response.ok) {
        setStatusData(data);
        setView('status');
      } else {
        setStatusError(data.error || 'Failed to get request status');
      }
    } catch (error) {
      setStatusError('Network error. Please try again.');
      console.error('Status check error:', error);
    } finally {
      setStatusLoading(false);
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          icon: <Shield className="h-5 w-5 text-yellow-600" />,
          title: 'Under Review',
          description: 'Your request is being reviewed by our security team.',
          color: 'bg-yellow-50 border-yellow-200 text-yellow-800'
        };
      case 'approved':
        return {
          icon: <CheckCircle className="h-5 w-5 text-green-600" />,
          title: 'Approved',
          description: 'Your email has been changed successfully.',
          color: 'bg-green-50 border-green-200 text-green-800'
        };
      case 'rejected':
        return {
          icon: <AlertTriangle className="h-5 w-5 text-red-600" />,
          title: 'Rejected',
          description: 'Your request was rejected. Contact support for details.',
          color: 'bg-red-50 border-red-200 text-red-800'
        };
      case 'expired':
        return {
          icon: <AlertTriangle className="h-5 w-5 text-gray-600" />,
          title: 'Expired',
          description: 'Your request has expired. You may submit a new request.',
          color: 'bg-gray-50 border-gray-200 text-gray-800'
        };
      default:
        return {
          icon: <HelpCircle className="h-5 w-5 text-gray-600" />,
          title: 'Unknown Status',
          description: 'Unable to determine request status.',
          color: 'bg-gray-50 border-gray-200 text-gray-800'
        };
    }
  };

  if (view === 'status' && statusData) {
    const statusDisplay = getStatusDisplay(statusData.status);
    
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <div className="mb-6">
            <Button
              onClick={() => setView('main')}
              variant="ghost"
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Search className="h-5 w-5 text-blue-600" />
                <span>Request Status</span>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <Alert className={statusDisplay.color}>
                {statusDisplay.icon}
                <AlertDescription>
                  <div className="space-y-2">
                    <p><strong>{statusDisplay.title}</strong></p>
                    <p>{statusDisplay.description}</p>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-300">Request ID</p>
                    <p className="text-gray-600 dark:text-gray-400 font-mono">{statusData.requestId}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-300">Status</p>
                    <p className="text-gray-600 dark:text-gray-400 capitalize">{statusData.status}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-300">Current Email</p>
                    <p className="text-gray-600 dark:text-gray-400">{statusData.currentEmail}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-300">New Email</p>
                    <p className="text-gray-600 dark:text-gray-400">{statusData.newEmail}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-300">Submitted</p>
                    <p className="text-gray-600 dark:text-gray-400">
                      {new Date(statusData.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-300">Expires</p>
                    <p className="text-gray-600 dark:text-gray-400">
                      {new Date(statusData.expiresAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                {statusData.attempts > 0 && (
                  <div className="text-sm">
                    <p className="font-medium text-gray-700 dark:text-gray-300">Verification Attempts</p>
                    <p className="text-gray-600 dark:text-gray-400">
                      {statusData.attempts} of {statusData.maxAttempts} attempts used
                    </p>
                  </div>
                )}
              </div>

              {statusData.status === 'approved' && (
                <Alert className="bg-blue-50 border-blue-200">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-700">
                    Your email has been changed successfully. You can now log in with your new email address: <strong>{statusData.newEmail}</strong>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (view === 'request') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <div className="mb-6">
            <Button
              onClick={() => setView('main')}
              variant="ghost"
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>

          <EmailRecoveryForm 
            onSuccess={handleRequestSuccess}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <Mail className="h-16 w-16 mx-auto text-blue-600 mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Email Recovery Center
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Lost access to your email? We can help you regain access to your ReadMyFinePrint account through our secure email recovery process.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Request Email Change */}
          <Card className="border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-blue-700 dark:text-blue-300">
                <Mail className="h-5 w-5" />
                <span>Request Email Change</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Can't access your current email? Submit a secure request to change your account email address with admin review.
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Manual security team review</li>
                <li>• 72-hour processing time</li>
                <li>• Email notifications at both addresses</li>
                <li>• Optional security questions for faster processing</li>
              </ul>
              <Button 
                onClick={() => setView('request')} 
                className="w-full"
              >
                Start Email Change Request
              </Button>
            </CardContent>
          </Card>

          {/* Check Request Status */}
          <Card className="border-green-200 dark:border-green-800">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-green-700 dark:text-green-300">
                <Search className="h-5 w-5" />
                <span>Check Request Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Already submitted a request? Check the status using your Request ID.
              </p>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="requestId">Request ID</Label>
                  <Input
                    id="requestId"
                    type="text"
                    value={requestId}
                    onChange={(e) => setRequestId(e.target.value)}
                    placeholder="Enter your request ID"
                    className="w-full"
                  />
                </div>
                
                {statusError && (
                  <Alert className="bg-red-50 border-red-200">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-700">
                      {statusError}
                    </AlertDescription>
                  </Alert>
                )}
                
                <Button 
                  onClick={handleCheckStatus}
                  disabled={!requestId.trim() || statusLoading}
                  className="w-full"
                >
                  {statusLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Checking...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Check Status
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Help Section */}
        <Card className="border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <HelpCircle className="h-5 w-5 text-gray-600" />
              <span>Need Additional Help?</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">Security Requirements</h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• All requests require manual review</li>
                  <li>• Valid reason for email change</li>
                  <li>• Verification may take up to 72 hours</li>
                  <li>• Additional verification for suspicious requests</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Contact Support</h4>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <p>Having trouble with the recovery process?</p>
                  <p>Email: <a href="mailto:support@readmyfineprint.com" className="text-blue-600 hover:underline">support@readmyfineprint.com</a></p>
                  <p>Include your Request ID if you have one.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}