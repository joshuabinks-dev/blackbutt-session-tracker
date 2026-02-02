export function nowISO(): string { return new Date().toISOString(); }
export function pad2(n: number): string { return String(n).padStart(2,"0"); }

export function formatMsTenths(ms: number): string {
  if (!Number.isFinite(ms)) return "0:00.0";
  const totalTenths = Math.round(ms / 100);
  const totalSeconds = totalTenths / 10;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  const t = Math.round((totalSeconds - Math.floor(totalSeconds)) * 10);
  return `${m}:${pad2(s)}.${t}`;
}

export function formatRestCountdown(startMs: number, durationSeconds: number, nowMs: number): { label: string; negative: boolean } {
  const elapsed = (nowMs - startMs) / 1000;
  const remaining = durationSeconds - elapsed;
  const negative = remaining < 0;
  const abs = Math.abs(remaining);
  const m = Math.floor(abs/60);
  const s = Math.floor(abs%60);
  const t = Math.floor((abs - Math.floor(abs))*10);
  const sign = negative ? "-" : "";
  return { label: `${sign}${m}:${pad2(s)}.${t}`, negative };
}
