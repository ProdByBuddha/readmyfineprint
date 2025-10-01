# Subscription Tiers - Updated Structure

## Overview

The platform offers **5 public tiers** (FREE, STARTER, PROFESSIONAL, BUSINESS, ENTERPRISE) plus an internal **ULTIMATE** tier reserved for the owner and specially authorized users.

## Public Tiers

### 🆓 FREE
- **Seats:** 1
- **Workspaces:** 0
- **Documents:** 10 per workspace
- **Rate Limit:** 60 rpm
- **Organizations:** ❌
- **Workspaces:** ❌
- **Activity Feed:** ❌
- **Real-time:** ❌
- **API Keys:** ❌
- **Priority Support:** ❌

### 🌱 STARTER
- **Seats:** 3
- **Workspaces:** 3
- **Documents:** 50 per workspace
- **Rate Limit:** 120 rpm
- **Organizations:** ❌
- **Workspaces:** ❌
- **Activity Feed:** ❌
- **Real-time:** ❌
- **API Keys:** ❌
- **Priority Support:** ❌

### 💼 PROFESSIONAL
- **Seats:** 5
- **Workspaces:** 10
- **Documents:** 200 per workspace
- **Rate Limit:** 300 rpm
- **Organizations:** ✅
- **Workspaces:** ✅
- **Activity Feed:** ✅
- **Real-time:** ❌
- **API Keys:** ✅
- **Priority Support:** ❌

**Best for:** Small teams, freelancers, consultants

### 🏢 BUSINESS
- **Seats:** 20
- **Workspaces:** 25
- **Documents:** 1,000 per workspace
- **Rate Limit:** 600 rpm
- **Organizations:** ✅
- **Workspaces:** ✅
- **Activity Feed:** ✅
- **Real-time:** ✅
- **API Keys:** ✅
- **Priority Support:** ❌

**Best for:** Growing companies, mid-size teams

### 🏛️ ENTERPRISE
- **Seats:** 100
- **Workspaces:** 100
- **Documents:** 5,000 per workspace
- **Rate Limit:** 1,500 rpm
- **Organizations:** ✅
- **Workspaces:** ✅
- **Activity Feed:** ✅
- **Real-time:** ✅
- **API Keys:** ✅
- **Priority Support:** ✅

**Best for:** Large organizations, enterprises

## Internal Tier

### 👑 ULTIMATE (Not Publicly Available)
- **Seats:** Unlimited
- **Workspaces:** Unlimited
- **Documents:** Unlimited
- **Rate Limit:** 3,000 rpm
- **All Features:** ✅

**Access:** Owner and manually assigned users only

**Assignment:** Via internal admin endpoint
```bash
POST /api/admin/orgs/:orgId/assign-ultimate
```

**Notes:**
- Not visible in public plans listing
- No Stripe subscription required
- Cannot be purchased or upgraded to
- Used for internal testing, demos, and special partnerships

## Feature Matrix

| Feature | Free | Starter | Professional | Business | Enterprise | Ultimate |
|---------|------|---------|--------------|----------|------------|----------|
| **Seats** | 1 | 3 | 5 | 20 | 100 | ∞ |
| **Workspaces** | 0 | 3 | 10 | 25 | 100 | ∞ |
| **Docs/Workspace** | 10 | 50 | 200 | 1,000 | 5,000 | ∞ |
| **Rate Limit (rpm)** | 60 | 120 | 300 | 600 | 1,500 | 3,000 |
| **Organizations** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Shared Workspaces** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Activity Feed** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Real-time Collab** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **API Keys** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Priority Support** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Public** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

## API Behavior

### Public Plans Endpoint
`GET /api/subscriptions/plans`

Returns only public tiers (FREE through ENTERPRISE). ULTIMATE is not included.

### Subscription Info
`GET /api/orgs/:orgId/subscription`

Returns subscription details with `is_internal_tier: true` for ULTIMATE tier.

