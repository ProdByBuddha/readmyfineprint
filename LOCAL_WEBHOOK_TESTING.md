# Local Webhook Testing Instructions

## Current Situation
- Your dev server is NOT running (hence the "connection refused" errors)
- You need to start the server and update the webhook secret for local testing

## Step-by-Step Guide

### Step 1: Backup Current Production Secret
```bash
echo "STRIPE_WEBHOOK_SECRET_PRODUCTION=whsec_0Tjd5vmi4MWYmgnXyhxt8o7YuD1FTVib" >> .env.backup
```

### Step 2: Update .env with Temporary Test Secret
```bash
# Replace the STRIPE_WEBHOOK_SECRET in .env with the test secret
sed -i 's/STRIPE_WEBHOOK_SECRET=.*/STRIPE_WEBHOOK_SECRET=whsec_97fb4c87601b6f905c3bff73bce59e9b870874222b666ba1cb1b524378d29a69/' .env
```

### Step 3: Start Your Dev Server
```bash
npm run dev
```

### Step 4: In a NEW Terminal - Start Stripe Listen
```bash
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

### Step 5: In ANOTHER Terminal - Trigger Test Events
```bash
stripe trigger customer.subscription.created
```

### Step 6: After Testing - Restore Production Secret
```bash
sed -i 's/STRIPE_WEBHOOK_SECRET=.*/STRIPE_WEBHOOK_SECRET=whsec_0Tjd5vmi4MWYmgnXyhxt8o7YuD1FTVib/' .env
```

## Quick Test Script

Here's a script that does it all:

```bash
# 1. Update webhook secret for testing
sed -i.bak 's/STRIPE_WEBHOOK_SECRET=.*/STRIPE_WEBHOOK_SECRET=whsec_97fb4c87601b6f905c3bff73bce59e9b870874222b666ba1cb1b524378d29a69/' .env

# 2. Start dev server (run in background or separate terminal)
npm run dev &
SERVER_PID=$!

# 3. Wait for server to start
sleep 5

# 4. In another terminal, run:
# stripe listen --forward-to localhost:3000/api/stripe-webhook

# 5. Then trigger events:
# stripe trigger customer.subscription.created

# 6. When done, restore production secret and stop server
kill $SERVER_PID
mv .env.bak .env
```

## Alternative: Test with Production Webhook Instead

Since local testing requires multiple terminals and temporary changes, you might prefer to:

1. **Configure the production webhook in Stripe Dashboard**
   - URL: `https://readmyfineprint.com/api/stripe-webhook`
   - Events: subscription.created, updated, deleted, trial_will_end
   - Get the signing secret and verify it matches your .env

2. **Test using real subscription flows**
   - Create a test subscription through your actual UI
   - Monitor webhook events in Stripe Dashboard
   - Check your production logs

This is safer and doesn't require local dev setup changes.

## Recommended Approach

**For now, I recommend using the production webhook setup** since:
- Your production endpoint is already working
- You avoid temporary .env changes
- You can test with real flows
- Easier to debug with Dashboard monitoring

Would you like me to help you verify the production webhook configuration instead?
