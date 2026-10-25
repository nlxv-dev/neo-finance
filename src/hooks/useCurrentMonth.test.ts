import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMonthKey, useCurrentMonth } from './useCurrentMonth';

describe('getMonthKey', () => {
  it('pads single-digit months', () => {
    expect(getMonthKey(new Date(2026, 0, 15))).toBe('2026-01');
    expect(getMonthKey(new Date(2026, 11, 31))).toBe('2026-12');
  });
});

describe('useCurrentMonth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates the month when the minute timer crosses a boundary', () => {
    const { result } = renderHook(() => useCurrentMonth());

    expect(result.current.currentMonthKey).toBe('2026-01');
    expect(result.current.monthLabel).toBe('Январь 2026');

    act(() => {
      vi.setSystemTime(new Date(2026, 1, 1, 0, 0, 1));
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current.currentMonthKey).toBe('2026-02');
    expect(result.current.monthLabel).toBe('Февраль 2026');
  });

  it('synchronizes on window focus and visibilitychange', () => {
    const { result } = renderHook(() => useCurrentMonth());

    act(() => {
      vi.setSystemTime(new Date(2026, 2, 1, 9, 0, 0));
      window.dispatchEvent(new Event('focus'));
    });
    expect(result.current.currentMonthKey).toBe('2026-03');

    act(() => {
      vi.setSystemTime(new Date(2026, 3, 1, 9, 0, 0));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.currentMonthKey).toBe('2026-04');
  });
});
