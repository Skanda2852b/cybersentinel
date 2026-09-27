import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  cn,
  truncate,
  getSeverityColor,
  getStatusColor,
  formatDate,
  formatRelativeTime,
  debounce,
} from './helpers';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('resolves conflicting tailwind classes with the last one winning', () => {
    expect(cn('px-2 px-4')).toBe('px-4');
  });

  it('ignores falsy values', () => {
    expect(cn('a', false && 'b', undefined, null)).toBe('a');
  });
});

describe('truncate', () => {
  it('returns short strings unchanged', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates long strings with an ellipsis', () => {
    expect(truncate('hello world', 8)).toBe('hello...');
  });
});

describe('getSeverityColor', () => {
  it('maps known severities', () => {
    expect(getSeverityColor('CRITICAL')).toContain('red');
    expect(getSeverityColor('HIGH')).toContain('orange');
    expect(getSeverityColor('MEDIUM')).toContain('yellow');
    expect(getSeverityColor('LOW')).toContain('blue');
    expect(getSeverityColor('INFO')).toContain('gray');
  });

  it('falls back to INFO styling for unknown severities', () => {
    expect(getSeverityColor('SOMETHING_ELSE')).toBe(getSeverityColor('INFO'));
  });
});

describe('getStatusColor', () => {
  it('maps known statuses', () => {
    expect(getStatusColor('OPEN')).toContain('blue');
    expect(getStatusColor('RESOLVED')).toContain('green');
    expect(getStatusColor('FALSE_POSITIVE')).toContain('gray');
  });

  it('falls back to OPEN styling for unknown statuses', () => {
    expect(getStatusColor('WHATEVER')).toBe(getStatusColor('OPEN'));
  });
});

describe('formatDate', () => {
  it('includes the year and month for a known date', () => {
    const out = formatDate('2024-01-15T10:30:00Z');
    expect(out).toContain('2024');
    expect(out).toContain('Jan');
  });
});

describe('formatRelativeTime', () => {
  it('says just now for recent dates', () => {
    expect(formatRelativeTime(new Date())).toBe('just now');
  });

  it('formats minutes, hours and days ago', () => {
    const now = Date.now();
    expect(formatRelativeTime(new Date(now - 5 * 60000))).toBe('5m ago');
    expect(formatRelativeTime(new Date(now - 3 * 3600000))).toBe('3h ago');
    expect(formatRelativeTime(new Date(now - 2 * 86400000))).toBe('2d ago');
  });
});

describe('debounce', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls the function once after the delay', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced('a');
    debounced('b');
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('b');
  });
});
