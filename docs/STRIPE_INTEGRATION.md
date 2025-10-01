# Stripe Integration - Complete Implementation

## Overview

The Stripe integration is now **fully implemented** with real API calls to Stripe for subscription management, checkout, and billing.

## Setup Requirements

### 1. Environment Variables

Add these to your `.env` file:

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_xxx  # or sk_live_xxx for production
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Application URL (for redirect URLs)
APP_URL=https://your-domain.com
```

### 2. Stripe Dashboard Configuration

#### Create Products and Prices

Create a product for each tier in Stripe Dashboard, then create monthly/yearly prices:

**Starter Plan:**
- `price_starter_monthly` - $9/month
- `price_starter_yearly` - $90/year

**Professional Plan:**
- `price_professional_monthly` - $29/month
- `price_professional_yearly` - $290/year

**Business Plan:**
- `price_business_monthly` - $99/month
- `price_business_yearly` - $990/year

**Enterprise Plan:**
- `price_enterprise_monthly` - $299/month
- `price_enterprise_yearly` - $2990/year

#### Update Price ID Mapping

Edit `server/subscription-service.ts` and update the `STRIPE_PRICE_TO_TIER` mapping with your actual price IDs:

```typescript
const STRIPE_PRICE_TO_TIER: Record<string, SubscriptionTier> = {
  'price_123abc': SubscriptionTier.STARTER,
  'price_456def': SubscriptionTier.STARTER,
  'price_789ghi': SubscriptionTier.PROFESSIONAL,
  // ... add your actual price IDs
};
```

#### Configure Webhook

1. Go to **Developers → Webhooks** in Stripe Dashboard
2. Click **Add endpoint**
3. Set endpoint URL: `https://your-domain.com/api/webhooks/stripe`
4. Select events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.trial_will_end`
5. Copy the **Signing secret** to `STRIPE_WEBHOOK_SECRET` in `.env`

## Implementation Details

### Webhook Handler (`server/stripe-webhook.ts`)

**Features:**
- ✅ Real Stripe SDK initialization
- ✅ Webhook signature verification
- ✅ Event type handling
- ✅ Automatic tier updates
- ✅ ULTIMATE tier protection (won't downgrade)

**Event Handlers:**

1. **`customer.subscription.created`**
   - Finds org by customer ID
   - Derives tier from price ID
   - Updates organization tier

2. **`customer.subscription.updated`**
   - Handles status changes
   - Downgrades on `canceled`, `unpaid`, `incomplete_expired`
   - Upgrades on `active`, `trialing`

3. **`customer.subscription.deleted`**
   - Downgrades to FREE
   - Preserves ULTIMATE tier (internal protection)

4. **`customer.subscription.trial_will_end`**
   - Logs trial expiration
   - TODO: Send email notification

### Helper Functions

#### `createStripeCustomer(orgId, email, name)`
Creates a Stripe customer with organization metadata.

```typescript
const customerId = await createStripeCustomer(
  'org_123',
  'admin@company.com',
  'Acme Corp'
);
```

#### `createCheckoutSession(orgId, priceId, successUrl, cancelUrl)`
Creates a Stripe Checkout session for subscription purchase.

- Auto-creates customer if needed
- Supports promotion codes
- Includes org_id in metadata

```typescript
const checkoutUrl = await createCheckoutSession(
  'org_123',
  'price_professional_monthly',
  'https://app.com/success',
  'https://app.com/cancel'
);
```

#### `createPortalSession(orgId, returnUrl)`
Creates a customer portal session for subscription management.

- Requires existing Stripe customer
- Allows customers to update payment, cancel, view invoices

```typescript
const portalUrl = await createPortalSession(
  'org_123',
  'https://app.com/settings/billing'
);
```

#### `cancelSubscription(orgId)`
Cancels subscription immediately.

```typescript
await cancelSubscription('org_123');
```

#### `getStripeSubscription(subscriptionId)`
Retrieves subscription details from Stripe.

```typescript
const subscription = await getStripeSubscription('sub_123');
if (subscription) {
  console.log(subscription.status);
}
```

## API Endpoints

### Upgrade to Plan

**POST** `/api/orgs/:orgId/subscription/upgrade`

**Request:**
```json
{
  "target_tier": "professional",
  "price_id": "price_professional_monthly"
}
```

**Response:**
```json
{
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_test_...",
  "target_tier": "professional"
}
```

**Flow:**
1. User clicks "Upgrade" button
2. Frontend calls this endpoint
3. Backend creates Stripe customer (if needed)
4. Backend creates checkout session
5. Frontend redirects to `checkout_url`
6. User completes payment on Stripe
7. Webhook updates organization tier
8. User redirected to success URL

### Customer Portal

**POST** `/api/orgs/:orgId/subscription/portal`

**Response:**
```json
{
  "portal_url": "https://billing.stripe.com/p/session/..."
}
```

**Use Cases:**
- Update payment method
- View invoices
- Cancel subscription
- Update billing address

### Webhook Endpoint

**POST** `/api/webhooks/stripe`

**Headers:**
- `stripe-signature` - Webhook signature for verification

**Note:** This endpoint should use `express.raw()` middleware to receive the raw body for signature verification.

## Express Setup

### Raw Body for Webhooks

Webhooks require raw body for signature verification:

```typescript
// In your Express app setup
import express from 'express';
import { handleStripeWebhook } from './server/stripe-webhook';

