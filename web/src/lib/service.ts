const DAY_MS = 24 * 60 * 60 * 1000;

/** How far ahead the "due for service" list looks. */
export const SERVICE_DUE_WINDOW_DAYS = 14;

/**
 * Next service date: the last dated repair plus the interval, in calendar
 * months (31 Jan + 1 month = 28/29 Feb). Null without both.
 */
export function nextServiceDue(lastRepairAt: Date | null, intervalMonths: number | null): Date | null {
  if (!lastRepairAt || !intervalMonths) return null;
  const y = lastRepairAt.getUTCFullYear();
  const m = lastRepairAt.getUTCMonth() + intervalMonths;
  const lastDayOfTarget = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(lastRepairAt.getUTCDate(), lastDayOfTarget)));
}

/** Whole days from `now` until `due` (negative when overdue), counted in UTC calendar days. */
export function daysUntil(due: Date, now: Date = new Date()): number {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((due.getTime() - today) / DAY_MS);
}

/** Latest due date the "due for service" list includes. */
export function serviceDueCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() + SERVICE_DUE_WINDOW_DAYS * DAY_MS);
}
