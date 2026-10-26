import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GoalsScreen } from '@/components/GoalsScreen';

function renderEmptyGoals() {
  return render(
    <GoalsScreen
      goals={[]}
      totalSaved={0}
      totalTarget={0}
      overallProgress={0}
      activeCount={0}
      completedCount={0}
      canWrite
      onAddGoal={vi.fn(() => true)}
      onUpdateGoal={vi.fn(() => true)}
      onDeleteGoal={vi.fn(() => true)}
      onAddProgress={vi.fn(() => true)}
      onReduceProgress={vi.fn(() => true)}
    />,
  );
}

describe('GoalsScreen', () => {
  it('shows an honest empty state instead of seeded demo goals', () => {
    renderEmptyGoals();
    expect(screen.getByRole('heading', { name: 'Цели' })).toBeTruthy();
    expect(screen.getByText('Цели пока не добавлены')).toBeTruthy();
    expect(screen.queryByText('Подушка безопасности')).toBeNull();
  });

  it('opens the create-goal sheet and explains that it does not reserve account funds', () => {
    renderEmptyGoals();
    fireEvent.click(screen.getByRole('button', { name: 'Новая цель' }));
    expect(screen.getByRole('dialog', { name: 'Новая цель' })).toBeTruthy();
    expect(screen.getByText(/не резервирует деньги на счёте/i)).toBeTruthy();
  });
});
