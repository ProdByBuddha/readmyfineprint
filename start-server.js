import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import { createServer } from 'http';

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
      console.log(`Payment succeeded: ${paymentIntent.id} for $${paymentIntent.amount / 100}`);
      break;
    case 'payment_intent.payment_failed':
      console.log(`Payment failed: ${event.data.object.id}`);
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

// Serve static files
app.use(express.static('client/src'));
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ReadMyFinePrint - Donation</title>
      <script src="https://js.stripe.com/v3/"></script>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; }
        .donation-form { background: white; border: 1px solid #e6e6e6; border-radius: 8px; padding: 24px; }
        .amount-buttons { display: flex; gap: 10px; margin: 20px 0; }
        .amount-btn { padding: 12px 20px; border: 1px solid #ccc; border-radius: 6px; background: white; cursor: pointer; }
        .amount-btn:hover { background: #f0f0f0; }
        .amount-btn.selected { background: #0070f3; color: white; border-color: #0070f3; }
        #express-checkout-element { margin: 20px 0; min-height: 60px; }
        .loading { text-align: center; padding: 20px; color: #666; }
        .error { color: #e74c3c; padding: 10px; background: #fdf2f2; border-radius: 4px; margin: 10px 0; }
        .success { color: #27ae60; padding: 10px; background: #f2fdf2; border-radius: 4px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Support ReadMyFinePrint</h1>
        <p>Help us continue providing legal document analysis services</p>
        
        <div class="donation-form">
          <h3>Choose Donation Amount</h3>
          <div class="amount-buttons">
            <button class="amount-btn" data-amount="5">$5</button>
            <button class="amount-btn" data-amount="10">$10</button>
            <button class="amount-btn" data-amount="25">$25</button>
            <button class="amount-btn" data-amount="50">$50</button>
          </div>
          
          <div id="express-checkout-element">
            <div class="loading">Loading payment options...</div>
          </div>
          
          <div id="message"></div>
        </div>
      </div>

      <script>
        const stripe = Stripe('pk_live_51RWZgOC9Th2WdqbcMR7Sst10N0eZBUHfSyKvs38vqgJMf4d7x0YVOKaYJyKNQQRJLI4PVBe55xjh3YYdDQPQz8Rp00xdnZZltu');
        let elements;
        let expressCheckoutElement;
        let selectedAmount = 10; // Default amount

        // Initialize Express Checkout
        async function initializeExpressCheckout() {
          try {
            // Create payment intent
            const response = await fetch('/api/create-payment-intent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ amount: selectedAmount })
            });

            if (!response.ok) {
              throw new Error('Failed to create payment intent');
            }

            const { clientSecret } = await response.json();
            
            // Initialize elements
            elements = stripe.elements({
              clientSecret,
              appearance: { theme: 'stripe' }
            });

            // Create express checkout element
            expressCheckoutElement = elements.create('expressCheckout', {
              buttonType: { applePay: 'donate', googlePay: 'donate' },
              buttonTheme: { applePay: 'black', googlePay: 'black' },
              buttonHeight: 48,
              layout: { maxColumns: 1, maxRows: 4 }
            });

            // Mount the element
            expressCheckoutElement.mount('#express-checkout-element');

            // Handle payment confirmation
            expressCheckoutElement.on('confirm', async (event) => {
              const {error} = await stripe.confirmPayment({
                elements,
                confirmParams: { return_url: window.location.origin + '/success' },
                redirect: 'if_required'
              });

              if (error) {
                showMessage('Payment failed: ' + error.message, 'error');
              } else {
                showMessage('Payment successful! Thank you for your donation.', 'success');
              }
            });

          } catch (error) {
            console.error('Express checkout initialization failed:', error);
            showMessage('Failed to initialize payment system: ' + error.message, 'error');
          }
        }

        // Amount selection
        document.querySelectorAll('.amount-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            // Update selection
            document.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('selected'));
            e.target.classList.add('selected');
            selectedAmount = parseInt(e.target.dataset.amount);
            
            // Reinitialize with new amount
            if (expressCheckoutElement) {
              expressCheckoutElement.unmount();
            }
            document.getElementById('express-checkout-element').innerHTML = '<div class="loading">Loading payment options...</div>';
            await initializeExpressCheckout();
          });
        });

        // Show messages
        function showMessage(text, type = 'info') {
          const messageDiv = document.getElementById('message');
          messageDiv.textContent = text;
          messageDiv.className = type;
        }

        // Initialize on page load
        document.querySelector('.amount-btn[data-amount="10"]').classList.add('selected');
        initializeExpressCheckout();
      </script>
    </body>
    </html>
  `);
});

const server = createServer(app);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV}`);
  console.log(`💳 Stripe configured: ${!!process.env.STRIPE_SECRET_KEY}`);
  
  if (process.env.VITE_STRIPE_PUBLIC_KEY) {
    console.log(`🔑 Stripe public key: ${process.env.VITE_STRIPE_PUBLIC_KEY.substring(0, 12)}...`);
  }
});