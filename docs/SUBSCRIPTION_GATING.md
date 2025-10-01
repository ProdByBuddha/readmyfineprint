# Subscription Gating and Seat Enforcement

## Overview

The subscription system enforces plan-based access control and seat limits across the application. It integrates with Stripe for billing and provides middleware for automatic enforcement.

## Subscription Tiers

### Free Tier
- **Seats:** 1
- **Workspaces:** 0
- **Rate Limit:** 60 rpm
- **Features:** Basic document analysis only
- **Organizations:** ❌
- **API Keys:** ❌

### Starter Tier  
- **Seats:** 3
- **Workspaces:** 2
- **Rate Limit:** 120 rpm
- **Features:** Multiple users, limited workspaces
- **Organizations:** ❌
- **API Keys:** ❌

### Business Tier ⭐
- **Seats:** 10
- **Workspaces:** 10
- **Rate Limit:** 300 rpm
- **Features:** Full team collaboration
- **Organizations:** ✅
- **Workspaces:** ✅
- **Activity Feed:** ✅
- **API Keys:** ✅

### Enterprise Tier
- **Seats:** 50
- **Workspaces:** 50
- **Rate Limit:** 1000 rpm
- **Features:** Large teams, real-time collaboration
- **Organizations:** ✅
- **Workspaces:** ✅
- **Activity Feed:** ✅
- **Real-time:** ✅
- **API Keys:** ✅
- **Priority Support:** ✅

### Ultimate Tier
- **Seats:** Unlimited
- **Workspaces:** Unlimited
- **Rate Limit:** 2000 rpm
- **Features:** Enterprise + unlimited everything
- **All Enterprise features:** ✅

## Architecture

### Components

1. **`server/subscription-service.ts`** - Core subscription logic
   - Plan definitions and limits
   - Tier checking and validation
   - Stripe price ID mapping
   - Seat limit enforcement

2. **`server/subscription-middleware.ts`** - Express middleware
   - Load subscription context
   - Require minimum tier
   - Require specific features
   - Check seat/workspace limits

3. **`server/stripe-webhook.ts`** - Stripe webhook handler
   - Handle subscription events
   - Update org tiers automatically
   - Process upgrades/downgrades

4. **`server/subscription-routes.ts`** - API endpoints
   - Get plan information
   - View subscription details
   - Initiate upgrades
   - Get recommendations

## Usage

### Loading Subscription Context

Add to your Express app:

```typescript
import { loadSubscriptionContext } from './server/subscription-middleware';

// Load subscription context after org context
app.use(loadOrganizationContext());
app.use(loadSubscriptionContext());
```

### Requiring Minimum Tier

```typescript
import { requireSubscriptionTier } from './server/subscription-middleware';
import { SubscriptionTier } from './server/subscription-service';

// Require Business tier or higher
router.post('/orgs/:orgId/workspaces',
  requireSubscriptionTier(SubscriptionTier.BUSINESS),
  createWorkspace
);
```

### Requiring Specific Feature

```typescript
import { requireFeature } from './server/subscription-middleware';

// Require API keys feature
router.post('/orgs/:orgId/api-keys',
  requireFeature('hasApiKeys'),
  createApiKey
);
```

### Checking Seat Limits

```typescript
import { checkSeatLimit } from './server/subscription-middleware';

async function inviteUser(req, res) {
  const currentMemberCount = await countOrgMembers(req.params.orgId);
  
  const canAdd = await checkSeatLimit(
    req,
    res,
    req.params.orgId,
    currentMemberCount,
    1 // adding 1 member
  );
  
  if (!canAdd) {
    // Response already sent with 402 error
    return;
  }
  
  // Proceed with invitation
}
```

### Manual Tier Checking

```typescript
import { subscriptionService } from './server/subscription-service';

// Check if org has feature access
const hasWorkspaces = await subscriptionService.hasFeatureAccess(
  orgId,
  'hasWorkspaces'
);

if (!hasWorkspaces) {
  return res.status(402).json({
    error: 'Workspaces require Business tier or higher',
    code: 'UPGRADE_REQUIRED',
    upgrade_url: subscriptionService.getUpgradeUrl(currentTier),
  });
}
```

## API Endpoints

### GET /api/subscriptions/plans

Get all available subscription plans (public endpoint).

**Response:**
```json
{
  "plans": [
    {
      "tier": "business",
      "display_name": "Business",
      "seats": "10",
      "max_workspaces": 10,
      "features": {
        "organizations": true,
        "workspaces": true,
        "activity": true,
        "realtime": false,
        "api_keys": true,
        "priority_support": false
      },
      "rate_limit": 300
    }
  ]
}
```

### GET /api/orgs/:orgId/subscription

Get organization's current subscription details.

**Requires:** Org membership

**Response:**
```json
{
  "tier": "business",
  "plan_name": "Business",
  "seat_limit": "10",
  "limits": {
    "seats": 10,
    "workspaces": 10,
    "documents_per_workspace": 500,
    "rate_limit": 300
  },
  "features": {
    "organizations": true,
    "workspaces": true,
    "activity": true,
    "realtime": false,
    "api_keys": true,
    "priority_support": false
  },
  "stripe": {
    "customer_id": "cus_xxx",
    "subscription_id": "sub_xxx"
  }
}
```

### GET /api/orgs/:orgId/subscription/upgrade-options

Get available upgrade options for organization.

**Requires:** Org admin

**Response:**
```json
{
  "current_tier": "business",
  "upgrade_options": [
    {
      "tier": "enterprise",
      "display_name": "Enterprise",
      "upgrade_url": "https://app.com/settings/billing/upgrade?to=enterprise",
      "seats": "50",
      "max_workspaces": 50,
      "features": { ... },
      "rate_limit": 1000
    }
  ]
}
```

