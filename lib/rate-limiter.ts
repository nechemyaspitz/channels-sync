function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RateLimiter {
  private lastRequestTime = 0;
  private minInterval: number;

  constructor(requestsPerMinute: number) {
    this.minInterval = (60 * 1000) / requestsPerMinute;
  }

  async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minInterval) {
      await sleep(this.minInterval - elapsed);
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Check Webflow rate limit headers and pause if needed.
   */
  async handleResponse(response: Response): Promise<void> {
    const remaining = response.headers.get("x-ratelimit-remaining");
    if (remaining && parseInt(remaining) < 5) {
      const resetTime = response.headers.get("x-ratelimit-reset");
      if (resetTime) {
        const waitMs = parseInt(resetTime) * 1000 - Date.now();
        if (waitMs > 0) {
          await sleep(Math.min(waitMs, 60000));
        }
      } else {
        await sleep(10000);
      }
    }
  }
}
