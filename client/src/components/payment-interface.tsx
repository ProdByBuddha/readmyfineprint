import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lock, CreditCard, AlertTriangle, RefreshCw } from "lucide-react";
import StripeCheckout from "@/components/stripe-checkout";
import PaymentForm from "@/components/payment-form";

interface PaymentInterfaceProps {
  amount: number;
  onSuccess: (amount: number) => void;
  onError: (error: string) => void;
}

export default function PaymentInterface({ amount, onSuccess, onError }: PaymentInterfaceProps) {
  const [useBackupForm, setUseBackupForm] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);

  const handleStripeError = (error: string) => {
    console.log('Stripe.js failed to load, switching to backup payment form');
    setStripeError(error);
    setUseBackupForm(true);
  };

  const handleTryStripeAgain = () => {
    setUseBackupForm(false);
    setStripeError(null);
  };

  const handleBackupFormSubmit = async (cardData: any) => {
    try {
      const response = await fetch('/api/process-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          amount,
          paymentMethod: 'manual',
          cardData 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Payment failed');
      }

      onSuccess(amount);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Payment processing failed');
    }
  };

  if (useBackupForm) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Payment system had connection issues. Using secure backup processing.
            <Button 
              variant="link" 
              className="p-0 h-auto ml-2"
              onClick={handleTryStripeAgain}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Secure Payment Processing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <CreditCard className="h-4 w-4" />
              <AlertDescription>
                <div className="text-sm">
                  <p className="font-medium mb-1">Test Card Numbers:</p>
                  <p>• Success: 4242 4242 4242 4242</p>
                  <p>• Declined: 4000 0000 0000 0002</p>
                  <p>Use any future date and any 3-digit CVC</p>
                </div>
              </AlertDescription>
            </Alert>
            
            <div className="text-center p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
              <CreditCard className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Secure payment processing temporarily unavailable
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Please contact support or try again later
              </p>
              <Button 
                variant="outline" 
                className="mt-3"
                onClick={handleTryStripeAgain}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry Payment System
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <StripeCheckout
      amount={amount}
      onSuccess={onSuccess}
      onError={handleStripeError}
    />
  );
}