
import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Heart, ArrowLeft, CreditCard, Loader2, Wallet, Copy } from "lucide-react";
import { SocialShare } from "@/components/SocialShare";

interface DonateButtonProps {
  amount: number;
  onError: (error: string) => void;
}

function DonateButton({ amount, onError }: DonateButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDonate = async () => {
    setIsProcessing(true);
    try {
      // Create checkout session and redirect to Stripe
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Server error: ${response.status}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received from server');
      }
    } catch (error) {
      console.error('Donation processing failed:', error);
      setIsProcessing(false);
      
      let errorMessage = 'Failed to process donation';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      onError(errorMessage);
    }
  };

  return (
    <Button
      disabled={isProcessing}
      onClick={handleDonate}
      className="w-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center space-x-2"
      size="lg"
    >
      {isProcessing ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Processing...</span>
        </>
      ) : (
        <>
          <CreditCard className="w-4 h-4" />
          <span>Donate ${amount.toFixed(2)}</span>
        </>
      )}
    </Button>
  );
}

export default function DonatePage() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const [customAmount, setCustomAmount] = useState('');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [showSocialShare, setShowSocialShare] = useState(false);
  const [showThankYouMessage, setShowThankYouMessage] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const success = searchParams.get('success') === 'true';
  const canceled = searchParams.get('canceled') === 'true';
  const amount = searchParams.get('amount');

  const predefinedAmounts = [5, 10, 25, 50, 100];

  // Crypto wallet addresses
  const cryptoAddresses = {
    worldchain: '0xe4fdf9076dca468d839b51f75af35983b898821b',
    ethereum: '0x5f596473Dea9043B6338EF33a747CF0426EBcf92',
    bitcoin: 'bc1qctmts3a2kmtfqskp0d5hrrew4gy9nhalu6mc4m',
    polygon: '0x5f596473Dea9043B6338EF33a747CF0426EBcf92',
    bsc: '0x5f596473Dea9043B6338EF33a747CF0426EBcf92',
    avalanche: '0x5f596473Dea9043B6338EF33a747CF0426EBcf92',
    arbitrum: '0x5f596473Dea9043B6338EF33a747CF0426EBcf92',
    optimism: '0x5f596473Dea9043B6338EF33a747CF0426EBcf92',
    solana: '2yUpjfwiQiv4pme1BSMLPpWgUcuWUMj6Q1KDetrPMc19',
    cardano: 'addr1qyqn6zvqrhmx8h83eady5kk9ytfskrz4dgw6fcj32cxaetxyvpz05tv3rqhgc28qqpq5f9rvkvmpu60j43lfn4crcphs747ush'
  };

  const copyToClipboard = async (address: string, type: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(type);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  // Check if user is returning to donation page and show thank you message
  useEffect(() => {
    const hasVisitedBefore = localStorage.getItem('donationPageVisited');
    const lastVisit = localStorage.getItem('donationPageLastVisit');
    const now = Date.now();
    
    // Show thank you message for canceled donations (regardless of visit history)
    if (canceled) {
      setShowThankYouMessage(true);
      // Auto-hide after 8 seconds for canceled donations
      setTimeout(() => setShowThankYouMessage(false), 8000);
    } else if (hasVisitedBefore && lastVisit) {
      // Only show for return visits (not initial visits)
      const timeSinceLastVisit = now - parseInt(lastVisit);
      // Show message if they return within 24 hours but after 10 seconds
      if (timeSinceLastVisit > 10000 && timeSinceLastVisit < 86400000) {
        setShowThankYouMessage(true);
        // Auto-hide after 5 seconds
        setTimeout(() => setShowThankYouMessage(false), 5000);
      }
    }
    
    // Update visit tracking for regular visits (not canceled page)
    if (!canceled) {
      localStorage.setItem('donationPageVisited', 'true');
      localStorage.setItem('donationPageLastVisit', now.toString());
    }
  }, [canceled]);

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
              <Button onClick={() => window.location.href = '/'} className="w-full">
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
              <Button onClick={() => window.location.href = '/'} className="w-full">
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2 text-gray-900 dark:text-white">
            <Heart className="w-8 h-8 text-red-500" />
            Support Our Mission
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Help us keep legal documents accessible and understandable for everyone
          </p>
        </div>

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

          {selectedAmount && selectedAmount > 0 && (
            <div className="pt-6 border-t">
              <DonateButton
                amount={selectedAmount}
                onError={handlePaymentError}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Crypto Donation Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Crypto Donations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Support us with cryptocurrency. Click to copy wallet addresses:
          </p>
          
          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
            <AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
              ⚠️ Verify network and address before sending. Lost transactions due to incorrect network/address cannot be recovered.
            </AlertDescription>
          </Alert>
          
          <div className="grid gap-3">
            {/* World Chain */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">WC</span>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">World Chain</div>
                  <div className="text-xs text-gray-500 mb-1">
                    Supports: WLD, USDC, WBTC, WETH, uSOL, uDOGE, uXRP only
                  </div>
                  <div className="text-xs text-gray-500 font-mono break-all">
                    {cryptoAddresses.worldchain}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(cryptoAddresses.worldchain, 'worldchain')}
                className="flex-shrink-0"
              >
                <Copy className="w-4 h-4" />
                {copiedAddress === 'worldchain' ? 'Copied!' : 'Copy'}
              </Button>
            </div>

            {/* EVM Compatible Chains */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">EVM</span>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">EVM Compatible Chains</div>
                  <div className="text-xs text-gray-500 mb-1">
                    Supports: ETH, MATIC, BNB, AVAX, ARB, OP only
                  </div>
                  <div className="text-xs text-gray-500 font-mono break-all">
                    {cryptoAddresses.ethereum}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(cryptoAddresses.ethereum, 'evm')}
                className="flex-shrink-0"
              >
                <Copy className="w-4 h-4" />
                {copiedAddress === 'evm' ? 'Copied!' : 'Copy'}
              </Button>
            </div>

            {/* Bitcoin */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-orange-600 dark:text-orange-400">BTC</span>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">Bitcoin</div>
                  <div className="text-xs text-gray-500 font-mono break-all">
                    {cryptoAddresses.bitcoin}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(cryptoAddresses.bitcoin, 'bitcoin')}
                className="flex-shrink-0"
              >
                <Copy className="w-4 h-4" />
                {copiedAddress === 'bitcoin' ? 'Copied!' : 'Copy'}
              </Button>
            </div>

            {/* Solana */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400">SOL</span>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">Solana</div>
                  <div className="text-xs text-gray-500 mb-1">
                    Supports: SOL only
                  </div>
                  <div className="text-xs text-gray-500 font-mono break-all">
                    {cryptoAddresses.solana}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(cryptoAddresses.solana, 'solana')}
                className="flex-shrink-0"
              >
                <Copy className="w-4 h-4" />
                {copiedAddress === 'solana' ? 'Copied!' : 'Copy'}
              </Button>
            </div>

            {/* Cardano */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">ADA</span>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">Cardano</div>
                  <div className="text-xs text-gray-500 mb-1">
                    Supports: ADA only
                  </div>
                  <div className="text-xs text-gray-500 font-mono break-all">
                    {cryptoAddresses.cardano}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(cryptoAddresses.cardano, 'cardano')}
                className="flex-shrink-0"
              >
                <Copy className="w-4 h-4" />
                {copiedAddress === 'cardano' ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Thank You for Considering Message */}
      {showThankYouMessage && (
        <div className="fixed top-4 right-4 z-50 max-w-sm">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 animate-in slide-in-from-right-5">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <Heart className="w-5 h-5 text-red-500 mt-0.5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  {canceled ? "Thank you for considering!" : "Thank you for considering!"}
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  {canceled 
                    ? "No worries! You can donate anytime. Every contribution helps us keep legal documents accessible."
                    : "Every contribution helps us keep legal documents accessible for everyone."
                  }
                </p>
              </div>
              <button
                onClick={() => setShowThankYouMessage(false)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
