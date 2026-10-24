import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsHeader } from '../SettingsHeader';

describe('SettingsHeader', () => {
  it('renders the provided title', () => {
    render(<SettingsHeader title="Оформление" onBack={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Оформление' })).toBeTruthy();
  });

  it('calls onBack exactly once when the back button is clicked', () => {
    const onBack = vi.fn();
    render(<SettingsHeader title="Категории" onBack={onBack} />);

    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('uses the reference back-button styling and semantics', () => {
    render(<SettingsHeader title="Данные и бэкап" onBack={vi.fn()} />);

    const backButton = screen.getByRole('button', { name: 'Назад' });

    expect(backButton.getAttribute('type')).toBe('button');
    expect(backButton.className).toContain('rounded-2xl');
    expect(backButton.className).toContain('neu-card-sm');
  });

  it('keeps the header transparent and protected from text selection', () => {
    const { container } = render(<SettingsHeader title="О Neo Finance" onBack={vi.fn()} />);

    const header = container.querySelector('header');
    expect(header).not.toBeNull();

    const headerClasses = header?.className ?? '';
    expect(headerClasses).toContain('select-none');
    expect(headerClasses).toContain('bg-transparent');
    expect(headerClasses).toContain('px-4');
    expect(headerClasses).not.toContain('bg-white');
    expect(headerClasses).not.toContain('rounded-');
    expect(headerClasses).not.toContain('shadow-');
    expect(headerClasses).not.toContain('border-');
  });
});
