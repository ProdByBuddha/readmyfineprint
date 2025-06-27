import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Shield, Key, RefreshCw, AlertTriangle, Check, Copy, Smartphone } from 'lucide-react';
import { fetchWithCSRF } from '@/lib/csrfManager';

interface TotpStatus {
  totpEnabled: boolean;
  hasBackupCodes: boolean;
  backupCodesRemaining: number;
}

interface TotpManagerProps {
  onTotpStatusChanged?: (enabled: boolean) => void;
}

export function TotpManager({ onTotpStatusChanged }: TotpManagerProps) {
  const [status, setStatus] = useState<TotpStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedBackupCodes, setCopiedBackupCodes] = useState(false);

  useEffect(() => {
    fetchTotpStatus();
  }, []);

  const fetchTotpStatus = async () => {
    try {
      const response = await fetchWithCSRF('/api/totp/status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      } else {
        setError('Failed to fetch TOTP status');
      }
    } catch (err) {
      setError('Failed to fetch TOTP status');
    } finally {
      setLoading(false);
    }
  };

  const verifyTotpToken = async () => {
    if (!verificationCode.trim()) {
      setError('Please enter a verification code');
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      const response = await fetchWithCSRF('/api/totp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verificationCode.trim() }),
      });

      if (response.ok) {
        setVerificationCode('');
        setShowVerifyDialog(false);
        setError(null);
        // Show success message
        const successDiv = document.createElement('div');
        successDiv.className = 'fixed top-4 right-4 bg-green-100 text-green-800 p-3 rounded-lg shadow-lg z-50';
        successDiv.textContent = 'TOTP token verified successfully!';
        document.body.appendChild(successDiv);
        setTimeout(() => document.body.removeChild(successDiv), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to verify TOTP token');
      }
    } catch (err) {
      setError('Failed to verify TOTP token');
    } finally {
      setActionLoading(false);
    }
  };

  const verifyBackupCode = async () => {
    if (!backupCode.trim()) {
      setError('Please enter a backup code');
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      const response = await fetchWithCSRF('/api/totp/verify-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupCode: backupCode.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setBackupCode('');
        setShowVerifyDialog(false);
        setError(null);
        
        // Update status with new backup code count
        await fetchTotpStatus();
        
        // Show success message
        const successDiv = document.createElement('div');
        successDiv.className = 'fixed top-4 right-4 bg-green-100 text-green-800 p-3 rounded-lg shadow-lg z-50';
        successDiv.textContent = `Backup code verified! ${data.remainingBackupCodes} codes remaining.`;
        document.body.appendChild(successDiv);
        setTimeout(() => document.body.removeChild(successDiv), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to verify backup code');
      }
    } catch (err) {
      setError('Failed to verify backup code');
    } finally {
      setActionLoading(false);
    }
  };

  const regenerateBackupCodes = async () => {
    setActionLoading(true);
    setError(null);

    try {
      const response = await fetchWithCSRF('/api/totp/regenerate-backup-codes', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setNewBackupCodes(data.backupCodes);
        await fetchTotpStatus();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to regenerate backup codes');
      }
    } catch (err) {
      setError('Failed to regenerate backup codes');
    } finally {
      setActionLoading(false);
    }
  };

  const disableTotp = async () => {
    setActionLoading(true);
    setError(null);

    try {
      const response = await fetchWithCSRF('/api/totp/disable', {
        method: 'POST',
      });

      if (response.ok) {
        setShowDisableDialog(false);
        await fetchTotpStatus();
        onTotpStatusChanged?.(false);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to disable TOTP');
      }
    } catch (err) {
      setError('Failed to disable TOTP');
    } finally {
      setActionLoading(false);
    }
  };

  const copyBackupCodes = async () => {
    if (!newBackupCodes) return;
    
    try {
      await navigator.clipboard.writeText(newBackupCodes.join('\n'));
      setCopiedBackupCodes(true);
      setTimeout(() => setCopiedBackupCodes(false), 2000);
    } catch (err) {
      console.error('Failed to copy backup codes:', err);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>Loading TOTP status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error || 'Failed to load TOTP status'}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Two-Factor Authentication (TOTP)
          {status.totpEnabled && <Badge variant="default">Enabled</Badge>}
        </CardTitle>
        <CardDescription>
          Secure your account with time-based one-time passwords from your authenticator app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {status.totpEnabled ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  <span className="font-medium">Authenticator App</span>
                </div>
                <p className="text-sm text-gray-600">
                  Your authenticator app is configured and ready to use.
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  <span className="font-medium">Backup Codes</span>
                </div>
                <p className="text-sm text-gray-600">
                  {status.backupCodesRemaining} backup codes remaining
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    Test Verification
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Test TOTP Verification</DialogTitle>
                    <DialogDescription>
                      Enter a code from your authenticator app or use a backup code to test verification.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="totp-code">Authenticator Code</Label>
                      <Input
                        id="totp-code"
                        placeholder="Enter 6-digit code"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        maxLength={6}
                        className="text-center text-lg font-mono"
                      />
                      <Button 
                        onClick={verifyTotpToken} 
                        disabled={actionLoading || !verificationCode.trim()}
                        className="w-full"
                      >
                        {actionLoading ? 'Verifying...' : 'Verify Code'}
                      </Button>
                    </div>
                    
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">Or</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="backup-code">Backup Code</Label>
                      <Input
                        id="backup-code"
                        placeholder="Enter backup code (e.g., ABCD-1234)"
                        value={backupCode}
                        onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                        className="text-center font-mono"
                      />
                      <Button 
                        onClick={verifyBackupCode} 
                        disabled={actionLoading || !backupCode.trim()}
                        className="w-full"
                        variant="outline"
                      >
                        {actionLoading ? 'Verifying...' : 'Verify Backup Code'}
                      </Button>
                    </div>
                    
                    {error && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Regenerate Backup Codes
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Generate New Backup Codes</DialogTitle>
                    <DialogDescription>
                      This will generate new backup codes and invalidate all existing ones.
                    </DialogDescription>
                  </DialogHeader>
                  {newBackupCodes ? (
                    <div className="space-y-4">
                      <Alert>
                        <Key className="h-4 w-4" />
                        <AlertDescription>
                          Save these new backup codes securely. Your old codes are no longer valid.
                        </AlertDescription>
                      </Alert>
                      <div className="space-y-2">
                        <div className="relative">
                          <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm max-h-48 overflow-y-auto">
                            {newBackupCodes.map((code, index) => (
                              <div key={index} className="py-1">
                                {code}
                              </div>
                            ))}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="absolute top-2 right-2"
                            onClick={copyBackupCodes}
                          >
                            {copiedBackupCodes ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                      <Button onClick={() => {
                        setShowRegenerateDialog(false);
                        setNewBackupCodes(null);
                      }} className="w-full">
                        Done
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600">
                        Are you sure you want to generate new backup codes? This action cannot be undone.
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          onClick={regenerateBackupCodes}
                          disabled={actionLoading}
                          className="flex-1"
                        >
                          {actionLoading ? 'Generating...' : 'Generate New Codes'}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => setShowRegenerateDialog(false)}
                          disabled={actionLoading}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                  {error && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                </DialogContent>
              </Dialog>

              <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    Disable TOTP
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to disable TOTP authentication? This will make your account less secure.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Warning:</strong> Disabling 2FA will reduce your account security. 
                        Only do this if you're unable to access your authenticator app.
                      </AlertDescription>
                    </Alert>
                    <div className="flex gap-2">
                      <Button 
                        variant="destructive"
                        onClick={disableTotp}
                        disabled={actionLoading}
                        className="flex-1"
                      >
                        {actionLoading ? 'Disabling...' : 'Yes, Disable TOTP'}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setShowDisableDialog(false)}
                        disabled={actionLoading}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                  {error && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </>
        ) : (
          <div className="text-center space-y-4">
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-sm text-yellow-800">
                Two-factor authentication is not enabled for your account. 
                Enable it now for enhanced security without sharing your phone number.
              </p>
            </div>
            <p className="text-sm text-gray-600">
              TOTP uses your authenticator app to generate time-based codes, 
              providing strong security while maintaining your privacy.
            </p>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}