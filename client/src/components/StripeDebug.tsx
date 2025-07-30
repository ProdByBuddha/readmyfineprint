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

      console.log('🔄 StripeDebug: Attempting to load Stripe.js with key:', stripePublicKey.substring(0, 20) + '...');

      let stripe: any = null;

      // Try the npm package method first
      try {
        console.log("📦 StripeDebug: Trying @stripe/stripe-js loadStripe()...");
        stripe = await loadStripe(stripePublicKey);
        if (stripe) {
          console.log('✅ StripeDebug: loadStripe worked');
          setStripeLoaded(true);
          return;
        }
      } catch (error) {
        console.warn("⚠️ StripeDebug: loadStripe failed:", error);
      }

      // Fallback to direct script loading
      try {
        console.log("📦 StripeDebug: Trying direct script loading...");
        
        stripe = await new Promise((resolve, reject) => {
          // Check if Stripe is already loaded
          if ((window as any).Stripe) {
            console.log("✅ StripeDebug: Stripe already available");
            resolve((window as any).Stripe(stripePublicKey));
            return;
          }

          // Create script element
          const script = document.createElement('script');
          script.src = 'https://js.stripe.com/v3/';
          script.async = true;

          script.onload = () => {
            console.log("✅ StripeDebug: Direct script loading worked");
            if ((window as any).Stripe) {
              resolve((window as any).Stripe(stripePublicKey));
            } else {
              reject(new Error("Stripe object not found after script load"));
            }
          };

          script.onerror = (error) => {
            console.error("❌ StripeDebug: Direct script loading failed:", error);
            reject(new Error("Failed to load Stripe.js script"));
          };

          document.head.appendChild(script);
        });

        if (stripe) {
          console.log('✅ StripeDebug: Direct script loading successful');
          setStripeLoaded(true);
          return;
        }
      } catch (fallbackError) {
        console.error('❌ StripeDebug: Both methods failed:', fallbackError);
        setStripeError(fallbackError instanceof Error ? fallbackError.message : 'Both loading methods failed');
      }

      // If we get here, both methods failed
      setStripeLoaded(false);
      if (!stripe) {
        setStripeError('Both npm package and direct script loading failed');
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
