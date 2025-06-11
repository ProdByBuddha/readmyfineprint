import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lock, AlertTriangle, RefreshCw } from "lucide-react";

// Enhanced Stripe loading with comprehensive error handling
let stripePromise: Promise<any> | null = null;
let loadAttempts = 0;
const MAX_LOAD_ATTEMPTS = 3;

const getStripe = () => {
  if (!stripePromise) {
    const publicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
    if (!publicKey) {
      console.error('VITE_STRIPE_PUBLIC_KEY is not configured');
      return Promise.reject(new Error('Stripe public key not configured'));
    }
    
    console.log('Attempting to load Stripe.js...', { attempt: loadAttempts + 1, publicKey: publicKey.substring(0, 8) + '...' });
    
    stripePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Stripe.js loading timed out'));
      }, 10000); // 10 second timeout

      loadStripe(publicKey)
        .then((stripe) => {
          clearTimeout(timeout);
          console.log('Stripe.js loaded successfully:', !!stripe);
          if (!stripe) {
            throw new Error('Stripe.js loaded but returned null');
          }
          resolve(stripe);
        })
        .catch((error) => {
          clearTimeout(timeout);
          console.error('Failed to load Stripe.js:', {
            error: error.message,
            attempt: loadAttempts + 1,
            userAgent: navigator.userAgent,
            location: window.location.href,
          });
          
          stripePromise = null; // Reset so we can retry
          loadAttempts++;
          
          // Provide more specific error messages
          let errorMessage = 'Failed to load payment system';
          if (error.message.includes('network') || error.message.includes('fetch')) {
            errorMessage = 'Network connection issue - please check your internet connection';
          } else if (error.message.includes('blocked') || error.message.includes('Content Security Policy')) {
            errorMessage = 'Payment system blocked by security settings';
          } else if (error.message.includes('timeout')) {
            errorMessage = 'Payment system loading timed out';
          }
          
          reject(new Error(errorMessage));
        });
    });
  }
  return stripePromise;
};

interface CheckoutFormProps {
  amount: number;
  onSuccess: (amount: number) => void;
  onError: (error: string) => void;
}

const CheckoutForm = ({ amount, onSuccess, onError }: CheckoutFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      onError("Stripe has not loaded properly. Please refresh and try again.");
      return;
    }

    if (amount < 1) {
      onError("Please enter a valid donation amount (minimum $1).");
      return;
    }

    setIsProcessing(true);

    try {
      // Create payment intent on the server
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment intent');
      }

      const { clientSecret } = data;

      // Confirm payment with Stripe
      const { error } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
        }
      });

      if (error) {
        onError(error.message || 'Payment failed. Please try again.');
      } else {
        onSuccess(amount);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  // Enhanced card element options with dark mode support
  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: document.documentElement.classList.contains('dark') ? '#ffffff' : '#424770',
        backgroundColor: 'transparent',
        fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
        fontSmoothing: 'antialiased',
        '::placeholder': {
          color: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#aab7c4',
        },
      },
      invalid: {
        color: '#fa755a',
        iconColor: '#fa755a'
      },
      complete: {
        color: document.documentElement.classList.contains('dark') ? '#10b981' : '#059669',
      },
    },
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
          Card Information
        </label>
        <div className="p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all">
          <CardElement options={cardElementOptions} />
        </div>
      </div>

      <Button
        type="submit"
        disabled={!stripe || isProcessing || amount < 1}
        className="w-full"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing Payment...
          </>
        ) : (
          <>
            <Lock className="w-4 h-4 mr-2" />
            Donate ${amount.toFixed(2)}
          </>
        )}
      </Button>

      <div className="text-center space-y-1">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Your payment information is secured by Stripe and never stored on our servers.
        </p>
        <div className="flex items-center justify-center gap-1 text-xs text-gray-400">
          <Lock className="w-3 h-3" />
          <span>256-bit SSL encryption</span>
        </div>
      </div>
    </form>
  );
};

// Stripe Provider with loading and error states
const StripeProvider = ({ children, onError }: { children: React.ReactNode; onError: (error: string) => void }) => {
  const [stripe, setStripe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const initStripe = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Initializing Stripe.js...');
      
      const stripeInstance = await getStripe();
      setStripe(stripeInstance);
      setError(null);
      loadAttempts = 0; // Reset global counter on success
      console.log('Stripe initialization successful');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load payment system';
      console.error('StripeProvider initialization failed:', {
        error: errorMessage,
        attempt: retryCount + 1,
        userAgent: navigator.userAgent,
        onlineStatus: navigator.onLine,
        currentUrl: window.location.href
      });
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initStripe();
  }, [onError, retryCount]);

  const handleRetry = () => {
    if (retryCount < MAX_LOAD_ATTEMPTS) {
      setRetryCount(prev => prev + 1);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">Loading payment system...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="text-left">
                <p className="mb-2">Unable to load payment system: {error}</p>
                <p className="text-sm mb-2">This may be due to:</p>
                <ul className="text-sm list-disc list-inside mb-2">
                  <li>Network connectivity issues</li>
                  <li>Ad blockers or privacy extensions blocking Stripe</li>
                  <li>Firewall or corporate network restrictions</li>
                  <li>Browser security settings</li>
                </ul>
                <p className="text-sm font-medium">Attempts: {retryCount + 1} of {MAX_LOAD_ATTEMPTS}</p>
              </div>
            </AlertDescription>
          </Alert>
          <div className="flex gap-2 justify-center">
            {retryCount < MAX_LOAD_ATTEMPTS && (
              <Button 
                onClick={handleRetry} 
                variant="outline"
                disabled={loading}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry ({MAX_LOAD_ATTEMPTS - retryCount} left)
              </Button>
            )}
            <Button 
              onClick={() => window.location.reload()} 
              variant="default"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Page
            </Button>
          </div>
          <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            <p>If the issue persists, try disabling browser extensions or contact support.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Elements stripe={stripe}>
      {children}
    </Elements>
  );
};

interface StripeCheckoutProps {
  amount: number;
  onSuccess: (amount: number) => void;
  onError: (error: string) => void;
}

export default function StripeCheckout({ amount, onSuccess, onError }: StripeCheckoutProps) {
  if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Stripe is not configured. Please contact the administrator.
              <br />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Missing VITE_STRIPE_PUBLIC_KEY environment variable.
              </span>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="w-5 h-5" />
          Complete Your Donation
        </CardTitle>
      </CardHeader>
      <CardContent>
        <StripeProvider onError={onError}>
          <CheckoutForm
            amount={amount}
            onSuccess={onSuccess}
            onError={onError}
          />
        </StripeProvider>
      </CardContent>
    </Card>
  );
}
