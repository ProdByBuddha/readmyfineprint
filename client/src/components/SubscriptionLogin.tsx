import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, LogIn, AlertCircle, Mail, Shield, Crown, X } from "lucide-react";
import { getStoredDeviceFingerprint } from "@/utils/deviceFingerprint";

interface SubscriptionLoginProps {
  onSuccess: (token: string, subscription: any) => void;
  onCancel?: () => void;
}

type LoginStep = "email" | "verification";

export function SubscriptionLogin({
  onSuccess,
  onCancel,
}: SubscriptionLoginProps) {
  const [step, setStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<Date | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(
    null,
  );

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/subscription/login/request-code", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Device-Fingerprint": getStoredDeviceFingerprint(),
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error cases with user-friendly messages
        if (
          response.status === 404 ||
          data.error?.includes("No subscription found")
        ) {
          setError(
            "No subscription found for this email address. Please check your email or subscribe first.",
          );
        } else if (
          response.status === 403 ||
          data.error?.includes("No active subscription")
        ) {
          setError(
            "Your subscription appears to be inactive or expired. Please contact support or renew your subscription.",
          );
        } else if (response.status === 429) {
          setError(
            "Too many attempts. Please wait a few minutes before trying again.",
          );
        } else {
          setError(
            data.error ||
              "Unable to send verification code. Please try again or contact support.",
          );
        }
        return;
      }

      if (data.success) {
        setCodeExpiresAt(new Date(data.expiresAt));
        setStep("verification");
        console.log("Verification code sent to email");
      } else {
        setError(
          data.error || "Failed to send verification code. Please try again.",
        );
      }
    } catch (error) {
      console.error("Email verification request error:", error);
      // Handle network errors or other unexpected issues
      if (
        error instanceof TypeError &&
        error.message.includes("Failed to fetch")
      ) {
        setError("Network error. Please check your connection and try again.");
      } else {
        setError(
          "An unexpected error occurred. Please try again or contact support.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!verificationCode || verificationCode.length !== 6) {
      setError("Please enter the 6-digit verification code");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/subscription/login/verify", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Device-Fingerprint": getStoredDeviceFingerprint(),
        },
        body: JSON.stringify({ email, code: verificationCode }),
      });

      // Handle different response scenarios
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.error("Failed to parse error response:", parseError);
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Update attempts remaining if provided
        if (typeof errorData.attemptsRemaining === 'number') {
          setAttemptsRemaining(errorData.attemptsRemaining);
        }

        // Handle specific error cases
        if (response.status === 400 && errorData.error) {
          throw new Error(errorData.error);
        } else if (response.status === 429) {
          throw new Error("Too many verification attempts. Please request a new code.");
        } else if (response.status >= 500) {
          throw new Error("Server error. Please try again in a moment.");
        } else {
          throw new Error(errorData.error || `Verification failed (${response.status})`);
        }
      }

      // Parse successful response
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error("Failed to parse success response:", parseError);
        throw new Error("Invalid response from server. Please try again.");
      }

      if (data.success && data.token) {
        // Store the new token
        localStorage.setItem("subscriptionToken", data.token);
        console.log("Successfully logged into subscription");

        // Call success callback
        onSuccess(data.token, data.subscription);
      } else {
        throw new Error(data.error || "Login failed - no token received");
      }
    } catch (error) {
      console.error("Verification error:", error);
      
      // Enhanced error handling with specific messages
      if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
        setError("Network connection failed. Please check your internet connection and try again.");
      } else if (error instanceof Error) {
        // Check for specific error messages and provide user-friendly alternatives
        let userFriendlyMessage = error.message;
        
        if (error.message.includes("Invalid verification code")) {
          userFriendlyMessage = "The verification code you entered is incorrect. Please check and try again.";
        } else if (error.message.includes("expired")) {
          userFriendlyMessage = "Your verification code has expired. Please request a new one.";
        } else if (error.message.includes("Too many")) {
          userFriendlyMessage = "Too many incorrect attempts. Please request a new verification code.";
        } else if (error.message.includes("Network error") || error.message.includes("fetch")) {
          userFriendlyMessage = "Connection problem. Please check your internet and try again.";
        } else if (error.message.includes("Server error") || error.message.includes("500")) {
          userFriendlyMessage = "Our servers are experiencing issues. Please try again in a moment.";
        } else if (!error.message || error.message === "Error {}" || error.message.trim() === "" || error.toString() === "[object Object]") {
          userFriendlyMessage = "Verification failed. Please check your code and try again, or request a new verification code.";
        }
        
        setError(userFriendlyMessage);
      } else if (typeof error === 'object' && error !== null) {
        // Handle cases where error is an object but not an Error instance
        const errorString = JSON.stringify(error);
        if (errorString === '{}' || errorString === 'null') {
          setError("Verification failed. Please check your code and try again, or request a new verification code.");
        } else {
          setError("An unexpected error occurred. Please try entering the code again.");
        }
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep("email");
    setVerificationCode("");
    setError(null);
    setAttemptsRemaining(null);
    setCodeExpiresAt(null);
  };

  if (step === "email") {
    return (
      <Card className="w-full max-w-md mx-auto relative">
        {onCancel && (
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors z-10"
            aria-label="Close login modal"
          >
            <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </button>
        )}
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Mail className="h-5 w-5" />
            <span>Login to Your Account</span>
          </CardTitle>
          <CardDescription>
            Enter the email address you used when subscribing to log into your
            account from this device.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoFocus
                className="text-foreground placeholder:text-muted-foreground bg-background border-input"
                style={{ color: 'var(--foreground)' }}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {error}
                  {error.includes("Network") && (
                    <div className="mt-2 text-sm">
                      <p>Try these steps:</p>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>Check your internet connection</li>
                        <li>Refresh the page and try again</li>
                        <li>Contact support if the problem persists</li>
                      </ul>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex space-x-2">
              <Button
                type="submit"
                disabled={loading || !email}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending Code...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Verification Code
                  </>
                )}
              </Button>
            </div>

            <div className="mt-4">
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => window.location.href = '/subscription'}
                disabled={loading}
              >
                <Crown className="mr-2 h-4 w-4 text-yellow-600" />
                Subscribe Now
              </Button>
            </div>
          </form>

          <div className="mt-4 text-sm text-muted-foreground">
            <p>
              🔒 <strong>Secure Login</strong>
            </p>
            <p>
              We'll send a verification code to your email to securely log you
              in.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Verification step
  return (
    <Card className="w-full max-w-md mx-auto relative">
      {onCancel && (
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors z-10"
          aria-label="Close login modal"
        >
          <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        </button>
      )}
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Shield className="h-5 w-5" />
          <span>Enter Verification Code</span>
        </CardTitle>
        <CardDescription>
          We sent a 6-digit code to <strong>{email}</strong>. Enter it below to
          access your subscription.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleVerificationSubmit} className="space-y-4">
          <div>
            <Input
              type="text"
              placeholder="000000"
              value={verificationCode}
              onChange={(e) =>
                setVerificationCode(
                  e.target.value.replace(/\D/g, "").slice(0, 6),
                )
              }
              disabled={loading}
              autoFocus
              className="text-center text-2xl font-mono tracking-wider text-foreground placeholder:text-muted-foreground bg-background border-input"
              style={{ color: 'var(--foreground)' }}
              maxLength={6}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error}
                {attemptsRemaining !== null && attemptsRemaining > 0 && (
                  <span className="block mt-1">
                    {attemptsRemaining} attempt
                    {attemptsRemaining !== 1 ? "s" : ""} remaining
                  </span>
                )}
                {attemptsRemaining === 0 && (
                  <div className="mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleBackToEmail}
                      className="text-xs"
                    >
                      Request New Code
                    </Button>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex space-x-2">
            <Button
              type="submit"
              disabled={loading || verificationCode.length !== 6}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Access Subscription
                </>
              )}
            </Button>
          </div>

          <div className="flex justify-center items-center text-sm">
            <Button
              type="button"
              variant="ghost"
              onClick={handleBackToEmail}
              disabled={loading}
              className="text-muted-foreground hover:text-foreground"
            >
              ← Change Email
            </Button>
          </div>
        </form>

        <div className="mt-4 text-sm text-muted-foreground">
          <p>
            📧 <strong>Didn't receive the code?</strong>
          </p>
          <p>Check your spam folder. The code expires in 10 minutes.</p>
          {codeExpiresAt && (
            <p className="mt-2">
              Expires at: {codeExpiresAt.toLocaleTimeString()}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
