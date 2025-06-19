import { useState, useEffect } from "react";
import { Heart, MapPin, AlertCircle, CheckCircle, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { SocialShare } from "@/components/SocialShare";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StripeDebug } from "@/components/StripeDebug";
import { SimpleStripeTest } from "@/components/SimpleStripeTest";

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
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successAmount, setSuccessAmount] = useState<number | null>(null);
    const [showThankYouModal, setShowThankYouModal] = useState(false);
  const [showConsideringModal, setShowConsideringModal] = useState(false);

  // Check for success or canceled parameters on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');
    const amount = urlParams.get('amount');

    if (success === 'true' && amount) {
      const donationAmount = parseFloat(amount);
      if (donationAmount > 0) {
        setSuccessAmount(donationAmount);
        setShowThankYouModal(true);
      }
    } else if (canceled === 'true') {
      setShowConsideringModal(true);
    }

    // Clean URL without refresh
    const newUrl = window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
  }, []);

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

    // Directly trigger server-side checkout (same as Alternative Payment Method)
    try {
      window.location.href = `/api/create-checkout-session?amount=${amount}`;
    } catch (error) {
      console.error('Server donation failed:', error);
      // Fallback to external Stripe checkout
      const stripeUrl = `https://donate.stripe.com/4gM6oI5ZLfCV7Qu8ww?prefilled_amount=${Math.round(amount * 100)}`;
      window.open(stripeUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Payment handlers removed as they're not currently used

  const currentAmount = selectedAmount || parseFloat(customAmount) || 0;

  const handleCloseThankYou = () => {
    setShowThankYouModal(false);
    setSuccessAmount(null);
  };

  const handleCloseConsidering = () => {
    setShowConsideringModal(false);
  };

  if (isSuccess && successAmount) {
    return (
      <div className="flex items-center justify-center p-4 pt-24 min-h-[calc(100vh-16rem)]">
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
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-slate-900 dark:to-slate-800 p-4 pb-40 md:pb-40">
      {/* Thank You Modal */}
      {showThankYouModal && successAmount && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
          onClick={handleCloseThankYou}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full animate-in fade-in-0 zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center">
              {/* Close button */}
              <button
                onClick={handleCloseThankYou}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Success icon with animation */}
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
              </div>

              {/* Thank you message */}
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                🎉 Thank You!
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Your donation of <span className="font-semibold text-green-600 dark:text-green-400">${successAmount.toFixed(2)}</span> has been processed successfully!
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Thank you for supporting our mission to make legal documents more accessible to everyone. Your contribution makes a real difference! ❤️
              </p>

              {/* Action buttons */}
              <div className="space-y-3">
                <Link to="/">
                  <Button className="w-full" size="lg">
                    <Heart className="w-4 h-4 mr-2" />
                    Return to Home
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={handleCloseThankYou}
                  className="w-full"
                >
                  Continue Browsing
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Thank You for Considering Modal */}
      {showConsideringModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
          onClick={handleCloseConsidering}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full animate-in fade-in-0 zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center">
              {/* Close button */}
              <button
                onClick={handleCloseConsidering}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Heart icon with gentle animation */}
              <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Heart className="w-12 h-12 text-blue-600 dark:text-blue-400" />
              </div>

              {/* Thank you message */}
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                💙 Thank You for Considering
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                We appreciate you taking the time to consider supporting our mission. Every bit of awareness helps!
              </p>
                             <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                 If you'd like to support us in other ways, you can share our site with friends or follow us on social media. Thank you for being part of our community! 🌟
               </p>

               {/* Social sharing */}
               <div className="mb-6">
                 <SocialShare
                   title="Check out ReadMyFinePrint - Making Legal Documents Accessible!"
                   description="I found this amazing platform that makes legal documents easier to understand. They're working to democratize legal literacy for everyone!"
                   hashtags={["legaltech", "accessibility", "transparency", "legal"]}
                 />
               </div>

               {/* Action buttons */}
               <div className="space-y-3">
                <Link to="/">
                  <Button className="w-full" size="lg">
                    <Heart className="w-4 h-4 mr-2" />
                    Explore Our Site
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={handleCloseConsidering}
                  className="w-full"
                >
                  Maybe Later
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto pt-24">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/20 dark:bg-primary/30 rounded-full mb-4">
            <Heart className="w-8 h-8 text-primary dark:text-primary" fill="currentColor" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Support Our Mission
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-6">
            Help us make legal documents accessible to everyone. Your donation keeps our
            advanced analysis service free and available to those who need it most.
          </p>
          <Link to="/roadmap">
            <Button variant="outline" className="inline-flex items-center">
              <MapPin className="w-4 h-4 mr-2" />
              View Development Roadmap
            </Button>
          </Link>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

                <div className="grid lg:grid-cols-2 gap-8 mb-8">
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-3 h-3 bg-primary rounded-full mt-1.5 flex-shrink-0"></div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Why Donate?</h4>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  Your donations help us maintain free access to legal document analysis for everyone.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-3 h-3 bg-primary rounded-full mt-1.5 flex-shrink-0"></div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Improve Our Service</h4>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  Funding helps us enhance our analysis capabilities and support more document types.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-3 h-3 bg-primary rounded-full mt-1.5 flex-shrink-0"></div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Expand Access</h4>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  Support our mission to democratize legal document understanding.
                </p>
              </div>
            </div>
          </div>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {DONATION_AMOUNTS.map((option) => (
                  <Button
                    key={option.amount}
                    variant={selectedAmount === option.amount ? "default" : "outline"}
                    onClick={() => handleAmountSelect(option.amount)}
                    className="h-12 text-sm font-medium"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200 dark:border-gray-600" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-gray-500 dark:text-gray-400">Or</span>
                </div>
              </div>

              <div>
                <label htmlFor="custom-amount" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Custom Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                  <input
                    id="custom-amount"
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="Enter amount"
                    value={customAmount}
                    onChange={(e) => handleCustomAmountChange(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
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
        </div>

                {/* Technical Diagnostics - Hidden for production but preserved for debugging */}
        {false && (
          <div className="mb-8 space-y-4">
            <details className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <summary className="cursor-pointer font-medium text-sm text-gray-600 dark:text-gray-300">
                🔧 Technical Diagnostics (Click to expand)
              </summary>
              <div className="mt-4 space-y-4">
                <StripeDebug />
                <SimpleStripeTest />
              </div>
            </details>
          </div>
        )}

        {/* Social Sharing Section */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Help Us Spread the Word! 📢
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Can't donate right now? No problem! Sharing our mission with friends and family is another valuable way to support us.
              </p>
            </div>

            <SocialShare
              title="ReadMyFinePrint - Making Legal Documents Accessible to Everyone"
              description="Discover a platform that's revolutionizing how we understand legal documents. Join the movement to make legal literacy accessible to all!"
              hashtags={["legaltech", "accessibility", "transparency", "legal", "fintech"]}
            />
          </CardContent>
        </Card>

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
