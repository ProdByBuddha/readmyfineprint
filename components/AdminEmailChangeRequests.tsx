import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Mail, 
  Shield, 
  CheckCircle,
  X,
  User,
  Calendar,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import type { EmailChangeRequest } from '@shared/schema';

interface AdminEmailChangeRequestsProps {
  className?: string;
}

interface ExtendedEmailChangeRequest extends EmailChangeRequest {
  user?: {
    id: string;
    email: string;
    username?: string;
    createdAt: Date;
  };
}

export function AdminEmailChangeRequests({ className = '' }: AdminEmailChangeRequestsProps) {
  const [requests, setRequests] = useState<ExtendedEmailChangeRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ExtendedEmailChangeRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const fetchPendingRequests = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/email-change-requests', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests);
      } else {
        setError('Failed to load email change requests');
      }
    } catch (error) {
      setError('Network error loading requests');
      console.error('Failed to load email change requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestClick = async (request: ExtendedEmailChangeRequest) => {
    if (selectedRequest?.id === request.id) {
      setSelectedRequest(null);
      return;
    }

    try {
      const response = await fetch(`/api/admin/email-change-requests/${request.id}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedRequest({ ...data.request, user: data.user });
        setReviewNotes('');
        setReviewAction(null);
      } else {
        setError('Failed to load request details');
      }
    } catch (error) {
      setError('Network error loading request details');
      console.error('Failed to load request details:', error);
    }
  };

  const handleReview = async (action: 'approve' | 'reject') => {
    if (!selectedRequest) return;

    setReviewLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/email-change-requests/${selectedRequest.id}/review`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          adminNotes: reviewNotes.trim() || undefined
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Refresh the requests list
        await fetchPendingRequests();
        setSelectedRequest(null);
        setReviewNotes('');
        setReviewAction(null);
      } else {
        setError(data.error || `Failed to ${action} request`);
      }
    } catch (error) {
      setError(`Network error during ${action}`);
      console.error(`Failed to ${action} request:`, error);
    } finally {
      setReviewLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      case 'expired': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString();
  };

  const getTimeRemaining = (expiresAt: Date | string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 24) return `${hours}h remaining`;
    
    const days = Math.floor(hours / 24);
    return `${days}d remaining`;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-blue-600" />
              <span>Email Change Requests</span>
            </CardTitle>
            <Button
              onClick={fetchPendingRequests}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {error && (
            <Alert className="mb-4 bg-red-50 border-red-200">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading requests...</span>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No pending email change requests</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div key={request.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                  <div 
                    onClick={() => handleRequestClick(request)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleRequestClick(request)}
                    role="button"
                    tabIndex={0}
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Badge variant="outline" className={getStatusColor(request.status)}>
                          {request.status}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          {getTimeRemaining(request.expiresAt)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(request.createdAt)}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">From:</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{request.currentEmail}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">To:</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{request.newEmail}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Reason:</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                        {request.reason}
                      </p>
                    </div>

                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <div className="flex items-center space-x-1">
                        <User className="h-3 w-3" />
                        <span>ID: {request.userId.slice(0, 8)}...</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span>Attempts: {request.attempts}/{request.maxAttempts}</span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {selectedRequest?.id === request.id && (
                    <div className="mt-6 pt-4 border-t space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <h4 className="font-medium mb-2">Request Details</h4>
                          <div className="space-y-1 text-gray-600 dark:text-gray-400">
                            <p><strong>Request ID:</strong> {selectedRequest.id}</p>
                            <p><strong>IP Address:</strong> {selectedRequest.clientIp}</p>
                            <p><strong>User Agent:</strong> {selectedRequest.userAgent}</p>
                            <p><strong>Device Fingerprint:</strong> {selectedRequest.deviceFingerprint.slice(0, 16)}...</p>
                          </div>
                        </div>
                        
                        {selectedRequest.user && (
                          <div>
                            <h4 className="font-medium mb-2">User Information</h4>
                            <div className="space-y-1 text-gray-600 dark:text-gray-400">
                              <p><strong>User ID:</strong> {selectedRequest.user.id}</p>
                              <p><strong>Username:</strong> {selectedRequest.user.username || 'N/A'}</p>
                              <p><strong>Account Created:</strong> {formatDate(selectedRequest.user.createdAt)}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Full Reason</h4>
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border text-sm">
                          {selectedRequest.reason}
                        </div>
                      </div>

                      {selectedRequest.securityAnswers && (
                        <div>
                          <h4 className="font-medium mb-2 flex items-center space-x-1">
                            <Shield className="h-4 w-4" />
                            <span>Security Questions Provided</span>
                          </h4>
                          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-300">
                            User provided answers to security questions (encrypted)
                          </div>
                        </div>
                      )}

                      {/* Review Actions */}
                      <div className="space-y-4 pt-4 border-t">
                        <div>
                          <label htmlFor="admin-notes" className="block text-sm font-medium mb-2">Admin Notes (Optional)</label>
                          <Textarea
                            id="admin-notes"
                            value={reviewNotes}
                            onChange={(e) => setReviewNotes(e.target.value)}
                            placeholder="Add notes about your decision..."
                            rows={3}
                            className="w-full"
                          />
                        </div>

                        <div className="flex space-x-3">
                          <Button
                            onClick={() => handleReview('approve')}
                            disabled={reviewLoading}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            {reviewLoading && reviewAction === 'approve' ? 'Approving...' : 'Approve'}
                          </Button>
                          <Button
                            onClick={() => handleReview('reject')}
                            disabled={reviewLoading}
                            variant="destructive"
                          >
                            <X className="h-4 w-4 mr-2" />
                            {reviewLoading && reviewAction === 'reject' ? 'Rejecting...' : 'Reject'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}