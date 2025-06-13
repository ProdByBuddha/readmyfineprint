import React, { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

export function StripeDebug() {
  const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [stripeLoaded, setStripeLoaded] = useState<boolean | null>(null);

  useEffect(() => {
    const testStripeLoad = async () => {
      if (!stripePublicKey) {
        setStripeError('No public key found');
        return;
      }

      try {
        console.log('🔄 Attempting to load Stripe.js with key:', stripePublicKey.substring(0, 20) + '...');
        const stripe = await loadStripe(stripePublicKey);
        if (stripe) {
          setStripeLoaded(true);
          console.log('✅ Stripe.js loaded successfully');
        } else {
          setStripeLoaded(false);
          setStripeError('loadStripe returned null');
        }
      } catch (error) {
        console.error('❌ Stripe.js loading failed:', error);
        setStripeLoaded(false);
        setStripeError(error instanceof Error ? error.message : 'Unknown error');
      }
    };

    testStripeLoad();
  }, [stripePublicKey]);

  return (
    <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
      <h3 className="font-bold mb-2">🔍 Stripe Debug Info</h3>
      <div className="space-y-1 text-sm">
        <div>
          <strong>VITE_STRIPE_PUBLIC_KEY:</strong> {
            stripePublicKey
              ? `${stripePublicKey.substring(0, 20)}...`
              : '❌ NOT SET'
          }
        </div>
        <div>
          <strong>Key Format Valid:</strong> {
            stripePublicKey?.startsWith('pk_')
              ? '✅ Valid format'
              : '❌ Should start with pk_'
          }
        </div>
        <div>
          <strong>Key Type:</strong> {
            stripePublicKey?.includes('test')
              ? '🧪 Test Key'
              : stripePublicKey?.includes('live')
                ? '🔴 Live Key'
                : '❓ Unknown'
          }
        </div>
        <div>
          <strong>Stripe.js Load Status:</strong> {
            stripeLoaded === null
              ? '⏳ Testing...'
              : stripeLoaded
                ? '✅ Success'
                : '❌ Failed'
          }
        </div>
        {stripeError && (
          <div className="text-red-600">
            <strong>Error:</strong> {stripeError}
          </div>
        )}
        <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900 rounded text-xs">
          <strong>Instructions:</strong>
          <br />1. Check browser console for detailed errors
          <br />2. Look for network errors to js.stripe.com
          <br />3. Check if domain is verified in Stripe Dashboard
        </div>
      </div>
    </div>
  );
}
