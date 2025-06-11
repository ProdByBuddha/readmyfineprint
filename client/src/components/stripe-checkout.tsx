import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Lock } from "lucide-react";

// Load Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

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
          <p className="text-red-600 dark:text-red-400 mb-2">
            Stripe is not configured. Please contact the administrator.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Missing VITE_STRIPE_PUBLIC_KEY environment variable.
          </p>
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
        <Elements stripe={stripePromise}>
          <CheckoutForm
            amount={amount}
            onSuccess={onSuccess}
            onError={onError}
          />
        </Elements>
      </CardContent>
    </Card>
  );
}
