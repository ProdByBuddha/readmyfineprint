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

      if (!response.ok) {
        const errorData = await response.json();
        setAttemptsRemaining(errorData.attemptsRemaining);
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`,
        );
      }

      const data = await response.json();

      if (data.success && data.token) {
        // Store the new token
        localStorage.setItem("subscriptionToken", data.token);
        console.log("Successfully logged into subscription");

        // Call success callback
        onSuccess(data.token, data.subscription);
      } else {
        throw new Error("Login failed - no token received");
      }
    } catch (error) {
      console.error("Verification error:", error);
      // Handle network errors gracefully
      if (
        error instanceof TypeError &&
        error.message.includes("Failed to fetch")
      ) {
        setError("Network error. Please check your connection and try again.");
      } else {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to verify code. Please try again.",
        );
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
                <AlertDescription>{error}</AlertDescription>
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
