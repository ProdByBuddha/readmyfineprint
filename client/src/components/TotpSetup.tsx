import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Check, Smartphone, Shield, Key, AlertTriangle } from 'lucide-react';
import { fetchWithCSRF } from '@/lib/csrfManager';

interface TotpSetupData {
  qrCodeUrl: string;
  manualEntry: string;
  backupCodes: string[];
  secret: string;
}

interface TotpSetupProps {
  userEmail: string;
  onComplete: () => void;
  onCancel: () => void;
}

export function TotpSetup({ userEmail, onComplete, onCancel }: TotpSetupProps) {
  const [step, setStep] = useState<'setup' | 'verify' | 'backup'>('setup');
  const [setupData, setSetupData] = useState<TotpSetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackupCodes, setCopiedBackupCodes] = useState(false);

  const initiateSetup = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithCSRF('/api/totp/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to setup TOTP');
      }

      const data = await response.json();
      setSetupData(data);
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup TOTP');
    } finally {
      setLoading(false);
    }
  };

  const completeSetup = async () => {
    if (!setupData || !verificationCode.trim()) {
      setError('Please enter the verification code from your authenticator app');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithCSRF('/api/totp/complete-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: setupData.secret,
          backupCodes: setupData.backupCodes,
          verificationToken: verificationCode.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to complete TOTP setup');
      }

      setStep('backup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete TOTP setup');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'secret' | 'backup') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'secret') {
        setCopiedSecret(true);
        setTimeout(() => setCopiedSecret(false), 2000);
      } else {
        setCopiedBackupCodes(true);
        setTimeout(() => setCopiedBackupCodes(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const renderSetupStep = () => (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Enable Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Secure your account with time-based one-time passwords using any authenticator app.
          This provides privacy-preserving 2FA without requiring a phone number.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            onClick={initiateSetup} 
            disabled={loading}
            className="flex-1"
          >
            {loading ? 'Setting up...' : 'Start TOTP Setup'}
          </Button>
          <Button 
            variant="outline" 
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            Recommended Authenticator Apps
          </h4>
          <ul className="text-sm space-y-1">
            <li>• Google Authenticator</li>
            <li>• Microsoft Authenticator</li>
            <li>• Authy</li>
            <li>• 1Password</li>
            <li>• Bitwarden Authenticator</li>
          </ul>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );

  const renderVerifyStep = () => (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Scan QR Code</CardTitle>
        <CardDescription>
          Scan the QR code with your authenticator app, then enter the verification code.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="qr" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="qr">QR Code</TabsTrigger>
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          </TabsList>
          
          <TabsContent value="qr" className="space-y-4">
            <div className="flex justify-center">
              <img 
                src={setupData?.qrCodeUrl} 
                alt="TOTP QR Code" 
                className="border rounded-lg"
              />
            </div>
            <p className="text-sm text-gray-600 text-center">
              Scan this QR code with your authenticator app
            </p>
          </TabsContent>
          
          <TabsContent value="manual" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manual-secret">Manual Entry Code</Label>
              <div className="flex gap-2">
                <Input
                  id="manual-secret"
                  value={setupData?.manualEntry || ''}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setupData && copyToClipboard(setupData.manualEntry, 'secret')}
                >
                  {copiedSecret ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Enter this code manually in your authenticator app if you can't scan the QR code.
            </p>
          </TabsContent>
        </Tabs>

        <div className="space-y-2">
          <Label htmlFor="verification-code">Verification Code</Label>
          <Input
            id="verification-code"
            placeholder="Enter 6-digit code from your app"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            maxLength={6}
            className="text-center text-lg font-mono"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            onClick={completeSetup} 
            disabled={loading || !verificationCode.trim()}
            className="flex-1"
          >
            {loading ? 'Verifying...' : 'Verify & Enable'}
          </Button>
          <Button 
            variant="outline" 
            onClick={onCancel}
            disabled={loading}
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
      </CardContent>
    </Card>
  );

  const renderBackupStep = () => (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="w-5 h-5" />
          Save Your Backup Codes
        </CardTitle>
        <CardDescription>
          Store these backup codes in a safe place. They can be used to access your account if you lose your authenticator app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Important:</strong> Each backup code can only be used once. Store them securely!
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label>Backup Codes</Label>
          <div className="relative">
            <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm">
              {setupData?.backupCodes.map((code, index) => (
                <div key={index} className="py-1">
                  {code}
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="absolute top-2 right-2"
              onClick={() => setupData && copyToClipboard(setupData.backupCodes.join('\n'), 'backup')}
            >
              {copiedBackupCodes ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <h4 className="font-semibold mb-2 text-green-800">✅ TOTP Authentication Enabled!</h4>
          <p className="text-sm text-green-700">
            Your account is now protected with two-factor authentication. You'll need to enter a code from your authenticator app when logging in.
          </p>
        </div>

        <Button onClick={onComplete} className="w-full">
          Complete Setup
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-4">
      {step === 'setup' && renderSetupStep()}
      {step === 'verify' && renderVerifyStep()}
      {step === 'backup' && renderBackupStep()}
    </div>
  );
}