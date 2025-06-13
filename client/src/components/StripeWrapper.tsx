import { useState, useEffect, ReactNode } from "react";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";

interface StripeWrapperProps {
  children: ReactNode;
}

export function StripeWrapper({ children }: StripeWrapperProps) {
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeStripe = async () => {
      try {
        const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;

        if (!stripePublicKey) {
          throw new Error("Stripe public key not configured");
        }

        if (!stripePublicKey.startsWith("pk_")) {
          throw new Error("Invalid Stripe public key format");
        }

        // Add retry logic and timeout for Replit environment
        const loadWithRetry = async (retries = 3) => {
          for (let i = 0; i < retries; i++) {
            try {
              // Use a longer timeout for Replit
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Stripe loading timeout")), 10000)
              );

                      // Load Stripe.js according to official docs: https://docs.stripe.com/js
        const stripePromise = loadStripe(stripePublicKey);

              const stripeInstance = await Promise.race([stripePromise, timeoutPromise]) as Stripe;

              if (!stripeInstance) {
                throw new Error(`Failed to initialize Stripe (attempt ${i + 1})`);
              }

              return stripeInstance;
            } catch (error) {
              console.warn(`Stripe loading attempt ${i + 1} failed:`, error);
              if (i === retries - 1) throw error;
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        };

        const stripeInstance = await loadWithRetry();
        if (stripeInstance) {
          setStripe(stripeInstance);
        } else {
          throw new Error("Stripe failed to initialize");
        }
      } catch (err: unknown) {
        console.error("Stripe initialization error:", err);
        setError(err instanceof Error ? err.message : "Failed to load payment processor");
      } finally {
        setLoading(false);
      }
    };

    initializeStripe();
  }, []);

  if (loading) {
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

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}. Please refresh the page and try again, or contact support if the problem persists.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!stripe) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Payment processor failed to load. Please refresh the page and try again.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Elements stripe={stripe}>
      {children}
    </Elements>
  );
}
