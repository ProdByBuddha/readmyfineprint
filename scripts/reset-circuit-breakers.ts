#!/usr/bin/env tsx
/**
 * Reset database circuit breakers when they're stuck in OPEN state
 */

import { getCircuitBreakers, getDatabaseStatus } from "../server/db-with-fallback";

async function resetCircuitBreakers() {
  console.log("🔧 Database Circuit Breaker Reset Tool\n");
  
  // Get current status
  const status = getDatabaseStatus();
  console.log("Current Database Status:");
  console.log("- Current DB:", status.currentDatabase);
  console.log("- Neon Circuit Breaker:", status.circuitBreakers.neon.state);
  console.log("- Local Circuit Breaker:", status.circuitBreakers.local.state);
  console.log();

  // Get circuit breaker instances
  const { neon, local } = getCircuitBreakers();
  
  // Reset Neon circuit breaker if needed
  if (status.circuitBreakers.neon.state !== 'CLOSED') {
    console.log("🔄 Resetting Neon circuit breaker...");
    neon.forceClose();
    console.log("✅ Neon circuit breaker reset to CLOSED state");
  } else {
    console.log("✓ Neon circuit breaker is already in CLOSED state");
  }
  
  // Reset Local circuit breaker if needed
  if (status.circuitBreakers.local.state !== 'CLOSED') {
    console.log("🔄 Resetting Local circuit breaker...");
    local.forceClose();
    console.log("✅ Local circuit breaker reset to CLOSED state");
  } else {
    console.log("✓ Local circuit breaker is already in CLOSED state");
  }
  
  // Get updated status
  const updatedStatus = getDatabaseStatus();
  console.log("\nUpdated Database Status:");
  console.log("- Neon Circuit Breaker:", updatedStatus.circuitBreakers.neon.state);
  console.log("- Local Circuit Breaker:", updatedStatus.circuitBreakers.local.state);
  
  console.log("\n✨ Circuit breakers have been reset. Try starting the server again.");
  console.log("💡 If the issue persists, check your database connection strings in .env");
}

// Run the reset
resetCircuitBreakers().catch(console.error);