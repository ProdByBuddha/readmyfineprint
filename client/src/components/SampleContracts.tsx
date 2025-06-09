import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Eye, Download } from "lucide-react";

interface SampleContract {
  id: string;
  title: string;
  type: string;
  description: string;
  content: string;
  riskLevel: 'low' | 'moderate' | 'high';
}

const sampleContracts: SampleContract[] = [
  {
    id: "saas-tos",
    title: "SaaS Terms of Service",
    type: "Terms of Service",
    description: "Standard software service agreement with common clauses",
    riskLevel: "moderate",
    content: `TERMS OF SERVICE

Last updated: December 1, 2024

1. ACCEPTANCE OF TERMS
By accessing and using CloudApp Services ("Service"), you accept and agree to be bound by the terms and provision of this agreement.

2. DESCRIPTION OF SERVICE
CloudApp provides cloud-based software solutions for business management. The Service includes data storage, analytics, and collaboration tools.

3. USER ACCOUNTS
- You are responsible for maintaining the confidentiality of your account
- You agree to accept responsibility for all activities under your account
- You must notify us immediately of any unauthorized use

4. PAYMENT TERMS
- Subscription fees are billed monthly in advance
- All fees are non-refundable except as required by law
- We reserve the right to change pricing with 30 days notice
- Accounts may be suspended for non-payment after 15 days

5. DATA AND PRIVACY
- We collect and process data as described in our Privacy Policy
- You retain ownership of your data
- We may access your data for service provision and support
- Data backup and security measures are provided but not guaranteed

6. LIMITATION OF LIABILITY
TO THE MAXIMUM EXTENT PERMITTED BY LAW, CLOUDAPP SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.

7. TERMINATION
- Either party may terminate this agreement at any time with 30 days notice
- Upon termination, your access will be revoked immediately
- Data may be deleted after 90 days following termination
- Surviving clauses include payment obligations and limitation of liability

8. GOVERNING LAW
This agreement shall be governed by the laws of Delaware, United States. Any disputes shall be resolved through binding arbitration.

9. CHANGES TO TERMS
We reserve the right to modify these terms at any time. Continued use after changes constitutes acceptance of new terms.

Contact: legal@cloudapp.com`
  },
  {
    id: "employment-contract",
    title: "Employment Agreement",
    type: "Employment Contract",
    description: "Standard employment contract with typical clauses",
    riskLevel: "low",
    content: `EMPLOYMENT AGREEMENT

This Employment Agreement ("Agreement") is entered into between TechCorp Inc. ("Company") and [Employee Name] ("Employee").

1. POSITION AND DUTIES
Employee is hired as Software Developer and agrees to perform duties including:
- Software development and maintenance
- Code review and testing
- Documentation and technical support
- Other duties as reasonably assigned

2. COMPENSATION
- Base salary: $85,000 annually
- Performance bonus eligibility up to 15% of base salary
- Health insurance with 80% company contribution
- 401(k) with 4% company match
- 3 weeks paid vacation annually

3. WORKING CONDITIONS
- Standard work week: 40 hours
- Flexible remote work options available
- Office location: 123 Tech Street, San Francisco, CA

4. CONFIDENTIALITY
Employee agrees to maintain confidentiality of proprietary information and trade secrets during and after employment.

5. INTELLECTUAL PROPERTY
Work products created during employment belong to the Company. Employee assigns all rights to inventions related to Company business.

6. TERMINATION
- Either party may terminate with 2 weeks written notice
- Company may terminate immediately for cause
- Upon termination, Employee must return all Company property
- Final paycheck includes accrued vacation time

7. NON-COMPETE
Employee agrees not to work for direct competitors within 50 miles for 6 months after termination.

8. DISPUTE RESOLUTION
Disputes will be resolved through mediation, then arbitration if necessary.

Effective Date: [Date]
Company Representative: [Name, Title]
Employee Signature: [Signature]`
  },
  {
    id: "rental-agreement",
    title: "Residential Lease Agreement",
    type: "Rental Agreement",
    description: "Apartment rental lease with standard terms",
    riskLevel: "high",
    content: `RESIDENTIAL LEASE AGREEMENT

Property: 456 Oak Avenue, Apartment 2B, Portland, OR 97201

PARTIES: Sunset Properties LLC ("Landlord") and [Tenant Name] ("Tenant")

1. LEASE TERM
- Start Date: January 1, 2025
- End Date: December 31, 2025
- Month-to-month after initial term unless terminated

2. RENT AND FEES
- Monthly Rent: $2,400 (due 1st of each month)
- Late Fee: $150 if rent is more than 5 days late
- Security Deposit: $2,400 (non-refundable cleaning fee of $200)
- Pet Deposit: $500 per pet (maximum 2 pets)

3. UTILITIES AND SERVICES
- Tenant responsible for: electricity, gas, internet, cable
- Landlord provides: water, sewer, trash collection
- Utilities must remain in Tenant's name throughout lease

4. PROPERTY USE AND RESTRICTIONS
- Residential use only, maximum 2 occupants
- No smoking anywhere on property (including balcony)
- No loud music or parties after 10 PM
- No alterations without written consent
- Subletting prohibited without prior approval

5. MAINTENANCE AND REPAIRS
- Tenant responsible for repairs under $100
- Landlord responsible for major repairs and appliances
- 48-hour notice required for non-emergency entry
- Tenant must report maintenance issues within 24 hours

6. DEPOSIT AND DAMAGES
- Security deposit held for damages beyond normal wear
- Landlord has 60 days to return deposit after move-out
- Tenant liable for all damages regardless of deposit amount
- Professional cleaning required upon move-out

7. TERMINATION AND PENALTIES
- 60-day written notice required for termination
- Early termination fee: 2 months rent
- Holdover tenancy charged at 150% of monthly rent
- Landlord may terminate immediately for any lease violation

8. LIABILITY AND INSURANCE
- Tenant must carry renter's insurance minimum $100,000
- Landlord not liable for theft, damage, or injury on property
- Tenant liable for all guest actions and damages

Contact: manager@sunsetproperties.com
Emergency: (503) 555-0199`
  }
];

interface SampleContractsProps {
  onSelectContract: (title: string, content: string) => void;
  disabled?: boolean;
}

export function SampleContracts({ onSelectContract, disabled = false }: SampleContractsProps) {
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'moderate':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={`space-y-6 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="text-center mb-8">
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
          Try Sample Contracts
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          Test the analyzer with these example documents to see how it works
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sampleContracts.map((contract) => (
          <Card key={contract.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <FileText className="w-8 h-8 text-primary mb-2" />
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRiskColor(contract.riskLevel)}`}>
                  {contract.riskLevel.charAt(0).toUpperCase() + contract.riskLevel.slice(1)} Risk
                </span>
              </div>
              <CardTitle className="text-lg">{contract.title}</CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-300">{contract.type}</p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 line-clamp-3">
                {contract.description}
              </p>
              <div className="flex space-x-2">
                <Button
                  onClick={() => !disabled && onSelectContract(contract.title, contract.content)}
                  className="flex-1 bg-primary text-white hover:bg-primary/90"
                  size="sm"
                  disabled={disabled}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Analyze
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
          Why Use Sample Contracts?
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          These examples demonstrate different risk levels and contract types. Each one shows
          how our AI identifies key terms, potential issues, and explains complex language in plain English.
        </p>
      </div>
    </div>
  );
}
