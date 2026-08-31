import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ConfirmDialogProvider,
  useConfirm,
} from '@/context/confirmDialogProvider';

function ConfirmHarness() {
  const confirm = useConfirm();
  const [result, setResult] = React.useState<string>('none');

  async function trigger() {
    const confirmed = await confirm('¿Eliminar esta unidad?');
    setResult(confirmed ? 'confirmed' : 'cancelled');
  }

  return (
    <div>
      <button type="button" onClick={trigger}>
        Trigger
      </button>
      <p>result: {result}</p>
    </div>
  );
}

describe('ConfirmDialogProvider / useConfirm', () => {
  it('resolves false and hides the dialog when cancelled', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmDialogProvider>
        <ConfirmHarness />
      </ConfirmDialogProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Trigger' }));

    expect(
      await screen.findByText('¿Eliminar esta unidad?'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(await screen.findByText('result: cancelled')).toBeInTheDocument();
    expect(
      screen.queryByText('¿Eliminar esta unidad?'),
    ).not.toBeInTheDocument();
  });

  it('resolves true when the destructive action is confirmed', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmDialogProvider>
        <ConfirmHarness />
      </ConfirmDialogProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Trigger' }));
    await screen.findByText('¿Eliminar esta unidad?');
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));

    expect(await screen.findByText('result: confirmed')).toBeInTheDocument();
  });

  it('throws when used outside the provider', () => {
    // Rendering without a provider should fail loudly rather than silently
    // no-op — the same contract every other Context hook in this repo uses.
    function Bare() {
      useConfirm();
      return null;
    }
    expect(() => render(<Bare />)).toThrow(
      'useConfirm must be used within a ConfirmDialogProvider',
    );
  });
});
