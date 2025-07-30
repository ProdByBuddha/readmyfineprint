import React, { ReactNode } from "react";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";

interface BasicStripeProviderProps {
  children: ReactNode;
}

// Initialize Stripe.js according to official docs: https://docs.stripe.com/js
const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;

if (!stripePublicKey) {
  console.error("VITE_STRIPE_PUBLIC_KEY is not set");
}

// Fallback method to load Stripe.js directly via script tag
const loadStripeWithFallback = async (publicKey: string): Promise<Stripe | null> => {
  // Try the npm package method first
  try {
    console.log("📦 BasicStripeProvider: Trying @stripe/stripe-js loadStripe()...");
    const stripeInstance = await loadStripe(publicKey);
    if (stripeInstance) {
      console.log("✅ BasicStripeProvider: loadStripe worked");
      return stripeInstance;
    }
  } catch (error) {
    console.warn("⚠️ BasicStripeProvider: loadStripe failed:", error);
  }

  // Fallback to direct script loading
  return new Promise((resolve, reject) => {
    console.log("📦 BasicStripeProvider: Trying direct script loading...");
    
    // Check if Stripe is already loaded
    if ((window as any).Stripe) {
      console.log("✅ BasicStripeProvider: Stripe already available");
      resolve((window as any).Stripe(publicKey));
      return;
    }

    // Create script element
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;

    script.onload = () => {
      console.log("✅ BasicStripeProvider: Direct script loading worked");
      if ((window as any).Stripe) {
        resolve((window as any).Stripe(publicKey));
      } else {
        reject(new Error("Stripe object not found after script load"));
      }
    };

    script.onerror = (error) => {
      console.error("❌ BasicStripeProvider: Direct script loading failed:", error);
      reject(new Error("Failed to load Stripe.js script"));
    };

    document.head.appendChild(script);
  });
};

// Create the Stripe promise outside of component to avoid recreating
const stripePromise = stripePublicKey ? loadStripeWithFallback(stripePublicKey) : null;

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
