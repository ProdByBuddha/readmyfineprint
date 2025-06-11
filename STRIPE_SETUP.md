# Stripe Payment Setup Guide

This guide will help you set up Stripe payments for the ReadMyFinePrint donation system.

## Prerequisites

1. A Stripe account (sign up at [stripe.com](https://stripe.com))
2. Access to your Stripe Dashboard

## Setup Steps

### 1. Get Your Stripe Keys

1. Log into your [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **API keys**
3. Copy your **Publishable key** and **Secret key**
   - For testing: Use keys that start with `pk_test_` and `sk_test_`
   - For production: Use keys that start with `pk_live_` and `sk_live_`

### 2. Configure Environment Variables

1. Copy the `env.example` file to `.env`:
   ```bash
   cp env.example .env
   ```

2. Add your Stripe keys to the `.env` file:
   ```env
   # Required for Stripe payment processing
   STRIPE_SECRET_KEY=sk_test_your_actual_secret_key_here
   VITE_STRIPE_PUBLIC_KEY=pk_test_your_actual_publishable_key_here
   ```

### 3. Set Up Webhooks (Recommended)

Webhooks allow Stripe to notify your application about payment events.

1. In your Stripe Dashboard, go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Set the endpoint URL to: `https://yourdomain.com/api/stripe-webhook`
   - For local development: `https://your-ngrok-url.ngrok.io/api/stripe-webhook`
4. Select the following events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Click **Add endpoint**
6. Copy the **Signing secret** and add it to your `.env` file:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_signing_secret_here
   ```

### 4. Local Development with Webhooks

For local development, use ngrok to expose your local server:

1. Install ngrok: https://ngrok.com/download
2. Start your development server:
   ```bash
   npm run dev
   ```
3. In a new terminal, expose your local server:
   ```bash
   ngrok http 3000
   ```
4. Use the ngrok URL for your webhook endpoint in Stripe

### 5. Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```
2. Navigate to `/donate` in your application
3. Try making a test donation with these test card numbers:
   - **Successful payment**: `4242424242424242`
   - **Declined payment**: `4000000000000002`
   - **3D Secure required**: `4000002500003155`

   Use any future expiry date, any 3-digit CVC, and any postal code.

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `STRIPE_SECRET_KEY` | Yes | Your Stripe secret key (starts with `sk_`) |
| `VITE_STRIPE_PUBLIC_KEY` | Yes | Your Stripe publishable key (starts with `pk_`) |
| `STRIPE_WEBHOOK_SECRET` | No | Webhook signing secret for verifying webhook authenticity |

## Security Notes

- **Never** commit your `.env` file or expose your secret keys
- Use test keys during development
- Set up webhook signature verification in production
- Enable HTTPS in production for webhook endpoints
- Consider implementing rate limiting for payment endpoints

## Troubleshooting

### Common Issues

1. **"Stripe has not loaded properly"**
   - Check that `VITE_STRIPE_PUBLIC_KEY` is set correctly
   - Ensure the key starts with `pk_test_` or `pk_live_`

2. **"Failed to create payment intent"**
   - Verify `STRIPE_SECRET_KEY` is set correctly
   - Check server logs for detailed error messages
   - Ensure the secret key starts with `sk_test_` or `sk_live_`

3. **Webhook events not received**
   - Verify the webhook URL is accessible
   - Check that the webhook secret is configured correctly
   - Review webhook delivery logs in Stripe Dashboard

### Testing Webhook Endpoints

You can test your webhook endpoint using the Stripe CLI:

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Forward events to your local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe-webhook
   ```

## Production Deployment

Before going live:

1. Switch to live Stripe keys
2. Update webhook endpoints to use production URLs
3. Enable webhook signature verification
4. Set up monitoring for payment events
5. Test the complete payment flow with live keys (in test mode)

## Support

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Stripe Testing Guide](https://stripe.com/docs/testing)
