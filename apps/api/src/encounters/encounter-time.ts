const INDIA_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

export function hospitalDate(now: Date): string {
  return new Date(now.getTime() + INDIA_OFFSET_MS).toISOString().slice(0, 10);
}

export function hospitalDayBounds(now: Date) {
  const date = hospitalDate(now);
  const from = new Date(`${date}T00:00:00+05:30`);
  return { date, from, until: new Date(from.getTime() + DAY_MS) };
}
