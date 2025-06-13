import React, { ReactNode } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";

interface BasicStripeProviderProps {
  children: ReactNode;
}

// Initialize Stripe.js according to official docs: https://docs.stripe.com/js
const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;

if (!stripePublicKey) {
  console.error("VITE_STRIPE_PUBLIC_KEY is not set");
}

// Create the Stripe promise outside of component to avoid recreating
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

export function BasicStripeProvider({ children }: BasicStripeProviderProps) {
  if (!stripePromise) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-600">Stripe configuration error. Please check your environment variables.</p>
        <p className="text-sm text-gray-500 mt-2">Missing VITE_STRIPE_PUBLIC_KEY</p>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      {children}
    </Elements>
  );
}
