import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TouchScrollContainer } from "@/components/TouchScrollContainer";
import { 
  Shield,
  Target,
  Users,
  Globe,
  Brain,
  FileText,
  Lock,
  Zap,
  Heart,
  Building,
  Mail,
  CheckCircle,
  Award,
  TrendingUp,
  BookOpen,
  Code,
  Scale,
  Eye,
  ArrowRight
} from "lucide-react";
import { Link } from "react-router-dom";
import { useSEO } from "@/lib/seo";

const teamMembers = [
  {
    name: "Development Team",
    role: "Engineering & AI Development",
    description: "Full-stack developers and AI engineers focused on building privacy-first legal technology solutions.",
    icon: Code,
    focus: "Product Development"
  },
  {
    name: "Security Team", 
    role: "Privacy & Security Engineering",
    description: "Cybersecurity experts ensuring enterprise-grade data protection and compliance standards.",
    icon: Shield,
    focus: "Data Protection"
  },
  {
    name: "Legal Advisory",
    role: "Legal Technology Consultants",
    description: "Legal professionals providing guidance on compliance requirements and user needs.",
    icon: Scale,
    focus: "Legal Compliance"
  },
  {
    name: "Product Team",
    role: "User Experience & Strategy",
    description: "Designers and strategists focused on making legal documents accessible to everyone.",
    icon: Users,
    focus: "User Experience"
  }
];

const coreValues = [
  {
    title: "Privacy by Design",
    description: "Every feature is built with privacy as the foundation, not an afterthought. Your documents and personal information are protected at every layer.",
    icon: Shield,
    details: [
      "Zero permanent document storage",
      "Automatic PII detection and protection",
      "End-to-end encryption for all communications",
      "GDPR/CCPA compliant by design"
    ]
  },
  {
    title: "Transparency & Trust",
    description: "Open about our practices, clear about our policies, and committed to building trust through consistent action and transparency.",
    icon: Eye,
    details: [
      "Open-source components where possible",
      "Clear privacy and data practices",
      "Regular security audits and reports",
      "Transparent development roadmap"
    ]
  },
  {
    title: "Accessibility First",
    description: "Legal documents shouldn't require a law degree to understand. We make complex legal language accessible to everyone.",
    icon: BookOpen,
    details: [
      "Plain English explanations",
      "Risk assessment and key findings",
      "Mobile-optimized experience",
      "WCAG accessibility compliance"
    ]
  },
  {
    title: "Enterprise Security",
    description: "Banking-level security standards with enterprise-grade compliance for businesses of all sizes.",
    icon: Lock,
    details: [
      "SOC 2 Type II compliance pathway",
      "OWASP ASVS Level 1 implementation",
      "Multi-factor authentication support",
      "Advanced threat monitoring"
    ]
  }
];

const achievements = [
  {
    title: "Privacy Protection",
    description: "Industry-leading PII detection with 90%+ accuracy across 7+ data types",
    icon: Shield,
    metric: "90%+ Accuracy"
  },
  {
    title: "Security Compliance",
    description: "Comprehensive OWASP ASVS Level 1 security implementation",
    icon: Award,
    metric: "82% ASVS Compliance"
  },
  {
    title: "User Trust",
    description: "Zero permanent document storage with session-based processing",
    icon: Heart,
    metric: "0 Minutes"
  },
  {
    title: "Response Time", 
    description: "Security team monitoring with 24/7 critical issue response",
    icon: Zap,
    metric: "24/7 Monitoring"
  }
];

