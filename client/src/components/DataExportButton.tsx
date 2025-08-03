import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Download, Shield, Clock, FileText, AlertCircle, Crown, Lock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

const DataExportButton: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [userTier, setUserTier] = useState<string>('free');
  const [hasDataExportAccess, setHasDataExportAccess] = useState(false);
  const { toast } = useToast();

  // Check user's tier on component mount
  useEffect(() => {
    const checkUserTier = async () => {
      try {
        // Use httpOnly cookies for authentication (no need for manual token handling)
        const response = await fetch('/api/user/subscription', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': sessionStorage.getItem('app-session-id') || 'anonymous',
          },
        });

        if (response.ok) {
          const data = await response.json();
          const tier = data.tier?.id || 'free';
          setUserTier(tier);
          
          // Professional tier and higher (professional, business, enterprise, ultimate) get data export access
          const dataExportTiers = ['professional', 'business', 'enterprise', 'ultimate'];
          setHasDataExportAccess(dataExportTiers.includes(tier));
        } else {
          setUserTier('free');
          setHasDataExportAccess(false);
        }
      } catch (error) {
        console.error('Error checking user tier:', error);
        setUserTier('free');
        setHasDataExportAccess(false);
      }
    };

    checkUserTier();
  }, []);

  const handleDownload = async () => {
    // Check tier access before proceeding
    if (!hasDataExportAccess) {
      toast({
        title: "Professional Tier Required",
        description: "Data export is available for Professional tier and above. Please upgrade your subscription.",
        variant: "destructive"
      });
      return;
    }

    setIsExporting(true);
    
    try {
      const response = await fetch('/api/users/me/download-data', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionStorage.getItem('app-session-id') || 'anonymous',
          'x-device-fingerprint': localStorage.getItem('deviceFingerprint') || ''
        },
        credentials: 'include'
      });

      if (response.status === 403) {
        const errorData = await response.json();
        toast({
          title: "Upgrade Required",
          description: errorData.message || "This feature requires Professional tier or higher",
          variant: "destructive"
        });
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Get filename from response headers
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || 
                      `readmyfineprint-data-export-${new Date().toISOString().split('T')[0]}.json`;

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Data Export Complete",
        description: `Your data has been downloaded as ${filename}`,
      });

      setShowDialog(false);

    } catch (error) {
      console.error('Data export error:', error);
      toast({
        title: "Export Failed",
        description: "Failed to download your data. Please try again or contact support.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className={`flex items-center space-x-2 ${!hasDataExportAccess ? 'opacity-75' : ''}`}
          disabled={!hasDataExportAccess}
        >
          {hasDataExportAccess ? (
            <Download className="h-4 w-4" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
          <span>{hasDataExportAccess ? 'Download My Data' : 'Download My Data (Pro)'}</span>
          {!hasDataExportAccess && (
            <Crown className="h-3 w-3 text-orange-500" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-background dark:bg-gray-800">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Download Your Personal Data</span>
          </DialogTitle>
          <DialogDescription>
            Download a complete export of all personal data associated with your account, including audit trails and usage history.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!hasDataExportAccess ? (
            <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
              <Crown className="h-4 w-4 text-orange-500" />
              <AlertDescription className="text-orange-800 dark:text-orange-200">
                <div className="font-medium mb-1">Professional Tier Required</div>
                Data export is available for Professional tier and above. 
                <a 
                  href="/subscription" 
                  className="underline hover:no-underline ml-1"
                  onClick={() => setShowDialog(false)}
                >
                  Upgrade your subscription
                </a> to access this feature.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                This export complies with GDPR Article 15 (Right of Access) and includes all personal data we hold about you.
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What's Included</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">Profile</Badge>
                  <span className="text-sm">Account information</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">Subscription</Badge>
                  <span className="text-sm">Plan and billing data</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">Usage</Badge>
                  <span className="text-sm">Document analysis history</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">Security</Badge>
                  <span className="text-sm">Login and security events</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">Requests</Badge>
                  <span className="text-sm">Email change requests</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">Legal</Badge>
                  <span className="text-sm">Privacy rights information</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <AlertCircle className="h-4 w-4" />
                <span>Important Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• The export file contains sensitive personal information</p>
              <p>• Store the file securely and delete when no longer needed</p>
              <p>• IP addresses are hashed for privacy protection</p>
              <p>• Password hashes are excluded for security</p>
              <p>• Export includes data from the last 24 months</p>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Export typically takes 5-10 seconds</span>
            </div>
            <div className="space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setShowDialog(false)}
                disabled={isExporting}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleDownload}
                disabled={isExporting || !hasDataExportAccess}
                className={`flex items-center space-x-2 ${!hasDataExportAccess ? 'opacity-50' : ''}`}
              >
                {isExporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Exporting...</span>
                  </>
                ) : !hasDataExportAccess ? (
                  <>
                    <Lock className="h-4 w-4" />
                    <span>Upgrade Required</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>Download Data</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DataExportButton;