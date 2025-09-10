import { useState } from "react";
import {
  CardElement,
  useStripe,
  useElements
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart, Loader2, Lock, CreditCard } from "lucide-react";
import { StripeWrapper } from "./StripeWrapper";

interface PaymentFormProps {
  amount: number;
  onSuccess: (amount: number) => void;
  onError: (error: string) => void;
}

function PaymentForm({ amount, onSuccess, onError }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      onError("Payment processor not ready. Please try again.");
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      onError("Card information not found. Please refresh and try again.");
      return;
    }

    setIsProcessing(true);

    try {
      // Create payment intent on the server
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

      const { clientSecret } = await response.json();

      // Confirm payment with Stripe
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: donorName || "Anonymous Donor",
            email: donorEmail || undefined,
          },
        },
      });

      if (error) {
        console.error("Payment failed:", error);
        onError(error.message || "Payment failed. Please try again.");
      } else if (paymentIntent && paymentIntent.status === "succeeded") {
        onSuccess(amount);
      } else {
        onError("Payment was not completed. Please try again.");
      }
    } catch (error: unknown) {
      console.error("Payment error:", error);
      onError("Payment processing failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: "16px",
        color: "#424770",
        "::placeholder": {
          color: "#aab7c4",
        },
      },
      invalid: {
        color: "#9e2146",
      },
    },
    hidePostalCode: false,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Heart className="h-5 w-5 text-red-500" />
          <span>Secure Donation - ${amount.toFixed(2)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="donor-name">Name (Optional)</Label>
            <Input
              id="donor-name"
              type="text"
              placeholder="Your name"
              value={donorName}
              onChange={(e) => setDonorName(e.target.value)}
              disabled={isProcessing}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="donor-email">Email (Optional)</Label>
            <Input
              id="donor-email"
              type="email"
              placeholder="your.email@example.com"
              value={donorEmail}
              onChange={(e) => setDonorEmail(e.target.value)}
              disabled={isProcessing}
            />
          </div>

          <div className="space-y-2">
            <Label>Payment Information</Label>
            <div className="p-3 border rounded-md bg-background">
              <CardElement options={cardElementOptions} />
            </div>
          </div>

          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              Your payment information is processed securely through Stripe.
              We never store your card details.
            </AlertDescription>
          </Alert>

          <Button
            type="submit"
            disabled={!stripe || isProcessing}
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Donate ${amount.toFixed(2)}
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center mt-2">
            Powered by Stripe • Secure Payment Processing
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

interface StripePaymentFormProps {
  amount: number;
  onSuccess: (amount: number) => void;
  onError: (error: string) => void;
}

export default function StripePaymentForm({ amount, onSuccess, onError }: StripePaymentFormProps) {
  return (
    <StripeWrapper>
      <PaymentForm amount={amount} onSuccess={onSuccess} onError={onError} />
    </StripeWrapper>
  );
}
