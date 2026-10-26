import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DayPicker } from '@/components/DayPicker';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-26T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DayPicker', () => {
  it('labels today and prevents navigating into the future', () => {
    render(
      <DayPicker
        date={new Date(2026, 9, 26)}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        canGoNext={false}
      />,
    );

    expect(screen.getByText('Сегодня')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Следующий день' })).toBeDisabled();
  });

  it('shows yesterday and calls the previous-day action', () => {
    const onPrevious = vi.fn();
    render(
      <DayPicker
        date={new Date(2026, 9, 25)}
        onPrevious={onPrevious}
        onNext={vi.fn()}
      />,
    );

    expect(screen.getByText('Вчера')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Предыдущий день' }));
    expect(onPrevious).toHaveBeenCalledOnce();
  });
});
