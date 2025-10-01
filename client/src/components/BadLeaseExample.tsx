
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, AlertTriangle } from "lucide-react";

const badLeaseContent = `RESIDENTIAL LEASE AGREEMENT - PROBLEMATIC VERSION

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
Signature: _________________________
Date: _____________________________

TENANT: ____________________________
Signature: _________________________
Date: _____________________________

DISCLAIMER: This document contains numerous illegal and unconscionable provisions that would likely be unenforceable. It is provided solely for educational purposes to demonstrate what problematic lease terms look like. Real tenants should never sign agreements with these types of clauses.`;

interface BadLeaseExampleProps {
  onSelectContract: (title: string, content: string) => void;
  disabled?: boolean;
}

export function BadLeaseExample({ onSelectContract, disabled = false }: BadLeaseExampleProps) {
  return (
    <div className={`space-y-6 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-8 h-8 text-red-600 mb-2" />
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
              EXTREMELY HIGH RISK
            </span>
          </div>
          <CardTitle className="text-lg text-red-900 dark:text-red-200">
            Problematic Residential Lease Agreement
          </CardTitle>
          <p className="text-sm text-red-700 dark:text-red-300">
            Educational Example - Contains Many Illegal & Unconscionable Terms
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-lg" dark:text-gray-100>
              <h4 className="font-semibold text-red-900 dark:text-red-200 mb-2">
                ⚠️ WARNING: Educational Purpose Only
              </h4>
              <p className="text-sm text-red-800 dark:text-red-300 mb-3">
                This lease contains numerous problematic provisions that would likely be illegal 
                or unenforceable in most jurisdictions. It demonstrates what tenants should watch out for.
              </p>
              <div className="text-xs text-red-700 dark:text-red-400 space-y-1">
                <p>• Excessive and illegal fees</p>
                <p>• Unconscionable liability terms</p>
                <p>• Privacy violations</p>
                <p>• Discriminatory provisions</p>
                <p>• Waiver of tenant rights</p>
                <p>• Automatic renewals with massive rent increases</p>
              </div>
            </div>
            
            <Button
              onClick={() => !disabled && onSelectContract("Problematic Residential Lease Agreement", badLeaseContent)}
              className="w-full bg-red-600 text-white hover:bg-red-700"
              size="sm"
              disabled={disabled}
            >
              <FileText className="w-4 h-4 mr-2" />
              Analyze This Problematic Lease
            </Button>
            
            <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
              Use this to test the analyzer's ability to identify red flags and problematic terms
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
