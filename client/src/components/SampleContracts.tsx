import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Eye } from "lucide-react";

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
    id: "problematic-lease",
    title: "Problematic Residential Lease",
    type: "Rental Agreement",
    description: "Educational example with many illegal and unconscionable terms",
    riskLevel: "high",
    content: `RESIDENTIAL LEASE AGREEMENT - PROBLEMATIC VERSION

Property: 789 Shady Lane, Unit 4C, Apartment Complex, Anywhere, USA 12345

PARTIES: Exploitative Property Management LLC ("Landlord") and [Tenant Name] ("Tenant")

WARNING: This is an example of a PROBLEMATIC lease with many unfavorable terms for educational purposes only.

1. LEASE TERM AND AUTOMATIC RENEWAL
- Initial Term: 12 months starting January 1, 2025
- AUTOMATIC RENEWAL: This lease automatically renews for successive 12-month periods unless Tenant provides 120 days written notice via certified mail. Failure to provide proper notice results in automatic renewal at 25% increased rent.
- NO EARLY TERMINATION: Tenant cannot terminate lease early under any circumstances, including job loss, medical emergencies, military deployment, or domestic violence situations.

2. RENT AND EXCESSIVE FEES
- Monthly Rent: $2,800 (subject to immediate increase without notice)
- Application Fee: $500 (non-refundable even if application denied)
- Security Deposit: $5,600 (two months rent, fully non-refundable)
- Pet Deposit: $1,500 per pet (non-refundable, even if no pets)
- Key Fee: $200 per key (non-refundable)
- Parking Fee: $300/month (mandatory even if no car)
- Amenity Fee: $250/month (mandatory for gym/pool access)
- Technology Fee: $75/month (for basic internet)
- Trash Fee: $50/month
- Water/Sewer Fee: $125/month
- HVAC Maintenance Fee: $100/month
- Pest Control Fee: $40/month
- Administrative Fee: $150/month
- Late Fee: $200 if rent is even 1 day late
- Returned Check Fee: $150 per occurrence
- Notice Fee: $100 for any notice received from Tenant
- Inspection Fee: $75 per month for monthly inspections

3. RENT INCREASES AND PAYMENT TERMS
- Rent may be increased at any time with only 24 hours notice
- All fees are subject to immediate increase without notice
- Rent must be paid by certified check or money order only
- NO PERSONAL CHECKS, credit cards, or electronic payments accepted
- Payment must be delivered in person to office between 9 AM - 10 AM on first of month
- Office closed on weekends and holidays (late fees still apply)
- Partial payments not accepted under any circumstances

4. EXCESSIVE SECURITY DEPOSIT TERMS
- Security deposit is NON-REFUNDABLE regardless of condition
- Additional cleaning fee of $500 automatically deducted
- Carpet replacement fee of $2,000 automatically charged regardless of condition
- Paint fee of $1,500 per room automatically charged
- Any wear whatsoever considered damage requiring full replacement
- Tenant responsible for all costs even if property improvements made

5. PROPERTY USE RESTRICTIONS
- Absolutely NO GUESTS allowed without prior written approval (minimum 72 hours notice)
- Guest approval fee: $100 per guest per night
- NO overnight guests under any circumstances
- NO cooking with oil, garlic, or strong spices
- NO music, television, or talking above whisper level after 8 PM
- NO use of air conditioning between 6 PM - 8 AM
- NO opening windows at any time
- NO rearranging furniture from original positions
- NO hanging pictures or decorations
- NO plants or flowers of any kind
- Mandatory bed time of 10 PM on weekdays, 11 PM weekends

6. LANDLORD ACCESS AND PRIVACY VIOLATIONS
- Landlord may enter at any time without notice for any reason
- Tenant must provide copy of all keys to Landlord
- Landlord may inspect personal belongings at any time
- Security cameras will be installed in all rooms for "safety"
- Tenant must provide passwords to all devices and social media accounts
- Landlord may bring prospective tenants/buyers through unit daily
- No locks may be changed or added by Tenant

7. MAINTENANCE AND REPAIR OBLIGATIONS
- Tenant responsible for ALL repairs regardless of cause, including:
  • Structural damage from earthquakes, floods, acts of God
  • Appliance replacement including refrigerator, stove, washer/dryer
  • HVAC system repairs and replacement
  • Roof repairs and replacement
  • Plumbing including main line blockages
  • Electrical system including rewiring
  • Foundation repairs
  • Pest infestations including termites
- Tenant must use only Landlord-approved contractors (at premium rates)
- Emergency repairs require Landlord approval (even for burst pipes/gas leaks)
- Tenant liable for improvements and upgrades made to property

8. UNCONSCIONABLE LIABILITY AND INSURANCE
- Tenant liable for unlimited damages to property and other units
- Tenant must carry $5,000,000 liability insurance naming Landlord as beneficiary
- Tenant liable for all injuries on entire property premises
- Tenant responsible for legal fees if anyone sues Landlord about property
- Landlord has no liability for anything including death or injury
- Tenant waives all rights to sue Landlord for any reason

9. TERMINATION AND HOLDOVER PENALTIES
- Only Landlord may terminate lease, Tenant has no termination rights
- 3-day notice for any violation (including late fees)
- Holdover rent charged at 500% of monthly rent per day
- $10,000 penalty for unauthorized vacation of premises
- Tenant remains liable for rent even after vacating
- No right to cure any violations

10. ILLEGAL DISCRIMINATION AND HARASSMENT
- Preference given to tenants of specific religious backgrounds
- Different rules apply based on tenant's country of origin
- Pregnant tenants subject to immediate eviction
- Tenants with service animals charged additional $2,000 monthly fee
- Background checks include invasive personal questions about medical history

11. UNCONSCIONABLE LEGAL PROVISIONS
- All disputes must be resolved in arbitration in a remote location 2,000 miles away
- Tenant pays all Landlord legal fees regardless of outcome
- Tenant waives all statutory rights and protections
- This lease governed by laws of fictitious jurisdiction with no tenant protections
- Any provision deemed illegal simply removed, rest of lease remains fully enforceable
- Landlord may modify lease terms at any time without notice or consent

12. MISCELLANEOUS EXPLOITATIVE TERMS
- Tenant grants Landlord power of attorney for all personal decisions
- Tenant's personal property becomes Landlord's property upon any lease violation
- Tenant must maintain property insurance that only benefits Landlord
- All communications with Landlord must be through expensive legal service
- Tenant responsible for property taxes and all building operating expenses
- Must pay Landlord's mortgage, insurance, and management company fees

13. MOVE-OUT REQUIREMENTS
- 180-day advance notice required for move-out
- Professional cleaning required (Landlord chooses company at $2,500 minimum)
- All items must be removed except those Landlord wants to keep
- Tenant must repaint all walls to original color (but Landlord won't specify color)
- Must replace all light bulbs, batteries in smoke detectors, air filters
- Carpets must be professionally steam cleaned twice
- Must pay for complete property inspection by engineer ($5,000)

ACKNOWLEDGMENT: By signing below, Tenant acknowledges this lease contains terms that may be illegal, unconscionable, and unenforceable in most jurisdictions. This example is for educational purposes to demonstrate problematic lease provisions.

LANDLORD: Exploitative Property Management LLC
TENANT: [Tenant Name]

DISCLAIMER: This document contains numerous illegal and unconscionable provisions that would likely be unenforceable. It is provided solely for educational purposes to demonstrate what problematic lease terms look like.`
  },
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

      <div className="text-center mt-8 p-6 bg-blue-50 dark:bg-blue-900/30 rounded-lg" dark:text-gray-100>
        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
          Why Use Sample Contracts?
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          These examples demonstrate different risk levels and contract types. Each one shows
          how our system identifies key terms, potential issues, and explains complex language in plain English.
        </p>
      </div>
    </div>
  );
}
