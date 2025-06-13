# Stripe Integration Setup Guide

## Overview

This project has a **complete Stripe payment integration** already implemented! You just need to configure your API keys to activate it.

## What's Already Implemented ✅

### Frontend Components
- **ExpressCheckoutForm** - Apple Pay, Google Pay, Link, PayPal
- **DonationForm** - Traditional card payment form
- **StripePaymentForm** - Stripe Elements integration
- **StripeWrapper** - Stripe provider with error handling

### Backend Integration
- Payment intent creation (`/api/create-payment-intent`)
- Payment processing (`/api/process-donation`)
- Webhook handling (`/api/stripe-webhook`)
- Security logging and validation
- Error handling and card validation

### Features
- Multiple payment methods (cards, Apple Pay, Google Pay, etc.)
- Real-time card validation
- Error handling and user feedback
- Security logging
- Webhook support for payment confirmations
- External Stripe checkout fallback

## Setup Instructions

### 1. Create Stripe Account
1. Go to [https://stripe.com](https://stripe.com)
2. Sign up for a free account
3. Complete account verification

### 2. Get API Keys
1. Log into your [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
2. Copy your **test** keys (for development):
   - **Publishable key** (starts with `pk_test_`)
   - **Secret key** (starts with `sk_test_`)

### 3. Configure Environment Variables

Create a `.env` file in your project root:

```bash
# Required for Stripe payment processing
STRIPE_SECRET_KEY=sk_test_your_actual_stripe_secret_key_here
VITE_STRIPE_PUBLIC_KEY=pk_test_your_actual_stripe_publishable_key_here

# Optional: Webhook secret for payment confirmations
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Your existing environment variables
OPENAI_API_KEY=sk-your-openai-api-key-here
NODE_ENV=development
```

### 4. Test the Integration

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to `/donate` in your browser

3. Test with Stripe's test card numbers:
   - **Successful payment**: `4242 4242 4242 4242`
   - **Declined payment**: `4000 0000 0000 0002`
   - **Requires authentication**: `4000 0025 0000 3155`

### 5. Webhook Setup (Optional but Recommended)

1. In your Stripe Dashboard, go to **Webhooks**
2. Click **Add endpoint**
3. Set the URL to: `https://your-domain.com/api/stripe-webhook`
4. Select events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copy the webhook secret to your `.env` file

## Payment Flow

1. **Amount Selection**: User selects or enters donation amount
2. **Payment Method Choice**:
   - **Express Checkout**: Apple Pay, Google Pay, Link, PayPal (one-click)
   - **Card Form**: Traditional card entry with validation
   - **External Checkout**: Fallback Stripe hosted page
3. **Processing**: Secure payment processing via Stripe
4. **Confirmation**: Success page with receipt

## Security Features

- PCI DSS compliant through Stripe
- No card data stored on your servers
- SSL encryption for all transactions
- Rate limiting and request validation
- Security event logging
- CSRF protection

## Production Deployment

### Switch to Live Keys
1. In Stripe Dashboard, switch to **Live** mode
2. Get your live API keys
3. Update your production environment variables:
   ```bash
   STRIPE_SECRET_KEY=sk_live_your_live_secret_key
   VITE_STRIPE_PUBLIC_KEY=pk_live_your_live_publishable_key
   NODE_ENV=production
   ```

### Update Webhook URL
- Change webhook endpoint to your production domain
- Update the webhook secret in your environment

## Troubleshooting

### Common Issues

1. **"Stripe public key not configured"**
   - Check that `VITE_STRIPE_PUBLIC_KEY` is set in your `.env`
   - Ensure the key starts with `pk_test_` or `pk_live_`

2. **"Payment processor failed to load"**
   - Verify your Stripe public key is valid
   - Check browser console for JavaScript errors
   - Ensure you have a stable internet connection

3. **"Payment endpoint not configured"**
   - Verify `STRIPE_SECRET_KEY` is set in your `.env`
   - Check that your server is running
   - Ensure the key starts with `sk_test_` or `sk_live_`

### Test Card Numbers

Use these test cards in **test mode only**:

| Card Number | Description |
|-------------|-------------|
| 4242 4242 4242 4242 | Successful payment |
| 4000 0000 0000 0002 | Declined (generic) |
| 4000 0000 0000 9995 | Declined (insufficient funds) |
| 4000 0025 0000 3155 | Requires 3D Secure authentication |

## Support

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Support](https://support.stripe.com/)
- Check the browser console for detailed error messages
- Review server logs for backend issues

---

🎉 **That's it!** Your Stripe integration is ready to accept donations.
