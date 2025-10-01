import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Users, 
  Mail, 
  Calendar, 
  Shield, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Loader2,
  Building2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/auth-fetch';

interface InvitationDetails {
  organization: {
    name: string;
    slug: string;
  };
  role: 'admin' | 'member' | 'viewer';
  email: string;
  expiresAt: string;
  invitedBy?: string;
}

interface AcceptResponse {
  success: boolean;
  orgId: string;
  role: string;
  message: string;
}

const roleDescriptions = {
  admin: 'Full access to manage the organization, members, and settings',
  member: 'Can collaborate on documents and participate in workspaces',
  viewer: 'Read-only access to organization content'
};

const roleColors = {
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  member: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  viewer: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
};

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication status
  useEffect(() => {
    const accessToken = localStorage.getItem('jwt_access_token');
    setIsAuthenticated(!!accessToken);
  }, []);

  // Fetch invitation details
  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }

    const fetchInvitation = async () => {
      try {
        const response = await fetch(`/api/invitations/${token}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('This invitation is invalid or has expired');
          }
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load invitation');
        }

        const data = await response.json();
        setInvitation(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load invitation');
      } finally {
        setLoading(false);
      }
    };

    fetchInvitation();
  }, [token]);

  const handleAccept = async () => {
    if (!token || !invitation) return;

    // Check if user is authenticated
    if (!isAuthenticated) {
      toast({
        title: "Authentication required",
        description: "Please sign in to accept this invitation",
        variant: "destructive"
      });
      // Store invitation token for after login
      sessionStorage.setItem('pending_invitation', token);
      navigate('/');
      return;
    }

    setAccepting(true);
    try {
      const response = await authFetch(`/api/invitations/${token}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 403 && errorData.code === 'EMAIL_MISMATCH') {
          throw new Error(`This invitation is for ${invitation.email}. Please sign in with that email address.`);
        }
        if (response.status === 409 && errorData.code === 'ALREADY_MEMBER') {
          throw new Error('You are already a member of this organization');
        }
        if (response.status === 404) {
          throw new Error('This invitation has expired or is no longer valid');
        }
        
        throw new Error(errorData.error || 'Failed to accept invitation');
      }

      const data: AcceptResponse = await response.json();
      
      toast({
        title: "Success! 🎉",
        description: data.message || `You've joined ${invitation.organization.name}`,
      });

      // Clear pending invitation if stored
      sessionStorage.removeItem('pending_invitation');

      // Redirect to organization page or dashboard
      setTimeout(() => {
        navigate('/settings'); // Or navigate to org dashboard when available
      }, 1500);
      
    } catch (err) {
      toast({
        title: "Failed to accept invitation",
        description: err instanceof Error ? err.message : 'An error occurred',
        variant: "destructive"
      });
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = () => {
    navigate('/');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isExpiringSoon = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const hoursUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilExpiry < 24 && hoursUntilExpiry > 0;
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="w-full max-w-lg">
            <CardHeader>
              <div className="flex items-center justify-center mb-4">
                <div className="rounded-full bg-red-100 dark:bg-red-900 p-3">
                  <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <CardTitle className="text-center text-2xl">Invalid Invitation</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {error || 'This invitation link is invalid or has expired.'}
                </AlertDescription>
              </Alert>
              <Button 
                onClick={() => navigate('/')} 
                className="w-full"
              >
                Return Home
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const expired = isExpired(invitation.expiresAt);
  const expiringSoon = isExpiringSoon(invitation.expiresAt);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl"
      >
        <Card className="overflow-hidden">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-8 text-white">
            <div className="flex items-center justify-center mb-4">
              <div className="rounded-full bg-white/20 p-4">
                <Users className="h-10 w-10" />
              </div>
            </div>
            <CardTitle className="text-center text-3xl font-bold mb-2">
              You've Been Invited!
            </CardTitle>
            <CardDescription className="text-center text-white/90 text-lg">
              Join your team and start collaborating
            </CardDescription>
          </div>

          <CardContent className="p-8">
            {/* Expiration warning */}
            {expired ? (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This invitation expired on {formatDate(invitation.expiresAt)}
                </AlertDescription>
              </Alert>
            ) : expiringSoon ? (
              <Alert className="mb-6 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                  This invitation expires soon: {formatDate(invitation.expiresAt)}
                </AlertDescription>
              </Alert>
            ) : null}

            {/* Organization details */}
            <div className="space-y-6 mb-8">
              <div className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                <Building2 className="h-6 w-6 text-purple-600 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">Organization</p>
                  <p className="text-xl font-semibold">{invitation.organization.name}</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                <Mail className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">Invited Email</p>
                  <p className="text-lg font-medium">{invitation.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                <Shield className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-2">Your Role</p>
                  <Badge className={`mb-2 ${roleColors[invitation.role]}`}>
                    {invitation.role.toUpperCase()}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    {roleDescriptions[invitation.role]}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                <Calendar className="h-6 w-6 text-orange-600 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">Expires</p>
                  <p className="text-lg font-medium">{formatDate(invitation.expiresAt)}</p>
                </div>
              </div>
            </div>

            {/* Authentication notice */}
            {!isAuthenticated && !expired && (
              <Alert className="mb-6 border-blue-500 bg-blue-50 dark:bg-blue-900/20">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  You'll need to sign in with <strong>{invitation.email}</strong> to accept this invitation
                </AlertDescription>
              </Alert>
            )}

            {/* Action buttons */}
            <div className="flex gap-4">
              <Button
                onClick={handleDecline}
                variant="outline"
                className="flex-1"
                disabled={accepting}
              >
                Decline
              </Button>
              <Button
                onClick={handleAccept}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                disabled={accepting || expired}
              >
                {accepting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Accept Invitation
                  </>
                )}
              </Button>
            </div>

            {/* Footer note */}
            <p className="text-center text-sm text-muted-foreground mt-6">
              By accepting, you agree to join this organization and collaborate with team members.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
