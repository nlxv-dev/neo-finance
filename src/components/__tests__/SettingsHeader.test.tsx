import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsHeader } from '../SettingsHeader';

const setScrollY = (value: number) => {
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    writable: true,
    value,
  });
};

const hasOpacityUtility = (element: HTMLElement) =>
  Array.from(element.classList).some((className) => className.startsWith('opacity-'));

describe('SettingsHeader', () => {
  beforeEach(() => {
    setScrollY(0);
  });

  it('renders the provided title', () => {
    render(<SettingsHeader title="Оформление" onBack={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Оформление' })).toBeInTheDocument();
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

    expect(backButton).toHaveAttribute('type', 'button');
    expect(backButton).toHaveClass('rounded-2xl');
    expect(backButton).toHaveClass('neu-card-sm');
  });

  it('activates the isolated backdrop mask only while the page is scrolled', () => {
    render(<SettingsHeader title="Оформление" onBack={vi.fn()} />);

    const headerBg = screen.getByTestId('header-bg');
    const backButton = screen.getByRole('button', { name: 'Назад' });
    const title = screen.getByRole('heading', { name: 'Оформление' });

    expect(headerBg).toHaveClass('bg-transparent');
    expect(headerBg).not.toHaveClass('backdrop-blur-lg');
    expect(headerBg.style.maskImage).toBe('none');

    setScrollY(50);
    fireEvent.scroll(window);

    expect(headerBg).toHaveClass('bg-slate-50/40');
    expect(headerBg).toHaveClass('dark:bg-neutral-900/40');
    expect(headerBg).toHaveClass('backdrop-blur-lg');
    expect(headerBg.style.maskImage).toBe(
      'linear-gradient(to bottom, black 60%, transparent 100%)'
    );

    expect(title.style.maskImage).toBe('');
    expect(backButton.style.maskImage).toBe('');
    expect(hasOpacityUtility(backButton)).toBe(false);
    expect(hasOpacityUtility(title)).toBe(false);

    setScrollY(0);
    fireEvent.scroll(window);

    expect(headerBg.style.maskImage).toBe('none');
    expect(headerBg).toHaveClass('bg-transparent');
    expect(headerBg).not.toHaveClass('bg-slate-50/40');
    expect(headerBg).not.toHaveClass('backdrop-blur-lg');
  });

  it('pins the header to the top layer', () => {
    render(<SettingsHeader title="Язык" onBack={vi.fn()} />);

    const headerElement = screen.getByRole('banner');

    expect(headerElement).toHaveClass('sticky');
    expect(headerElement).toHaveClass('top-0');
    expect(headerElement).toHaveClass('z-50');
  });

  it('follows the Apple HIG grid and transparency rules', () => {
    render(<SettingsHeader title="Данные и бэкап" onBack={vi.fn()} />);

    const headerElement = screen.getByRole('banner');

    expect(headerElement).toHaveClass('px-4');
    expect(headerElement).toHaveClass('bg-transparent');
    expect(headerElement).toHaveClass('flex');
    expect(headerElement).toHaveClass('items-center');
    expect(headerElement).toHaveClass('justify-start');
    expect(headerElement).toHaveClass('select-none');
    expect(headerElement).not.toHaveClass('bg-white');
  });

  it('keeps the back button on the content grid without external offsets', () => {
    render(<SettingsHeader title="Оформление" onBack={vi.fn()} />);

    const backButton = screen.getByRole('button', { name: 'Назад' });

    expect(backButton).toHaveClass('h-10');
    expect(backButton).toHaveClass('w-10');
    expect(backButton).not.toHaveClass('ml-');
    expect(backButton).not.toHaveClass('mr-');

    const hasHorizontalMargin = Array.from(backButton.classList).some((className) =>
      /^-?m[lr]-/.test(className)
    );
    expect(hasHorizontalMargin).toBe(false);
  });

  it('aligns the title with the shared typography scale', () => {
    render(<SettingsHeader title="Категории" onBack={vi.fn()} />);

    const titleElement = screen.getByRole('heading', { name: 'Категории' });

    expect(titleElement).toHaveClass('ml-4');
    expect(titleElement).toHaveClass('text-xl');
    expect(titleElement).toHaveClass('font-semibold');
    expect(titleElement).toHaveClass('tracking-tight');
    expect(titleElement).toHaveClass('h-10');
  });
});
