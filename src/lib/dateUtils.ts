import { format, isValid } from 'date-fns';

export const safeDate = (value: unknown, fallback: Date = new Date()): Date => {
  if (!value) return fallback;
  if (value instanceof Date) {
    return isValid(value) ? value : fallback;
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as any).toDate === 'function') {
    const d = (value as any).toDate();
    return isValid(d) ? d : fallback;
  }
  const parsed = new Date(value as string | number);
  return isValid(parsed) ? parsed : fallback;
};

export const safeFormatDate = (
  value: unknown,
  formatStr: string = 'PPP',
  fallbackText: string = 'N/A'
): string => {
  if (!value) return fallbackText;
  const parsed = safeDate(value, new Date(NaN));
  if (!isValid(parsed)) return fallbackText;
  try {
    return format(parsed, formatStr);
  } catch {
    return fallbackText;
  }
};
