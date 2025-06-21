import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Heart, ArrowLeft, ExternalLink } from "lucide-react";
import { SocialShare } from "@/components/SocialShare";
import StripePaymentForm from "@/components/StripePaymentForm";

export default function DonatePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [customAmount, setCustomAmount] = useState('');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [showSocialShare, setShowSocialShare] = useState(false);

  const success = searchParams.get('success') === 'true';
  const canceled = searchParams.get('canceled') === 'true';
  const amount = searchParams.get('amount');

  const predefinedAmounts = [5, 10, 25, 50, 100];

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
    setPaymentError(null);
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      setSelectedAmount(numValue);
    } else {
      setSelectedAmount(null);
    }
    setPaymentError(null);
  };

  const handlePaymentSuccess = (donatedAmount: number) => {
    setPaymentSuccess(true);
    setSelectedAmount(donatedAmount);
    setPaymentError(null);

    // Show social share after successful payment
    setTimeout(() => {
      setShowSocialShare(true);
    }, 2000);
  };

  const handlePaymentError = (error: string) => {
    setPaymentError(error);
    setPaymentSuccess(false);
  };

  const resetForm = () => {
    setPaymentSuccess(false);
    setPaymentError(null);
    setSelectedAmount(null);
    setCustomAmount('');
    setShowSocialShare(false);
  };

  if (success) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-4">Thank you for your donation!</h1>
            {amount && (
              <p className="text-lg mb-4">
                Your donation of ${amount} has been processed successfully.
              </p>
            )}
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Your support helps us keep legal documents accessible for everyone.
            </p>
            <div className="space-y-4">
              <Button onClick={() => navigate('/')} className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return to Home
              </Button>
              <SocialShare
                title="I just supported ReadMyFinePrint!"
                description="Help make legal documents accessible to everyone. Check out this amazing tool!"
                hashtags={["legaltech", "accessibility", "transparency"]}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (canceled) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardContent className="p-8 text-center">
            <h1 className="text-2xl font-bold mb-4">Donation Canceled</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              No worries! You can try again anytime.
            </p>
            <Button onClick={() => window.location.href = '/donate'} className="w-full">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paymentSuccess) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-4">Thank you for your donation!</h1>
            <p className="text-lg mb-4">
              Your donation of ${selectedAmount?.toFixed(2)} has been processed successfully.
            </p>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Your support helps us keep legal documents accessible for everyone.
            </p>

            {showSocialShare && (
              <div className="mb-6">
                <SocialShare
                  title="I just supported ReadMyFinePrint!"
                  description="Help make legal documents accessible to everyone. Check out this amazing tool!"
                  hashtags={["legaltech", "accessibility", "transparency"]}
                />
              </div>
            )}

            <div className="space-y-3">
              <Button onClick={() => navigate('/')} className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return to Home
              </Button>
              <Button onClick={resetForm} variant="outline" className="w-full">
                Make Another Donation
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
          <Heart className="w-8 h-8 text-red-500" />
          Support Our Mission
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Help us keep legal documents accessible and understandable for everyone
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Choose Your Donation Amount</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              {predefinedAmounts.map((amount) => (
                <Button
                  key={amount}
                  variant={selectedAmount === amount ? "default" : "outline"}
                  onClick={() => handleAmountSelect(amount)}
                  className="h-12"
                >
                  ${amount}
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="custom-amount">Custom Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                <Input
                  id="custom-amount"
                  type="number"
                  placeholder="Enter amount"
                  value={customAmount}
                  onChange={(e) => handleCustomAmountChange(e.target.value)}
                  className="pl-8"
                  min="1"
                  step="0.01"
                />
              </div>
            </div>

            {paymentError && (
              <Alert variant="destructive">
                <AlertDescription>{paymentError}</AlertDescription>
              </Alert>
            )}

            <div className="pt-4 border-t">
              <h3 className="font-semibold mb-3">Alternative Ways to Support</h3>
              <div className="space-y-2">
                <Button
                  onClick={() => window.open('https://paypal.me/readmyfineprint', '_blank')}
                  variant="outline"
                  className="w-full justify-start"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Donate via PayPal
                </Button>
                <Button
                  onClick={() => window.open('https://ko-fi.com/readmyfineprint', '_blank')}
                  variant="outline"
                  className="w-full justify-start"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Support on Ko-fi
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedAmount && selectedAmount > 0 && (
          <div>
            <StripePaymentForm
              amount={selectedAmount}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
            />
          </div>
        )}
      </div>

      <div className="mt-8 text-center">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-3">How Your Donation Helps</h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="font-medium">Free Access</div>
                <div className="text-gray-600 dark:text-gray-400">
                  Keep our service free for everyone
                </div>
              </div>
              <div>
                <div className="font-medium">AI Improvements</div>
                <div className="text-gray-600 dark:text-gray-400">
                  Enhance document analysis capabilities
                </div>
              </div>
              <div>
                <div className="font-medium">Legal Literacy</div>
                <div className="text-gray-600 dark:text-gray-400">
                  Expand educational resources
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}