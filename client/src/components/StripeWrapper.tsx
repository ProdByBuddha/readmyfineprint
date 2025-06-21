
import { useState, useEffect, ReactNode } from "react";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StripeWrapperProps {
  children: ReactNode;
}

export function StripeWrapper({ children }: StripeWrapperProps) {
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const initializeStripe = async (attempt: number = 1) => {
    try {
      setLoading(true);
      setError(null);

      const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;

      if (!stripePublicKey) {
        throw new Error("Stripe public key not configured");
      }

      if (!stripePublicKey.startsWith("pk_")) {
        throw new Error("Invalid Stripe public key format");
      }

      console.log(`🔄 Loading Stripe.js (attempt ${attempt})`);

      // Use a longer timeout for network environments like Replit
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Network timeout - Stripe.js failed to load")), 15000)
      );

      // Load Stripe.js with proper error handling
      const stripePromise = loadStripe(stripePublicKey);

      const stripeInstance = await Promise.race([stripePromise, timeoutPromise]);

      if (!stripeInstance) {
        throw new Error("Stripe.js loaded but returned null");
      }

      console.log("✅ Stripe.js loaded successfully");
      setStripe(stripeInstance);
      setRetryCount(0);
    } catch (err: unknown) {
      console.error(`❌ Stripe loading attempt ${attempt} failed:`, err);
      
      const errorMessage = err instanceof Error ? err.message : "Failed to load payment processor";
      
      // If this is a network/loading error and we haven't exceeded max retries
      if (attempt < 3 && (
        errorMessage.includes("timeout") || 
        errorMessage.includes("Failed to load") ||
        errorMessage.includes("Network error") ||
        errorMessage.includes("Script error")
      )) {
        console.log(`⏳ Retrying Stripe.js load in ${attempt * 2} seconds...`);
        setTimeout(() => {
          setRetryCount(attempt);
          initializeStripe(attempt + 1);
        }, attempt * 2000);
        return;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initializeStripe();
  }, []);

  const handleRetry = () => {
    initializeStripe();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>
              Loading secure payment processor
              {retryCount > 0 && ` (retry ${retryCount}/3)`}...
            </span>
          </div>
          {retryCount > 0 && (
            <div className="text-center mt-2 text-sm text-muted-foreground">
              Network connectivity may be limited. Retrying...
            </div>
          )}
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
            <AlertDescription className="mb-4">
              <div className="font-medium mb-2">Payment processor failed to load</div>
              <div className="text-sm">{error}</div>
              
              {error.includes("timeout") || error.includes("Network") ? (
                <div className="mt-2 text-sm">
                  This may be due to network restrictions in the development environment.
                  The payment system will work properly in production.
                </div>
              ) : null}
            </AlertDescription>
          </Alert>
          
          <div className="flex justify-center mt-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRetry}
              className="flex items-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Retry Loading</span>
            </Button>
          </div>
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
              Payment processor initialization failed. Please try refreshing the page.
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
