import { useState } from "react";
import { Heart, ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "wouter";
import ExpressCheckoutForm from "@/components/ExpressCheckoutForm";

const DONATION_AMOUNTS = [
  { amount: 5, label: "$5" },
  { amount: 10, label: "$10" },
  { amount: 25, label: "$25" },
  { amount: 50, label: "$50" },
  { amount: 100, label: "$100" },
];

const DonateContent = () => {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successAmount, setSuccessAmount] = useState<number | null>(null);

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount("");
    setError(null);
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    setSelectedAmount(null);
    setError(null);
  };

  const handleProceedToCheckout = () => {
    const amount = selectedAmount || parseFloat(customAmount) || 0;
    if (amount < 1) {
      setError("Please select or enter a valid donation amount (minimum $1).");
      return;
    }
    setShowCheckout(true);
    setError(null);
  };

  const handlePaymentSuccess = (amount: number) => {
    setIsSuccess(true);
    setSuccessAmount(amount);
    setShowCheckout(false);
    setError(null);
  };

  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage);
    setShowCheckout(false);
  };

  const handleBackToSelection = () => {
    setShowCheckout(false);
    setError(null);
  };

  const currentAmount = selectedAmount || parseFloat(customAmount) || 0;

  if (isSuccess && successAmount) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-secondary/20 dark:bg-secondary/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-secondary dark:text-secondary" fill="currentColor" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Thank You!
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Your donation of ${successAmount.toFixed(2)} has been processed successfully.
              Thank you for supporting our mission to make legal documents more accessible!
            </p>
            <Link to="/">
              <Button className="w-full">
                Return to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-4xl mx-auto pt-8">
        <div className="mb-6">
          <Link to="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>

        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/20 dark:bg-primary/30 rounded-full mb-4">
            <Heart className="w-8 h-8 text-primary dark:text-primary" fill="currentColor" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Support Our Mission
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Help us make legal documents accessible to everyone. Your donation keeps our
            advanced analysis service free and available to those who need it most.
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Why Donate?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                <div>
                  <h4 className="font-semibold mb-1">Keep It Free</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Your donations help us maintain free access to legal document analysis for everyone.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                <div>
                  <h4 className="font-semibold mb-1">Improve Our Service</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Funding helps us enhance our analysis capabilities and support more document types.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                <div>
                  <h4 className="font-semibold mb-1">Expand Access</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Support our mission to democratize legal document understanding.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {showCheckout ? (
            <div className="space-y-4">
              <Button
                variant="outline"
                onClick={handleBackToSelection}
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Amount Selection
              </Button>
              <div className="space-y-4">
                <Button 
                  onClick={() => window.open('https://donate.stripe.com/4gM6oI5ZLfCV7Qu8hHb7y00', '_blank')}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-6 rounded-lg"
                >
                  Donate ${currentAmount.toFixed(2)} Now
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  Secure payment powered by Stripe
                </p>
              </div>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Make a Donation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {DONATION_AMOUNTS.map((option) => (
                    <Button
                      key={option.amount}
                      variant={selectedAmount === option.amount ? "default" : "outline"}
                      onClick={() => handleAmountSelect(option.amount)}
                      className="h-12"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Custom Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      placeholder="Enter amount"
                      value={customAmount}
                      onChange={(e) => handleCustomAmountChange(e.target.value)}
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleProceedToCheckout}
                  disabled={currentAmount < 1}
                  className="w-full"
                  size="lg"
                >
                  {currentAmount >= 1 ? `Donate $${currentAmount.toFixed(2)}` : 'Select Amount to Continue'}
                </Button>

                <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
                  Secure payments powered by Stripe
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Secure & Safe:</strong> All donations are processed securely through Stripe.
              We never store your payment information and all transactions are encrypted.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default function Donate() {
  return <DonateContent />;
}
