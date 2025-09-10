import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, CheckCircle, X, Bell } from 'lucide-react';

interface MailingListModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriptionType?: string;
  source?: string;
  userEmail?: string; // Pre-filled if user is logged in
}

export function MailingListModal({ 
  isOpen, 
  onClose, 
  subscriptionType = 'enterprise_features',
  source = 'subscription_plans',
  userEmail 
}: MailingListModalProps) {
  const [email, setEmail] = useState(userEmail || '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/mailing-list/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim(),
          subscriptionType,
          source,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to subscribe to mailing list');
      }

      setSuccess(true);
      
      // Auto-close after 3 seconds
      setTimeout(() => {
        onClose();
        // Reset state when closing
        setTimeout(() => {
          setSuccess(false);
          setEmail(userEmail || '');
          setError(null);
        }, 300);
      }, 3000);

    } catch (error) {
      console.error('Mailing list signup error:', error);
      setError(error instanceof Error ? error.message : 'Failed to subscribe to mailing list');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      // Reset state when closing
      setTimeout(() => {
        setSuccess(false);
        setEmail(userEmail || '');
        setError(null);
      }, 300);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {!success ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-purple-600" />
                Get Notified
              </DialogTitle>
              <DialogDescription>
                Be the first to know when our enterprise features are available! We'll send you an email when team collaboration, API access, and other advanced features launch.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading || Boolean(userEmail)}
                  className="w-full"
                  autoFocus
                />
                {userEmail && (
                  <p className="text-xs text-gray-500">
                    Using your account email address
                  </p>
                )}
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={loading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Subscribing...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Notify Me
                    </>
                  )}
                </Button>
              </div>
            </form>

            <div className="mt-4 text-xs text-gray-500 text-center">
              We'll only email you about enterprise feature updates. You can unsubscribe anytime.
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <DialogTitle className="text-xl font-semibold mb-2">
              You're All Set!
            </DialogTitle>
            <DialogDescription className="text-base">
              We'll notify you at <strong>{email}</strong> when our enterprise features are ready.
            </DialogDescription>
            <div className="mt-4 text-xs text-gray-500">
              This dialog will close automatically...
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 