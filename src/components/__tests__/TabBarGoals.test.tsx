import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TabBar } from '@/components/TabBar';

describe('TabBar goals destination', () => {
  it('uses Goals as the right-side destination and keeps the centre action separate', () => {
    const onTabChange = vi.fn();
    const onAddClick = vi.fn();
    render(<TabBar activeTab="goals" onTabChange={onTabChange} onAddClick={onAddClick} />);

    fireEvent.click(screen.getByRole('button', { name: 'Цели' }));
    expect(onTabChange).toHaveBeenCalledWith('goals');
    expect(screen.queryByRole('button', { name: 'Отчёты' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Добавить транзакцию' }));
    expect(onAddClick).toHaveBeenCalledOnce();
  });
});
