import { CheckCircle, Clock, Target, ArrowLeft, Zap, Shield, Globe, Users, Brain, FileText, Building, Key, Palette, BarChart3, GitBranch, Webhook, Crown, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

const roadmapItems = [
  {
    quarter: "Q1 2025",
    title: "Team Collaboration & Foundation",
    status: "in-progress",
    description: "Building the foundation for team-based workflows and enhanced collaboration features",
    targetTiers: ["Business", "Enterprise"],
    items: [
      {
        title: "Organization Management",
        description: "Create organizations, invite team members, and manage role-based access control with comprehensive usage tracking",
        icon: Building,
        status: "in-progress",
        details: ["Admin/Member/Viewer roles", "Email invitations", "Usage analytics", "Organization-wide document sharing"]
      },
      {
        title: "Shared Workspaces",
        description: "Organize documents into shared folders with granular permissions and collaborative annotations",
        icon: Users,
        status: "planned",
        details: ["Folder structure", "Granular permissions", "Activity feed", "Collaborative annotations"]
      },
      {
        title: "Advanced Document Analysis",
        description: "Enhanced AI-powered analysis with risk assessment, compliance checking, and key findings extraction",
        icon: Brain,
        status: "completed",
        details: ["Risk assessment", "Compliance checking", "Key findings", "Smart recommendations"]
      },
      {
        title: "Security Questions Requirement",
        description: "Enhanced account security with mandatory security questions for document processing operations",
        icon: Shield,
        status: "completed",
        details: ["Mandatory setup for new users", "Account recovery options", "Document operation protection", "Argon2 encrypted storage"]
      }
    ]
  },
  {
    quarter: "Q2 2025",
    title: "API Access & Enterprise Integration",
    status: "planned",
    description: "Professional-grade API access and enterprise-ready integration capabilities",
    targetTiers: ["Professional", "Business", "Enterprise"],
    items: [
      {
        title: "API Access System",
        description: "Complete API platform with key management, rate limiting, and comprehensive documentation",
        icon: Key,
        status: "planned",
        details: ["API key management", "Rate limiting by tier", "OpenAPI documentation", "Multi-language SDKs", "Usage analytics"]
      },
      {
        title: "SSO Integration",
        description: "Single Sign-On with major providers including SAML 2.0 and OAuth 2.0/OpenID Connect support",
        icon: Shield,
        status: "planned",
        details: ["Okta, Auth0, Azure AD", "Google Workspace", "User provisioning", "Group mapping"]
      },
      {
        title: "Webhooks & Integrations",
        description: "Real-time webhooks and pre-built integrations with popular workflow tools",
        icon: Webhook,
        status: "planned",
        details: ["Event notifications", "Retry logic", "Slack/Teams integration", "Zapier templates"]
      }
    ]
  },
  {
    quarter: "Q3 2025",
    title: "White-Label & Customization",
    status: "planned",
    description: "Brand customization and deployment flexibility for enterprise customers",
    targetTiers: ["Business", "Enterprise"],
    items: [
      {
        title: "White-Label Platform",
        description: "Complete branding customization with custom domains, logos, and color schemes",
        icon: Palette,
        status: "planned",
        details: ["Custom subdomains", "Logo & color themes", "Custom email templates", "Remove branding option"]
      },
      {
        title: "Multi-Language Support",
        description: "Comprehensive support for analyzing legal documents in multiple languages",
        icon: Globe,
        status: "planned",
        details: ["Spanish, French, German", "Additional EU languages", "Localized UI", "Regional compliance"]
      },
      {
        title: "Custom Deployment Options",
        description: "On-premise and private cloud deployment with enterprise-grade security",
        icon: Building,
        status: "planned",
        details: ["Docker/Kubernetes", "Private cloud guides", "Data residency", "Backup & recovery"]
      }
    ]
  },
  {
    quarter: "Q4 2025",
    title: "Advanced Features & Analytics",
    status: "planned",
    description: "Cutting-edge AI capabilities and comprehensive business intelligence",
    targetTiers: ["Enterprise"],
    items: [
      {
        title: "Model Fine-Tuning",
        description: "Custom AI models trained on your specific industry and document types",
        icon: Brain,
        status: "planned",
        details: ["Training data upload", "A/B testing", "Performance metrics", "Model versioning"]
      },
      {
        title: "Advanced Analytics & Reporting",
        description: "Interactive dashboards with customizable widgets and scheduled reports",
        icon: BarChart3,
        status: "planned",
        details: ["Custom dashboards", "Scheduled reports", "Export capabilities", "ROI analysis"]
      },
      {
        title: "Contract Comparison & Templates",
        description: "Side-by-side contract comparison and curated legal template library",
        icon: GitBranch,
        status: "planned",
        details: ["Document comparison", "Template library", "Pre-configured rules", "Version tracking"]
      }
    ]
  }
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case "completed":
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">✓ Completed</Badge>;
    case "in-progress":
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">🚧 In Progress</Badge>;
    case "planned":
      return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">📋 Planned</Badge>;
    default:
      return null;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />;
    case "in-progress":
      return <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
    case "planned":
      return <Target className="w-5 h-5 text-purple-600 dark:text-purple-400" />;
    default:
      return null;
  }
};

