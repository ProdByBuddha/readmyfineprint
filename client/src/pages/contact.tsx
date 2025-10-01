import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TouchScrollContainer } from "@/components/TouchScrollContainer";
import { 
  Mail, 
  Shield, 
  DollarSign, 
  FileText, 
  Users, 
  Clock, 
  MapPin, 
  Phone,
  Send,
  CheckCircle,
  AlertTriangle,
  Building,
  HeadphonesIcon
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/lib/seo";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// Contact form schema
const contactFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name too long"),
  email: z.string().email("Please enter a valid email address"),
  category: z.enum(["security", "sales", "support", "legal", "general"], {
    required_error: "Please select a contact category"
  }),
  subject: z.string().min(5, "Subject must be at least 5 characters").max(200, "Subject too long"),
  message: z.string().min(20, "Message must be at least 20 characters").max(2000, "Message too long"),
  urgency: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  company: z.string().optional(),
  phone: z.string().optional()
});

type ContactFormData = z.infer<typeof contactFormSchema>;

const contactChannels = [
  {
    id: "security",
    title: "Security & Privacy",
    description: "Data security, privacy concerns, vulnerability reports, compliance questions",
    icon: Shield,
    email: "security@readmyfineprint.com",
    responseTime: "24 hours",
    priority: "High",
    color: "text-red-600"
  },
  {
    id: "sales",
    title: "Business & Enterprise",
    description: "Enterprise pricing, custom deployments, partnership opportunities, bulk licensing",
    icon: Building,
    email: "sales@readmyfineprint.com", 
    responseTime: "4 hours",
    priority: "High",
    color: "text-blue-600"
  },
  {
    id: "support", 
    title: "Technical Support",
    description: "Account issues, billing questions, feature requests, technical difficulties",
    icon: HeadphonesIcon,
    email: "support@readmyfineprint.com",
    responseTime: "12 hours", 
    priority: "Medium",
    color: "text-green-600"
  },
  {
    id: "legal",
    title: "Legal & Compliance",
    description: "Terms clarification, GDPR/CCPA requests, legal document concerns, compliance",
    icon: FileText,
    email: "legal@readmyfineprint.com",
    responseTime: "48 hours",
    priority: "Medium",
    color: "text-purple-600"
  },
  {
    id: "general",
    title: "General Inquiries",
    description: "Media requests, general questions, feedback, suggestions",
    icon: Mail,
    email: "admin@readmyfineprint.com",
    responseTime: "72 hours",
    priority: "Standard",
    color: "text-gray-600"
  }
];

