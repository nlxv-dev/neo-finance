import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { BottomSheet } from '@/components/ui/BottomSheet';

function ControlledSheet() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open sheet</button>
      <button type="button">Outside action</button>
      <BottomSheet open={open} onClose={() => setOpen(false)} ariaLabel="Test sheet">
        <div className="p-5">
          <input aria-label="Amount" />
          <button type="button">Last action</button>
        </div>
      </BottomSheet>
    </>
  );
}

describe('BottomSheet interactions', () => {
  it('opens and closes through its visible controls', () => {
    render(<ControlledSheet />);
    fireEvent.click(screen.getByRole('button', { name: 'Open sheet' }));
    expect(screen.getByRole('dialog', { name: 'Test sheet' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(screen.getByTestId('bottom-sheet-dialog')).toHaveAttribute('aria-hidden', 'true');
  });

  it('does not steal focus, trap focus or close through an Escape shortcut', () => {
    render(<ControlledSheet />);
    const opener = screen.getByRole('button', { name: 'Open sheet' });
    const outsideAction = screen.getByRole('button', { name: 'Outside action' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Test sheet' });
    expect(opener).toHaveFocus();
    outsideAction.focus();
    expect(outsideAction).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(dialog).toBeInTheDocument();
  });

  it('closes through the backdrop tap', () => {
    render(<ControlledSheet />);
    fireEvent.click(screen.getByRole('button', { name: 'Open sheet' }));
    expect(screen.getByRole('dialog', { name: 'Test sheet' })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('bottom-sheet-backdrop'));
    expect(screen.getByTestId('bottom-sheet-dialog')).toHaveAttribute('aria-hidden', 'true');
  });
});
