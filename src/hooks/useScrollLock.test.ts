import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useScrollLock } from './useScrollLock';

describe('useScrollLock', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('keeps the body locked until the last consumer releases it', () => {
    const first = renderHook(() => useScrollLock(true));
    expect(document.body.style.overflow).toBe('hidden');

    const second = renderHook(() => useScrollLock(true));
    expect(document.body.style.overflow).toBe('hidden');

    first.unmount();
    expect(document.body.style.overflow).toBe('hidden');

    second.unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('does not touch the body when unlocked', () => {
    renderHook(() => useScrollLock(false));

    expect(document.body.style.overflow).toBe('');
  });
});
