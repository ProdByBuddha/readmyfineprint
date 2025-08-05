'use client';

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Mail, ArrowLeft } from "lucide-react";
import Link from "next/link";

const UnsubscribeContent: React.FC = () => {
  const rawSearchParams = useSearchParams();
  const searchParams = new URLSearchParams(rawSearchParams);
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleUnsubscribe = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Invalid or missing unsubscribe token.');
        return;
      }

      try {
        const response = await fetch('/api/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        if (response.ok) {
          setStatus('success');
          setMessage('You have been successfully unsubscribed.');
        } else {
          const errorData = await response.json();
          setStatus('error');
          setMessage(errorData.message || 'Failed to unsubscribe. Please try again.');
        }
      } catch (error) {
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again later.');
        console.error('Unsubscribe error:', error);
      }
    };

    handleUnsubscribe();
  }, [token]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 page-transition">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray-800 text-center">
        {status === 'loading' && (
          <div className="flex flex-col items-center">
            <Mail className="h-16 w-16 text-blue-500 animate-bounce mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Processing Unsubscribe...</h2>
            <p className="text-gray-600 dark:text-gray-400">Please wait while we process your request.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center">
            <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Unsubscribed Successfully!</h2>
            <p className="text-gray-600 dark:text-gray-400">{message}</p>
            <Link href="/" className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Home
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center">
            <XCircle className="h-16 w-16 text-red-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Unsubscribe Failed</h2>
            <p className="text-gray-600 dark:text-gray-400">{message}</p>
            <Link href="/" className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Home
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

const UnsubscribePage: React.FC = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <UnsubscribeContent />
    </Suspense>
  );
};

export default UnsubscribePage;