import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TabBar } from '@/components/TabBar';

describe('TabBar goals destination', () => {
  it('exposes a labeled navigation landmark and marks the active destination', () => {
    render(<TabBar activeTab="wallet" onTabChange={vi.fn()} onAddClick={vi.fn()} />);
    expect(screen.getByRole('navigation', { name: 'Основная навигация' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Кошелёк' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Главная' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: 'Добавить транзакцию' })).not.toHaveAttribute('aria-current');
  });

  it('uses Goals as the right-side destination and keeps the centre action separate', () => {
    const onTabChange = vi.fn();
    const onAddClick = vi.fn();
    render(<TabBar activeTab="goals" onTabChange={onTabChange} onAddClick={onAddClick} />);

    fireEvent.click(screen.getByRole('button', { name: 'Цели' }));
    expect(onTabChange).toHaveBeenCalledWith('goals');
    expect(screen.queryByRole('button', { name: 'Отчёты' })).toBeNull();

    const addButton = screen.getByRole('button', { name: 'Добавить транзакцию' });
    expect(addButton).not.toHaveAttribute('aria-current');
    expect(addButton).toHaveClass('active:scale-90');
    expect(addButton.style.transform).toBe('');
    fireEvent.click(addButton);
    expect(onAddClick).toHaveBeenCalledOnce();
  });
});
