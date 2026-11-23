/** Small in-memory sliding-window rate limiter (single process). */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private max: number, private windowMs: number) {
    setInterval(() => this.sweep(), Math.max(60_000, windowMs)).unref?.();
  }
  /** Returns seconds to wait, or 0 if allowed (and records the hit). */
  take(key: string): number {
    const now = Date.now();
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (arr.length >= this.max) {
      this.hits.set(key, arr);
      return Math.ceil((this.windowMs - (now - arr[0]!)) / 1000);
    }
    arr.push(now);
    this.hits.set(key, arr);
    return 0;
  }
  private sweep() {
    const now = Date.now();
    for (const [k, v] of this.hits) if (!v.some((t) => now - t < this.windowMs)) this.hits.delete(k);
  }
}
