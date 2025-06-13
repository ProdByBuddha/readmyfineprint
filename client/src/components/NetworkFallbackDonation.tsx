import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Heart, ExternalLink, Shield } from "lucide-react";

interface NetworkFallbackDonationProps {
  amount: number;
  onSuccess?: (amount: number) => void;
}

export function NetworkFallbackDonation({ amount }: NetworkFallbackDonationProps) {
  const handleStripeCheckout = () => {
    // Redirect to Stripe's hosted checkout
    const stripeUrl = `https://donate.stripe.com/4gM6oI5ZLfCV7Qu8ww?prefilled_amount=${Math.round(amount * 100)}`;
    window.open(stripeUrl, '_blank', 'noopener,noreferrer');
  };

  const handleServerDonation = async () => {
    try {
      // Try server-side payment processing
      window.location.href = `/api/create-checkout-session?amount=${amount}`;
    } catch (error) {
      console.error('Server donation failed:', error);
      // Fallback to Stripe checkout
      handleStripeCheckout();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-red-500" />
          Secure Donation - ${amount.toFixed(2)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <div className="text-sm">
              <p className="font-medium mb-1">Network Restriction Detected</p>
              <p>Unable to load payment forms locally. Using secure external checkout.</p>
            </div>
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <Button
            onClick={handleStripeCheckout}
            className="w-full"
            size="lg"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Donate ${amount.toFixed(2)} via Stripe Checkout
          </Button>

          <Button
            onClick={handleServerDonation}
            variant="outline"
            className="w-full"
            size="lg"
          >
            <Heart className="w-4 h-4 mr-2" />
            Alternative Payment Method
          </Button>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-xs text-gray-400">
            <Shield className="w-3 h-3" />
            <span>Secure SSL encryption • PCI DSS compliant</span>
          </div>
        </div>

        <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <AlertDescription>
            <div className="text-sm text-green-800 dark:text-green-200">
              <strong>How it works:</strong>
              <br />• Click "Donate via Stripe Checkout" above
              <br />• You'll be redirected to Stripe's secure payment page
              <br />• Complete your donation safely on Stripe's servers
              <br />• Return here after successful payment
            </div>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