export default function Contact() {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  // SEO implementation for Contact page
  useSEO('/contact', {
    title: 'Contact ReadMyFinePrint - Enterprise Security & Legal Tech Support',
    description: 'Get in touch with ReadMyFinePrint for security concerns, enterprise sales, technical support, or general inquiries. Fast response times and expert support team.',
    keywords: 'contact readmyfineprint, legal tech support, enterprise security, technical support, sales inquiry, privacy concerns, vulnerability reporting',
    canonical: 'https://readmyfineprint.com/contact',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "ContactPage",
      "name": "Contact ReadMyFinePrint",
      "description": "Contact form and information for ReadMyFinePrint legal document analysis platform",
      "url": "https://readmyfineprint.com/contact",
      "mainEntity": {
        "@type": "Organization",
        "name": "ReadMyFinePrint",
        "contactPoint": [
          {
            "@type": "ContactPoint",
            "contactType": "Security Support",
            "email": "security@readmyfineprint.com",
            "areaServed": "Worldwide",
            "availableLanguage": "English"
          },
          {
            "@type": "ContactPoint",
            "contactType": "Sales Support",
            "email": "sales@readmyfineprint.com",
            "areaServed": "Worldwide",
            "availableLanguage": "English"
          }
        ]
      }
    }
  });

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      category: undefined,
      subject: "",
      message: "",
      urgency: "medium",
      company: "",
      phone: ""
    }
  });

  const submitContactForm = useMutation({
    mutationFn: async (data: ContactFormData) => {
      return await apiRequest('POST', '/api/contact/submit', {
        body: data
      });
    },
    onSuccess: () => {
      setIsSubmitted(true);
      form.reset();
      toast({
        title: "Message Sent",
        description: "We'll get back to you within the expected timeframe."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed", 
        description: error.message || "Please try again later.",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (data: ContactFormData) => {
    submitContactForm.mutate(data);
  };

  const selectedChannel = contactChannels.find(channel => channel.id === selectedCategory);

  if (isSubmitted) {
    return (
      <TouchScrollContainer className="h-full bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
            <CardContent className="pt-8 text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Message Sent Successfully</h1>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Thank you for contacting ReadMyFinePrint. We've received your message and will respond 
                within the expected timeframe based on your inquiry type.
              </p>
              <div className="space-y-3">
                <Button 
                  onClick={() => setIsSubmitted(false)} 
                  variant="outline"
                  data-testid="button-send-another"
                >
                  Send Another Message
                </Button>
                <Button 
                  onClick={() => window.location.href = '/'}
                  data-testid="button-return-home"
                >
                  Return to Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </TouchScrollContainer>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-blue-950 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5 dark:opacity-10"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5"></div>
      
      <TouchScrollContainer className="relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          
          {/* Header Section */}
          <div className="text-center mb-16">
            <Badge className="mb-6 px-6 py-3 text-sm font-semibold bg-gradient-to-r from-primary/5 to-secondary/5 dark:from-primary/10 dark:to-secondary/10 border-primary/20 dark:border-primary/30 shadow-lg backdrop-blur-sm border">
              <Mail className="w-4 h-4 mr-2" />
              Enterprise Support
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-6 leading-tight text-slate-900 dark:text-white">
              Contact Our
              <br />
              <span className="bg-gradient-to-r from-primary via-blue-600 to-secondary bg-clip-text text-transparent">
                Expert Team
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 max-w-4xl mx-auto leading-relaxed font-light mb-8">
              Get <strong className="font-semibold text-primary">enterprise-grade support</strong> from our expert teams.
              We're here to help with security, sales, and technical inquiries.
            </p>
          </div>

        {/* Quick Response Promise */}
        <Card className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-200">Fast Response Times</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-900 dark:text-green-200">Security-First Support</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <span className="text-sm font-medium text-purple-900 dark:text-purple-200">Expert Team</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Contact Channels */}
          <div className="lg:col-span-1">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Contact Channels</h2>
            <div className="space-y-4">
              {contactChannels.map((channel) => {
                const IconComponent = channel.icon;
                return (
                  <Card 
                    key={channel.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedCategory === channel.id ? 'ring-2 ring-primary border-primary' : ''
                    }`}
                    onClick={() => {
                      setSelectedCategory(channel.id);
                      form.setValue('category', channel.id as any);
                    }}
                    data-testid={`contact-channel-${channel.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-gray-700`}>
                          <IconComponent className={`w-5 h-5 ${channel.color}`} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                            {channel.title}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {channel.description}
                          </p>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              {channel.responseTime}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {channel.priority}
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-500 font-mono">
                            {channel.email}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Direct Contact Info */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Company Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Business Name</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Coleman Creative LLC</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">(DBA ReadMyFinePrint)</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Location</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">California, United States</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Business Hours</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Monday - Friday: 9 AM - 6 PM PST</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Security: 24/7 response for critical issues</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="w-5 h-5" />
                  Send us a Message
                </CardTitle>
                {selectedChannel && (
                  <Alert>
                    <selectedChannel.icon className="w-4 h-4" />
                    <AlertDescription>
                      You're contacting our <strong>{selectedChannel.title}</strong> team. 
                      Expected response time: <strong>{selectedChannel.responseTime}</strong>
                    </AlertDescription>
                  </Alert>
                )}
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                  
                  {/* Basic Information */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        {...form.register('name')}
                        placeholder="Your full name"
                        data-testid="input-contact-name"
                      />
                      {form.formState.errors.name && (
                        <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        {...form.register('email')}
                        placeholder="your@email.com"
                        data-testid="input-contact-email"
                      />
                      {form.formState.errors.email && (
                        <p className="text-sm text-red-600 mt-1">{form.formState.errors.email.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Optional Fields */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="company">Company/Organization</Label>
                      <Input
                        id="company"
                        {...form.register('company')}
                        placeholder="Optional"
                        data-testid="input-contact-company"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        {...form.register('phone')}
                        placeholder="Optional"
                        data-testid="input-contact-phone"
                      />
                    </div>
                  </div>

                  {/* Category Selection */}
                  {!selectedCategory && (
                    <div>
                      <Label>Contact Category *</Label>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        Please select a contact category above to continue
                      </p>
                    </div>
                  )}

                  {/* Subject and Priority */}
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <Label htmlFor="subject">Subject *</Label>
                      <Input
                        id="subject"
                        {...form.register('subject')}
                        placeholder="Brief description of your inquiry"
                        data-testid="input-contact-subject"
                      />
                      {form.formState.errors.subject && (
                        <p className="text-sm text-red-600 mt-1">{form.formState.errors.subject.message}</p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="urgency">Priority Level</Label>
                      <select 
                        id="urgency"
                        {...form.register('urgency')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:border-gray-600 dark:bg-gray-800"
                        data-testid="select-contact-urgency"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                  </div>

                  {/* Message */}
                  <div>
                    <Label htmlFor="message">Message *</Label>
                    <Textarea
                      id="message"
                      {...form.register('message')}
                      placeholder="Please provide detailed information about your inquiry..."
                      rows={6}
                      data-testid="textarea-contact-message"
                    />
                    {form.formState.errors.message && (
                      <p className="text-sm text-red-600 mt-1">{form.formState.errors.message.message}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {form.watch('message')?.length || 0}/2000 characters
                    </p>
                  </div>

                  {/* Privacy Notice */}
                  <Alert>
                    <Shield className="w-4 h-4" />
                    <AlertDescription className="text-xs">
                      Your contact information will be used only to respond to your inquiry. 
                      We never share personal information with third parties. See our{' '}
                      <a href="/privacy" className="text-blue-600 dark:text-blue-300 hover:underline">
                        Privacy Policy
                      </a>{' '}
                      for details.
                    </AlertDescription>
                  </Alert>

                  {/* Submit Button */}
                  <div className="flex gap-3">
                    <Button 
                      type="submit" 
                      disabled={!selectedCategory || submitContactForm.isPending}
                      className="flex-1"
                      data-testid="button-submit-contact"
                    >
                      {submitContactForm.isPending ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Sending...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Send className="w-4 h-4" />
                          Send Message
                        </div>
                      )}
                    </Button>
                    
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => form.reset()}
                      data-testid="button-reset-contact"
                    >
                      Reset
                    </Button>
                  </div>

                  {/* Direct Email Alternative */}
                  {selectedChannel && (
                    <div className="pt-4 border-t">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Prefer email? You can also contact us directly at{' '}
                        <a 
                          href={`mailto:${selectedChannel.email}`}
                          className="text-blue-600 dark:text-blue-300 hover:underline font-mono"
                        >
                          {selectedChannel.email}
                        </a>
                      </p>
                    </div>
                  )}
                </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Emergency Contact */}
        <Card className="mt-8 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-200 mb-2">
                  Security Emergency or Data Breach?
                </h3>
                <p className="text-red-800 dark:text-red-300 text-sm mb-3">
                  For immediate security concerns, potential vulnerabilities, or suspected data breaches, 
                  contact our security team immediately at{' '}
                  <a href="mailto:security@readmyfineprint.com" className="font-bold underline">
                    security@readmyfineprint.com
                  </a>
                  {' '}with "URGENT SECURITY" in the subject line.
                </p>
                <p className="text-xs text-red-700 dark:text-red-400">
                  Our security team monitors this email 24/7 and will respond to critical issues within 4 hours.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TouchScrollContainer>
    </div>
  );
}