const app = express();

// Use raw body for webhook endpoint
app.post(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  handleStripeWebhook
);

// Use JSON parser for other routes
app.use(express.json());
```

## Testing

### Local Testing with Stripe CLI

1. **Install Stripe CLI:**
```bash
brew install stripe/stripe-cli/stripe
# or download from https://stripe.com/docs/stripe-cli
```

2. **Login:**
```bash
stripe login
```

3. **Forward webhooks to local:**
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

4. **Get webhook secret:**
The CLI will output a webhook signing secret like `whsec_xxx`. Use this in your local `.env`.

5. **Trigger test events:**
```bash
# Test subscription created
stripe trigger customer.subscription.created

# Test subscription updated
stripe trigger customer.subscription.updated
```

### Manual Testing Flow

1. **Create organization** with FREE tier

2. **Initiate upgrade:**
```bash
curl -X POST http://localhost:3000/api/orgs/org_123/subscription/upgrade \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Org-Id: org_123" \
  -H "Content-Type: application/json" \
  -d '{
    "target_tier": "professional",
    "price_id": "price_professional_monthly"
  }'
```

3. **Complete checkout** in returned URL

4. **Verify webhook** received and org updated

5. **Check organization subscription:**
```bash
curl http://localhost:3000/api/orgs/org_123/subscription \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Org-Id: org_123"
```

## Security Considerations

### 1. Webhook Signature Verification

✅ **Implemented:** All webhooks verify signature using `stripe.webhooks.constructEvent()`

**Why:** Prevents malicious actors from sending fake webhook events.

### 2. ULTIMATE Tier Protection

✅ **Implemented:** Subscription deletions don't downgrade ULTIMATE tier

```typescript
if (org.billing_tier === SubscriptionTier.ULTIMATE) {
  console.log('ULTIMATE tier protected, skipping downgrade');
  return;
}
```

### 3. Customer Metadata

✅ **Implemented:** Store `org_id` in Stripe customer metadata

**Benefit:** Easy to match Stripe customers to organizations.

### 4. Idempotent Operations

✅ **Implemented:** Multiple webhook deliveries won't cause issues

**How:** Using Stripe's subscription ID as source of truth.

## Error Handling

### Common Errors

**"No Stripe customer found"**
- Organization doesn't have `stripe_customer_id`
- Solution: Customer is auto-created on first checkout

**"Failed to create checkout session"**
- Invalid price ID
- Stripe API error
- Solution: Check price ID mapping and Stripe dashboard

**"Invalid signature"**
- Wrong webhook secret
- Modified webhook payload
- Solution: Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard

**"Organization not found for Stripe customer"**
- Customer exists in Stripe but not linked to org
- Solution: Ensure `stripe_customer_id` is set in database

## Monitoring

### Logs to Watch

```typescript
// Success
"Created Stripe customer cus_xxx for org org_123"
"Created checkout session cs_xxx for org org_123"
"Organization org_123 upgraded to professional"

// Webhooks
"Received Stripe webhook: customer.subscription.created"
"Organization org_123 upgraded to professional (subscription: sub_xxx)"

// Errors
"Organization not found for Stripe customer cus_xxx"
"Webhook signature verification failed"
```

### Stripe Dashboard

Monitor in **Developers → Webhooks**:
- Delivery success/failure rate
- Event logs
- Retry attempts

## Production Checklist

- [ ] Replace test keys with live keys
- [ ] Update price IDs to production IDs
- [ ] Configure production webhook endpoint
- [ ] Test webhook delivery in production
- [ ] Enable Stripe Radar (fraud protection)
- [ ] Set up billing email notifications
- [ ] Configure tax settings if applicable
- [ ] Test full upgrade/downgrade flow
- [ ] Monitor webhook logs for first week
- [ ] Set up Stripe dashboard alerts

## Troubleshooting

### Webhook Not Received

1. Check webhook URL is accessible publicly
2. Verify webhook is enabled in Stripe dashboard
3. Check Stripe dashboard → Webhooks → Recent events
4. Look for failed deliveries and retry manually
5. Verify endpoint uses `express.raw()` middleware

### Subscription Not Updating

1. Check webhook event type is handled
2. Verify price ID is in `STRIPE_PRICE_TO_TIER` mapping
3. Check database for `stripe_subscription_id`
4. Look for errors in application logs
5. Manually verify subscription in Stripe dashboard

### Checkout Session Fails

1. Verify `STRIPE_SECRET_KEY` is correct
2. Check price ID exists in Stripe
3. Verify success/cancel URLs are valid
4. Check for Stripe API errors in logs
5. Ensure customer has valid email

## Future Enhancements

- [ ] Add metered billing for API usage
- [ ] Implement usage-based pricing
- [ ] Add invoice.paid webhook for custom logic
- [ ] Support multiple payment methods
- [ ] Add subscription pause/resume
- [ ] Implement prorated upgrades
- [ ] Add referral/affiliate tracking
- [ ] Support tax ID collection
- [ ] Add payment failed retry logic

---

**Status:** ✅ Fully Implemented  
**Date:** 2025-10-01  
**Stripe SDK Version:** 18.5.0
