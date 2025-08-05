import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail } from "lucide-react";

interface LoginFormProps {
  onLoginSuccess: (token: string) => void;
  isAdmin?: boolean;
  onEmailRecovery?: () => void;
}

export function LoginForm({ onLoginSuccess, isAdmin = false, onEmailRecovery }: LoginFormProps) {
  const [step, setStep] = useState<'email' | 'verify'>('email');
  const [email, setEmail] = useState(isAdmin ? 'admin@readmyfineprint.com' : '');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Auto-advance to verification step for admin
  useEffect(() => {
    if (isAdmin && email === 'admin@readmyfineprint.com') {
      handleRequestCode();
    }
  }, [isAdmin]);

  const handleRequestCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);

    try {
      const endpoint = isAdmin ? "/api/admin/request-verification" : "/api/subscription/login/request-code";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      // Add admin key if this is admin login
      if (isAdmin) {
                 const adminKey = process.env.VITE_ADMIN_API_KEY || process.env.ADMIN_API_KEY;
        headers["X-Admin-Key"] = adminKey || '';
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: isAdmin ? undefined : JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        setStep('verify');
        const description = isAdmin 
          ? "Check admin@readmyfineprint.com and prodbybuddha@icloud.com"
          : `Check your email at ${email}`;
        toast({
          title: "Verification code sent",
          description,
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to send verification code",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send verification code",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const endpoint = isAdmin ? "/api/admin/verify-code" : "/api/subscription/login/verify-code";
      const body = isAdmin ? { code } : { email, code };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        const token = isAdmin ? data.adminToken : data.token;
        onLoginSuccess(token);
        toast({
          title: "Login successful",
          description: isAdmin ? "Admin access granted" : "Welcome back!",
        });
      } else {
        toast({
          title: "Verification failed",
          description: data.error || "Invalid verification code",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to verify code",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'email') {
    return (
      <form onSubmit={handleRequestCode} className="space-y-4">
        <div>
          <Label htmlFor="email">Email Address</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            disabled={isAdmin}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Sending..." : "Send Verification Code"}
        </Button>
        
        {!isAdmin && onEmailRecovery && (
          <div className="space-y-3">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Need help?
                </span>
              </div>
            </div>
            
            <Button 
              type="button" 
              variant="outline" 
              className="w-full" 
              onClick={onEmailRecovery}
            >
              <Mail className="w-4 h-4 mr-2" />
              Can't access your email?
            </Button>
          </div>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={handleVerifyCode} className="space-y-4">
      <div className="text-center mb-4">
        <p className="text-sm text-muted-foreground">
          {isAdmin 
            ? "Code sent to admin emails"
            : `Code sent to ${email}`
          }
        </p>
      </div>
      
      <div>
        <Label htmlFor="code">6-Digit Verification Code</Label>
        <Input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter 6-digit code"
          maxLength={6}
          pattern="[0-9]{6}"
          required
        />
      </div>
      
      <div className="flex space-x-2">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => setStep('email')}
          className="flex-1"
        >
          Back
        </Button>
        <Button type="submit" className="flex-1" disabled={isLoading || !code}>
          {isLoading ? "Verifying..." : "Verify Code"}
        </Button>
      </div>
    </form>
  );
}