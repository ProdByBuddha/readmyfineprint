
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

  // Fallback method to load Stripe.js directly via script tag
  const loadStripeDirectly = (publicKey: string): Promise<Stripe | null> => {
    return new Promise((resolve, reject) => {
      // Check if Stripe is already loaded
      if ((window as any).Stripe) {
        console.log("✅ Stripe already available on window");
        resolve((window as any).Stripe(publicKey));
        return;
      }

      // Create script element
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.async = true;

      script.onload = () => {
        console.log("✅ Stripe.js script loaded directly");
        if ((window as any).Stripe) {
          const stripe = (window as any).Stripe(publicKey);
          resolve(stripe);
        } else {
          reject(new Error("Stripe object not found after script load"));
        }
      };

      script.onerror = (error) => {
        console.error("❌ Direct script loading failed:", error);
        reject(new Error("Failed to load Stripe.js script"));
      };

      document.head.appendChild(script);
    });
  };

  const initializeStripe = async (attempt: number = 1) => {
    try {
      setLoading(true);
      setError(null);

      const stripePublicKey = process.env.VITE_STRIPE_PUBLIC_KEY;

      console.log(`🔄 Loading Stripe.js (attempt ${attempt})`);
      console.log(`🔑 Stripe public key: ${stripePublicKey ? stripePublicKey.slice(0, 10) + '...' : 'NOT SET'}`);
      console.log(`🌍 Current URL: ${window.location.href}`);
      console.log(`🌍 User agent: ${navigator.userAgent}`);

      if (!stripePublicKey) {
        console.error("❌ VITE_STRIPE_PUBLIC_KEY not found in environment variables");
        console.log("Available env vars:", Object.keys(process.env));
        throw new Error("Stripe public key not configured - check VITE_STRIPE_PUBLIC_KEY environment variable");
      }

      if (!stripePublicKey.startsWith("pk_")) {
        console.error(`❌ Invalid key format: ${stripePublicKey}`);
        throw new Error(`Invalid Stripe public key format: expected pk_* but got ${stripePublicKey.slice(0, 10)}...`);
      }

      // Check network connectivity to Stripe
      console.log("🌐 Testing network connectivity to Stripe...");
      try {
        const response = await fetch('https://js.stripe.com/v3/', { method: 'HEAD' });
        console.log(`📡 Stripe connectivity test: ${response.status} ${response.statusText}`);
      } catch (networkErr) {
        console.warn("⚠️ Network connectivity test failed:", networkErr);
      }

      console.log("🌍 Environment check:", {
        userAgent: navigator.userAgent,
        isClient: typeof window !== 'undefined',
        hasDocument: typeof document !== 'undefined',
        location: window.location.href
      });

      let stripeInstance: Stripe | null = null;

      // Try the npm package method first
      try {
        console.log("📦 Method 1: Trying @stripe/stripe-js loadStripe()...");
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("loadStripe timeout")), 10000)
        );
        
        const stripePromise = loadStripe(stripePublicKey);
        stripeInstance = await Promise.race([stripePromise, timeoutPromise]);
        console.log("📦 loadStripe result:", stripeInstance);
        
        if (stripeInstance) {
          console.log("✅ Method 1 success: loadStripe worked");
        }
      } catch (loadStripeError) {
        console.warn("⚠️ Method 1 failed:", loadStripeError);
        stripeInstance = null;
      }

      // If npm package failed, try direct script loading
      if (!stripeInstance) {
        console.log("📦 Method 2: Trying direct script loading...");
        try {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Direct script timeout")), 10000)
          );
          
          stripeInstance = await Promise.race([
            loadStripeDirectly(stripePublicKey),
            timeoutPromise
          ]);
          
          if (stripeInstance) {
            console.log("✅ Method 2 success: Direct script loading worked");
          }
        } catch (directError) {
          console.error("❌ Method 2 failed:", directError);
        }
      }

      if (!stripeInstance) {
        throw new Error("Both loading methods failed - Stripe.js could not be initialized");
      }

      console.log("✅ Stripe.js loaded successfully using fallback method");
      setStripe(stripeInstance);
      setRetryCount(0);
    } catch (err: unknown) {
      console.error(`❌ Stripe loading attempt ${attempt} failed:`, err);
      
      // Enhanced error details
      if (err instanceof Error) {
        console.error("Error details:", {
          name: err.name,
          message: err.message,
          stack: err.stack?.slice(0, 200)
        });
      }
      
      const errorMessage = err instanceof Error ? err.message : "Failed to load payment processor";
      
      // If this is a network/loading error and we haven't exceeded max retries
      if (attempt < 3 && (
        errorMessage.includes("timeout") || 
        errorMessage.includes("Failed to load") ||
        errorMessage.includes("Network error") ||
        errorMessage.includes("Script error") ||
        errorMessage.includes("CSP") ||
        errorMessage.includes("Content Security Policy") ||
        errorMessage.includes("Both loading methods failed")
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
    initializeStripe(1);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading secure payment processor...</span>
          </div>
          {retryCount > 0 && (
            <div className="text-center mt-2 text-sm text-muted-foreground">
              Retry attempt {retryCount}/3...
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
            <AlertDescription>
              <div className="font-medium mb-1">Payment System Error</div>
              <div className="text-sm mb-3">{error}</div>
              <Button 
                onClick={handleRetry}
                variant="outline"
                size="sm"
                className="flex items-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry</span>
              </Button>
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
