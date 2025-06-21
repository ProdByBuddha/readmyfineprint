
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Heart, ExternalLink, CreditCard, AlertCircle, RefreshCw } from "lucide-react";
import { SocialShare } from "./SocialShare";

interface NetworkFallbackDonationProps {
  onRetryStripe?: () => void;
  stripeError?: string;
}

export function NetworkFallbackDonation({ onRetryStripe, stripeError }: NetworkFallbackDonationProps) {
  const [showSocialShare, setShowSocialShare] = useState(false);

  const isNetworkError = stripeError?.includes("timeout") || 
                        stripeError?.includes("Network") ||
                        stripeError?.includes("Failed to load");

  return (
    <div className="space-y-6">
      {stripeError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium mb-1">Payment System Issue</div>
            <div className="text-sm">{stripeError}</div>
            {isNetworkError && (
              <div className="mt-2 text-sm">
                This is likely due to network restrictions in the development environment.
                Payment processing will work properly in production.
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {onRetryStripe && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <CreditCard className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Payment System Loading Issue</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  The secure payment processor is having trouble loading. This is common in development environments.
                </p>
                <Button 
                  onClick={onRetryStripe}
                  variant="outline"
                  className="flex items-center space-x-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Retry Payment System</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Heart className="w-5 h-5 text-red-500" />
            <span>Support Our Mission</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              While we work on the payment system, you can still support us in other ways!
            </p>

            <div className="grid gap-4">
              <Button
                onClick={() => window.open('https://paypal.me/readmyfineprint', '_blank')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center space-x-2"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Donate via PayPal</span>
              </Button>

              <Button
                onClick={() => window.open('https://ko-fi.com/readmyfineprint', '_blank')}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center space-x-2"
              >
                <Heart className="w-4 h-4" />
                <span>Support on Ko-fi</span>
              </Button>

              <Button
                onClick={() => setShowSocialShare(!showSocialShare)}
                variant="outline"
                className="w-full flex items-center justify-center space-x-2"
              >
                <Heart className="w-4 h-4" />
                <span>Share & Spread the Word</span>
              </Button>
            </div>

            {showSocialShare && (
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <SocialShare
                  title="ReadMyFinePrint - Making Legal Documents Accessible"
                  description="Check out this amazing tool that makes legal documents easier to understand!"
                  hashtags={["legaltech", "accessibility", "transparency"]}
                />
              </div>
            )}
          </div>

          <div className="text-center pt-4 border-t">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              💡 <strong>Can't donate right now?</strong> Sharing our mission with friends and family 
              helps us reach more people who need accessible legal document analysis.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
