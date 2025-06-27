/**
 * Circuit Breaker Pattern Implementation
 * Provides fault tolerance for external service calls and database operations
 */

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, failing fast
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number;    // Number of failures before opening
  resetTimeout: number;        // Time to wait before attempting recovery (ms)
  monitoringWindow: number;    // Time window for failure counting (ms)
  successThreshold?: number;   // Successful calls needed to close from half-open
  name?: string;              // Circuit breaker name for logging
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  totalCalls: number;
  circuitOpenTime: number | null;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private totalCalls: number = 0;
  private circuitOpenTime: number | null = null;
  private readonly config: Required<CircuitBreakerConfig>;

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      successThreshold: 3,
      name: 'CircuitBreaker',
      ...config
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    this.totalCalls++;

    // Check if circuit should transition from OPEN to HALF_OPEN
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset(now)) {
        this.state = CircuitState.HALF_OPEN;
        console.log(`[${this.config.name}] Circuit transitioning to HALF_OPEN`);
      } else {
        throw new Error(`Circuit breaker is OPEN. Service unavailable until ${new Date(this.circuitOpenTime! + this.config.resetTimeout).toISOString()}`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess(now);
      return result;
    } catch (error) {
      this.onFailure(now, error);
      throw error;
    }
  }

  private onSuccess(now: number): void {
    this.lastSuccessTime = now;
    this.successes++;

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successes >= this.config.successThreshold) {
        this.reset();
        console.log(`[${this.config.name}] Circuit closed after ${this.successes} successful calls`);
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on successful operation
      this.resetFailureCount();
    }
  }

  private onFailure(now: number, error: any): void {
    this.lastFailureTime = now;
    this.failures++;

    console.error(`[${this.config.name}] Circuit breaker failure (${this.failures}/${this.config.failureThreshold}):`, error.message);

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in HALF_OPEN goes back to OPEN
      this.openCircuit(now);
    } else if (this.state === CircuitState.CLOSED) {
      // Check if we should open the circuit
      if (this.shouldOpenCircuit(now)) {
        this.openCircuit(now);
      }
    }
  }

  private shouldOpenCircuit(now: number): boolean {
    if (this.failures >= this.config.failureThreshold) {
      // Check if failures occurred within the monitoring window
      if (this.lastFailureTime && (now - this.lastFailureTime) <= this.config.monitoringWindow) {
        return true;
      }
    }
    return false;
  }

  private shouldAttemptReset(now: number): boolean {
    return this.circuitOpenTime !== null && 
           (now - this.circuitOpenTime) >= this.config.resetTimeout;
  }

  private openCircuit(now: number): void {
    this.state = CircuitState.OPEN;
    this.circuitOpenTime = now;
    this.successes = 0; // Reset success count
    console.error(`[${this.config.name}] Circuit breaker OPENED after ${this.failures} failures. Will retry in ${this.config.resetTimeout}ms`);
  }

  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.circuitOpenTime = null;
  }

  private resetFailureCount(): void {
    this.failures = 0;
  }

  /**
   * Get current circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalCalls: this.totalCalls,
      circuitOpenTime: this.circuitOpenTime
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get health status
   */
  isHealthy(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  /**
   * Force circuit to open (for testing or manual intervention)
   */
  forceOpen(): void {
    this.openCircuit(Date.now());
  }

  /**
   * Force circuit to close (for testing or manual intervention)
   */
  forceClose(): void {
    this.reset();
  }
}

/**
 * Circuit breaker factory for common configurations
 */
export class CircuitBreakerFactory {
  /**
   * Database circuit breaker configuration
   */
  static createDatabaseCircuitBreaker(name: string = 'Database'): CircuitBreaker {
    return new CircuitBreaker({
      failureThreshold: 5,        // Open after 5 failures
      resetTimeout: 30000,        // Wait 30 seconds before retry
      monitoringWindow: 60000,    // Count failures within 1 minute
      successThreshold: 3,        // Need 3 successes to close
      name
    });
  }

  /**
   * External API circuit breaker configuration
   */
  static createApiCircuitBreaker(name: string = 'ExternalAPI'): CircuitBreaker {
    return new CircuitBreaker({
      failureThreshold: 3,        // Open after 3 failures
      resetTimeout: 60000,        // Wait 1 minute before retry
      monitoringWindow: 120000,   // Count failures within 2 minutes
      successThreshold: 2,        // Need 2 successes to close
      name
    });
  }

  /**
   * Critical service circuit breaker configuration
   */
  static createCriticalServiceCircuitBreaker(name: string = 'CriticalService'): CircuitBreaker {
    return new CircuitBreaker({
      failureThreshold: 2,        // Open after 2 failures
      resetTimeout: 120000,       // Wait 2 minutes before retry
      monitoringWindow: 300000,   // Count failures within 5 minutes
      successThreshold: 5,        // Need 5 successes to close
      name
    });
  }
}