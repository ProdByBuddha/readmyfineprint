import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Download,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Shield,
  Lock,
  Globe,
  Eye,
  Clock,
  Users,
  Database,
  Settings,
  BookOpen,
  PieChart,
  BarChart3,
  Zap,
  RefreshCw
} from "lucide-react";
import { sessionFetch } from "@/lib/sessionManager";

interface ComplianceReport {
  id: string;
  reportType: string;
  standard: string;
  generatedDate: string;
  period: string;
  status: 'completed' | 'pending' | 'in_progress';
  findings: number;
  complianceScore: number;
  downloadUrl?: string;
}

interface ComplianceStandard {
  name: string;
  fullName: string;
  description: string;
  currentScore: number;
  lastAssessment: string;
  nextAssessment: string;
  requirements: Array<{
    id: string;
    requirement: string;
    status: 'compliant' | 'non_compliant' | 'partially_compliant';
    lastChecked: string;
    notes?: string;
  }>;
}

interface DataProcessingActivity {
  id: string;
  activityName: string;
  dataTypes: string[];
  purpose: string;
  legalBasis: string;
  retentionPeriod: string;
  dataSubjects: string[];
  recipients: string[];
  transfersOutsideEU: boolean;
  lastReviewed: string;
  status: 'active' | 'inactive' | 'under_review';
}

