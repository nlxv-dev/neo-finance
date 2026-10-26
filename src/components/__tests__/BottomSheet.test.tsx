import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

describe('BottomSheet focus management', () => {
  it('moves focus into the sheet and restores focus to its opener when closed', async () => {
    render(<ControlledSheet />);
    const opener = screen.getByRole('button', { name: 'Open sheet' });
    opener.focus();

    fireEvent.click(opener);
    expect(await screen.findByRole('dialog', { name: 'Test sheet' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveFocus());

    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(opener).toHaveFocus();
  });

  it('contains Tab and Shift+Tab in the sheet', async () => {
    render(<ControlledSheet />);
    fireEvent.click(screen.getByRole('button', { name: 'Open sheet' }));
    const dialog = await screen.findByRole('dialog', { name: 'Test sheet' });
    const closeButton = screen.getByRole('button', { name: 'Закрыть' });
    const lastAction = screen.getByRole('button', { name: 'Last action' });

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveFocus());
    lastAction.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(lastAction).toHaveFocus();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('redirects focus back into the open sheet if focus is moved outside', async () => {
    render(<ControlledSheet />);
    fireEvent.click(screen.getByRole('button', { name: 'Open sheet' }));
    await screen.findByRole('dialog', { name: 'Test sheet' });
    const outsideAction = screen.getByRole('button', { name: 'Outside action' });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveFocus());
    outsideAction.focus();
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveFocus();
  });
});