const getTierBadge = (tiers: string[]) => {
  const tierColors = {
    "Professional": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    "Business": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    "Enterprise": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
  };
  
  return (
    <div className="flex gap-1 flex-wrap">
      {tiers.map(tier => (
        <Badge key={tier} className={`text-xs ${tierColors[tier as keyof typeof tierColors]}`}>
          <Crown className="w-3 h-3 mr-1" />
          {tier}
        </Badge>
      ))}
    </div>
  );
};

export default function Roadmap() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 pb-40 md:pb-40">
      <div className="max-w-6xl mx-auto pt-8">
        {/* Header Section */}
        <div className="relative text-center mb-12">
          {/* Back to Donate Button - Top Right */}
          <div className="absolute top-0 right-0">
            <Link to="/donate">
              <Button variant="outline" className="inline-flex items-center">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Donate
              </Button>
            </Link>
          </div>
          
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary/20 to-secondary/20 dark:from-primary/30 dark:to-secondary/30 rounded-full mb-4">
            <Target className="w-8 h-8 text-primary dark:text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Development Roadmap
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-6">
            Our commitment to making legal documents more accessible through continuous innovation and feature development.
          </p>
          
          {/* Key Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">4</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Features Completed</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">2</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">In Development</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">10</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Features Planned</div>
            </div>
          </div>
        </div>

        {/* Roadmap Timeline */}
        <div className="space-y-12">
          {roadmapItems.map((quarter, quarterIndex) => (
            <div key={quarter.quarter} className="relative">
              {/* Quarter Header */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mb-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(quarter.status)}
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {quarter.quarter}
                      </h2>
                    </div>
                    {getStatusBadge(quarter.status)}
                  </div>
                  {quarter.targetTiers && (
                    <div className="flex flex-col items-start md:items-end gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Target Tiers:</span>
                      {getTierBadge(quarter.targetTiers)}
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {quarter.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    {quarter.description}
                  </p>
                </div>
              </div>

              {/* Items Grid */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {quarter.items.map((item, itemIndex) => {
                  const IconComponent = item.icon;
                  return (
                    <Card key={itemIndex} className="h-full hover:shadow-lg transition-shadow duration-300">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-primary/10 to-secondary/10 dark:from-primary/20 dark:to-secondary/20 rounded-lg flex items-center justify-center">
                              <IconComponent className="w-5 h-5 text-primary dark:text-primary" />
                            </div>
                            <div className="flex-1">
                              <CardTitle className="text-lg leading-tight">
                                {item.title}
                              </CardTitle>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            {getStatusIcon(item.status)}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                          {item.description}
                        </p>
                        {item.details && (
                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                              Key Features:
                            </h4>
                            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                              {item.details.map((detail, detailIndex) => (
                                <li key={detailIndex} className="flex items-center gap-2">
                                  <Star className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                                  {detail}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Timeline Connector */}
              {quarterIndex < roadmapItems.length - 1 && (
                <div className="flex justify-center mb-8">
                  <div className="w-px h-12 bg-gradient-to-b from-gray-300 to-gray-100 dark:from-gray-600 dark:to-gray-800"></div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Implementation Priority Section */}
        <Card className="mt-12 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
          <CardContent className="p-8">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
              Implementation Priority
            </h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Zap className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">High Priority</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  API Access, Organization Management, SSO Integration, Basic Webhooks
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Medium Priority</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Shared Workspaces, White-label Branding, Advanced Webhooks
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Target className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Future Features</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Model Fine-tuning, On-premise Deployment, Advanced Analytics
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <Card className="mt-12 bg-gradient-to-r from-primary/5 to-secondary/5 dark:from-primary/10 dark:to-secondary/10 border-primary/20 dark:border-primary/30">
          <CardContent className="p-8 text-center">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Help Us Build the Future of Legal Tech
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-2xl mx-auto">
              Your donations directly fund the development of these features. Every contribution helps us maintain free access 
              while building the tools that make legal documents more accessible to everyone.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/donate">
                <Button size="lg" className="px-8">
                  💝 Support Our Mission
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="px-8" onClick={() => window.open('mailto:admin@readmyfineprint.com?subject=Roadmap%20Feedback', '_blank')}>
                📧 Share Feedback
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}