export default function ComplianceReporting() {
  const [selectedStandard, setSelectedStandard] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('current');
  const [currentTime, setCurrentTime] = useState(new Date());
  const { toast } = useToast();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  // Fetch compliance standards (mock data since endpoint doesn't exist)
  const { data: complianceStandards, isLoading: standardsLoading } = useQuery({
    queryKey: ["/api/admin/compliance-standards-mock"],
    queryFn: async () => {
      // Mock compliance standards data since endpoint doesn't exist
      await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
      return [
        {
          name: 'GDPR',
          fullName: 'General Data Protection Regulation',
          description: 'EU regulation for data protection and privacy',
          currentScore: 98,
          lastAssessment: '2024-11-15',
          nextAssessment: '2025-02-15',
          requirements: [
            { id: '1', requirement: 'Data Processing Lawfulness', status: 'compliant', lastChecked: '2024-11-15' },
            { id: '2', requirement: 'Data Subject Rights', status: 'compliant', lastChecked: '2024-11-15' },
            { id: '3', requirement: 'Data Breach Notification', status: 'compliant', lastChecked: '2024-11-15' },
            { id: '4', requirement: 'Privacy by Design', status: 'partially_compliant', lastChecked: '2024-11-15', notes: 'Minor improvements needed in data minimization' },
            { id: '5', requirement: 'Data Protection Impact Assessment', status: 'compliant', lastChecked: '2024-11-15' }
          ]
        },
        {
          name: 'CCPA',
          fullName: 'California Consumer Privacy Act',
          description: 'California state privacy law',
          currentScore: 95,
          lastAssessment: '2024-11-10',
          nextAssessment: '2025-02-10',
          requirements: [
            { id: '1', requirement: 'Consumer Right to Know', status: 'compliant', lastChecked: '2024-11-10' },
            { id: '2', requirement: 'Consumer Right to Delete', status: 'compliant', lastChecked: '2024-11-10' },
            { id: '3', requirement: 'Consumer Right to Opt-out', status: 'compliant', lastChecked: '2024-11-10' },
            { id: '4', requirement: 'Non-discrimination', status: 'compliant', lastChecked: '2024-11-10' }
          ]
        },
        {
          name: 'SOC2',
          fullName: 'Service Organization Control 2',
          description: 'Security, availability, processing integrity framework',
          currentScore: 92,
          lastAssessment: '2024-10-20',
          nextAssessment: '2025-01-20',
          requirements: [
            { id: '1', requirement: 'Security Controls', status: 'compliant', lastChecked: '2024-10-20' },
            { id: '2', requirement: 'Availability Controls', status: 'compliant', lastChecked: '2024-10-20' },
            { id: '3', requirement: 'Processing Integrity', status: 'partially_compliant', lastChecked: '2024-10-20', notes: 'Minor logging improvements needed' },
            { id: '4', requirement: 'Confidentiality Controls', status: 'compliant', lastChecked: '2024-10-20' }
          ]
        },
        {
          name: 'HIPAA',
          fullName: 'Health Insurance Portability and Accountability Act',
          description: 'US healthcare data privacy and security',
          currentScore: 89,
          lastAssessment: '2024-11-01',
          nextAssessment: '2025-02-01',
          requirements: [
            { id: '1', requirement: 'Administrative Safeguards', status: 'compliant', lastChecked: '2024-11-01' },
            { id: '2', requirement: 'Physical Safeguards', status: 'compliant', lastChecked: '2024-11-01' },
            { id: '3', requirement: 'Technical Safeguards', status: 'partially_compliant', lastChecked: '2024-11-01', notes: 'Encryption key rotation needs improvement' }
          ]
        }
      ];
    }
  });

  // Fetch compliance reports (mock data since endpoint doesn't exist)
  const { data: complianceReports, isLoading: reportsLoading, refetch: refetchReports } = useQuery({
    queryKey: ["/api/admin/compliance-reports-mock", selectedStandard, selectedPeriod],
    queryFn: async () => {
      // Mock compliance reports data since endpoint doesn't exist
      await new Promise(resolve => setTimeout(resolve, 400)); // Simulate network delay
      return [
        {
          id: '1',
          reportType: 'Privacy Impact Assessment',
          standard: 'GDPR',
          generatedDate: '2024-11-15',
          period: 'Q4 2024',
          status: 'completed',
          findings: 2,
          complianceScore: 98,
          downloadUrl: '/reports/gdpr-pia-q4-2024.pdf'
        },
        {
          id: '2',
          reportType: 'SOC 2 Type II',
          standard: 'SOC2',
          generatedDate: '2024-10-20',
          period: 'Q3 2024',
          status: 'completed',
          findings: 3,
          complianceScore: 92,
          downloadUrl: '/reports/soc2-type2-q3-2024.pdf'
        },
        {
          id: '3',
          reportType: 'CCPA Consumer Request Log',
          standard: 'CCPA',
          generatedDate: '2024-11-10',
          period: 'October 2024',
          status: 'completed',
          findings: 0,
          complianceScore: 100,
          downloadUrl: '/reports/ccpa-consumer-log-oct-2024.pdf'
        },
        {
          id: '4',
          reportType: 'Quarterly Security Assessment',
          standard: 'SOC2',
          generatedDate: '2024-12-01',
          period: 'Q4 2024',
          status: 'in_progress',
          findings: 0,
          complianceScore: 0
        }
      ];
    },
    refetchInterval: 30000
  });

  // Fetch data processing activities (mock data since endpoint doesn't exist)
  const { data: dataProcessingActivities, isLoading: activitiesLoading } = useQuery({
    queryKey: ["/api/admin/data-processing-activities-mock"],
    queryFn: async () => {
      // Mock data processing activities since endpoint doesn't exist
      await new Promise(resolve => setTimeout(resolve, 350)); // Simulate network delay
      return [
        {
          id: '1',
          activityName: 'Document Analysis Processing',
          dataTypes: ['Document content', 'User metadata', 'Processing logs'],
          purpose: 'Legal document analysis and summarization',
          legalBasis: 'Legitimate interest (Art. 6(1)(f))',
          retentionPeriod: '30 days for processing, 1 year for logs',
          dataSubjects: ['Registered users', 'Anonymous users'],
          recipients: ['OpenAI API (for processing)', 'Internal analytics team'],
          transfersOutsideEU: true,
          lastReviewed: '2024-11-01',
          status: 'active'
        },
        {
          id: '2',
          activityName: 'User Account Management',
          dataTypes: ['Email addresses', 'Authentication data', 'User preferences'],
          purpose: 'User registration, authentication, and account management',
          legalBasis: 'Contract performance (Art. 6(1)(b))',
          retentionPeriod: 'Duration of account + 3 years',
          dataSubjects: ['Registered users'],
          recipients: ['Internal systems only'],
          transfersOutsideEU: false,
          lastReviewed: '2024-10-15',
          status: 'active'
        },
        {
          id: '3',
          activityName: 'Subscription Management',
          dataTypes: ['Payment information', 'Subscription status', 'Usage metrics'],
          purpose: 'Subscription billing and service provision',
          legalBasis: 'Contract performance (Art. 6(1)(b))',
          retentionPeriod: '7 years (financial records)',
          dataSubjects: ['Subscribed users'],
          recipients: ['Stripe (payment processor)', 'Internal billing team'],
          transfersOutsideEU: true,
          lastReviewed: '2024-11-05',
          status: 'active'
        }
      ];
    }
  });

  // Generate report mutation
  const generateReportMutation = useMutation({
    mutationFn: async ({ reportType, standard, period }: { reportType: string, standard: string, period: string }) => {
      const response = await sessionFetch('/api/admin/generate-compliance-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType, standard, period })
      });
      
      if (!response.ok) throw new Error('Failed to generate report');
      return response.json();
    },
    onSuccess: () => {
      refetchReports();
      toast({
        title: "Report Generation Started",
        description: "Your compliance report is being generated and will be available shortly",
      });
    },
    onError: () => {
      toast({
        title: "Report Generation Failed",
        description: "Failed to start report generation. Please try again.",
        variant: "destructive"
      });
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant':
      case 'completed':
      case 'active':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'partially_compliant':
      case 'in_progress':
      case 'under_review':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'non_compliant':
      case 'pending':
      case 'inactive':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'compliant':
      case 'completed':
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'partially_compliant':
      case 'in_progress':
      case 'under_review':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
    }
  };

  const getComplianceScoreColor = (score: number) => {
    if (score >= 95) return 'text-green-600';
    if (score >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleGenerateReport = (reportType: string, standard: string) => {
    generateReportMutation.mutate({
      reportType,
      standard,
      period: 'current'
    });
  };

  return (
    <div className="space-y-6" data-testid="compliance-reporting">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Compliance Reporting</h2>
          <p className="text-slate-600 dark:text-slate-400">
            Regulatory compliance monitoring and reporting • Last updated: {currentTime.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={selectedStandard} onValueChange={setSelectedStandard}>
            <SelectTrigger className="w-40" data-testid="select-standard">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Standards</SelectItem>
              <SelectItem value="GDPR">GDPR</SelectItem>
              <SelectItem value="CCPA">CCPA</SelectItem>
              <SelectItem value="SOC2">SOC 2</SelectItem>
              <SelectItem value="HIPAA">HIPAA</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" data-testid="button-refresh-compliance">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Compliance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {complianceStandards?.map((standard) => (
          <Card key={standard.name} className="border-0 shadow-md" data-testid={`card-${standard.name.toLowerCase()}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <Badge variant="outline" className={getComplianceScoreColor(standard.currentScore) + ' bg-white'}>
                  {standard.currentScore}%
                </Badge>
              </div>
              <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {standard.fullName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Progress value={standard.currentScore} className={`h-2 ${standard.currentScore >= 95 ? '[&>div]:bg-green-500' : standard.currentScore >= 85 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-red-500'}`} />
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Last: {new Date(standard.lastAssessment).toLocaleDateString()}</span>
                  <span>Next: {new Date(standard.nextAssessment).toLocaleDateString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Compliance Standards Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Standards Requirements */}
        <Card className="border-0 shadow-md" data-testid="card-requirements">
          <CardHeader className="border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <BookOpen className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">Requirements Status</CardTitle>
                <p className="text-sm text-slate-500">Current compliance requirements assessment</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {complianceStandards?.map((standard) => (
                <div key={standard.name} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-slate-900 dark:text-slate-100">{standard.name}</h3>
                    <Badge variant="outline" className={getComplianceScoreColor(standard.currentScore) + ' bg-white'}>
                      {standard.currentScore}%
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {standard.requirements.map((req) => (
                      <div key={req.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded">
                        <div className="flex items-center space-x-2 flex-1">
                          {getStatusIcon(req.status)}
                          <span className="text-sm text-slate-900 dark:text-slate-100">{req.requirement}</span>
                        </div>
                        <Badge variant="outline" className={`text-xs ${getStatusColor(req.status)}`}>
                          {req.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Reports */}
        <Card className="border-0 shadow-md" data-testid="card-reports">
          <CardHeader className="border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <FileText className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold">Compliance Reports</CardTitle>
                  <p className="text-sm text-slate-500">Generated compliance documentation</p>
                </div>
              </div>
              <Button variant="outline" size="sm" data-testid="button-generate-report">
                <PieChart className="h-4 w-4 mr-2" />
                Generate Report
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {complianceReports?.map((report) => (
                <div key={report.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs">
                        {report.standard}
                      </Badge>
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {report.reportType}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-slate-500">
                      <span>{report.period}</span>
                      <span>•</span>
                      <span>{new Date(report.generatedDate).toLocaleDateString()}</span>
                      {report.findings > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-orange-600">{report.findings} findings</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className={getStatusColor(report.status)}>
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(report.status)}
                        <span>{report.status.replace('_', ' ')}</span>
                      </div>
                    </Badge>
                    {report.downloadUrl && (
                      <Button variant="outline" size="sm" data-testid={`button-download-${report.id}`}>
                        <Download className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              )) || (
                <div className="text-center text-slate-500 py-8">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No compliance reports available</p>
                  <p className="text-sm mt-1">Generate your first compliance report above</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Processing Activities */}
      <Card className="border-0 shadow-md" data-testid="card-data-processing">
        <CardHeader className="border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <Database className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Data Processing Activities</CardTitle>
              <p className="text-sm text-slate-500">GDPR Article 30 - Record of Processing Activities</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Activity Name</TableHead>
                  <TableHead>Data Types</TableHead>
                  <TableHead>Legal Basis</TableHead>
                  <TableHead>EU Transfers</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Reviewed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dataProcessingActivities?.map((activity) => (
                  <TableRow key={activity.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <TableCell className="font-medium" data-testid={`activity-${activity.id}`}>
                      {activity.activityName}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {activity.dataTypes.slice(0, 2).map((type, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {type}
                          </Badge>
                        ))}
                        {activity.dataTypes.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{activity.dataTypes.length - 2} more
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {activity.legalBasis}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={activity.transfersOutsideEU ? 'text-orange-700 bg-orange-50' : 'text-green-700 bg-green-50'}>
                        {activity.transfersOutsideEU ? 'Yes' : 'No'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(activity.status)}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(activity.status)}
                          <span>{activity.status.replace('_', ' ')}</span>
                        </div>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {new Date(activity.lastReviewed).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="border-0 shadow-md" data-testid="card-quick-actions">
        <CardHeader className="border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <Zap className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
              <p className="text-sm text-slate-500">Common compliance management tasks</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="h-20 flex flex-col space-y-2"
              onClick={() => handleGenerateReport('Privacy Impact Assessment', 'GDPR')}
              data-testid="button-generate-pia"
            >
              <Shield className="h-6 w-6" />
              <span className="text-xs">Generate PIA</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex flex-col space-y-2"
              onClick={() => handleGenerateReport('Data Audit Report', 'all')}
              data-testid="button-data-audit"
            >
              <Database className="h-6 w-6" />
              <span className="text-xs">Data Audit</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex flex-col space-y-2"
              data-testid="button-security-assessment"
            >
              <Lock className="h-6 w-6" />
              <span className="text-xs">Security Assessment</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex flex-col space-y-2"
              data-testid="button-export-activities"
            >
              <Download className="h-6 w-6" />
              <span className="text-xs">Export Activities</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}