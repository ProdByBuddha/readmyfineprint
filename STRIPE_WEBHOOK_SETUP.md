# Stripe Webhook Configuration Guide

## Overview
Your application is configured to receive Stripe webhook events at:
**`https://readmyfineprint.com/api/stripe-webhook`**

## Step-by-Step Setup

### 1. Access Stripe Dashboard
Go to: https://dashboard.stripe.com/webhooks

### 2. Add Webhook Endpoint
Click **"Add endpoint"** button

### 3. Configure Endpoint
- **Endpoint URL**: `https://readmyfineprint.com/api/stripe-webhook`
- **Description**: Production webhook for subscription management (optional)

### 4. Select Events to Listen To
Select the following events (all handled in your code):

✅ **customer.subscription.created**
   - Triggered when a new subscription is created
   - Creates subscription in your database

✅ **customer.subscription.updated**
   - Triggered when subscription status changes (active, canceled, etc.)
   - Updates subscription tier and status

✅ **customer.subscription.deleted**
   - Triggered when a subscription is deleted
   - Downgrades organization to FREE tier

✅ **customer.subscription.trial_will_end**
   - Triggered 3 days before trial ends
   - Used for sending reminder emails

### 5. Get Signing Secret
After creating the webhook:
1. Click on the webhook endpoint you just created
2. Click **"Reveal"** next to "Signing secret"
3. Copy the secret (starts with `whsec_...`)

### 6. Update Environment Variable
Update your `.env` file with the new signing secret if it's different:

```bash
STRIPE_WEBHOOK_SECRET=whsec_your_new_secret_here
```

**Current secret configured**: `whsec_0Tjd5vmi4MWYmgnXyhxt8o7YuD1FTVib`

### 7. Verify Webhook
After setup, you can:
1. Use Stripe Dashboard's "Send test webhook" button
2. Monitor webhook attempts in the Stripe Dashboard
3. Check your application logs for webhook processing

## Testing Webhooks

### Test with Stripe CLI (if available)
```bash
stripe listen --forward-to https://readmyfineprint.com/api/stripe-webhook
stripe trigger customer.subscription.created
```

### Test via Stripe Dashboard
1. Go to your webhook endpoint page
2. Click "Send test webhook"
3. Select event type (e.g., `customer.subscription.created`)
4. Click "Send test webhook"

## Webhook Event Handlers

Your application handles these events in `server/stripe-webhook.ts`:

| Event | Action |
|-------|--------|
| `subscription.created` | Updates org with new tier and subscription ID |
| `subscription.updated` | Updates tier based on status (active/canceled/etc) |
| `subscription.deleted` | Downgrades org to FREE tier |
| `trial_will_end` | Logs trial ending (email notification TODO) |

## Price ID Mapping

Your current Stripe price IDs are mapped in `server/subscription-service.ts`:

- **STARTER**
  - Monthly: `price_1SDLWeQd9szft5zEfCK9YOvA`
  - Yearly: `price_1SDM4jQd9szft5zEMXyN0dSd`

- **PROFESSIONAL**
  - Monthly: `price_1SDMCRQd9szft5zE1q5CpYg6`
  - Yearly: `price_1SDMCSQd9szft5zEx3rozWrQ`

- **BUSINESS**
  - Monthly: `price_1SDMHHQd9szft5zEvUJDB10s`
  - Yearly: `price_1SDMHHQd9szft5zEU2K5N1fy`

- **ENTERPRISE**
  - Monthly: `price_1SDMM1Qd9szft5zE53KobCmz`
  - Yearly: `price_1SDMM1Qd9szft5zEn3PQjFk3`

## Troubleshooting

### Webhook Not Receiving Events
1. Check endpoint URL is correct in Stripe Dashboard
2. Verify signing secret in `.env` matches Stripe Dashboard
3. Check application logs for errors
4. Ensure server is deployed and accessible

### Signature Verification Failing
- The signing secret must match exactly
- Webhook secret is different for test vs live mode
- Check if you're using the correct mode's secret

### Events Not Processing
- Check application logs: `server/stripe-webhook.ts` logs all events
- Verify organization has a `stripe_customer_id` set
- Ensure database is accessible

## Next Steps

1. ✅ Stripe products and prices created
2. ✅ Price IDs updated in application code
3. 🔄 **Configure webhook in Stripe Dashboard** (do this now)
4. ⏭️  Test subscription flow end-to-end
5. ⏭️  Set up email notifications for trial endings
6. ⏭️  Configure Stripe Customer Portal settings

## Security Notes

- Webhook signature verification is enabled (required)
- Only events with valid signatures are processed
- Failed verifications return 400 status
- All webhook events are logged for monitoring
