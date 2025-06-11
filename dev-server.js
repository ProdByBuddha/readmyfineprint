import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import { createServer } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

// Payment intent creation endpoint for Express Checkout
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const { amount } = req.body;
    
    console.log(`Creating payment intent for $${amount}`);
    
    if (!amount || amount < 0.5) {
      return res.status(400).json({ error: 'Invalid amount. Minimum $0.50 required.' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        donation_amount: amount.toString(),
        timestamp: new Date().toISOString(),
      },
    });

    console.log(`Payment intent created: ${paymentIntent.id}`);

    res.json({ 
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Payment intent creation failed:', error.message);
    res.status(500).json({ 
      error: 'Failed to create payment intent',
      details: error.message 
    });
  }
});

// Webhook endpoint for Stripe events
app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(`Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log(`✅ Payment succeeded: ${paymentIntent.id} for $${paymentIntent.amount / 100}`);
      break;
    case 'payment_intent.payment_failed':
      console.log(`❌ Payment failed: ${event.data.object.id}`);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({received: true});
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    stripe_configured: !!process.env.STRIPE_SECRET_KEY
  });
});

// Start development mode with Vite
async function startDevelopmentServer() {
  try {
    // Create Vite server
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
      root: 'client',
    });

    // Use vite's connect instance as middleware
    app.use(vite.ssrFixStacktrace);
    app.use(vite.middlewares);

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Development server running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV}`);
      console.log(`💳 Stripe configured: ${!!process.env.STRIPE_SECRET_KEY}`);
      
      if (process.env.VITE_STRIPE_PUBLIC_KEY) {
        console.log(`🔑 Stripe public key: ${process.env.VITE_STRIPE_PUBLIC_KEY.substring(0, 12)}...`);
      }
      console.log(`🌐 Visit: http://localhost:${PORT}`);
    });

    process.on('SIGTERM', () => {
      server.close(() => {
        vite.close();
      });
    });

  } catch (error) {
    console.error('Failed to start development server:', error);
    process.exit(1);
  }
}

startDevelopmentServer();