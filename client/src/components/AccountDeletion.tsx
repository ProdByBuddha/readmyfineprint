/**
 * Account Deletion Component
 * GDPR/CCPA compliant account deletion with clear information about data retention
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Trash2, AlertTriangle, Shield, FileText } from 'lucide-react';

interface AccountDeletionProps {
  userEmail: string;
  onSuccess: () => void;
}

export default function AccountDeletion({ userEmail, onSuccess }: AccountDeletionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'warning' | 'confirmation' | 'processing' | 'success'>('warning');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [error, setError] = useState('');
  const [deletionResult, setDeletionResult] = useState<any>(null);

  const handleDelete = async () => {
    if (confirmEmail !== userEmail) {
      setError('Email confirmation does not match your account email');
      return;
    }

    if (!understood) {
      setError('Please confirm that you understand the consequences');
      return;
    }

    setStep('processing');
    setError('');

    try {
      const token = localStorage.getItem('subscriptionToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch('/api/users/account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-subscription-token': token,
        },
        body: JSON.stringify({
          confirmEmail,
          reason: 'user_request',
          retainFinancialData: true,
          anonymizeData: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete account');
      }

      const result = await response.json();
      setDeletionResult(result);
      setStep('success');

      // Clear local storage
      localStorage.removeItem('subscriptionToken');
      
      // Notify parent component
      setTimeout(() => {
        onSuccess();
      }, 3000);

    } catch (error) {
      console.error('Account deletion failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete account');
      setStep('confirmation');
    }
  };

  const resetDialog = () => {
    setStep('warning');
    setConfirmEmail('');
    setUnderstood(false);
    setError('');
    setDeletionResult(null);
  };

  return (
    <>
      <Button 
        variant="destructive" 
        onClick={() => setIsOpen(true)}
        className="w-full"
      >
        <Trash2 className="w-4 h-4 mr-2" />
        Delete Account
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) resetDialog();
      }}>
        <DialogContent className="max-w-2xl">
          {step === 'warning' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="w-5 h-5" />
                  Delete Account
                </DialogTitle>
                <DialogDescription>
                  This action will permanently delete your account. Please read the following carefully.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertTitle>What happens to your data</AlertTitle>
                  <AlertDescription className="mt-2 space-y-2">
                    <div className="space-y-1">
                      <p><strong>Immediately deleted:</strong></p>
                      <ul className="list-disc list-inside pl-4 text-sm">
                        <li>Your email address will be anonymized</li>
                        <li>Your account credentials will be permanently removed</li>
                        <li>All active sessions will be terminated</li>
                        <li>All subscription tokens will be revoked</li>
                      </ul>
                    </div>
                    
                    <div className="space-y-1">
                      <p><strong>Retained for compliance (anonymized):</strong></p>
                      <ul className="list-disc list-inside pl-4 text-sm">
                        <li>Subscription and payment history (7 years)</li>
                        <li>Usage statistics for billing purposes</li>
                        <li>Financial records required by law</li>
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>

                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertTitle>Stripe Integration</AlertTitle>
                  <AlertDescription>
                    Your Stripe subscription will be cancelled immediately. Payment history in Stripe 
                    will be anonymized but retained for financial compliance requirements.
                  </AlertDescription>
                </Alert>

                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <h4 className="font-semibold text-red-800 mb-2">⚠️ This action cannot be undone</h4>
                  <p className="text-sm text-red-700">
                    Once your account is deleted and your data is anonymized, we cannot restore 
                    your account or recover your personal information.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => setStep('confirmation')}
                >
                  Continue with Deletion
                </Button>
              </DialogFooter>
            </>
          )}

          {step === 'confirmation' && (
            <>
              <DialogHeader>
                <DialogTitle className="text-red-600">Confirm Account Deletion</DialogTitle>
                <DialogDescription>
                  To confirm, please type your email address and acknowledge that you understand the consequences.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="confirmEmail">
                    Type your email address: <span className="font-mono text-sm">{userEmail}</span>
                  </Label>
                  <Input
                    id="confirmEmail"
                    type="email"
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    placeholder={userEmail}
                    className="mt-1"
                  />
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="understood"
                    checked={understood}
                    onCheckedChange={(checked) => setUnderstood(checked as boolean)}
                  />
                  <Label htmlFor="understood" className="text-sm leading-relaxed">
                    I understand that this action is permanent and irreversible. My personal 
                    information will be permanently deleted and anonymized, while financial 
                    records will be retained for compliance purposes.
                  </Label>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setStep('warning')}>
                  Back
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleDelete}
                  disabled={!confirmEmail || !understood}
                >
                  Delete My Account Permanently
                </Button>
              </DialogFooter>
            </>
          )}

          {step === 'processing' && (
            <>
              <DialogHeader>
                <DialogTitle>Deleting Account...</DialogTitle>
                <DialogDescription>
                  Please wait while we process your account deletion request.
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
              </div>
            </>
          )}

          {step === 'success' && (
            <>
              <DialogHeader>
                <DialogTitle className="text-green-600">Account Successfully Deleted</DialogTitle>
                <DialogDescription>
                  Your account has been permanently deleted and your data has been anonymized.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertTitle>Deletion Summary</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 space-y-1 text-sm">
                      <p><strong>Deleted at:</strong> {new Date(deletionResult?.deletedAt).toLocaleString()}</p>
                      {deletionResult?.dataRetention && (
                        <div>
                          <p><strong>Data retention:</strong></p>
                          <ul className="list-disc list-inside pl-4">
                            <li>Financial records: {deletionResult.dataRetention.financialRecords ? 'Retained (anonymized)' : 'Deleted'}</li>
                            <li>Usage statistics: {deletionResult.dataRetention.usageStatistics ? 'Retained (anonymized)' : 'Deleted'}</li>
                            <li>Subscription history: {deletionResult.dataRetention.subscriptionHistory ? 'Retained (anonymized)' : 'Deleted'}</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>

                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <p className="text-sm text-green-700">
                    You will be logged out shortly. Thank you for using ReadMyFinePrint.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button onClick={() => onSuccess()}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}