import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, FileText, Download, Gavel } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

interface LawEnforcementRequestProps {
  adminToken: string;
}

const LawEnforcementRequest: React.FC<LawEnforcementRequestProps> = ({ adminToken }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState({
    requestType: '',
    targetIdentifier: '',
    legalBasis: '',
    requestingAgency: '',
    contactOfficer: '',
    urgencyLevel: 'routine',
    notes: ''
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/law-enforcement-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-subscription-token': adminToken
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      // Get filename from response headers
      const contentDisposition = response.headers.get('Content-Disposition');
      const requestId = response.headers.get('X-Request-ID');
      const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || 
                      `law-enforcement-request-${requestId}-${new Date().toISOString().split('T')[0]}.json`;

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Request Processed",
        description: `Law enforcement data request completed. Request ID: ${requestId}`,
      });

      // Reset form
      setFormData({
        requestType: '',
        targetIdentifier: '',
        legalBasis: '',
        requestingAgency: '',
        contactOfficer: '',
        urgencyLevel: 'routine',
        notes: ''
      });
      setShowDialog(false);

    } catch (error) {
      console.error('Law enforcement request error:', error);
      toast({
        title: "Request Failed",
        description: error instanceof Error ? error.message : "Failed to process request",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center space-x-2 border-orange-200 text-orange-700 hover:bg-orange-50">
          <Gavel className="h-4 w-4" />
          <span>Law Enforcement Request</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl bg-background dark:bg-gray-800">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-orange-600" />
            <span>Law Enforcement Data Request</span>
          </DialogTitle>
          <DialogDescription>
            Process lawful data requests from government agencies and law enforcement.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-900/30" dark:text-gray-100>
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800 dark:text-orange-200">
            <strong>Legal Authorization Required:</strong> Only process requests with proper legal documentation (court orders, warrants, subpoenas, etc.).
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="requestType">Request Type *</Label>
              <Select value={formData.requestType} onValueChange={(value) => handleInputChange('requestType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select request type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user_data">User Data</SelectItem>
                  <SelectItem value="audit_logs">Audit Logs</SelectItem>
                  <SelectItem value="communication_records">Communication Records</SelectItem>
                  <SelectItem value="financial_records">Financial Records</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="urgencyLevel">Urgency Level *</Label>
              <Select value={formData.urgencyLevel} onValueChange={(value) => handleInputChange('urgencyLevel', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">Routine</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="targetIdentifier">Target User (Email or User ID) *</Label>
            <Input
              id="targetIdentifier"
              value={formData.targetIdentifier}
              onChange={(e) => handleInputChange('targetIdentifier', e.target.value)}
              placeholder="user@example.com or user-id"
              required
            />
          </div>

          <div>
            <Label htmlFor="legalBasis">Legal Basis (Court Order, Warrant #, etc.) *</Label>
            <Input
              id="legalBasis"
              value={formData.legalBasis}
              onChange={(e) => handleInputChange('legalBasis', e.target.value)}
              placeholder="Court Order #12345, Search Warrant SW-2024-001, etc."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="requestingAgency">Requesting Agency *</Label>
              <Input
                id="requestingAgency"
                value={formData.requestingAgency}
                onChange={(e) => handleInputChange('requestingAgency', e.target.value)}
                placeholder="FBI, Local PD, etc."
                required
              />
            </div>

            <div>
              <Label htmlFor="contactOfficer">Contact Officer *</Label>
              <Input
                id="contactOfficer"
                value={formData.contactOfficer}
                onChange={(e) => handleInputChange('contactOfficer', e.target.value)}
                placeholder="Detective Smith, Agent Johnson, etc."
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Case details, specific data requirements, contact information, etc."
              rows={3}
            />
          </div>

          <Card className="bg-gray-50 dark:bg-gray-900">
            <CardHeader>
              <CardTitle className="text-sm">Data Package Will Include</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs">Profile</Badge>
                  <span>Account information</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs">Security</Badge>
                  <span>Authentication logs</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs">Usage</Badge>
                  <span>Document analysis history</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs">Financial</Badge>
                  <span>Subscription & payment data</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
              <FileText className="h-4 w-4" />
              <span>Request will be logged for audit</span>
            </div>
            <div className="space-x-2">
              <Button 
                type="button"
                variant="outline" 
                onClick={() => setShowDialog(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={isSubmitting || !formData.requestType || !formData.targetIdentifier || !formData.legalBasis || !formData.requestingAgency || !formData.contactOfficer}
                className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>Process Request</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LawEnforcementRequest;