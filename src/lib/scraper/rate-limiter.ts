export class RateLimiter {
  private lastRequest = 0;
  private readonly minIntervalMs: number;

  constructor(requestsPerSecond = 2) {
    this.minIntervalMs = 1000 / requestsPerSecond;
  }

  async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequest;
    if (elapsed < this.minIntervalMs) {
      const jitter = Math.random() * 200;
      await new Promise((resolve) => setTimeout(resolve, this.minIntervalMs - elapsed + jitter));
    }
    this.lastRequest = Date.now();
  }
}
