import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  formatDate,
  formatRelativeTime,
  truncate,
  getSeverityColor,
  getStatusColor,
  debounce,
} from '@/utils/helpers';

afterEach(() => {
  vi.useRealTimers();
});

describe('formatDate', () => {
  it('formats a date string with default options', () => {
    const result = formatDate('2024-01-15T10:30:45.123Z');
    expect(result).toContain('2024');
    expect(result).toContain('Jan');
    expect(result).toContain('15');
  });

  it('formats a Date object', () => {
    const result = formatDate(new Date('2024-01-15T10:30:45.123Z'));
    expect(result).toContain('2024');
  });

  it('accepts custom Intl options', () => {
    const result = formatDate('2024-01-15T10:30:45.123Z', { weekday: 'long' });
    expect(result).toContain('Monday');
  });
});

describe('formatRelativeTime', () => {
  it('returns "just now" for sub-minute differences', () => {
    vi.setSystemTime(new Date('2024-01-15T10:30:00Z'));
    const result = formatRelativeTime('2024-01-15T10:29:55Z');
    expect(result).toBe('just now');
  });

  it('returns minutes ago', () => {
    vi.setSystemTime(new Date('2024-01-15T10:30:00Z'));
    const result = formatRelativeTime('2024-01-15T10:25:00Z');
    expect(result).toBe('5m ago');
  });

  it('returns hours ago', () => {
    vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));
    const result = formatRelativeTime('2024-01-15T08:00:00Z');
    expect(result).toBe('2h ago');
  });

  it('returns days ago', () => {
    vi.setSystemTime(new Date('2024-01-20T10:00:00Z'));
    const result = formatRelativeTime('2024-01-15T10:00:00Z');
    expect(result).toBe('5d ago');
  });

  it('falls back to formatDate for older dates', () => {
    vi.setSystemTime(new Date('2024-02-01T10:00:00Z'));
    const result = formatRelativeTime('2024-01-15T10:00:00Z');
    expect(result).toContain('2024');
  });
});

describe('truncate', () => {
  it('returns short strings unchanged', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates long strings with ellipsis', () => {
    expect(truncate('hello world', 8)).toBe('hello...');
  });

  it('truncates to exact length', () => {
    expect(truncate('abcdefgh', 5)).toBe('ab...');
  });
});

describe('getSeverityColor', () => {
  it('returns CRITICAL color', () => {
    expect(getSeverityColor('CRITICAL')).toContain('text-red-600');
  });

  it('returns HIGH color', () => {
    expect(getSeverityColor('HIGH')).toContain('text-orange-600');
  });

  it('returns MEDIUM color', () => {
    expect(getSeverityColor('MEDIUM')).toContain('text-yellow-600');
  });

  it('returns LOW color', () => {
    expect(getSeverityColor('LOW')).toContain('text-blue-600');
  });

  it('returns INFO color', () => {
    expect(getSeverityColor('INFO')).toContain('text-gray-600');
  });

  it('falls back to INFO for unknown severity', () => {
    expect(getSeverityColor('UNKNOWN')).toBe(getSeverityColor('INFO'));
  });
});

describe('getStatusColor', () => {
  it('returns OPEN color', () => {
    expect(getStatusColor('OPEN')).toContain('text-blue-600');
  });

  it('returns ACKNOWLEDGED color', () => {
    expect(getStatusColor('ACKNOWLEDGED')).toContain('text-purple-600');
  });

  it('returns INVESTIGATING color', () => {
    expect(getStatusColor('INVESTIGATING')).toContain('text-amber-600');
  });

  it('returns RESOLVED color', () => {
    expect(getStatusColor('RESOLVED')).toContain('text-green-600');
  });

  it('returns FALSE_POSITIVE color', () => {
    expect(getStatusColor('FALSE_POSITIVE')).toContain('text-gray-600');
  });

  it('falls back to OPEN for unknown status', () => {
    expect(getStatusColor('UNKNOWN')).toBe(getStatusColor('OPEN'));
  });
});

describe('debounce', () => {
  it('delays function execution', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('a');
    debounced('b');
    debounced('c');

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith('c');
  });

  it('resets timer on subsequent calls', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('a');
    vi.advanceTimersByTime(50);
    debounced('b');
    vi.advanceTimersByTime(60);

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith('b');
  });
});
