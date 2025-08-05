'use client';

'use client';

import { useState } from 'react';
import { EmailRecoveryForm } from '@/components/EmailRecoveryForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function EmailRecoveryPage() {
  const [recoveryStatus, setRecoveryStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleRecoveryAttempt = async (email: string) => {
    try {
      // Simulate API call
      const response = await fetch('/api/auth/request-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setRecoveryStatus('success');
        setMessage('If an account with that email exists, a recovery link has been sent.');
      } else {
        const errorData = await response.json();
        setRecoveryStatus('error');
        setMessage(errorData.message || 'Failed to initiate recovery. Please try again.');
      }
    } catch (error) {
      setRecoveryStatus('error');
      setMessage('An unexpected error occurred. Please try again later.');
      console.error('Email recovery error:', error);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Account Recovery</CardTitle>
        </CardHeader>
        <CardContent>
          {recoveryStatus === 'success' && (
            <Alert className="mb-4 bg-green-100 border-green-400 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          {recoveryStatus === 'error' && (
            <Alert className="mb-4 bg-red-100 border-red-400 text-red-700 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          <EmailRecoveryForm onSuccess={handleRecoveryAttempt} />
        </CardContent>
      </Card>
    </div>
  );
}