### Upgrade Options
`GET /api/orgs/:orgId/subscription/upgrade-options`

- For public tiers: Shows available higher public tiers
- For ULTIMATE tier: Returns empty array with message "You are on the highest available tier"

### Upgrade Initiation
`POST /api/orgs/:orgId/subscription/upgrade`

- Blocks upgrades to ULTIMATE (validation error: "Cannot upgrade to internal tier")
- Only allows upgrades to public tiers

## Stripe Integration

### Price Mapping
ULTIMATE is **not mapped** to any Stripe price ID:

```typescript
const STRIPE_PRICE_TO_TIER = {
  'price_free': FREE,
  'price_starter_monthly': STARTER,
  'price_starter_yearly': STARTER,
  'price_professional_monthly': PROFESSIONAL,
  'price_professional_yearly': PROFESSIONAL,
  'price_business_monthly': BUSINESS,
  'price_business_yearly': BUSINESS,
  'price_enterprise_monthly': ENTERPRISE,
  'price_enterprise_yearly': ENTERPRISE,
  // ULTIMATE not included
};
```

### Webhooks
Stripe webhooks will never set an organization to ULTIMATE tier. They can only assign FREE through ENTERPRISE.

## Internal Admin Access

### Assigning ULTIMATE Tier

**Endpoint:** `POST /api/admin/orgs/:orgId/assign-ultimate`

**Authentication:** Requires system owner/admin authentication (TODO: implement proper owner check)

**Request:**
```bash
curl -X POST https://api.example.com/api/admin/orgs/org_123/assign-ultimate \
  -H "Authorization: Bearer $OWNER_TOKEN"
```

**Response:**
```json
{
  "message": "ULTIMATE tier assigned successfully",
  "org_id": "org_123",
  "tier": "ultimate"
}
```

**Effects:**
- Sets `billing_tier` to `ultimate`
- Clears `stripe_subscription_id` (no billing)
- Sets `seat_limit` to `null` (unlimited)
- Logs assignment action

## Upgrade Paths

```
FREE → STARTER → PROFESSIONAL → BUSINESS → ENTERPRISE
                                                ↓
                                           (manual)
                                             ULTIMATE
```

**Public upgrades:** Users can upgrade from any public tier to a higher public tier via Stripe checkout.

**ULTIMATE assignment:** Only via internal admin endpoint, bypassing Stripe entirely.

## Implementation Notes

### `isPublic` Flag
Each tier has an `isPublic` boolean:
- `true` for FREE, STARTER, PROFESSIONAL, BUSINESS, ENTERPRISE
- `false` for ULTIMATE

### Filtering Logic
```typescript
// Get only public tiers
const publicTiers = subscriptionService.getPublicTiers();

// Check if tier is public
const plan = subscriptionService.getPlanLimits(tier);
if (!plan.isPublic) {
  // Handle internal tier
}
```

### Service Methods
- `getPublicTiers()` - Returns only public tiers
- `assignUltimateTier(orgId, userId)` - Manual ULTIMATE assignment
- `getRecommendedTier()` - Only recommends public tiers

## Security Considerations

1. **ULTIMATE Assignment**
   - Must implement proper owner/admin authentication
   - Log all ULTIMATE tier assignments
   - Audit trail for internal tier usage

2. **API Validation**
   - Prevent public upgrade to ULTIMATE
   - Hide ULTIMATE from public listings
   - Clear error messages for blocked actions

3. **Stripe Webhooks**
   - Never allow Stripe to set ULTIMATE
   - Downgrade protection (ULTIMATE → FREE on cancel should not happen)

## Future Enhancements

- [ ] Implement owner authentication middleware
- [ ] Add audit trail for ULTIMATE assignments
- [ ] Dashboard to view all ULTIMATE tier organizations
- [ ] Ability to revoke ULTIMATE tier
- [ ] Notifications for ULTIMATE tier changes

---

**Last Updated:** 2025-10-01  
**Owner:** System Administrator
