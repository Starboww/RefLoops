// =============================================================================
// RefLoop — Clock
// Injectable time source so services are testable without mocking globals.
// Technical Design §3.2
// =============================================================================

export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** Fixed-time clock for deterministic unit tests */
export class FixedClock implements Clock {
  constructor(private readonly fixed: Date) {}
  now(): Date {
    return new Date(this.fixed);
  }
}
