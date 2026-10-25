import { fireEvent, render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MonthPicker } from '../MonthPicker';

vi.mock('../../hooks/useCurrentMonth', () => ({
  useCurrentMonth: () => ({
    currentMonthKey: '2026-10',
    monthLabel: 'Октябрь 2026',
  }),
}));

describe('MonthPicker UX & Accessibility Specifications', () => {
  let styleElement: HTMLStyleElement;

  beforeAll(() => {
    // jsdom does not run the Vite/Tailwind pipeline, so emulate the two
    // production rules that govern selection: the `.select-none` utility and
    // the global interactive-control rule from index.css.
    styleElement = document.createElement('style');
    styleElement.textContent = `
      .select-none { -webkit-user-select: none; -moz-user-select: none; user-select: none; }
      button, [role="button"] { -webkit-user-select: none; -moz-user-select: none; user-select: none; }
    `;
    document.head.appendChild(styleElement);
  });

  afterAll(() => {
    styleElement.remove();
  });

  it('should prevent text selection for native-like PWA experience', () => {
    render(<MonthPicker onPrevious={vi.fn()} onNext={vi.fn()} />);

    const textNode = screen.getByText('Октябрь 2026');
    const interactiveContainer = textNode.closest('button') ?? textNode;

    expect(interactiveContainer.className).toContain('select-none');
    expect(window.getComputedStyle(textNode).userSelect).toBe('none');

    for (const button of screen.getAllByRole('button')) {
      expect(window.getComputedStyle(button).userSelect).toBe('none');
    }
  });

  it('should enforce strict button semantic types', () => {
    render(<MonthPicker onPrevious={vi.fn()} onNext={vi.fn()} />);

    const actionableElements = screen.getAllByRole('button');
    expect(actionableElements).toHaveLength(2);

    actionableElements.forEach((element) => {
      expect(element.getAttribute('type')).toBe('button');
    });
  });

  it('should wire month navigation and disable the next arrow on the current month', () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    const { rerender } = render(<MonthPicker onPrevious={onPrevious} onNext={onNext} />);

    fireEvent.click(screen.getByRole('button', { name: 'Предыдущий месяц' }));
    fireEvent.click(screen.getByRole('button', { name: 'Следующий месяц' }));

    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);

    rerender(<MonthPicker onPrevious={onPrevious} onNext={onNext} canGoNext={false} />);

    const nextButton = screen.getByRole('button', { name: 'Следующий месяц' });
    expect((nextButton as HTMLButtonElement).disabled).toBe(true);
  });
});
