# Tiered Subscription System Setup Guide

## Overview

This project now includes a comprehensive tiered subscription system based on different OpenAI models, with pricing designed to provide a 5x profit margin over actual AI costs. Each subscription tier uses a different LLM model, from GPT-3.5-Turbo for the free tier to o1-preview for enterprise customers.

## Subscription Tiers

### Tier Structure & Pricing

| Tier | Model | Monthly Price | Documents/Month | AI Cost per Doc | Profit Margin |
|------|-------|---------------|-----------------|-----------------|---------------|
| **Free** | GPT-3.5-Turbo | $0 | 3 | $0.00425 | N/A |
| **Starter** | GPT-4o-mini | $15 | 50 | $0.00135 | ~222x |
| **Professional** | GPT-4o | $75 | 200 | $0.02 | ~19x |
| **Business** | GPT-4-Turbo | $250 | 500 | $0.065 | ~7.7x |
| **Enterprise** | o1-preview | $500 | 1000+ | $0.12 | ~4.2x |

### Features by Tier

- **Free**: Basic analysis, community support, 3 docs/month
- **Starter**: Enhanced analysis, email support, exports, 50 docs/month
- **Professional**: Priority processing, chat support, API access, advanced features
- **Business**: 24/7 support, unlimited API, white-label options, team features
- **Enterprise**: Dedicated support, custom deployments, SLA, o1-preview reasoning

## Setup Instructions

### 1. Stripe Configuration

#### Environment Variables
Add these to your `.env` file:

```bash
# Required for subscription management
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
VITE_STRIPE_PUBLIC_KEY=pk_test_your_stripe_public_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Your existing OpenAI key
OPENAI_API_KEY=sk-your-openai-api-key-here
```

#### Initialize Stripe Products
After deploying, run this once to create Stripe products and prices:

```bash
curl -X POST https://your-domain.com/api/admin/init-stripe-products \
  -H "Authorization: Bearer your-admin-token"
```

Or access the endpoint through your admin panel at `/api/admin/init-stripe-products`

### 2. Webhook Configuration

Set up webhooks in your Stripe dashboard:

1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://your-domain.com/api/subscription-webhook`
3. Select these events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the webhook secret to your `.env` file

### 3. Database Schema (Future Enhancement)

While the current implementation uses in-memory storage for demonstration, you'll want to implement these database tables:

```sql
-- User subscriptions
CREATE TABLE user_subscriptions (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  tier_id VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Usage tracking
CREATE TABLE usage_records (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  subscription_id VARCHAR(255) NOT NULL,
  period VARCHAR(7) NOT NULL, -- YYYY-MM
  documents_analyzed INT DEFAULT 0,
  tokens_used BIGINT DEFAULT 0,
  cost DECIMAL(10,6) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## API Endpoints

### Subscription Management

- `GET /api/subscription/tiers` - Get all available subscription tiers
- `GET /api/user/subscription` - Get current user's subscription and usage
- `POST /api/subscription/create` - Create a new subscription
- `POST /api/subscription/cancel` - Cancel a subscription
- `POST /api/subscription/upgrade` - Upgrade/downgrade subscription tier
- `POST /api/subscription-webhook` - Stripe webhook handler

### Admin Endpoints

- `POST /api/admin/init-stripe-products` - Initialize Stripe products (run once)

## Implementation Details

### Model Selection Logic

The system automatically selects the appropriate OpenAI model based on the user's subscription tier:

```typescript
// In your document analysis endpoint
const userTier = await getUserSubscriptionTier(userId);
const model = userTier.model; // e.g., "gpt-4o", "gpt-3.5-turbo"

const analysis = await analyzeDocument(content, title, ip, userAgent, sessionId, model);
```

### Usage Tracking

Each document analysis automatically tracks:
- Tokens used (input + output)
- Actual AI cost
- Document count
- Timestamp

### Profit Margin Calculation

Pricing is calculated with built-in profit margins:

```typescript
// Example for Starter tier (GPT-4o-mini)
const costPerDocument = 0.00135; // Actual OpenAI cost
const monthlyLimit = 50; // Documents per month
const monthlyCost = costPerDocument * monthlyLimit; // $0.0675
const price = 15; // Our price: $15/month
const profitMargin = (price - monthlyCost) / monthlyCost; // ~222x margin
```

## Testing

### Test Cards for Stripe

Use these test card numbers in development:

- **Successful payment**: `4242 4242 4242 4242`
- **Declined payment**: `4000 0000 0000 0002`
- **Requires authentication**: `4000 0025 0000 3155`

### Testing Workflow

1. Visit `/subscription` to view plans
2. Select a paid tier
3. Complete checkout with test card
4. Verify subscription is active
5. Test document analysis with new model
6. Check usage tracking
7. Test cancellation/upgrading

## Security Features

- Rate limiting on subscription endpoints
- Webhook signature verification
- Secure payment processing via Stripe
- Usage validation and limits
- Audit logging for all subscription events

## Monitoring

Key metrics to monitor:

- Subscription conversion rates
- Monthly recurring revenue (MRR)
- Usage patterns by tier
- Support ticket volume by tier
- Model costs vs. revenue
- Churn rates

## Troubleshooting

### Common Issues

1. **Stripe webhook failures**
   - Verify webhook secret in environment
   - Check endpoint URL is accessible
   - Review webhook logs in Stripe dashboard

2. **Model selection errors**
   - Ensure subscription tier is properly set
   - Verify OpenAI API key has access to requested model
   - Check rate limits

3. **Usage tracking issues**
   - Verify database connections
   - Check token counting accuracy
   - Monitor for double-counting

### Support Escalation

- **Free tier**: Community support, documentation
- **Starter**: Email support within 48 hours
- **Professional**: Priority email + chat support within 24 hours
- **Business**: 24/7 support within 4 hours
- **Enterprise**: Dedicated account manager, custom SLA

## Revenue Projections

Based on conservative estimates:

| Tier | Monthly Users | Revenue/Month | AI Costs | Net Profit |
|------|---------------|---------------|----------|------------|
| Starter | 100 | $1,500 | $6.75 | $1,493.25 |
| Professional | 50 | $3,750 | $200 | $3,550 |
| Business | 20 | $5,000 | $650 | $4,350 |
| Enterprise | 5 | $2,500 | $600 | $1,900 |
| **Total** | **175** | **$12,750** | **$1,456.75** | **$11,293.25** |

This represents an 88.6% profit margin while providing transparent, fair pricing based on actual AI costs.

## Next Steps

1. Set up Stripe account and configure webhooks
2. Initialize Stripe products using the admin endpoint
3. Implement user authentication (currently using session IDs)
4. Add database persistence for production use
5. Set up monitoring and analytics
6. Configure email notifications for subscription events
7. Add more advanced features like team management for Business/Enterprise tiers

The subscription system is designed to be transparent, profitable, and scalable while providing clear value at each tier through progressively more powerful AI models.
