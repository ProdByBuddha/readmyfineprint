import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Home, ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-blue-950 flex items-center justify-center relative overflow-hidden" data-testid="not-found-page">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5 dark:opacity-10" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
      
      <div className="relative max-w-2xl mx-4">
        <Card className="text-center shadow-2xl border-0 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl" data-testid="error-card">
          <CardHeader className="pb-4">
            <div className="mx-auto w-24 h-24 bg-gradient-to-br from-red-500/20 via-orange-500/20 to-yellow-500/20 dark:from-red-400/10 dark:via-orange-400/10 dark:to-yellow-400/10 rounded-2xl flex items-center justify-center mb-6">
              <AlertCircle className="h-12 w-12 text-red-500 dark:text-red-400" />
            </div>
            <Badge className="mb-4 px-4 py-2 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-700/30 mx-auto">
              <AlertCircle className="w-3 h-3 mr-2" />
              Page Not Found
            </Badge>
            <CardTitle className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-4 leading-tight" data-testid="error-title">
              404 Error
            </CardTitle>
            <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 font-light leading-relaxed" data-testid="error-description">
              The page you're looking for doesn't exist or has been moved to a different location.
            </p>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                What can you do?
              </h3>
              <div className="grid gap-4 text-left">
                <div className="flex items-start gap-3 p-4 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl backdrop-blur-sm">
                  <Home className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-200">Return to Homepage</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Go back to our main page and explore our features</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl backdrop-blur-sm">
                  <Search className="w-5 h-5 text-secondary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-200">Check the URL</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Make sure you've entered the correct web address</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/" data-testid="button-home-link">
                <Button 
                  className="group bg-gradient-to-r from-primary via-blue-600 to-primary hover:from-primary/90 hover:via-blue-600/90 hover:to-primary/90 text-white px-8 py-4 text-lg font-bold shadow-xl hover:shadow-primary/25 transition-all duration-300 transform hover:-translate-y-1"
                  data-testid="button-return-home"
                >
                  <Home className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform duration-300" />
                  Return Home
                </Button>
              </Link>
              <Button 
                variant="outline"
                onClick={() => window.history.back()}
                className="group px-8 py-4 text-lg font-semibold border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-300 backdrop-blur-sm bg-transparent"
                data-testid="button-go-back"
              >
                <ArrowLeft className="w-5 h-5 mr-3 group-hover:-translate-x-1 transition-transform duration-300" />
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
