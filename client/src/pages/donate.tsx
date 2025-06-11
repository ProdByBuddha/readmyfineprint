import { useState, useEffect } from "react";
import { Heart, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const DONATION_AMOUNTS = [
  { amount: 5, label: "$5" },
  { amount: 10, label: "$10" },
  { amount: 25, label: "$25" },
  { amount: 50, label: "$50" },
  { amount: 100, label: "$100" },
];

// Load Stripe script dynamically
const loadStripeScript = () => {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src="https://js.stripe.com/v3/buy-button.js"]')) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/buy-button.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Failed to load Stripe script'));
    document.head.appendChild(script);
  });
};

const DonateContent = () => {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [stripeLoaded, setStripeLoaded] = useState(false);
  const [loadingStripe, setLoadingStripe] = useState(true);
  const { toast } = useToast();

  // Check for success in URL
  const urlParams = new URLSearchParams(window.location.search);
  const isSuccess = urlParams.get('success') === 'true';
  const successAmount = urlParams.get('amount');

  useEffect(() => {
    loadStripeScript()
      .then(() => {
        setStripeLoaded(true);
        setLoadingStripe(false);
      })
      .catch((error) => {
        console.error('Failed to load Stripe:', error);
        setLoadingStripe(false);
        toast({
          title: "Payment System Unavailable",
          description: "Please try again later or contact support.",
          variant: "destructive",
        });
      });
  }, [toast]);

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount("");
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    setSelectedAmount(null);
  };

  const currentAmount = selectedAmount || parseFloat(customAmount) || 0;

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-green-600 dark:text-green-400" fill="currentColor" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Thank You!
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Your donation of ${successAmount} has been processed successfully. 
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
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
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full mb-4">
            <Heart className="w-8 h-8 text-red-600 dark:text-red-400" fill="currentColor" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Support Our Mission
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Help us make legal documents accessible to everyone. Your donation keeps our 
            AI-powered analysis free and available to those who need it most.
          </p>
        </div>

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
                  <h4 className="font-semibold mb-1">Improve Our AI</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Funding helps us train better models and support more document types.
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

          <Card>
            <CardHeader>
              <CardTitle>Choose Your Amount</CardTitle>
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

              {loadingStripe ? (
                <Button disabled className="w-full">
                  Loading Payment System...
                </Button>
              ) : stripeLoaded ? (
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    Secure payments powered by Stripe
                  </p>
                  <div 
                    dangerouslySetInnerHTML={{
                      __html: `
                        <stripe-buy-button
                          buy-button-id="buy_btn_1RY6rDPxX1dXZoQGmXsNpzwU"
                          publishable-key="${import.meta.env.VITE_STRIPE_PUBLIC_KEY}"
                        >
                        </stripe-buy-button>
                      `
                    }}
                  />
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-red-600 dark:text-red-400 mb-4">
                    Payment system is currently unavailable. Please try again later.
                  </p>
                  <Button 
                    onClick={() => window.location.reload()} 
                    variant="outline"
                  >
                    Retry
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
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