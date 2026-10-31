import type { Medicine } from "./prescription-draft";
type Fetcher = (term: string, signal: AbortSignal) => Promise<Medicine[]>;
export class MedicineSearchClient {
  private readonly fetcher: Fetcher;
  private readonly now: () => number;
  private readonly cache = new Map<
    string,
    { expires: number; items: Medicine[] }
  >();
  constructor(fetcher: Fetcher, now: () => number = Date.now) {
    this.fetcher = fetcher;
    this.now = now;
  }
  async search(
    term: string,
    signal: AbortSignal,
    refresh = false,
  ): Promise<Medicine[]> {
    const query = term.trim();
    const key = query.toLowerCase();
    if (query.length < 2 || query.length > 100) return [];
    if (signal.aborted)
      throw new DOMException("Search cancelled.", "AbortError");
    const hit = this.cache.get(key);
    if (!refresh && hit && hit.expires > this.now()) return hit.items;
    if (!refresh)
      await new Promise<void>((resolve, reject) => {
        const abort = () => {
          clearTimeout(timer);
          reject(new DOMException("Search cancelled.", "AbortError"));
        };
        const timer = setTimeout(() => {
          signal.removeEventListener("abort", abort);
          resolve();
        }, 200);
        signal.addEventListener("abort", abort, { once: true });
      });
    if (signal.aborted)
      throw new DOMException("Search cancelled.", "AbortError");
    const items = await this.fetcher(query, signal);
    if (signal.aborted)
      throw new DOMException("Search cancelled.", "AbortError");
    this.cache.delete(key);
    this.cache.set(key, { items, expires: this.now() + 30000 });
    while (this.cache.size > 20)
      this.cache.delete(this.cache.keys().next().value!);
    return items;
  }
}