export default function About() {
  // SEO implementation for About page
  useSEO('/about', {
    title: 'About ReadMyFinePrint - Privacy-First Legal Document Analysis',
    description: 'Learn about ReadMyFinePrint\'s mission to make legal documents accessible and secure. Discover our privacy-by-design approach, expert team, and commitment to legal transparency.',
    keywords: 'about readmyfineprint, legal document analysis, privacy by design, legal tech company, document security, AI legal assistant, legal transparency',
    canonical: 'https://readmyfineprint.com/about',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      "name": "About ReadMyFinePrint",
      "description": "Information about ReadMyFinePrint, the privacy-first legal document analysis platform",
      "url": "https://readmyfineprint.com/about",
      "mainEntity": {
        "@type": "Organization",
        "name": "ReadMyFinePrint",
        "description": "Privacy-first AI platform for legal document analysis and understanding",
        "foundingDate": "2025",
        "url": "https://readmyfineprint.com",
        "knowsAbout": [
          "Legal Document Analysis",
          "Privacy Protection",
          "AI Technology",
          "Legal Technology",
          "Document Security"
        ],
        "hasOfferCatalog": {
          "@type": "OfferCatalog",
          "name": "Legal Document Analysis Services",
          "itemListElement": [
            {
              "@type": "Offer",
              "itemOffered": {
                "@type": "Service",
                "name": "Legal Document Analysis",
                "description": "AI-powered analysis of legal documents with privacy protection"
              }
            }
          ]
        }
      }
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-blue-950 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5 dark:opacity-10"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5"></div>
      
      <TouchScrollContainer className="relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          
          {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary/20 to-secondary/20 dark:from-primary/30 dark:to-secondary/30 rounded-full mb-6">
            <FileText className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            About ReadMyFinePrint
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-4xl mx-auto leading-relaxed">
            We're on a mission to make legal documents accessible, understandable, and secure for everyone. 
            Our privacy-first AI platform helps individuals and businesses navigate complex legal language 
            with confidence and complete data protection.
          </p>
        </div>

        {/* Mission Statement */}
        <Card className="mb-12 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
          <CardContent className="p-8">
            <div className="text-center">
              <Target className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Our Mission</h2>
              <p className="text-lg text-gray-700 dark:text-gray-300 max-w-4xl mx-auto leading-relaxed">
                <strong>To democratize legal understanding</strong> by providing AI-powered document analysis 
                that protects your privacy while making complex legal language clear and actionable. We believe 
                everyone deserves to understand the agreements they sign without compromising their personal data.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Key Achievements */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-8">
            What Sets Us Apart
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {achievements.map((achievement, index) => {
              const IconComponent = achievement.icon;
              return (
                <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary/10 to-secondary/10 dark:from-primary/20 dark:to-secondary/20 rounded-full mb-4">
                      <IconComponent className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">
                      {achievement.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {achievement.description}
                    </p>
                    <Badge className="bg-primary/10 text-primary border-primary/20">
                      {achievement.metric}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Core Values */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
            Our Core Values
          </h2>
          <div className="grid lg:grid-cols-2 gap-8">
            {coreValues.map((value, index) => {
              const IconComponent = value.icon;
              return (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-primary/10 to-secondary/10 dark:from-primary/20 dark:to-secondary/20 rounded-lg flex items-center justify-center">
                        <IconComponent className="w-6 h-6 text-primary" />
                      </div>
                      {value.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
                      {value.description}
                    </p>
                    <ul className="space-y-2">
                      {value.details.map((detail, detailIndex) => (
                        <li key={detailIndex} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                          <span className="text-gray-600 dark:text-gray-400">{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Company Information */}
        <div className="grid lg:grid-cols-2 gap-8 mb-16">
          {/* Company Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                Company Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Legal Entity</h4>
                <p className="text-gray-600 dark:text-gray-400">
                  <strong>Nexus Integrated Technologies</strong><br />
                  (Doing Business As: ReadMyFinePrint)
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Headquarters</h4>
                <p className="text-gray-600 dark:text-gray-400">
                  California, United States
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Founded</h4>
                <p className="text-gray-600 dark:text-gray-400">
                  2024 - Privacy-First Legal Technology
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Industry Focus</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Legal Technology</Badge>
                  <Badge variant="outline">Privacy Engineering</Badge>
                  <Badge variant="outline">AI/ML Applications</Badge>
                  <Badge variant="outline">Enterprise SaaS</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Technical Approach */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                Technology & Approach
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Privacy Architecture</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Session-based processing with zero permanent document storage. 
                  Advanced PII detection ensures your sensitive information never reaches external AI services.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">AI Technology</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  State-of-the-art language models combined with privacy-first redaction technology 
                  for accurate analysis without compromising your data.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Security Standards</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Enterprise-grade security with OWASP ASVS Level 1 compliance, SOC 2 pathway, 
                  and comprehensive threat monitoring.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">User Experience</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Accessible, mobile-responsive design with clear explanations and actionable insights 
                  that make legal documents understandable for everyone.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Team Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-8">
            Our Team
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto">
            ReadMyFinePrint is built by a diverse team of engineers, security experts, legal professionals, 
            and designers united by a shared mission to make legal documents more accessible while 
            protecting user privacy.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {teamMembers.map((member, index) => {
              const IconComponent = member.icon;
              return (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-primary/10 to-secondary/10 dark:from-primary/20 dark:to-secondary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <IconComponent className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-1">
                          {member.name}
                        </h3>
                        <p className="text-sm text-primary font-medium mb-2">
                          {member.role}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          {member.description}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          Focus: {member.focus}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Future Vision */}
        <Card className="mb-12 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border-purple-200 dark:border-purple-800">
          <CardContent className="p-8">
            <div className="text-center">
              <TrendingUp className="w-12 h-12 text-purple-600 dark:text-purple-400 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Looking Ahead</h2>
              <p className="text-lg text-gray-700 dark:text-gray-300 max-w-4xl mx-auto leading-relaxed mb-8">
                We're building the future of legal technology with enterprise-grade features like API access, 
                white-label solutions, multi-language support, and advanced AI capabilities. Our roadmap 
                focuses on making legal documents even more accessible while maintaining our privacy-first principles.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/roadmap">
                  <Button size="lg" className="px-8" data-testid="button-view-roadmap">
                    <Target className="w-4 h-4 mr-2" />
                    View Our Roadmap
                  </Button>
                </Link>
                <Link to="/contact">
                  <Button size="lg" variant="outline" className="px-8" data-testid="button-contact-us">
                    <Users className="w-4 h-4 mr-2" />
                    Get in Touch
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
            <CardContent className="p-6 text-center">
              <Heart className="w-12 h-12 text-green-600 dark:text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                Support Our Mission
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Help us keep legal documents accessible for everyone through community support and contributions.
              </p>
              <Link to="/donate">
                <Button className="w-full" data-testid="button-donate">
                  Support ReadMyFinePrint
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
            <CardContent className="p-6 text-center">
              <Building className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                Enterprise Solutions
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Discover enterprise-grade features, custom deployments, and business solutions for your organization.
              </p>
              <Link to="/contact">
                <Button variant="outline" className="w-full" data-testid="button-enterprise">
                  Contact Sales Team
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Contact Information */}
        <Card className="mt-8">
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Questions About ReadMyFinePrint?
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              We're here to help. Reach out to our team for support, enterprise inquiries, 
              security questions, or general feedback.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <a 
                href="mailto:admin@readmyfineprint.com" 
                className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <Mail className="w-4 h-4" />
                General: admin@readmyfineprint.com
              </a>
              <a 
                href="mailto:security@readmyfineprint.com" 
                className="text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
              >
                <Shield className="w-4 h-4" />
                Security: security@readmyfineprint.com
              </a>
              <a 
                href="mailto:sales@readmyfineprint.com" 
                className="text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
              >
                <Building className="w-4 h-4" />
                Business: sales@readmyfineprint.com
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </TouchScrollContainer>
    </div>
  );
}