import { Heart, Shield, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TouchScrollContainer } from "@/components/TouchScrollContainer";

export default function DonateSimple() {
  const handleDonate = () => {
    window.open('https://donate.stripe.com/4gM6oI5ZLfCV7Qu8hHb7y00', '_blank');
  };

  return (
    <TouchScrollContainer className="h-full bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-4 max-w-2xl">
        
        <div className="text-center mb-8">
          <Heart className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Support ReadMyFinePrint</h1>
          <p className="text-lg text-muted-foreground">
            Help us keep legal document analysis free and accessible for everyone
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-center">Make a Donation</CardTitle>
            <CardDescription className="text-center">
              Your contribution helps maintain and improve our services
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Button
              onClick={handleDonate}
              className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Donate Now
            </Button>
            
            <p className="text-center text-sm text-muted-foreground">
              Secure payment powered by Stripe
            </p>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <Zap className="h-5 w-5 text-primary mt-1" />
                <div>
                  <h3 className="font-semibold text-sm">Technological Accessibility</h3>
                  <p className="text-xs text-muted-foreground">
                    Advanced document processing and analysis
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <Users className="h-5 w-5 text-secondary mt-1" />
                <div>
                  <h3 className="font-semibold text-sm">Free for Everyone</h3>
                  <p className="text-xs text-muted-foreground">
                    No subscription fees or hidden charges
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <Shield className="h-5 w-5 text-primary mt-1" />
                <div>
                  <h3 className="font-semibold text-sm">Privacy Focused</h3>
                  <p className="text-xs text-muted-foreground">
                    Your documents are processed securely
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <Heart className="h-5 w-5 text-primary mt-1" />
                <div>
                  <h3 className="font-semibold text-sm">Community Driven</h3>
                  <p className="text-xs text-muted-foreground">
                    Built for users, supported by users
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-muted">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-2">How Your Donation Helps</h3>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Maintain server infrastructure and processing power</li>
              <li>• Improve analysis accuracy and capabilities</li>
              <li>• Keep the service free for everyone to use</li>
              <li>• Add new features and document types</li>
              <li>• Ensure data privacy and security compliance</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </TouchScrollContainer>
  );
}