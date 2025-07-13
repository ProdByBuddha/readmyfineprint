import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Mail, ArrowLeft } from 'lucide-react';

const UnsubscribePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already_unsubscribed'>('loading');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setStatus('error');
      setMessage('Invalid unsubscribe link. No token provided.');
      return;
    }

    // Call the unsubscribe API
    fetch(`/api/mailing-list/unsubscribe?token=${token}`)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          if (data.alreadyUnsubscribed) {
            setStatus('already_unsubscribed');
            setMessage(data.message);
          } else {
            setStatus('success');
            setMessage(data.message);
          }
        } else {
          setStatus('error');
          setMessage(data.error || 'Failed to unsubscribe');
        }
      })
      .catch(error => {
        console.error('Unsubscribe error:', error);
        setStatus('error');
        setMessage('An error occurred while processing your request.');
      });
  }, [searchParams]);

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />;
      case 'already_unsubscribed':
        return <CheckCircle className="w-16 h-16 text-blue-500 mx-auto" />;
      case 'error':
        return <XCircle className="w-16 h-16 text-red-500 mx-auto" />;
      default:
        return <Mail className="w-16 h-16 text-gray-400 mx-auto animate-pulse" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'text-green-600';
      case 'already_unsubscribed':
        return 'text-blue-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getBackgroundColor = () => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'already_unsubscribed':
        return 'bg-blue-50 border-blue-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className={`${getBackgroundColor()} rounded-lg border-2 p-8 text-center shadow-lg`}>
          {getStatusIcon()}
          
          <h1 className={`text-2xl font-bold ${getStatusColor()} mt-4 mb-2`}>
            {status === 'loading' && 'Processing...'}
            {status === 'success' && 'Unsubscribed Successfully'}
            {status === 'already_unsubscribed' && 'Already Unsubscribed'}
            {status === 'error' && 'Unsubscribe Failed'}
          </h1>
          
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {message}
          </p>
          
          {status === 'success' && (
            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 mb-6 border border-green-200 dark:border-green-700">
              <h3 className="font-semibold text-green-700 dark:text-green-300 mb-2">
                What happens next?
              </h3>
              <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <li>• You'll receive a confirmation email</li>
                <li>• No more notifications about enterprise features</li>
                <li>• You can resubscribe anytime</li>
              </ul>
            </div>
          )}
          
          {status === 'already_unsubscribed' && (
            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 mb-6 border border-blue-200 dark:border-blue-700">
              <h3 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">
                Want to resubscribe?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                You can sign up again anytime by visiting our subscription page and entering your email.
              </p>
            </div>
          )}
          
          {status === 'error' && (
            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 mb-6 border border-red-200 dark:border-red-700">
              <h3 className="font-semibold text-red-700 dark:text-red-300 mb-2">
                Need help?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                If you continue to have issues, please contact us at{' '}
                <a href="mailto:support@readmyfineprint.com" className="text-blue-600 hover:underline">
                  support@readmyfineprint.com
                </a>
              </p>
            </div>
          )}
          
          <div className="space-y-3">
            <a
              href="/subscription?tab=plans"
              className="inline-flex items-center justify-center w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Mail className="w-4 h-4 mr-2" />
              View Subscription Plans
            </a>
            
            <a
              href="/roadmap"
              className="inline-flex items-center justify-center w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              See What We're Building
            </a>
            
            <a
              href="/"
              className="inline-flex items-center justify-center w-full px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </a>
          </div>
        </div>
        
        <div className="text-center mt-6 text-sm text-gray-500 dark:text-gray-400">
          <p>ReadMyFinePrint | Privacy-First AI-Powered Contract Analysis</p>
        </div>
      </div>
    </div>
  );
};

export default UnsubscribePage; 