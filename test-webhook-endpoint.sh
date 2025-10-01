#!/bin/bash

echo "Testing webhook endpoint availability..."
echo ""

# Test if the endpoint responds
curl -X POST https://readmyfineprint.com/api/stripe-webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo ""
echo "Expected: 400 (Bad Request) - Missing signature is normal"
echo "This confirms the endpoint exists and requires valid Stripe signatures"
