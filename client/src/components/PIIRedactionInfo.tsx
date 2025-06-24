import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  Eye, 
  EyeOff, 
  Lock, 
  Mail, 
  Phone, 
  CreditCard, 
  MapPin, 
  User, 
  Calendar,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import type { PIIRedactionInfo, PIIMatch } from '@shared/schema';

interface PIIRedactionInfoProps {
  redactionInfo: PIIRedactionInfo;
  className?: string;
}

export function PIIRedactionInfoComponent({ redactionInfo, className = '' }: PIIRedactionInfoProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showRedactedValues, setShowRedactedValues] = useState(false);

  if (!redactionInfo.hasRedactions) {
    return (
      <Alert className={`bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 ${className}`}>
        <Shield className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-700 dark:text-green-300">
          <span className="font-medium">No sensitive information detected.</span> Your document was automatically scanned and analyzed safely.
        </AlertDescription>
      </Alert>
    );
  }

  const getIconForPIIType = (type: PIIMatch['type']) => {
    switch (type) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'phone': return <Phone className="h-4 w-4" />;
      case 'creditCard': return <CreditCard className="h-4 w-4" />;
      case 'address': return <MapPin className="h-4 w-4" />;
      case 'name': return <User className="h-4 w-4" />;
      case 'dob': return <Calendar className="h-4 w-4" />;
      case 'ssn': return <Lock className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getColorForPIIType = (type: PIIMatch['type']) => {
    switch (type) {
      case 'ssn': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800';
      case 'creditCard': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800';
      case 'email': return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800';
      case 'phone': return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800';
      case 'address': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800';
      case 'name': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800';
      case 'dob': return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-800';
    }
  };

  const formatPIIType = (type: PIIMatch['type']) => {
    switch (type) {
      case 'ssn': return 'Social Security Number';
      case 'creditCard': return 'Credit Card';
      case 'email': return 'Email Address';
      case 'phone': return 'Phone Number';
      case 'address': return 'Address';
      case 'name': return 'Name';
      case 'dob': return 'Date of Birth';
      default: return 'Sensitive Data';
    }
  };

  const groupMatchesByType = (matches: PIIMatch[]) => {
    const grouped = new Map<string, PIIMatch[]>();
    for (const match of matches) {
      const key = match.type;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(match);
    }
    return grouped;
  };

  const groupedMatches = groupMatchesByType(redactionInfo.matches);

  return (
    <Card className={`border-orange-200 dark:border-orange-800 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2 text-orange-700 dark:text-orange-300">
          <Shield className="h-5 w-5" />
          <span>Privacy Protection Active</span>
        </CardTitle>
        <Alert className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
          <Lock className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-700 dark:text-orange-300">
            <span className="font-medium">{redactionInfo.matches.length} sensitive item{redactionInfo.matches.length !== 1 ? 's' : ''} detected and protected.</span> 
            {' '}Your personal information was automatically redacted before AI analysis to ensure maximum privacy protection.
          </AlertDescription>
        </Alert>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Summary of redacted types */}
          <div className="flex flex-wrap gap-2">
            {Array.from(groupedMatches.keys()).map(type => {
              const matches = groupedMatches.get(type)!;
              const piiType = type as PIIMatch['type'];
              return (
                <Badge 
                  key={type} 
                  variant="outline" 
                  className={`${getColorForPIIType(piiType)} border`}
                >
                  <div className="flex items-center space-x-1">
                    {getIconForPIIType(piiType)}
                    <span>{formatPIIType(piiType)} ({matches.length})</span>
                  </div>
                </Badge>
              );
            })}
          </div>

          {/* Toggle details button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-center space-x-2"
          >
            {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span>{showDetails ? 'Hide Details' : 'Show Details'}</span>
          </Button>

          {/* Detailed information */}
          {showDetails && (
            <div className="space-y-4 pt-2 border-t border-gray-200 dark:border-gray-700">
              
              {/* Show/hide redacted values toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Redacted Information:
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRedactedValues(!showRedactedValues)}
                  className="flex items-center space-x-1 text-xs"
                >
                  {showRedactedValues ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  <span>{showRedactedValues ? 'Hide' : 'Show'} Values</span>
                </Button>
              </div>

              {/* List of redacted items by type */}
              <div className="space-y-3">
                {Array.from(groupedMatches.entries()).map(([type, matches]) => {
                  const piiType = type as PIIMatch['type'];
                  return (
                    <div key={type} className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center space-x-2">
                        {getIconForPIIType(piiType)}
                        <span>{formatPIIType(piiType)}</span>
                      </h4>
                      <div className="grid grid-cols-1 gap-2 ml-6">
                        {matches.map((match, index) => (
                          <div 
                            key={index}
                            className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded border"
                          >
                            <div className="flex items-center space-x-2">
                              <Badge variant="secondary" className="text-xs">
                                {match.placeholder}
                              </Badge>
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                (Confidence: {Math.round(match.confidence * 100)}%)
                              </span>
                            </div>
                            {showRedactedValues && (
                              <span className="text-sm font-mono bg-yellow-100 dark:bg-yellow-900/20 px-2 py-1 rounded border">
                                {match.value}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detection settings info */}
              <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
                <strong>Protection Details:</strong>
                <ul className="mt-1 space-y-1">
                  <li>• Automatic scanning for SSNs, credit cards, emails, phones, addresses, and names</li>
                  <li>• High-confidence detection threshold: {Math.round(redactionInfo.detectionSettings.minConfidence * 100)}%</li>
                  <li>• Enterprise-grade privacy protection applied to all documents</li>
                </ul>
              </div>

              {/* Privacy explanation */}
              <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <Shield className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-700 dark:text-blue-300 text-xs">
                  <strong>How it works:</strong> Every document is automatically scanned for sensitive information before AI analysis. 
                  We replace any detected PII with secure placeholders, send only the redacted version for analysis, then restore 
                  the original information in your results. Your sensitive data is always protected and never exposed to external AI services.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}