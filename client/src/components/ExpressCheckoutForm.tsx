import { useState, useEffect } from "react";
import {
  Elements,
  ExpressCheckoutElement,
  useStripe,
  useElements
} from "@stripe/react-stripe-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Heart, Loader2, Lock, AlertCircle } from "lucide-react";
import { loadStripe, Stripe } from "@stripe/stripe-js";

// Get Stripe public key from environment variables
const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;

// Fallback method to load Stripe.js directly via script tag
const loadStripeWithFallback = async (publicKey: string): Promise<Stripe | null> => {
  // Try the npm package method first
  try {
    console.log("📦 ExpressCheckoutForm: Trying @stripe/stripe-js loadStripe()...");
    const stripeInstance = await loadStripe(publicKey);
    if (stripeInstance) {
      console.log("✅ ExpressCheckoutForm: loadStripe worked");
      return stripeInstance;
    }
  } catch (error) {
    console.warn("⚠️ ExpressCheckoutForm: loadStripe failed:", error);
  }

  // Fallback to direct script loading
  return new Promise((resolve, reject) => {
    console.log("📦 ExpressCheckoutForm: Trying direct script loading...");

    // Check if Stripe is already loaded
    if ((window as any).Stripe) {
      console.log("✅ ExpressCheckoutForm: Stripe already available");
      resolve((window as any).Stripe(publicKey));
      return;
    }

    // Create script element
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    script.crossOrigin = 'anonymous';
    // Note: Stripe.js doesn't provide SRI hashes as it's a dynamic service that updates frequently
    // This is acceptable as Stripe is a trusted payment processor and the script loads over HTTPS

    script.onload = () => {
      console.log("✅ ExpressCheckoutForm: Direct script loading worked");
      if ((window as any).Stripe) {
        resolve((window as any).Stripe(publicKey));
      } else {
        reject(new Error("Stripe object not found after script load"));
      }
    };

    script.onerror = (error) => {
      console.error("❌ ExpressCheckoutForm: Direct script loading failed:", error);
      reject(new Error("Failed to load Stripe.js script"));
    };

    document.head.appendChild(script);
  });
};

const stripePromise = stripePublicKey ? loadStripeWithFallback(stripePublicKey) : null;

// Stripe-specific interfaces
interface PaymentIntent {
  clientSecret: string;
  paymentIntentId: string;
}

interface ExpressCheckoutFormProps {
  amount: number;
  onSuccess: (amount: number) => void;
  onError: (error: string) => void;
}

function ExpressCheckoutFormElement({ amount, onSuccess, onError }: ExpressCheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent | null>(null);

  // Create payment intent when component mounts
  useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        const response = await fetch("/api/create-payment-intent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ amount }),
        });

        if (!response.ok) {
          throw new Error("Failed to create payment intent");
        }

        const { clientSecret, paymentIntentId } = await response.json();
        setPaymentIntent({ clientSecret, paymentIntentId });
      } catch (error: unknown) {
        console.error("Payment intent creation failed:", error);
        onError("Failed to initialize payment. Please try again.");
      }
    };

    createPaymentIntent();
  }, [amount, onError]);

  const onConfirm = async () => {
    if (!stripe || !elements || !paymentIntent) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/donate?success=true`,
        },
        redirect: "if_required",
      });

      if (error) {
        console.error("Payment confirmation failed:", error);
        onError(error.message || "Payment failed. Please try again.");
      } else {
        onSuccess(amount);
      }
    } catch (error: unknown) {
      console.error("Payment error:", error);
      onError("Payment processing failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const onClick = () => {
    // Handle click events if needed
    console.log("Express checkout clicked");
  };

  const onCancel = () => {
    setIsProcessing(false);
  };

  if (!paymentIntent) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading payment options...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Heart className="h-5 w-5 text-red-500" />
          <span>Quick Donation - ${amount.toFixed(2)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ExpressCheckoutElement
          onConfirm={onConfirm}
          onClick={onClick}
          onCancel={onCancel}
          options={{
            buttonTheme: {
              applePay: "black",
              googlePay: "black",
              paypal: "gold",
            },
            layout: {
              maxColumns: 1,
              maxRows: 4,
              overflow: "auto",
            },
            buttonHeight: 48,
            buttonType: {
              applePay: "donate",
              googlePay: "donate",
              paypal: "pay",

            },
            paymentMethods: {
              applePay: "auto",
              googlePay: "auto",
              link: "auto",
              paypal: "auto",
            },
          }}
        />

        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            Secure one-click payment with Apple Pay, Google Pay, Link, or PayPal.
            Your payment information is processed securely through Stripe.
          </AlertDescription>
        </Alert>

        {isProcessing && (
          <div className="flex items-center justify-center space-x-2 py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Processing payment...</span>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Powered by Stripe • Secure Payment Processing
        </p>
      </CardContent>
    </Card>
  );
}

function ExpressCheckoutWrapper({ amount, onSuccess, onError }: ExpressCheckoutFormProps) {
  const [stripeLoaded, setStripeLoaded] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [stripe, setStripe] = useState<Stripe | null>(null);

  useEffect(() => {
    if (!stripePublicKey) {
      setStripeError("Stripe configuration is missing");
      return;
    }

    const initializeStripe = async () => {
      try {
        if (stripePromise) {
          const stripeInstance = await stripePromise;
          if (stripeInstance) {
            setStripe(stripeInstance);
            setStripeLoaded(true);
          } else {
            setStripeError("Failed to load Stripe");
          }
        } else {
          setStripeError("Stripe not initialized");
        }
      } catch (error) {
        console.error("Stripe initialization error:", error);
        setStripeError("Failed to initialize payment processor");
      }
    };

    initializeStripe();
  }, []);

  if (stripeError) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {stripeError}. Please refresh the page and try again.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!stripeLoaded || !stripe) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading secure payment processor...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Elements
      stripe={stripe}
      options={{
        mode: "payment",
        amount: Math.round(amount * 100),
        currency: "usd",
      }}
    >
      <ExpressCheckoutFormElement
        amount={amount}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  );
}

export default function ExpressCheckoutForm({ amount, onSuccess, onError }: ExpressCheckoutFormProps) {
  return <ExpressCheckoutWrapper amount={amount} onSuccess={onSuccess} onError={onError} />;
}