### POST /api/orgs/:orgId/subscription/upgrade

Initiate upgrade process (creates Stripe checkout session).

**Requires:** Org admin

**Request:**
```json
{
  "target_tier": "enterprise",
  "price_id": "price_enterprise_monthly"
}
```

**Response:**
```json
{
  "checkout_url": "https://checkout.stripe.com/...",
  "target_tier": "enterprise"
}
```

### POST /api/subscriptions/recommend

Get recommended tier based on requirements.

**Request:**
```json
{
  "needs_organizations": true,
  "needs_workspaces": true,
  "needs_realtime": false,
  "needs_api_keys": true,
  "min_seats": 15
}
```

**Response:**
```json
{
  "recommended_tier": "business",
  "plan_name": "Business",
  "seats": "10",
  "features": { ... }
}
```

## Error Responses

All subscription-gated endpoints return 402 Payment Required when the tier is insufficient:

```json
{
  "error": "This feature requires Business plan or higher",
  "code": "UPGRADE_REQUIRED",
  "current_tier": "starter",
  "required_tier": "business",
  "upgrade_url": "https://app.com/settings/billing/upgrade?to=business"
}
```

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UPGRADE_REQUIRED` | 402 | Plan tier insufficient |
| `FEATURE_NOT_AVAILABLE` | 402 | Feature not in plan |
| `SEAT_LIMIT_REACHED` | 402 | No seats available |
| `WORKSPACE_LIMIT_REACHED` | 402 | Workspace limit exceeded |
| `INVALID_UPGRADE` | 400 | Target tier not higher |

## Stripe Integration

### Webhook Setup

1. Add webhook endpoint to Stripe dashboard:
   ```
   POST /api/webhooks/stripe
   ```

2. Select events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.trial_will_end`

3. Copy webhook secret to `.env`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### Price ID Mapping

Update `STRIPE_PRICE_TO_TIER` in `server/subscription-service.ts`:

```typescript
const STRIPE_PRICE_TO_TIER: Record<string, SubscriptionTier> = {
  'price_business_monthly': SubscriptionTier.BUSINESS,
  'price_business_yearly': SubscriptionTier.BUSINESS,
  'price_enterprise_monthly': SubscriptionTier.ENTERPRISE,
  'price_enterprise_yearly': SubscriptionTier.ENTERPRISE,
  // ... your actual Stripe price IDs
};
```

### Webhook Flow

```
1. User upgrades to Business
   ├─ Frontend calls POST /api/orgs/:id/subscription/upgrade
   ├─ Creates Stripe checkout session
   └─ Redirects to Stripe hosted checkout

2. User completes payment
   ├─ Stripe sends customer.subscription.created webhook
   ├─ Webhook handler updates organization tier
   └─ Organization now has Business features

3. Subscription renews monthly
   ├─ Stripe sends customer.subscription.updated webhook
   └─ Tier remains Business

4. User cancels subscription
   ├─ Stripe sends customer.subscription.deleted webhook
   ├─ Webhook handler downgrades to Free tier
   └─ Organization loses Business features
```

## Testing

### Manual Testing

```bash
# Get all plans
curl http://localhost:3000/api/subscriptions/plans

# Get org subscription
curl -H "Authorization: Bearer $TOKEN" \
     -H "X-Org-Id: org_123" \
     http://localhost:3000/api/orgs/org_123/subscription

# Get upgrade options
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "X-Org-Id: org_123" \
     http://localhost:3000/api/orgs/org_123/subscription/upgrade-options

# Initiate upgrade
curl -X POST http://localhost:3000/api/orgs/org_123/subscription/upgrade \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "X-Org-Id: org_123" \
     -H "Content-Type: application/json" \
     -d '{"target_tier": "business", "price_id": "price_business_monthly"}'
```

### Simulating Webhooks

For local testing without Stripe:

```typescript
// Manually update org tier
await subscriptionService.updateOrganizationTier(
  'org_123',
  SubscriptionTier.BUSINESS,
  'sub_test_123'
);
```

## Best Practices

### 1. Always Load Context

Ensure subscription context is loaded before checking features:

```typescript
app.use(loadOrganizationContext());
app.use(loadSubscriptionContext());  // Must be after org context
```

### 2. Use Middleware for Routes

Prefer middleware over manual checks:

```typescript
// Good
router.post('/workspaces',
  requireSubscriptionTier(SubscriptionTier.BUSINESS),
  createWorkspace
);

// Avoid manual checks in route handlers
```

### 3. Provide Upgrade URLs

Always include upgrade URLs in 402 responses:

```typescript
return res.status(402).json({
  error: 'Feature requires upgrade',
  code: 'UPGRADE_REQUIRED',
  upgrade_url: subscriptionService.getUpgradeUrl(currentTier),
});
```

### 4. Check Limits Before Operations

Check seat/workspace limits before expensive operations:

```typescript
// Check first
const canAdd = await checkSeatLimit(req, res, orgId, currentCount, addCount);
if (!canAdd) return;

// Then proceed with expensive work
await createInvitation(...);
```

## Troubleshooting

### Organization showing wrong tier

1. Check `organizations.billing_tier` in database
2. Verify Stripe subscription is active
3. Check webhook logs for delivery failures
4. Manually trigger webhook: `POST /api/webhooks/stripe`

### Seat limit not enforcing

1. Verify `seat_limit` column has correct value
2. Check if limit is null (means unlimited)
3. Ensure invitation/member creation uses `checkSeatLimit`

### 402 errors when should have access

1. Verify subscription context is loaded
2. Check org membership is active
3. Verify billing_tier matches expected value
4. Check feature flags are enabled

---

**Status:** ✅ Production-ready  
**Date:** 2025-10-01  
**Dependencies:** Stripe (optional for full billing integration)
