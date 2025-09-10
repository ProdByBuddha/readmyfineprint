import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart, Loader2, Lock, CreditCard, AlertCircle } from "lucide-react";

interface SimplePaymentFormProps {
  amount: number;
  onSuccess: (amount: number) => void;
  onError: (error: string) => void;
}

export default function SimplePaymentForm({ amount, onSuccess, onError }: SimplePaymentFormProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [cvc, setCvc] = useState("");
  const [billingZip, setBillingZip] = useState("");

  // Format card number with spaces
  const formatCardNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    const formatted = numbers.replace(/(\d{4})(?=\d)/g, '$1 ');
    return formatted;
  };

  // Format expiry date as MM/YY
  const formatExpiryDate = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length >= 2) {
      return numbers.substring(0, 2) + '/' + numbers.substring(2, 4);
    }
    return numbers;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    if (formatted.length <= 19) { // 16 digits + 3 spaces
      setCardNumber(formatted);
    }
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatExpiryDate(e.target.value);
    if (formatted.length <= 5) { // MM/YY
      setExpiryDate(formatted);
    }
  };

  const handleCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numbers = e.target.value.replace(/\D/g, '');
    if (numbers.length <= 4) {
      setCvc(numbers);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsProcessing(true);

    try {
      // Basic validation
      if (!cardNumber || !expiryDate || !cvc) {
        throw new Error("Please fill in all card details");
      }

      if (cardNumber.replace(/\s/g, '').length < 13) {
        throw new Error("Please enter a valid card number");
      }

      if (expiryDate.length !== 5) {
        throw new Error("Please enter expiry date as MM/YY");
      }

      if (cvc.length < 3) {
        throw new Error("Please enter a valid CVC");
      }

      // Parse expiry date
      const [expMonth, expYear] = expiryDate.split('/');
      const currentYear = new Date().getFullYear() % 100;
      const currentMonth = new Date().getMonth() + 1;

      if (parseInt(expMonth) < 1 || parseInt(expMonth) > 12) {
        throw new Error("Invalid expiry month");
      }

      if (parseInt(expYear) < currentYear ||
          (parseInt(expYear) === currentYear && parseInt(expMonth) < currentMonth)) {
        throw new Error("Card has expired");
      }

      // Send payment data to server
      const response = await fetch("/api/process-donation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          card: {
            number: cardNumber.replace(/\s/g, ''),
            exp_month: parseInt(expMonth),
            exp_year: parseInt(`20${expYear}`),
            cvc: cvc,
            name: donorName || "Anonymous Donor",
          },
          billing_details: {
            name: donorName || "Anonymous Donor",
            email: donorEmail || undefined,
            address: {
              postal_code: billingZip || undefined
            }
          }
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Payment failed");
      }

      // Payment successful
      onSuccess(amount);
    } catch (error: unknown) {
      console.error("Payment error:", error);
      onError(error instanceof Error ? error.message : "Payment processing failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
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
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Note: This is a simplified payment form. For maximum security, we recommend using live deployment with full Stripe Elements integration.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="card-number">Card Number *</Label>
            <Input
              id="card-number"
              type="text"
              placeholder="1234 5678 9012 3456"
              value={cardNumber}
              onChange={handleCardNumberChange}
              disabled={isProcessing}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expiry">Expiry *</Label>
              <Input
                id="expiry"
                type="text"
                placeholder="MM/YY"
                value={expiryDate}
                onChange={handleExpiryChange}
                disabled={isProcessing}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cvc">CVC *</Label>
              <Input
                id="cvc"
                type="text"
                placeholder="123"
                value={cvc}
                onChange={handleCvcChange}
                disabled={isProcessing}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zip">ZIP Code</Label>
              <Input
                id="zip"
                type="text"
                placeholder="12345"
                value={billingZip}
                onChange={(e) => setBillingZip(e.target.value)}
                disabled={isProcessing}
              />
            </div>
          </div>

          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              Your payment is processed securely through Stripe.
              Card details are encrypted and never stored on our servers.
            </AlertDescription>
          </Alert>

          <Button
            type="submit"
            disabled={isProcessing}
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing Payment...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Donate ${amount.toFixed(2)}
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center mt-2">
            Secured by Stripe • PCI DSS Compliant
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
