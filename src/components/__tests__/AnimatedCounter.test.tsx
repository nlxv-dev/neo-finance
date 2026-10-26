import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnimatedCounter } from '@/components/AnimatedCounter';

describe('AnimatedCounter accessibility', () => {
  it('exposes a single readable formatted value and hides animated digit columns', () => {
    const { container } = render(<AnimatedCounter value={1234} />);
    expect(container.querySelector('.sr-only')).toHaveTextContent('1 234');
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toContain('123456789');
  });

  it('keeps digit columns keyed by numeric place when the value gains a digit', () => {
    const { container, rerender } = render(<AnimatedCounter value={999} />);
    const visualCounter = container.querySelector('[aria-hidden="true"]');
    expect(visualCounter).toBeInTheDocument();
    rerender(<AnimatedCounter value={1000} />);
    expect(container.querySelector('.sr-only')).toHaveTextContent('1 000');
    expect(container.querySelector('[aria-hidden="true"]')).toBe(visualCounter);
  });
});
