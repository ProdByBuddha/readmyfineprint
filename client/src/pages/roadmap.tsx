import { CheckCircle, Clock, Target, ArrowLeft, Zap, Shield, Globe, Users, Brain, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const roadmapItems = [
  {
    quarter: "Q1 2025",
    status: "completed",
    items: [
      {
        title: "Advanced Legal Document Analysis",
        description: "AI-powered analysis of complex legal documents with risk assessment and key findings extraction",
        icon: Brain,
        status: "completed"
      },
      {
        title: "Secure File Processing",
        description: "End-to-end encrypted file upload and processing with comprehensive security logging",
        icon: Shield,
        status: "completed"
      },
      {
        title: "PDF Export with QR Donations",
        description: "Professional PDF export with integrated donation QR codes for sustainable funding",
        icon: FileText,
        status: "completed"
      }
    ]
  },
  {
    quarter: "Q2 2025",
    status: "in-progress",
    items: [
      {
        title: "Multi-Language Document Support",
        description: "Support for analyzing legal documents in Spanish, French, German, and other major languages",
        icon: Globe,
        status: "in-progress"
      },
      {
        title: "Real-time Collaboration",
        description: "Share document analysis with team members and collaborate on reviews in real-time",
        icon: Users,
        status: "planned"
      },
      {
        title: "Enhanced Mobile Experience",
        description: "Optimized mobile interface with improved touch interactions and responsive design",
        icon: Zap,
        status: "planned"
      }
    ]
  },
  {
    quarter: "Q3 2025",
    status: "planned",
    items: [
      {
        title: "Contract Comparison Tool",
        description: "Side-by-side comparison of multiple contracts with highlighted differences and recommendations",
        icon: Target,
        status: "planned"
      },
      {
        title: "API Access for Developers",
        description: "RESTful API for integrating document analysis capabilities into third-party applications",
        icon: Zap,
        status: "planned"
      },
      {
        title: "Advanced Search & Organization",
        description: "Search through analyzed documents with filters, tags, and advanced organization features",
        icon: FileText,
        status: "planned"
      }
    ]
  },
  {
    quarter: "Q4 2025",
    status: "planned",
    items: [
      {
        title: "Legal Template Library",
        description: "Curated library of legal document templates with pre-configured analysis rules",
        icon: FileText,
        status: "planned"
      },
      {
        title: "Compliance Monitoring",
        description: "Automated monitoring for regulatory changes that might affect your analyzed documents",
        icon: Shield,
        status: "planned"
      },
      {
        title: "Enterprise Features",
        description: "Advanced user management, custom branding, and dedicated support for organizations",
        icon: Users,
        status: "planned"
      }
    ]
  }
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case "completed":
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Completed</Badge>;
    case "in-progress":
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">In Progress</Badge>;
    case "planned":
      return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">Planned</Badge>;
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
      return <Target className="w-5 h-5 text-gray-600 dark:text-gray-400" />;
    default:
      return null;
  }
};

export default function Roadmap() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-slate-900 dark:to-slate-800">
      <Header />
      <div className="p-4 pb-40 md:pb-40">
        <div className="max-w-6xl mx-auto pt-24">
          {/* Header Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/20 dark:bg-primary/30 rounded-full mb-4">
              <Target className="w-8 h-8 text-primary dark:text-primary" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Development Roadmap
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Our commitment to making legal documents more accessible through continuous innovation and feature development.
            </p>
          </div>

          {/* Back to Donate Button */}
          <div className="mb-8">
            <Link to="/donate">
              <Button variant="outline" className="inline-flex items-center">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Donate
              </Button>
            </Link>
          </div>

          {/* Roadmap Timeline */}
          <div className="space-y-8">
            {roadmapItems.map((quarter, quarterIndex) => (
              <div key={quarter.quarter} className="relative">
                {/* Quarter Header */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(quarter.status)}
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {quarter.quarter}
                    </h2>
                  </div>
                  {getStatusBadge(quarter.status)}
                </div>

                {/* Items Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {quarter.items.map((item, itemIndex) => {
                    const IconComponent = item.icon;
                    return (
                      <Card key={itemIndex} className="h-full">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center">
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
                          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                            {item.description}
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Timeline Connector */}
                {quarterIndex < roadmapItems.length - 1 && (
                  <div className="flex justify-center mb-8">
                    <div className="w-px h-8 bg-gray-300 dark:bg-gray-600"></div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Call to Action */}
          <Card className="mt-12 bg-gradient-to-r from-primary/5 to-secondary/5 dark:from-primary/10 dark:to-secondary/10 border-primary/20 dark:border-primary/30">
            <CardContent className="p-8 text-center">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Help Us Build the Future
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-2xl mx-auto">
                Your donations directly fund the development of these features. Every contribution helps us maintain free access 
                while building the tools that make legal documents more accessible to everyone.
              </p>
              <Link to="/donate">
                <Button size="lg" className="px-8">
                  Support Our Mission
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  );
}