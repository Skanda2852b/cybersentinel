import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}

export function formatRelativeTime(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(d);
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length - 3) + '...';
}

export function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    CRITICAL: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400',
    HIGH: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400',
    MEDIUM: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400',
    LOW: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
    INFO: 'text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400',
  };
  return colors[severity] || colors.INFO;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    OPEN: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
    ACKNOWLEDGED: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400',
    INVESTIGATING: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400',
    RESOLVED: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400',
    FALSE_POSITIVE: 'text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400',
    CONTAINED: 'text-cyan-600 bg-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-400',
    ERADICATED: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400',
    RECOVERED: 'text-teal-600 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400',
    CLOSED: 'text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400',
  };
  return colors[status] || colors.OPEN;
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}